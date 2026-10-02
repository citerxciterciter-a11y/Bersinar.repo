import { useState, useEffect, useMemo, useCallback } from "react";
import api, { apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { rupiah, fmtQty, categoryColor } from "@/lib/format";
import Numpad from "@/components/Numpad";
import Receipt from "@/components/Receipt";
import { toast } from "sonner";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X, Loader2, Wallet,
  QrCode, Landmark, NotebookPen, Package,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function resolvePrice(product, qty) {
  const tiers = (product.tiers || []).slice().sort((a, b) => a.min_qty - b.min_qty);
  const ok = tiers.filter((t) => qty >= t.min_qty);
  if (ok.length) return ok[ok.length - 1];
  return tiers[0] || { tier_name: "Eceran", price: product.retail_price || 0 };
}

const PAYMENTS = [
  { key: "Cash", label: "Tunai", icon: Wallet },
  { key: "QRIS", label: "QRIS", icon: QrCode },
  { key: "Bank", label: "Transfer", icon: Landmark },
  { key: "Credit", label: "Bon", icon: NotebookPen },
];

function CartPanel({ cart, setCart, onEditQty, onCheckout, submitting }) {
  const total = cart.reduce((s, c) => s + resolvePrice(c.product, c.qty).price * c.qty, 0);
  const inc = (i, d) => {
    setCart((cs) => cs.map((c, idx) => {
      if (idx !== i) return c;
      const step = c.product.is_decimal_allowed ? 0.25 : 1;
      const q = Math.max(step, +(c.qty + d * step).toFixed(2));
      return { ...c, qty: q };
    }));
  };
  const remove = (i) => setCart((cs) => cs.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <h2 className="font-heading font-bold text-lg flex items-center gap-2 text-emerald-900">
          <ShoppingCart size={20} /> Keranjang
        </h2>
        {cart.length > 0 && (
          <button data-testid="cart-clear" onClick={() => setCart([])} className="text-xs text-red-500 hover:underline">Kosongkan</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <ShoppingCart size={56} strokeWidth={1.2} />
            <p className="text-sm text-gray-400">Keranjang kosong</p>
          </div>
        ) : cart.map((c, i) => {
          const tier = resolvePrice(c.product, c.qty);
          return (
            <div key={c.product.id} data-testid={`cart-item-${c.product.id}`} className="bg-gray-50 rounded-xl p-3 mb-2 border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{c.product.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    {rupiah(tier.price)}/{c.product.unit}
                    {tier.tier_name !== "Eceran" && (
                      <span className="px-1.5 py-0.5 rounded bg-lime-100 text-lime-700 text-[10px] font-semibold">{tier.tier_name}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => remove(i)} data-testid={`cart-remove-${c.product.id}`} className="text-gray-400 hover:text-red-500 p-1">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => inc(i, -1)} data-testid={`cart-dec-${c.product.id}`} className="h-7 w-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-transform">
                    <Minus size={14} />
                  </button>
                  <button onClick={() => onEditQty(c.product, c.qty)} data-testid={`cart-qty-${c.product.id}`}
                    className="font-mono font-semibold text-sm min-w-[52px] text-center px-2 py-1 rounded-lg bg-white border border-gray-200">
                    {fmtQty(c.qty)}
                  </button>
                  <button onClick={() => inc(i, 1)} data-testid={`cart-inc-${c.product.id}`} className="h-7 w-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-transform">
                    <Plus size={14} />
                  </button>
                </div>
                <div className="font-mono font-bold text-emerald-700">{rupiah(tier.price * c.qty)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-100 p-4 flex-shrink-0 bg-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-500">Total</span>
          <span data-testid="cart-total" className="font-mono font-extrabold text-2xl text-emerald-800">{rupiah(total)}</span>
        </div>
        <button data-testid="checkout-btn" disabled={cart.length === 0 || submitting} onClick={onCheckout}
          className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-lg transition-transform duration-150 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
          {submitting && <Loader2 className="animate-spin" size={20} />} Bayar
        </button>
      </div>
    </div>
  );
}

export default function POS() {
  const { location } = useAuth();
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ categories: [] });
  const [cat, setCat] = useState("Semua");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFull, setIsFull] = useState(false);

  const [numpad, setNumpad] = useState({ open: false, product: null, initial: null });
  const [showSheet, setShowSheet] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/products", { params: { category: cat, search } })
      .then((r) => setProducts(r.data)).catch((e) => toast.error(apiErr(e)))
      .finally(() => setLoading(false));
  }, [cat, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/meta").then((r) => setMeta(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const stockAt = (p) => {
    const l = (p.locations || []).find((x) => x.location_name === location);
    return l ? l.stock_quantity : 0;
  };

  const addToCart = (product, qty) => {
    const stock = stockAt(product);
    setCart((cs) => {
      const i = cs.findIndex((c) => c.product.id === product.id);
      let newQty = qty;
      if (i >= 0) newQty = qty; // numpad overwrites; from card we pass incremented
      if (newQty > stock) { toast.error(`Stok ${product.name} hanya ${fmtQty(stock)} ${product.unit}`); return cs; }
      if (i >= 0) { const copy = [...cs]; copy[i] = { ...copy[i], qty: newQty }; return copy; }
      return [...cs, { product, qty: newQty }];
    });
  };

  const onProductClick = (product) => {
    if (stockAt(product) <= 0) { toast.error("Stok habis di cabang ini"); return; }
    if (product.is_decimal_allowed) {
      const existing = cart.find((c) => c.product.id === product.id);
      setNumpad({ open: true, product, initial: existing?.qty || null });
    } else {
      const existing = cart.find((c) => c.product.id === product.id);
      addToCart(product, (existing?.qty || 0) + 1);
      toast.success(`${product.name} ditambahkan`);
    }
  };

  const onEditQty = (product, qty) => setNumpad({ open: true, product, initial: qty });

  const gridCols = isFull ? "grid-cols-3 md:grid-cols-5" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
  const cartCount = cart.length;
  const cartTotal = cart.reduce((s, c) => s + resolvePrice(c.product, c.qty).price * c.qty, 0);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Catalog */}
      <div className="flex-1 lg:w-[62%] flex flex-col min-w-0 h-full">
        <div className="p-3 sm:p-4 flex-shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input data-testid="pos-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk / scan barcode..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none" />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {["Semua", ...(meta.categories || [])].map((c) => (
              <button key={c} data-testid={`cat-${c}`} onClick={() => setCat(c)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                  cat === c ? "bg-emerald-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-emerald-300"
                }`}>{c}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-24 lg:pb-4">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div>
          ) : products.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-gray-400 gap-2"><Package size={40} /><p>Tidak ada produk</p></div>
          ) : (
            <div className={`grid ${gridCols} gap-2 sm:gap-3`}>
              {products.map((p) => {
                const stock = stockAt(p);
                const low = stock <= p.min_stock_alert;
                return (
                  <button key={p.id} data-testid={`product-${p.id}`} onClick={() => onProductClick(p)}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden text-left hover:border-emerald-400 hover:shadow-md transition-all duration-150 active:scale-95 flex flex-col">
                    <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> :
                        <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={28} /></div>}
                      <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${categoryColor(p.category)}`}>{p.category}</span>
                      <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${stock <= 0 ? "bg-red-600 text-white" : low ? "bg-amber-500 text-white" : "bg-white/90 text-gray-700"}`}>
                        {fmtQty(stock)} {p.unit}
                      </span>
                    </div>
                    <div className="p-2 flex-1 flex flex-col">
                      <div className="text-xs sm:text-sm font-semibold line-clamp-2 leading-tight">{p.name}</div>
                      <div className="mt-auto pt-1">
                        <div className="font-mono font-bold text-emerald-700 text-sm">{rupiah(p.retail_price)}</div>
                        {p.is_decimal_allowed && <div className="text-[10px] text-gray-400">per {p.unit} • bisa desimal</div>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart desktop */}
      <div className="hidden lg:flex lg:w-[38%] border-l border-gray-200 h-full shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <CartPanel cart={cart} setCart={setCart} onEditQty={onEditQty} onCheckout={() => setCheckout(true)} submitting={false} />
      </div>

      {/* Mobile floating cart bar */}
      {cartCount > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
          <button data-testid="mobile-cart-bar" onClick={() => setShowSheet(true)}
            className="w-full bg-emerald-600 text-white rounded-2xl px-4 py-3.5 flex items-center justify-between shadow-xl shadow-emerald-900/20 active:scale-[0.98] transition-transform">
            <span className="flex items-center gap-2 font-semibold"><ShoppingCart size={20} /> {cartCount} Item</span>
            <span className="font-mono font-bold">{rupiah(cartTotal)}</span>
            <span className="font-heading font-bold">Lihat →</span>
          </button>
        </div>
      )}

      {/* Mobile bottom sheet */}
      {showSheet && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setShowSheet(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full rounded-t-2xl max-h-[85dvh] h-[85dvh] flex flex-col animate-slide-up">
            <div className="flex justify-center pt-2"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <CartPanel cart={cart} setCart={setCart} onEditQty={onEditQty} onCheckout={() => { setShowSheet(false); setCheckout(true); }} submitting={false} />
          </div>
        </div>
      )}

      <Numpad open={numpad.open} product={numpad.product} initial={numpad.initial}
        onClose={() => setNumpad({ open: false, product: null, initial: null })}
        onConfirm={(qty) => {
          addToCart(numpad.product, qty);
          setNumpad({ open: false, product: null, initial: null });
          toast.success("Ditambahkan ke keranjang");
        }} />

      {checkout && (
        <CheckoutModal cart={cart} total={cartTotal} location={location}
          onClose={() => setCheckout(false)}
          onDone={(txn) => { setCheckout(false); setCart([]); setReceipt(txn); load(); }} />
      )}

      {receipt && <Receipt txn={receipt.txn} customer={receipt.customer} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function CheckoutModal({ cart, total, location, onClose, onDone }) {
  const [method, setMethod] = useState("Cash");
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {}); }, []);

  const grand = Math.max(0, total - (Number(discount) || 0));
  const change = (Number(paid) || 0) - grand;
  const customer = customers.find((c) => c.id === customerId);
  const creditLeft = customer ? customer.credit_limit - customer.current_credit : 0;
  const overLimit = method === "Credit" && customer && grand > creditLeft;

  const submit = async () => {
    if (method === "Credit" && !customerId) { toast.error("Pilih pelanggan B2B"); return; }
    if (overLimit) { toast.error("Melebihi limit kredit pelanggan"); return; }
    if (method === "Cash" && (Number(paid) || 0) < grand) { toast.error("Uang tunai kurang"); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post("/transactions", {
        location_name: location,
        customer_id: method === "Credit" ? customerId : (customerId || null),
        items: cart.map((c) => ({ product_id: c.product.id, qty: c.qty })),
        discount: Number(discount) || 0,
        payment_method: method,
        amount_paid: method === "Cash" ? Number(paid) || 0 : grand,
      });
      toast.success("Transaksi berhasil!");
      onDone({ txn: data, customer });
    } catch (e) { toast.error(apiErr(e)); }
    finally { setSubmitting(false); }
  };

  const quickCash = [grand, 50000, 100000, 150000, 200000];

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose} data-testid="checkout-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] flex flex-col animate-slide-up shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-heading font-bold text-xl">Pembayaran</h3>
          <button onClick={onClose} data-testid="checkout-close" className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <div className="text-sm text-emerald-600">Total Tagihan</div>
            <div data-testid="checkout-grand" className="font-mono font-extrabold text-3xl text-emerald-800">{rupiah(grand)}</div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Diskon (Rp)</label>
            <input data-testid="checkout-discount" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)}
              className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 font-mono outline-none focus:border-emerald-500" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Metode Pembayaran</label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENTS.map((p) => (
                <button key={p.key} data-testid={`pay-${p.key}`} onClick={() => setMethod(p.key)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                    method === p.key ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300"
                  }`}>
                  <p.icon size={18} /> {p.label}
                </button>
              ))}
            </div>
          </div>

          {method === "Cash" && (
            <div>
              <label className="text-sm font-medium text-gray-700">Uang Diterima</label>
              <input data-testid="checkout-paid" type="number" value={paid} onChange={(e) => setPaid(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 font-mono text-lg outline-none focus:border-emerald-500" />
              <div className="flex flex-wrap gap-2 mt-2">
                {quickCash.map((q, i) => (
                  <button key={i} onClick={() => setPaid(String(q))} className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-emerald-100 text-xs font-mono font-semibold">
                    {i === 0 ? "Uang Pas" : rupiah(q)}
                  </button>
                ))}
              </div>
              {Number(paid) > 0 && (
                <div className={`mt-3 flex justify-between font-semibold ${change < 0 ? "text-red-600" : "text-emerald-700"}`}>
                  <span>Kembalian</span>
                  <span data-testid="checkout-change" className="font-mono">{rupiah(Math.max(0, change))}</span>
                </div>
              )}
            </div>
          )}

          {(method === "Credit" || method !== "Cash") && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Pelanggan {method === "Credit" ? "B2B (wajib)" : "(opsional)"}
              </label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger data-testid="checkout-customer" className="w-full"><SelectValue placeholder="Pilih pelanggan" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id} data-testid={`cust-opt-${c.id}`}>{c.name} ({c.customer_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {method === "Credit" && customer && (
                <div className={`mt-2 text-sm rounded-xl px-3 py-2 ${overLimit ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  Sisa limit kredit: <b className="font-mono">{rupiah(creditLeft)}</b>
                  {overLimit && <div className="font-semibold mt-0.5">⚠ Transaksi melebihi limit!</div>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button data-testid="checkout-confirm" disabled={submitting || overLimit} onClick={submit}
            className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-lg flex items-center justify-center gap-2 transition-transform duration-150 active:scale-95 disabled:opacity-50">
            {submitting && <Loader2 className="animate-spin" size={20} />} Proses Pembayaran
          </button>
        </div>
      </div>
    </div>
  );
}
