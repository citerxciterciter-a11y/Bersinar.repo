from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging
import jwt
import bcrypt

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
LOCATIONS = ["Gudang Utama", "Cabang 1", "Cabang 2"]
CATEGORIES = ["Sayur", "Buah", "Sembako", "Minuman", "Daging", "Lainnya"]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bersinar")


# ---------------- Helpers ----------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User tidak ditemukan")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kadaluarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hanya admin yang diizinkan")
    return user


# ---------------- Models ----------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "kasir"


class TierPriceInput(BaseModel):
    tier_name: str
    min_qty: float
    price: float


class LocationStockInput(BaseModel):
    location_name: str
    stock_quantity: float
    cogs_price: float


class ProductInput(BaseModel):
    sku: Optional[str] = None
    barcode: Optional[str] = ""
    name: str
    category: str
    unit: str = "PCS"
    is_decimal_allowed: bool = False
    is_expirable: bool = False
    expired_date: Optional[str] = None
    min_stock_alert: float = 5
    image_url: Optional[str] = None
    tiers: List[TierPriceInput] = []
    locations: List[LocationStockInput] = []


class CustomerInput(BaseModel):
    name: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    customer_type: str = "B2B"
    credit_limit: float = 0
    payment_terms_days: int = 30


class CartItem(BaseModel):
    product_id: str
    qty: float
    unit_price_override: Optional[float] = None


class CheckoutInput(BaseModel):
    location_name: str
    customer_id: Optional[str] = None
    items: List[CartItem]
    discount: float = 0
    payment_method: str  # Cash / QRIS / Bank / Credit
    amount_paid: float = 0
    notes: Optional[str] = ""


class WasteInput(BaseModel):
    product_id: str
    location_name: str
    qty: float
    reason: str
    notes: Optional[str] = ""


class CreditPaymentInput(BaseModel):
    customer_id: str
    transaction_id: Optional[str] = None
    payment_amount: float
    payment_method: str = "Cash"
    notes: Optional[str] = ""


# ---------------- Auth routes ----------------
def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True,
                        secure=True, samesite="none", max_age=604800, path="/")


