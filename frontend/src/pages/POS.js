import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
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

const PRODUCTS_CACHE = "bersinar_products_cache";
const PAGE_SIZE = 24;

export function resolvePrice(product, qty) {
  const tiers = product.tiers || [];
  let chosen = null;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (qty >= t.min_qty && (!chosen || t.min_qty > chosen.min_qty)) chosen = t;
  }
  if (chosen) return chosen;
  // lowest min_qty tier as fallback
  let low = tiers[0];
  for (let i = 1; i < tiers.length; i++) if (tiers[i].min_qty < low.min_qty) low = tiers[i];
  return low || { tier_name: "Eceran", price: product.retail_price || 0 };
}

const stockAt = (p, loc) => {
  const locs = p.locations || [];
  for (let i = 0; i < locs.length; i++) if (locs[i].location_name === loc) return locs[i].stock_quantity;
  return 0;
};

const PAYMENTS = [
  { key: "Cash", label: "Tunai", icon: Wallet },
  { key: "QRIS", label: "QRIS", icon: QrCode },
  { key: "Bank", label: "Transfer", icon: Landmark },
  { key: "Credit", label: "Bon", icon: NotebookPen },
];

/* ---------- Memoized Product Card ---------- */
const ProductCard = memo(function ProductCard({ product, stock, onClick }) {
  const low = stock <= product.min_stock_alert;
  return (
    <button data-testid={`product-${product.id}`} onClick={() => onClick(product)}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden text-left hover:border-emerald-400 flex flex-col">
      <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={28} /></div>
        )}
        <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${categoryColor(product.category)}`}>{product.category}</span>
        <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${stock <= 0 ? "bg-red-600 text-white" : low ? "bg-amber-500 text-white" : "bg-white text-gray-700"}`}>
          {fmtQty(stock)} {product.unit}
        </span>
      </div>
      <div className="p-2 flex-1 flex flex-col">
        <div className="text-xs sm:text-sm font-semibold line-clamp-2 leading-tight">{product.name}</div>
        <div className="mt-auto pt-1">
          <div className="font-mono font-bold text-emerald-700 text-sm">{rupiah(product.retail_price)}</div>
          {product.is_decimal_allowed && <div className="text-[10px] text-gray-400">per {product.unit} • bisa desimal</div>}
        </div>
      </div>
    </button>
  );
});

/* ---------- Memoized Cart Item ---------- */
const CartItem = memo(function CartItem({ item, onInc, onDec, onRemove, onEditQty }) {
  const { product, qty } = item;
  const tier = resolvePrice(product, qty);
  return (
    <div data-testid={`cart-item-${product.id}`} className="bg-gray-50 rounded-lg p-3 mb-2 border border-gray-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{product.name}</div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            {rupiah(tier.price)}/{product.unit}
            {tier.tier_name !== "Eceran" && (
              <span className="px-1.5 py-0.5 rounded bg-lime-100 text-lime-700 text-[10px] font-semibold">{tier.tier_name}</span>
            )}
          </div>
        </div>
        <button onClick={() => onRemove(product.id)} data-testid={`cart-remove-${product.id}`} className="text-gray-400 hover:text-red-500 p-1">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <button onClick={() => onDec(product.id)} data-testid={`cart-dec-${product.id}`} className="h-7 w-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100">
            <Minus size={14} />
          </button>
          <button onClick={() => onEditQty(product, qty)} data-testid={`cart-qty-${product.id}`}
            className="font-mono font-semibold text-sm min-w-[52px] text-center px-2 py-1 rounded-lg bg-white border border-gray-200">
            {fmtQty(qty)}
          </button>
          <button onClick={() => onInc(product.id)} data-testid={`cart-inc-${product.id}`} className="h-7 w-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100">
            <Plus size={14} />
          </button>
        </div>
        <div className="font-mono font-bold text-emerald-700">{rupiah(tier.price * qty)}</div>
      </div>
    </div>
  );
});

/* ---------- Cart Panel ---------- */
const CartPanel = memo(function CartPanel({ cart, total, onInc, onDec, onRemove, onClear, onEditQty, onCheckout }) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h2 className="font-heading font-bold text-lg flex items-center gap-2 text-emerald-900">
          <ShoppingCart size={20} /> Keranjang
        </h2>
        {cart.length > 0 && (
          <button data-testid="cart-clear" onClick={onClear} className="text-xs text-red-500 hover:underline">Kosongkan</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 no-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <ShoppingCart size={56} strokeWidth={1.2} />
            <p className="text-sm text-gray-400">Keranjang kosong</p>
          </div>
        ) : cart.map((c) => (
          <CartItem key={c.product.id} item={c} onInc={onInc} onDec={onDec} onRemove={onRemove} onEditQty={onEditQty} />
        ))}
      </div>

      <div className="border-t border-gray-200 p-4 flex-shrink-0 bg-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-500">Total</span>
          <span data-testid="cart-total" className="font-mono font-extrabold text-2xl text-emerald-800">{rupiah(total)}</span>
        </div>
        <button data-testid="checkout-btn" disabled={cart.length === 0} onClick={onCheckout}
          className="w-full py-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2">
          Bayar
        </button>
      </div>
    </div>
  );
});

