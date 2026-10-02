"""BERSINAR POS backend regression tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL",
                          open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0]).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "citerxciter.citer@gmail.com", "password": "bersinar123"}
KASIR = {"email": "kasir@bersinar.id", "password": "kasir123"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("role") == "admin"
    assert data.get("token")
    return data["token"]


@pytest.fixture(scope="session")
def kasir_token():
    r = requests.post(f"{API}/auth/login", json=KASIR, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def kasir_h(kasir_token):
    return {"Authorization": f"Bearer {kasir_token}"}


# ---------- Auth ----------
class TestAuth:
    def test_login_admin_sets_cookie_and_token(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200
        assert "access_token" in r.cookies or any("access_token" in c for c in r.headers.get("set-cookie", ""))
        body = r.json()
        assert body["role"] == "admin"
        assert isinstance(body["token"], str) and len(body["token"]) > 20

    def test_login_kasir(self):
        r = requests.post(f"{API}/auth/login", json=KASIR, timeout=30)
        assert r.status_code == 200
        assert r.json()["role"] == "kasir"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "wrong@x.com", "password": "bad"}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_with_bearer(self, admin_h):
        r = requests.get(f"{API}/auth/me", headers=admin_h, timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN["email"]


# ---------- Products / Catalog ----------
class TestProducts:
    def test_list_products_has_12_seeded(self, admin_h):
        r = requests.get(f"{API}/products", headers=admin_h, timeout=30)
        assert r.status_code == 200
        prods = r.json()
        assert len(prods) >= 12
        # verify no _id leaking
        assert all("_id" not in p for p in prods)
        # verify tiers + locations shape
        p = prods[0]
        assert "tiers" in p and "locations" in p and "total_stock" in p

    def test_filter_by_category(self, admin_h):
        r = requests.get(f"{API}/products?category=Sayur", headers=admin_h, timeout=30)
        assert r.status_code == 200
        for p in r.json():
            assert p["category"] == "Sayur"

    def test_search(self, admin_h):
        r = requests.get(f"{API}/products?search=Bayam", headers=admin_h, timeout=30)
        assert r.status_code == 200
        assert any("Bayam" in p["name"] for p in r.json())

    def test_crud_product(self, admin_h):
        payload = {
            "name": "TEST_Semangka", "category": "Buah", "unit": "Kg",
            "is_decimal_allowed": True, "min_stock_alert": 5,
            "tiers": [{"tier_name": "Eceran", "min_qty": 1, "price": 15000},
                      {"tier_name": "Grosir", "min_qty": 5, "price": 13000}],
            "locations": [{"location_name": "Gudang Utama", "stock_quantity": 20, "cogs_price": 10000}],
        }
        r = requests.post(f"{API}/products", json=payload, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        # Get
        g = requests.get(f"{API}/products/{pid}", headers=admin_h, timeout=30)
        assert g.status_code == 200
        assert g.json()["name"] == "TEST_Semangka"
        assert len(g.json()["tiers"]) == 2
        # Update
        payload["name"] = "TEST_Semangka Edit"
        u = requests.put(f"{API}/products/{pid}", json=payload, headers=admin_h, timeout=30)
        assert u.status_code == 200
        assert u.json()["name"] == "TEST_Semangka Edit"
        # Delete
        d = requests.delete(f"{API}/products/{pid}", headers=admin_h, timeout=30)
        assert d.status_code == 200
        g2 = requests.get(f"{API}/products/{pid}", headers=admin_h, timeout=30)
        assert g2.status_code == 404


# ---------- Inventory ----------
class TestInventory:
    def test_inventory_list(self, admin_h):
        r = requests.get(f"{API}/inventory?location=Gudang Utama", headers=admin_h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        assert all(i["location_name"] == "Gudang Utama" for i in data)

    def test_inventory_adjust(self, admin_h):
        prods = requests.get(f"{API}/products", headers=admin_h, timeout=30).json()
        pid = prods[0]["id"]
        r = requests.post(
            f"{API}/inventory/adjust",
            params={"product_id": pid, "location_name": "Gudang Utama", "new_qty": 99},
            headers=admin_h, timeout=30)
        assert r.status_code == 200
        inv = requests.get(f"{API}/inventory?location=Gudang Utama", headers=admin_h, timeout=30).json()
        item = next(i for i in inv if i["product_id"] == pid)
        assert item["stock_quantity"] == 99


# ---------- Checkout + Tier Pricing ----------
class TestCheckout:
    def _find(self, admin_h, name_contains):
        prods = requests.get(f"{API}/products", headers=admin_h, timeout=30).json()
        return next(p for p in prods if name_contains in p["name"])

    def test_cash_checkout(self, admin_h):
        p = self._find(admin_h, "Minyak Goreng")
        payload = {
            "location_name": "Gudang Utama",
            "items": [{"product_id": p["id"], "qty": 1}],
            "payment_method": "Cash", "amount_paid": 50000,
        }
        r = requests.post(f"{API}/transactions", json=payload, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["payment_status"] == "paid"
        assert t["change"] == round(50000 - t["total_amount"], 2)
        assert t["items"][0]["applied_unit_price"] == 38000  # Eceran
        assert "_id" not in t
        assert all("_id" not in i for i in t["items"])

    def test_tier_pricing_bayam_5kg(self, admin_h):
        p = self._find(admin_h, "Bayam")
        payload = {
            "location_name": "Gudang Utama",
            "items": [{"product_id": p["id"], "qty": 5}],
            "payment_method": "Cash", "amount_paid": 50000,
        }
        r = requests.post(f"{API}/transactions", json=payload, headers=admin_h, timeout=30)
        assert r.status_code == 200
        assert r.json()["items"][0]["applied_unit_price"] == 10000  # Grosir tier

    def test_credit_overlimit_blocked(self, admin_h):
        # create low-limit customer
        c = requests.post(f"{API}/customers",
                          json={"name": "TEST_LowLimit", "credit_limit": 10000, "payment_terms_days": 7},
                          headers=admin_h, timeout=30).json()
        p = self._find(admin_h, "Beras")
        r = requests.post(f"{API}/transactions", json={
            "location_name": "Gudang Utama", "customer_id": c["id"],
            "items": [{"product_id": p["id"], "qty": 1}],
            "payment_method": "Credit", "amount_paid": 0,
        }, headers=admin_h, timeout=30)
        assert r.status_code == 400
        assert "limit" in r.text.lower()
        requests.delete(f"{API}/customers/{c['id']}", headers=admin_h, timeout=30)

    def test_credit_success_increments_current_credit(self, admin_h):
        c = requests.post(f"{API}/customers",
                          json={"name": "TEST_B2B", "credit_limit": 500000, "payment_terms_days": 14},
                          headers=admin_h, timeout=30).json()
        p = self._find(admin_h, "Gula Pasir")
        r = requests.post(f"{API}/transactions", json={
            "location_name": "Gudang Utama", "customer_id": c["id"],
            "items": [{"product_id": p["id"], "qty": 1}],
            "payment_method": "Credit", "amount_paid": 0,
        }, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        txn = r.json()
        assert txn["payment_status"] == "unpaid"
        # verify customer current_credit
        custs = requests.get(f"{API}/customers", headers=admin_h, timeout=30).json()
        updated = next(x for x in custs if x["id"] == c["id"])
        assert updated["current_credit"] == txn["total_amount"]
        # pay off
        pay = requests.post(f"{API}/credit-payments", json={
            "customer_id": c["id"], "transaction_id": txn["id"],
            "payment_amount": txn["total_amount"], "payment_method": "Cash",
        }, headers=admin_h, timeout=30)
        assert pay.status_code == 200
        custs2 = requests.get(f"{API}/customers", headers=admin_h, timeout=30).json()
        assert next(x for x in custs2 if x["id"] == c["id"])["current_credit"] == 0
        requests.delete(f"{API}/customers/{c['id']}", headers=admin_h, timeout=30)


# ---------- Waste ----------
class TestWaste:
    def test_create_waste_reduces_stock(self, admin_h):
        prods = requests.get(f"{API}/products?category=Sayur", headers=admin_h, timeout=30).json()
        p = prods[0]
        # ensure stock
        requests.post(f"{API}/inventory/adjust",
                      params={"product_id": p["id"], "location_name": "Gudang Utama", "new_qty": 50},
                      headers=admin_h, timeout=30)
        r = requests.post(f"{API}/waste", json={
            "product_id": p["id"], "location_name": "Gudang Utama",
            "qty": 2, "reason": "Busuk"
        }, headers=admin_h, timeout=30)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["total_loss_cogs"] > 0
        inv = requests.get(f"{API}/inventory?location=Gudang Utama", headers=admin_h, timeout=30).json()
        assert next(i for i in inv if i["product_id"] == p["id"])["stock_quantity"] == 48


# ---------- Customers ----------
class TestCustomers:
    def test_list_customers(self, admin_h):
        r = requests.get(f"{API}/customers", headers=admin_h, timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 3


# ---------- Reports ----------
class TestReports:
    def test_dashboard(self, admin_h):
        r = requests.get(f"{API}/reports/dashboard", headers=admin_h, timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ["today_sales", "total_sales", "total_receivable", "low_stock_count",
                  "sales_series", "category_series"]:
            assert k in d
        assert len(d["sales_series"]) == 7

    def test_profit_loss(self, admin_h):
        r = requests.get(f"{API}/reports/profit-loss", headers=admin_h, timeout=30)
        assert r.status_code == 200
        for k in ["revenue", "cogs_sold", "gross_profit", "waste_loss", "net_profit"]:
            assert k in r.json()

    def test_receivables(self, admin_h):
        r = requests.get(f"{API}/reports/receivables", headers=admin_h, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "customers" in d and "aging" in d
        for b in ["current", "d1_30", "d31_60", "d60_plus"]:
            assert b in d["aging"]


# ---------- Role gating ----------
class TestRoles:
    def test_kasir_cannot_list_users(self, kasir_h):
        r = requests.get(f"{API}/users", headers=kasir_h, timeout=30)
        assert r.status_code == 403

    def test_admin_can_list_users(self, admin_h):
        r = requests.get(f"{API}/users", headers=admin_h, timeout=30)
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_kasir_cannot_delete_product(self, kasir_h, admin_h):
        prods = requests.get(f"{API}/products", headers=admin_h, timeout=30).json()
        r = requests.delete(f"{API}/products/{prods[0]['id']}", headers=kasir_h, timeout=30)
        assert r.status_code == 403