@api_router.post("/auth/login")
async def login(payload: LoginInput, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    return {"id": user["id"], "email": user["email"], "name": user["name"],
            "role": user["role"], "token": token}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logout berhasil"}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.get("/users")
async def list_users(user: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users


@api_router.post("/users")
async def create_user(payload: UserCreate, user: dict = Depends(require_admin)):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    doc = {"id": new_id(), "email": email, "password_hash": hash_password(payload.password),
           "name": payload.name, "role": payload.role, "created_at": now_iso()}
    await db.users.insert_one(doc)
    return {"id": doc["id"], "email": email, "name": payload.name, "role": payload.role}


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus diri sendiri")
    await db.users.delete_one({"id": user_id})
    return {"message": "User dihapus"}


# ---------------- Meta ----------------
@api_router.get("/meta")
async def meta(user: dict = Depends(get_current_user)):
    return {"locations": LOCATIONS, "categories": CATEGORIES,
            "units": ["Kg", "Gram", "PCS", "Pack", "Liter", "Karung", "Dus"],
            "tiers": ["Eceran", "Grosir", "Partai"],
            "waste_reasons": ["Busuk", "Layu", "Pecah", "Dimakan Hama", "Kadaluarsa"]}


# ---------------- Products ----------------
async def build_product(prod: dict) -> dict:
    prod.pop("_id", None)
    tiers = await db.tier_prices.find({"product_id": prod["id"]}, {"_id": 0}).to_list(50)
    tiers.sort(key=lambda t: t["min_qty"])
    locations = await db.inventory.find({"product_id": prod["id"]}, {"_id": 0}).to_list(50)
    prod["tiers"] = tiers
    prod["locations"] = locations
    prod["total_stock"] = sum(l["stock_quantity"] for l in locations)
    retail = next((t["price"] for t in tiers if t["tier_name"] == "Eceran"), tiers[0]["price"] if tiers else 0)
    prod["retail_price"] = retail
    prod["cogs_price"] = locations[0]["cogs_price"] if locations else 0
    return prod


@api_router.get("/products")
async def get_products(category: Optional[str] = None, search: Optional[str] = None,
                       user: dict = Depends(get_current_user)):
    q = {}
    if category and category != "Semua":
        q["category"] = category
    if search:
        q["$or"] = [{"name": {"$regex": search, "$options": "i"}},
                    {"sku": {"$regex": search, "$options": "i"}}]
    prods = await db.products.find(q).sort("name", 1).to_list(1000)
    return [await build_product(p) for p in prods]


@api_router.get("/products/{product_id}")
async def get_product(product_id: str, user: dict = Depends(get_current_user)):
    prod = await db.products.find_one({"id": product_id})
    if not prod:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return await build_product(prod)


async def save_product_relations(product_id: str, data: ProductInput):
    await db.tier_prices.delete_many({"product_id": product_id})
    for t in data.tiers:
        await db.tier_prices.insert_one({"id": new_id(), "product_id": product_id,
                                         "tier_name": t.tier_name, "min_qty": t.min_qty, "price": t.price})
    for loc in data.locations:
        await db.inventory.update_one(
            {"product_id": product_id, "location_name": loc.location_name},
            {"$set": {"stock_quantity": loc.stock_quantity, "cogs_price": loc.cogs_price},
             "$setOnInsert": {"id": new_id()}}, upsert=True)


@api_router.post("/products")
async def create_product(data: ProductInput, user: dict = Depends(get_current_user)):
    sku = data.sku or f"SKU-{str(uuid.uuid4())[:8].upper()}"
    if await db.products.find_one({"sku": sku}):
        sku = f"SKU-{str(uuid.uuid4())[:8].upper()}"
    pid = new_id()
    doc = {"id": pid, "sku": sku, "barcode": data.barcode or "", "name": data.name, "category": data.category,
           "unit": data.unit, "is_decimal_allowed": data.is_decimal_allowed,
           "is_expirable": data.is_expirable, "expired_date": data.expired_date,
           "min_stock_alert": data.min_stock_alert, "image_url": data.image_url,
           "created_at": now_iso()}
    await db.products.insert_one(doc)
    await save_product_relations(pid, data)
    return await get_product(pid, user)


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductInput, user: dict = Depends(get_current_user)):
    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    await db.products.update_one({"id": product_id}, {"$set": {
        "name": data.name, "category": data.category, "unit": data.unit,
        "sku": data.sku or existing["sku"], "barcode": data.barcode or "",
        "is_decimal_allowed": data.is_decimal_allowed, "is_expirable": data.is_expirable,
        "expired_date": data.expired_date, "min_stock_alert": data.min_stock_alert,
        "image_url": data.image_url}})
    await save_product_relations(product_id, data)
    return await get_product(product_id, user)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_admin)):
    await db.products.delete_one({"id": product_id})
    await db.tier_prices.delete_many({"product_id": product_id})
    await db.inventory.delete_many({"product_id": product_id})
    return {"message": "Produk dihapus"}


# ---------------- Inventory ----------------
@api_router.get("/inventory")
async def get_inventory(location: Optional[str] = None, user: dict = Depends(get_current_user)):
    prods = await db.products.find().sort("name", 1).to_list(1000)
    result = []
    for p in prods:
        p.pop("_id", None)
        locs = await db.inventory.find({"product_id": p["id"]}, {"_id": 0}).to_list(50)
        if location and location != "Semua":
            locs = [l for l in locs if l["location_name"] == location]
        for l in locs:
            result.append({"product_id": p["id"], "name": p["name"], "sku": p["sku"],
                           "category": p["category"], "unit": p["unit"],
                           "min_stock_alert": p["min_stock_alert"],
                           "location_name": l["location_name"],
                           "stock_quantity": l["stock_quantity"], "cogs_price": l["cogs_price"],
                           "low": l["stock_quantity"] <= p["min_stock_alert"]})
    return result