/* ---------- Main POS ---------- */
export default function POS() {
  const { location } = useAuth();
  const [allProducts, setAllProducts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PRODUCTS_CACHE)) || []; } catch { return []; }
  });
  const [categories, setCategories] = useState([]);
  const [cat, setCat] = useState("Semua");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(() => allProducts.length === 0);
  const [isFull, setIsFull] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const [numpad, setNumpad] = useState({ open: false, product: null, initial: null });
  const [showSheet, setShowSheet] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const scrollRef = useRef(null);

  const loadProducts = useCallback(() => {
    api.get("/products").then((r) => {
      setAllProducts(r.data);
      try { localStorage.setItem(PRODUCTS_CACHE, JSON.stringify(r.data)); } catch {}
    }).catch((e) => toast.error(apiErr(e))).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { api.get("/meta").then((r) => setCategories(r.data.categories || [])).catch(() => {}); }, []);
  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Debounce search (150ms)
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 150);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Client-side filtering (memoized) — no re-fetch on filter change
  const filtered = useMemo(() => {
    return allProducts.filter((p) => {
      if (cat !== "Semua" && p.category !== cat) return false;
      if (search && !(p.name.toLowerCase().includes(search) || (p.sku || "").toLowerCase().includes(search))) return false;
      return true;
    });
  }, [allProducts, cat, search]);

  useEffect(() => { setVisible(PAGE_SIZE); if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [cat, search]);

  const pageItems = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  const onScroll = useCallback((e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      setVisible((v) => (v < filtered.length ? v + PAGE_SIZE : v));
    }
  }, [filtered.length]);

  /* ---- cart mutations (stable) ---- */
  const addToCart = useCallback((product, qty) => {
    const stock = stockAt(product, location);
    setCart((cs) => {
      const i = cs.findIndex((c) => c.product.id === product.id);
      if (qty > stock) { toast.error(`Stok ${product.name} hanya ${fmtQty(stock)} ${product.unit}`); return cs; }
      if (i >= 0) { const copy = cs.slice(); copy[i] = { ...copy[i], qty }; return copy; }
      return [...cs, { product, qty }];
    });
  }, [location]);

  const onProductClick = useCallback((product) => {
    if (stockAt(product, location) <= 0) { toast.error("Stok habis di cabang ini"); return; }
    if (product.is_decimal_allowed) {
      setCart((cs) => {
        const ex = cs.find((c) => c.product.id === product.id);
        setNumpad({ open: true, product, initial: ex?.qty || null });
        return cs;
      });
    } else {
      setCart((cs) => {
        const i = cs.findIndex((c) => c.product.id === product.id);
        const stock = stockAt(product, location);
        const newQty = (i >= 0 ? cs[i].qty : 0) + 1;
        if (newQty > stock) { toast.error(`Stok ${product.name} hanya ${fmtQty(stock)} ${product.unit}`); return cs; }
        if (i >= 0) { const copy = cs.slice(); copy[i] = { ...copy[i], qty: newQty }; return copy; }
        return [...cs, { product, qty: newQty }];
      });
    }
  }, [location]);

  const incItem = useCallback((id) => {
    setCart((cs) => cs.map((c) => {
      if (c.product.id !== id) return c;
      const step = c.product.is_decimal_allowed ? 0.25 : 1;
      return { ...c, qty: +(c.qty + step).toFixed(2) };
    }));
  }, []);
  const decItem = useCallback((id) => {
    setCart((cs) => cs.map((c) => {
      if (c.product.id !== id) return c;
      const step = c.product.is_decimal_allowed ? 0.25 : 1;
      return { ...c, qty: Math.max(step, +(c.qty - step).toFixed(2)) };
    }));
  }, []);
  const removeItem = useCallback((id) => setCart((cs) => cs.filter((c) => c.product.id !== id)), []);
  const clearCart = useCallback(() => setCart([]), []);
  const onEditQty = useCallback((product, qty) => setNumpad({ open: true, product, initial: qty }), []);

  const cartTotal = useMemo(
    () => cart.reduce((s, c) => s + resolvePrice(c.product, c.qty).price * c.qty, 0),
    [cart]
  );
  const cartCount = cart.length;

  const closeNumpad = useCallback(() => setNumpad({ open: false, product: null, initial: null }), []);
  const confirmNumpad = useCallback((qty) => {
    setNumpad((np) => { if (np.product) addToCart(np.product, qty); return { open: false, product: null, initial: null }; });
    toast.success("Ditambahkan ke keranjang");
  }, [addToCart]);

  const gridCols = isFull ? "grid-cols-3 md:grid-cols-5" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
  const stockFor = useCallback((p) => stockAt(p, location), [location]);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Catalog */}
      <div className="flex-1 lg:w-[62%] flex flex-col min-w-0 h-full">
        <div className="p-3 sm:p-4 flex-shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input data-testid="pos-search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Cari produk / scan barcode..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:border-emerald-500 outline-none" />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {["Semua", ...categories].map((c) => (
              <button key={c} data-testid={`cat-${c}`} onClick={() => setCat(c)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                  cat === c ? "bg-emerald-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-emerald-300"
                }`}>{c}</button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4 pb-24 lg:pb-4">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-gray-400 gap-2"><Package size={40} /><p>Tidak ada produk</p></div>
          ) : (
            <>
              <div className={`grid ${gridCols} gap-2 sm:gap-3`}>
                {pageItems.map((p) => (
                  <ProductCard key={p.id} product={p} stock={stockFor(p)} onClick={onProductClick} />
                ))}
              </div>
              {visible < filtered.length && (
                <div className="py-4 text-center text-xs text-gray-400">Memuat produk lainnya… ({visible}/{filtered.length})</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Cart desktop */}
      <div className="hidden lg:flex lg:w-[38%] border-l border-gray-200 h-full">
        <CartPanel cart={cart} total={cartTotal} onInc={incItem} onDec={decItem} onRemove={removeItem}
          onClear={clearCart} onEditQty={onEditQty} onCheckout={() => setCheckout(true)} />
      </div>

      {/* Mobile floating cart bar */}
      {cartCount > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40">
          <button data-testid="mobile-cart-bar" onClick={() => setShowSheet(true)}
            className="w-full bg-emerald-600 text-white rounded-lg px-4 py-3.5 flex items-center justify-between border border-emerald-700">
            <span className="flex items-center gap-2 font-semibold"><ShoppingCart size={20} /> {cartCount} Item</span>
            <span className="font-mono font-bold">{rupiah(cartTotal)}</span>
            <span className="font-heading font-bold">Lihat →</span>
          </button>
        </div>
      )}

      {/* Mobile bottom sheet (instant) */}
      {showSheet && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setShowSheet(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white w-full rounded-t-2xl max-h-[85dvh] h-[85dvh] flex flex-col">
            <div className="flex justify-center pt-2"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <CartPanel cart={cart} total={cartTotal} onInc={incItem} onDec={decItem} onRemove={removeItem}
              onClear={clearCart} onEditQty={onEditQty} onCheckout={() => { setShowSheet(false); setCheckout(true); }} />
          </div>
        </div>
      )}

      <Numpad open={numpad.open} product={numpad.product} initial={numpad.initial}
        onClose={closeNumpad} onConfirm={confirmNumpad} />

      {checkout && (
        <CheckoutModal cart={cart} total={cartTotal} location={location}
          onClose={() => setCheckout(false)}
          onDone={(txn) => { setCheckout(false); setCart([]); setReceipt(txn); loadProducts(); }} />
      )}

      {receipt && <Receipt txn={receipt.txn} customer={receipt.customer} onClose={() => setReceipt(null)} />}
    </div>
  );
}

/* ---------- Checkout Modal (instant) ---------- */
function CheckoutModal({ cart, total, location, onClose, onDone }) {
  const [method, setMethod] = useState("Cash");
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {}); }, []);

  const grand = useMemo(() => Math.max(0, total - (Number(discount) || 0)), [total, discount]);
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
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] flex flex-col border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="font-heading font-bold text-xl">Pembayaran</h3>
          <button onClick={onClose} data-testid="checkout-close" className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-4 space-y-4 flex-1">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
            <div className="text-sm text-emerald-600">Total Tagihan</div>
            <div data-testid="checkout-grand" className="font-mono font-extrabold text-3xl text-emerald-800">{rupiah(grand)}</div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Diskon (Rp)</label>
            <input data-testid="checkout-discount" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)}
              className="w-full mt-1 px-4 py-2.5 rounded-lg border border-gray-200 font-mono outline-none focus:border-emerald-500" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Metode Pembayaran</label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENTS.map((p) => (
                <button key={p.key} data-testid={`pay-${p.key}`} onClick={() => setMethod(p.key)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium ${
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
                className="w-full mt-1 px-4 py-2.5 rounded-lg border border-gray-200 font-mono text-lg outline-none focus:border-emerald-500" />
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
                <div className={`mt-2 text-sm rounded-lg px-3 py-2 ${overLimit ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  Sisa limit kredit: <b className="font-mono">{rupiah(creditLeft)}</b>
                  {overLimit && <div className="font-semibold mt-0.5">⚠ Transaksi melebihi limit!</div>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <button data-testid="checkout-confirm" disabled={submitting || overLimit} onClick={submit}
            className="w-full py-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting && <Loader2 className="animate-spin" size={20} />} Proses Pembayaran
          </button>
        </div>
      </div>
    </div>
  );
}