@api_router.post("/inventory/adjust")
async def adjust_inventory(product_id: str = Query(...), location_name: str = Query(...),
                           new_qty: float = Query(...), user: dict = Depends(get_current_user)):
    await db.inventory.update_one(
        {"product_id": product_id, "location_name": location_name},
        {"$set": {"stock_quantity": new_qty}, "$setOnInsert": {"id": new_id(), "cogs_price": 0}},
        upsert=True)
    return {"message": "Stok diperbarui"}


# ---------------- Customers ----------------
@api_router.get("/customers")
async def get_customers(user: dict = Depends(get_current_user)):
    custs = await db.customers.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return custs


@api_router.post("/customers")
async def create_customer(data: CustomerInput, user: dict = Depends(get_current_user)):
    doc = {"id": new_id(), "name": data.name, "phone": data.phone, "address": data.address,
           "customer_type": data.customer_type, "credit_limit": data.credit_limit,
           "current_credit": 0, "payment_terms_days": data.payment_terms_days,
           "created_at": now_iso()}
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, data: CustomerInput, user: dict = Depends(get_current_user)):
    await db.customers.update_one({"id": customer_id}, {"$set": {
        "name": data.name, "phone": data.phone, "address": data.address,
        "customer_type": data.customer_type, "credit_limit": data.credit_limit,
        "payment_terms_days": data.payment_terms_days}})
    c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    return c


@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, user: dict = Depends(require_admin)):
    await db.customers.delete_one({"id": customer_id})
    return {"message": "Pelanggan dihapus"}


# ---------------- Pricing logic ----------------
async def resolve_price(product_id: str, qty: float) -> float:
    tiers = await db.tier_prices.find({"product_id": product_id}, {"_id": 0}).to_list(50)
    applicable = [t for t in tiers if qty >= t["min_qty"]]
    if not applicable:
        return min((t["price"] for t in tiers), default=0)
    applicable.sort(key=lambda t: t["min_qty"])
    return applicable[-1]["price"]


# ---------------- Transactions / Checkout ----------------
@api_router.post("/transactions")
async def checkout(data: CheckoutInput, user: dict = Depends(get_current_user)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Keranjang kosong")

    line_items = []
    total = 0.0
    for item in data.items:
        prod = await db.products.find_one({"id": item.product_id}, {"_id": 0})
        if not prod:
            raise HTTPException(status_code=404, detail=f"Produk tidak ditemukan")
        inv = await db.inventory.find_one(
            {"product_id": item.product_id, "location_name": data.location_name}, {"_id": 0})
        stock = inv["stock_quantity"] if inv else 0
        cogs = inv["cogs_price"] if inv else 0
        if item.qty > stock:
            raise HTTPException(status_code=400,
                                detail=f"Stok {prod['name']} tidak cukup (sisa {stock})")
        price = item.unit_price_override if item.unit_price_override is not None \
            else await resolve_price(item.product_id, item.qty)
        subtotal = round(price * item.qty, 2)
        total += subtotal
        line_items.append({"id": new_id(), "product_id": item.product_id,
                           "product_name": prod["name"], "unit": prod["unit"],
                           "qty": item.qty, "applied_unit_price": price,
                           "subtotal": subtotal, "cogs_price": cogs})

    total_amount = round(total - data.discount, 2)

    customer = None
    if data.payment_method == "Credit":
        if not data.customer_id:
            raise HTTPException(status_code=400, detail="Pilih pelanggan B2B untuk pembayaran Bon")
        customer = await db.customers.find_one({"id": data.customer_id}, {"_id": 0})
        if not customer:
            raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
        if customer["current_credit"] + total_amount > customer["credit_limit"]:
            sisa = customer["credit_limit"] - customer["current_credit"]
            raise HTTPException(status_code=400,
                                detail=f"Melebihi limit kredit. Sisa limit: Rp {sisa:,.0f}")

    # decrement stock
    for item in data.items:
        await db.inventory.update_one(
            {"product_id": item.product_id, "location_name": data.location_name},
            {"$inc": {"stock_quantity": -item.qty}})

    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    count = await db.transactions.count_documents(
        {"invoice_number": {"$regex": f"^INV-{today}"}}) + 1
    invoice = f"INV-{today}-{count:04d}"

    payment_status = "unpaid" if data.payment_method == "Credit" else "paid"
    change = round(data.amount_paid - total_amount, 2) if data.payment_method == "Cash" else 0

    txn = {"id": new_id(), "invoice_number": invoice, "location_name": data.location_name,
           "customer_id": data.customer_id, "customer_name": customer["name"] if customer else "Umum",
           "total_amount": total_amount, "discount": data.discount,
           "payment_method": data.payment_method, "payment_status": payment_status,
           "amount_paid": data.amount_paid, "change": change,
           "cashier_id": user["id"], "cashier_name": user["name"],
           "notes": data.notes, "created_at": now_iso()}
    await db.transactions.insert_one(txn)
    for li in line_items:
        li["transaction_id"] = txn["id"]
        await db.transaction_items.insert_one(li)
        li.pop("_id", None)

    if data.payment_method == "Credit" and customer:
        await db.customers.update_one({"id": data.customer_id},
                                      {"$inc": {"current_credit": total_amount}})

    txn.pop("_id", None)
    txn["items"] = line_items
    return txn


@api_router.get("/transactions")
async def list_transactions(location: Optional[str] = None, payment_status: Optional[str] = None,
                            limit: int = 100, user: dict = Depends(get_current_user)):
    q = {}
    if location and location != "Semua":
        q["location_name"] = location
    if payment_status:
        q["payment_status"] = payment_status
    txns = await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return txns


@api_router.get("/transactions/{txn_id}")
async def get_transaction(txn_id: str, user: dict = Depends(get_current_user)):
    txn = await db.transactions.find_one({"id": txn_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    items = await db.transaction_items.find({"transaction_id": txn_id}, {"_id": 0}).to_list(200)
    txn["items"] = items
    return txn


# ---------------- Waste ----------------
@api_router.get("/waste")
async def list_waste(location: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if location and location != "Semua":
        q["location_name"] = location
    logs = await db.waste_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return logs


@api_router.post("/waste")
async def create_waste(data: WasteInput, user: dict = Depends(get_current_user)):
    prod = await db.products.find_one({"id": data.product_id}, {"_id": 0})
    if not prod:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    inv = await db.inventory.find_one(
        {"product_id": data.product_id, "location_name": data.location_name}, {"_id": 0})
    cogs = inv["cogs_price"] if inv else 0
    total_loss = round(cogs * data.qty, 2)
    await db.inventory.update_one(
        {"product_id": data.product_id, "location_name": data.location_name},
        {"$inc": {"stock_quantity": -data.qty}})
    doc = {"id": new_id(), "product_id": data.product_id, "product_name": prod["name"],
           "location_name": data.location_name, "qty": data.qty, "unit": prod["unit"],
           "reason": data.reason, "total_loss_cogs": total_loss,
           "notes": data.notes, "reported_by": user["name"], "created_at": now_iso()}
    await db.waste_logs.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------- Credit payments ----------------
@api_router.get("/credit-payments")
async def list_credit_payments(customer_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if customer_id:
        q["customer_id"] = customer_id
    pays = await db.credit_payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return pays


@api_router.post("/credit-payments")
async def create_credit_payment(data: CreditPaymentInput, user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": data.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    if data.payment_amount <= 0:
        raise HTTPException(status_code=400, detail="Jumlah pembayaran tidak valid")
    new_credit = max(0, round(customer["current_credit"] - data.payment_amount, 2))
    await db.customers.update_one({"id": data.customer_id},
                                  {"$set": {"current_credit": new_credit}})
    if data.transaction_id:
        await db.transactions.update_one({"id": data.transaction_id},
                                         {"$set": {"payment_status": "paid"}})
    doc = {"id": new_id(), "customer_id": data.customer_id, "customer_name": customer["name"],
           "transaction_id": data.transaction_id, "payment_amount": data.payment_amount,
           "payment_method": data.payment_method, "notes": data.notes,
           "received_by": user["name"], "created_at": now_iso()}
    await db.credit_payments.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------- Reports ----------------
def parse_dt(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return datetime.now(timezone.utc)


@api_router.get("/reports/dashboard")
async def report_dashboard(location: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if location and location != "Semua":
        q["location_name"] = location
    txns = await db.transactions.find(q, {"_id": 0}).to_list(5000)
    today = datetime.now(timezone.utc).date()
    today_sales = 0.0
    today_count = 0
    total_sales = 0.0
    for t in txns:
        total_sales += t["total_amount"]
        if parse_dt(t["created_at"]).date() == today:
            today_sales += t["total_amount"]
            today_count += 1
    # receivables
    custs = await db.customers.find({}, {"_id": 0}).to_list(1000)
    total_receivable = sum(c["current_credit"] for c in custs)
    # low stock
    inv_items = await get_inventory(location, user)
    low_stock = [i for i in inv_items if i["low"]]
    # waste
    wq = {}
    if location and location != "Semua":
        wq["location_name"] = location
    wastes = await db.waste_logs.find(wq, {"_id": 0}).to_list(5000)
    total_waste_loss = sum(w["total_loss_cogs"] for w in wastes)

    # sales last 7 days
    series = {}
    for i in range(6, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        series[d] = 0.0
    for t in txns:
        d = parse_dt(t["created_at"]).date().isoformat()
        if d in series:
            series[d] += t["total_amount"]
    sales_series = [{"date": k, "total": round(v, 2)} for k, v in series.items()]

    # sales by category
    cat_sales = {c: 0.0 for c in CATEGORIES}
    items = await db.transaction_items.find({}, {"_id": 0}).to_list(20000)
    prod_cat = {p["id"]: p["category"] for p in await db.products.find({}, {"_id": 0, "id": 1, "category": 1}).to_list(5000)}
    for it in items:
        c = prod_cat.get(it["product_id"], "Lainnya")
        cat_sales[c] = cat_sales.get(c, 0) + it["subtotal"]
    category_series = [{"category": k, "total": round(v, 2)} for k, v in cat_sales.items() if v > 0]

    return {"today_sales": round(today_sales, 2), "today_count": today_count,
            "total_sales": round(total_sales, 2), "total_transactions": len(txns),
            "total_receivable": round(total_receivable, 2),
            "low_stock_count": len(low_stock), "low_stock_items": low_stock[:10],
            "total_waste_loss": round(total_waste_loss, 2),
            "sales_series": sales_series, "category_series": category_series}


@api_router.get("/reports/profit-loss")
async def report_profit_loss(location: Optional[str] = None, user: dict = Depends(get_current_user)):
    tq = {}
    if location and location != "Semua":
        tq["location_name"] = location
    txns = await db.transactions.find(tq, {"_id": 0}).to_list(10000)
    txn_ids = {t["id"] for t in txns}
    revenue = sum(t["total_amount"] for t in txns)
    total_discount = sum(t["discount"] for t in txns)
    items = await db.transaction_items.find({}, {"_id": 0}).to_list(50000)
    cogs_sold = sum(it["cogs_price"] * it["qty"] for it in items if it["transaction_id"] in txn_ids)
    wq = {}
    if location and location != "Semua":
        wq["location_name"] = location
    wastes = await db.waste_logs.find(wq, {"_id": 0}).to_list(10000)
    waste_loss = sum(w["total_loss_cogs"] for w in wastes)
    gross_profit = revenue - cogs_sold
    net_profit = gross_profit - waste_loss
    return {"revenue": round(revenue, 2), "cogs_sold": round(cogs_sold, 2),
            "gross_profit": round(gross_profit, 2), "waste_loss": round(waste_loss, 2),
            "total_discount": round(total_discount, 2), "net_profit": round(net_profit, 2)}


@api_router.get("/reports/receivables")
async def report_receivables(user: dict = Depends(get_current_user)):
    custs = await db.customers.find({"current_credit": {"$gt": 0}}, {"_id": 0}).to_list(1000)
    result = []
    aging_buckets = {"current": 0.0, "d1_30": 0.0, "d31_60": 0.0, "d60_plus": 0.0}
    for c in custs:
        unpaid = await db.transactions.find(
            {"customer_id": c["id"], "payment_status": "unpaid"}, {"_id": 0}).to_list(500)
        now = datetime.now(timezone.utc)
        for t in unpaid:
            days = (now - parse_dt(t["created_at"])).days
            due = days - c.get("payment_terms_days", 30)
            if due <= 0:
                bucket = "current"
            elif due <= 30:
                bucket = "d1_30"
            elif due <= 60:
                bucket = "d31_60"
            else:
                bucket = "d60_plus"
            aging_buckets[bucket] += t["total_amount"]
        result.append({**c, "overdue": any(
            (datetime.now(timezone.utc) - parse_dt(t["created_at"])).days > c.get("payment_terms_days", 30)
            for t in unpaid)})
    return {"customers": result, "aging": {k: round(v, 2) for k, v in aging_buckets.items()},
            "total": round(sum(aging_buckets.values()), 2)}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- Seed ----------------
async def seed():
    await db.users.create_index("email", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"id": new_id(), "email": admin_email,
                                   "password_hash": hash_password(admin_password),
                                   "name": "Admin BERSINAR", "role": "admin", "created_at": now_iso()})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
    # cashier
    if not await db.users.find_one({"email": "kasir@bersinar.id"}):
        await db.users.insert_one({"id": new_id(), "email": "kasir@bersinar.id",
                                   "password_hash": hash_password("kasir123"),
                                   "name": "Kasir Toko", "role": "kasir", "created_at": now_iso()})

    if await db.products.count_documents({}) > 0:
        return

    veg_img = "https://images.unsplash.com/photo-1557844352-761f2565b576?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwzfHxmcmVzaCUyMG9yZ2FuaWMlMjB2ZWdldGFibGVzJTIwbWFya2V0fGVufDB8fHx8MTc5MDkyMDIzNnww&ixlib=rb-4.1.0&q=85"
    rice_img = "https://images.pexels.com/photos/38781904/pexels-photo-38781904.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    meat_img = "https://images.unsplash.com/photo-1690983330536-3b0089d07cf9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHxmcmVzaCUyMHJhdyUyMGJlZWYlMjBidXRjaGVyfGVufDB8fHx8MTc5MDkyMDIzNnww&ixlib=rb-4.1.0&q=85"

    samples = [
        {"name": "Bayam Hijau", "category": "Sayur", "unit": "Kg", "dec": True, "cogs": 8000,
         "tiers": [("Eceran", 1, 12000), ("Grosir", 5, 10000), ("Partai", 20, 9000)], "img": veg_img, "stock": 40},
        {"name": "Wortel Segar", "category": "Sayur", "unit": "Kg", "dec": True, "cogs": 9000,
         "tiers": [("Eceran", 1, 14000), ("Grosir", 5, 12000), ("Partai", 20, 11000)], "img": veg_img, "stock": 35},
        {"name": "Cabai Merah Keriting", "category": "Sayur", "unit": "Kg", "dec": True, "cogs": 30000,
         "tiers": [("Eceran", 0.25, 45000), ("Grosir", 5, 40000)], "img": veg_img, "stock": 15},
        {"name": "Apel Fuji", "category": "Buah", "unit": "Kg", "dec": True, "cogs": 22000,
         "tiers": [("Eceran", 1, 32000), ("Grosir", 5, 28000)], "img": veg_img, "stock": 25},
        {"name": "Pisang Cavendish", "category": "Buah", "unit": "Kg", "dec": True, "cogs": 12000,
         "tiers": [("Eceran", 1, 18000), ("Grosir", 10, 15000)], "img": veg_img, "stock": 30},
        {"name": "Beras Pandan Wangi 5kg", "category": "Sembako", "unit": "Karung", "dec": False, "cogs": 62000,
         "tiers": [("Eceran", 1, 72000), ("Grosir", 5, 68000), ("Partai", 20, 66000)], "img": rice_img, "stock": 50},
        {"name": "Gula Pasir 1kg", "category": "Sembako", "unit": "Pack", "dec": False, "cogs": 13000,
         "tiers": [("Eceran", 1, 16000), ("Grosir", 12, 15000)], "img": rice_img, "stock": 60},
        {"name": "Minyak Goreng 2L", "category": "Sembako", "unit": "PCS", "dec": False, "cogs": 32000,
         "tiers": [("Eceran", 1, 38000), ("Grosir", 6, 36000)], "img": rice_img, "stock": 45},
        {"name": "Teh Botol 350ml", "category": "Minuman", "unit": "PCS", "dec": False, "cogs": 3500,
         "tiers": [("Eceran", 1, 5000), ("Grosir", 24, 4500)], "img": rice_img, "stock": 100},
        {"name": "Air Mineral 600ml", "category": "Minuman", "unit": "Dus", "dec": False, "cogs": 32000,
         "tiers": [("Eceran", 1, 42000), ("Grosir", 10, 40000)], "img": rice_img, "stock": 20},
        {"name": "Daging Sapi Has Dalam", "category": "Daging", "unit": "Kg", "dec": True, "cogs": 110000,
         "tiers": [("Eceran", 0.5, 140000), ("Grosir", 5, 132000)], "img": meat_img, "stock": 12},
        {"name": "Ayam Potong", "category": "Daging", "unit": "Kg", "dec": True, "cogs": 28000,
         "tiers": [("Eceran", 1, 38000), ("Grosir", 10, 35000)], "img": meat_img, "stock": 18},
    ]
    for s in samples:
        pid = new_id()
        await db.products.insert_one({"id": pid, "sku": f"SKU-{str(uuid.uuid4())[:6].upper()}",
                                      "name": s["name"], "category": s["category"], "unit": s["unit"],
                                      "is_decimal_allowed": s["dec"], "is_expirable": s["category"] in ["Sayur", "Buah", "Daging"],
                                      "expired_date": None, "min_stock_alert": 10, "image_url": s["img"],
                                      "created_at": now_iso()})
        for tname, mq, price in s["tiers"]:
            await db.tier_prices.insert_one({"id": new_id(), "product_id": pid,
                                             "tier_name": tname, "min_qty": mq, "price": price})
        for idx, loc in enumerate(LOCATIONS):
            await db.inventory.insert_one({"id": new_id(), "product_id": pid, "location_name": loc,
                                           "stock_quantity": s["stock"] if idx == 0 else round(s["stock"] * 0.5),
                                           "cogs_price": s["cogs"]})

    for c in [{"name": "Warung Bu Siti", "phone": "6281234567890", "limit": 2000000, "terms": 14},
              {"name": "Resto Padang Sederhana", "phone": "6289876543210", "limit": 5000000, "terms": 30},
              {"name": "Katering Berkah", "phone": "6281122334455", "limit": 3000000, "terms": 21}]:
        await db.customers.insert_one({"id": new_id(), "name": c["name"], "phone": c["phone"],
                                       "address": "Jakarta", "customer_type": "B2B",
                                       "credit_limit": c["limit"], "current_credit": 0,
                                       "payment_terms_days": c["terms"], "created_at": now_iso()})
    logger.info("Seed data created")


@app.on_event("startup")
async def on_startup():
    await seed()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
