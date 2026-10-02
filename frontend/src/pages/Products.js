import { useState, useEffect, useCallback, useRef } from "react";
import api, { apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { rupiah, categoryColor, fmtQty, thumb } from "@/lib/format";
import { compressImage, dataUrlKb } from "@/lib/image";
import { toast } from "sonner";
import {
  Plus, Search, Pencil, Trash2, X, Loader2, Package, Image as ImageIcon,
  ScanLine, Upload,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const CAT_IMG = {
  Sayur: "https://images.unsplash.com/photo-1557844352-761f2565b576?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwzfHxmcmVzaCUyMG9yZ2FuaWMlMjB2ZWdldGFibGVzJTIwbWFya2V0fGVufDB8fHx8MTc5MDkyMDIzNnww&ixlib=rb-4.1.0&q=85",
  Buah: "https://images.unsplash.com/photo-1557844352-761f2565b576?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwzfHxmcmVzaCUyMG9yZ2FuaWMlMjB2ZWdldGFibGVzJTIwbWFya2V0fGVufDB8fHx8MTc5MDkyMDIzNnww&ixlib=rb-4.1.0&q=85",
  Sembako: "https://images.pexels.com/photos/38781904/pexels-photo-38781904.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  Minuman: "https://images.pexels.com/photos/38781904/pexels-photo-38781904.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  Daging: "https://images.unsplash.com/photo-1690983330536-3b0089d07cf9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODF8MHwxfHNlYXJjaHwzfHxmcmVzaCUyMHJhdyUyMGJlZWYlMjBidXRjaGVyfGVufDB8fHx8MTc5MDkyMDIzNnww&ixlib=rb-4.1.0&q=85",
};

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ categories: [], units: [], locations: [], tiers: [] });
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("Semua");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | product

  const load = useCallback(() => {
    setLoading(true);
    api.get("/products", { params: { category: cat, search } })
      .then((r) => setProducts(r.data)).catch((e) => toast.error(apiErr(e))).finally(() => setLoading(false));
  }, [cat, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/meta").then((r) => setMeta(r.data)).catch(() => {}); }, []);

  const del = async (p) => {
    if (!window.confirm(`Hapus produk ${p.name}?`)) return;
    try { await api.delete(`/products/${p.id}`); toast.success("Produk dihapus"); load(); }
    catch (e) { toast.error(apiErr(e)); }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-900 tracking-tight">Kelola Produk</h1>
          <p className="text-gray-500 text-sm">{products.length} produk terdaftar</p>
        </div>
        <button data-testid="add-product-btn" onClick={() => setModal("new")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          <Plus size={20} /> Tambah Produk Baru
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input data-testid="product-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / SKU..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white outline-none focus:border-emerald-500" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger data-testid="product-cat-filter" className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["Semua", ...(meta.categories || [])].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Produk</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">SKU</th>
                  <th className="px-4 py-3 font-medium">Harga Eceran</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">HPP</th>
                  <th className="px-4 py-3 font-medium">Stok Total</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} data-testid={`product-row-${p.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          {p.image_url ? <img src={thumb(p.image_url, 80, 80)} alt="" width="40" height="40" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={18} /></div>}
                        </div>
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${categoryColor(p.category)}`}>{p.category}</span>
                          {p.is_decimal_allowed && <span className="ml-1 text-[10px] text-gray-400">• desimal</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden sm:table-cell">{p.sku}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{rupiah(p.retail_price)}<span className="text-gray-400 text-xs">/{p.unit}</span></td>
                    <td className="px-4 py-3 font-mono text-gray-500 hidden md:table-cell">{rupiah(p.cogs_price)}</td>
                    <td className="px-4 py-3 font-mono">{fmtQty(p.total_stock)} {p.unit}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button data-testid={`edit-product-${p.id}`} onClick={() => setModal(p)} className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600"><Pencil size={16} /></button>
                        {user?.role === "admin" && <button data-testid={`del-product-${p.id}`} onClick={() => del(p)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && <ProductForm meta={meta} product={modal === "new" ? null : modal} catImg={CAT_IMG}
        onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function ProductForm({ meta, product, catImg, onClose, onSaved }) {
  const locations = meta.locations || [];
  const tierNames = meta.tiers || ["Eceran", "Grosir", "Partai"];
  const init = product || {};
  const [form, setForm] = useState({
    name: init.name || "", sku: init.sku || "", barcode: init.barcode || "", category: init.category || "Sayur",
    unit: init.unit || "Kg", is_decimal_allowed: init.is_decimal_allowed || false,
    is_expirable: init.is_expirable || false, expired_date: init.expired_date || "",
    min_stock_alert: init.min_stock_alert ?? 10, image_url: init.image_url || "",
  });
  const [imgSize, setImgSize] = useState(500);
  const [imgBusy, setImgBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef(null);
  const [tiers, setTiers] = useState(
    init.tiers?.length ? init.tiers.map((t) => ({ ...t })) : [{ tier_name: "Eceran", min_qty: 1, price: 0 }]
  );
  const [locs, setLocs] = useState(
    locations.map((l) => {
      const ex = init.locations?.find((x) => x.location_name === l);
      return { location_name: l, stock_quantity: ex?.stock_quantity ?? 0, cogs_price: ex?.cogs_price ?? 0 };
    })
  );
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onPickImage = async (file) => {
    if (!file) return;
    setImgBusy(true);
    try {
      const dataUrl = await compressImage(file, imgSize, 0.72);
      set("image_url", dataUrl);
      toast.success(`Gambar dikompres (~${dataUrlKb(dataUrl)} KB)`);
    } catch (e) { toast.error(e.message || "Gagal memproses gambar"); }
    finally { setImgBusy(false); }
  };

  // Scan-to-form: capture one barcode from a wired scanner into the barcode field
  useEffect(() => {
    if (!scanning) return;
    let buffer = ""; let last = 0;
    const onKey = (e) => {
      const now = Date.now(); const gap = now - last; last = now;
      if (gap > 80) buffer = "";
      if (e.key === "Enter") {
        if (buffer.length >= 2) { set("barcode", buffer); toast.success("Barcode terisi: " + buffer); }
        setScanning(false); e.preventDefault(); return;
      }
      if (e.key.length === 1) { if (buffer.length < 64) buffer += e.key; e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey, true);
    const to = setTimeout(() => setScanning(false), 15000);
    return () => { window.removeEventListener("keydown", onKey, true); clearTimeout(to); };
  }, [scanning]);

  const addTier = () => {
    const next = tierNames[tiers.length] || "Partai";
    setTiers((t) => [...t, { tier_name: next, min_qty: 1, price: 0 }]);
  };
  const setTier = (i, k, v) => setTiers((t) => t.map((x, idx) => idx === i ? { ...x, [k]: v } : x));
  const setLoc = (i, k, v) => setLocs((l) => l.map((x, idx) => idx === i ? { ...x, [k]: v } : x));

  const save = async () => {
    if (!form.name) { toast.error("Nama produk wajib diisi"); return; }
    setSaving(true);
    const payload = {
      ...form, min_stock_alert: Number(form.min_stock_alert) || 0,
      image_url: form.image_url || catImg[form.category] || null,
      expired_date: form.is_expirable ? form.expired_date || null : null,
      tiers: tiers.map((t) => ({ tier_name: t.tier_name, min_qty: Number(t.min_qty) || 0, price: Number(t.price) || 0 })),
      locations: locs.map((l) => ({ location_name: l.location_name, stock_quantity: Number(l.stock_quantity) || 0, cogs_price: Number(l.cogs_price) || 0 })),
    };
    try {
      if (product) await api.put(`/products/${product.id}`, payload);
      else await api.post("/products", payload);
      toast.success(product ? "Produk diperbarui" : "Produk ditambahkan");
      onSaved();
    } catch (e) { toast.error(apiErr(e)); } finally { setSaving(false); }
  };

  const field = "w-full px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-emerald-500 text-sm";

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose} data-testid="product-form-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92dvh] flex flex-col animate-slide-up border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-heading font-bold text-xl">{product ? "Edit Produk" : "Tambah Produk Baru"}</h3>
          <button onClick={onClose} data-testid="product-form-close" className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-5 flex-1 min-h-0">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-700">Nama Produk *</label>
              <input data-testid="pf-name" className={field} value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Kategori</label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger data-testid="pf-category" className="mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>{(meta.categories || []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Satuan</label>
              <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger data-testid="pf-unit" className="mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>{(meta.units || []).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">SKU (opsional)</label>
              <input data-testid="pf-sku" className={field} value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="Auto-generate" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Barcode</label>
              <div className="flex gap-2">
                <input data-testid="pf-barcode" className={field} value={form.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="Scan / ketik barcode" />
                <button type="button" data-testid="pf-scan-barcode" onClick={() => setScanning(true)}
                  className={`px-3 rounded-lg border flex items-center gap-1 text-sm font-medium flex-shrink-0 ${scanning ? "bg-amber-500 text-white border-amber-500" : "bg-white border-gray-200 text-emerald-700 hover:bg-emerald-50"}`}>
                  <ScanLine size={16} /> {scanning ? "Scan..." : "Scan"}
                </button>
              </div>
              {scanning && <p className="text-[11px] text-amber-600 mt-1">Arahkan & tembak barcode dengan scanner sekarang...</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Batas Minimum Stok</label>
              <input data-testid="pf-minstock" type="number" className={field} value={form.min_stock_alert} onChange={(e) => set("min_stock_alert", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-700">Gambar Produk</label>
              <div className="flex gap-3 items-start mt-1">
                <div className="h-24 w-24 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {form.image_url ? <img src={thumb(form.image_url, 200, 200)} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="text-gray-300" size={28} />}
                </div>
                <div className="flex-1 space-y-2">
                  <input ref={fileRef} type="file" accept="image/*" data-testid="pf-image-file" className="hidden"
                    onChange={(e) => onPickImage(e.target.files?.[0])} />
                  <div className="flex gap-2">
                    <button type="button" data-testid="pf-image-upload" onClick={() => fileRef.current?.click()} disabled={imgBusy}
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50">
                      {imgBusy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />} Unggah Foto
                    </button>
                    {form.image_url && (
                      <button type="button" data-testid="pf-image-remove" onClick={() => set("image_url", "")}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">Hapus</button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Ukuran:</span>
                    <Select value={String(imgSize)} onValueChange={(v) => setImgSize(Number(v))}>
                      <SelectTrigger data-testid="pf-image-size" className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="300">Kecil (300px) — tercepat</SelectItem>
                        <SelectItem value="500">Sedang (500px)</SelectItem>
                        <SelectItem value="800">Besar (800px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[11px] text-gray-400">Foto otomatis dikompres (JPEG) agar ringan & tidak memperlambat halaman kasir. Kosong = pakai gambar default kategori.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch data-testid="pf-decimal" checked={form.is_decimal_allowed} onCheckedChange={(v) => set("is_decimal_allowed", v)} />
              Izinkan Penjualan Desimal (timbangan)
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch data-testid="pf-expirable" checked={form.is_expirable} onCheckedChange={(v) => set("is_expirable", v)} />
              Punya Masa Simpan / Expired
            </label>
          </div>
          {form.is_expirable && (
            <div className="max-w-xs">
              <label className="text-sm font-medium text-gray-700">Tanggal Kadaluarsa</label>
              <input data-testid="pf-expdate" type="date" className={field} value={form.expired_date || ""} onChange={(e) => set("expired_date", e.target.value)} />
            </div>
          )}

          {/* Tiers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-heading font-bold text-sm">Harga Bertingkat (Multi-Tier)</h4>
              <button data-testid="pf-add-tier" onClick={addTier} className="text-emerald-600 text-sm flex items-center gap-1 hover:underline"><Plus size={14} /> Tambah Tier</button>
            </div>
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={t.tier_name} onValueChange={(v) => setTier(i, "tier_name", v)}>
                    <SelectTrigger data-testid={`pf-tier-name-${i}`} className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{tierNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex-1">
                    <input data-testid={`pf-tier-minqty-${i}`} type="number" className={field} value={t.min_qty} onChange={(e) => setTier(i, "min_qty", e.target.value)} placeholder="Min Qty" />
                  </div>
                  <div className="flex-1">
                    <input data-testid={`pf-tier-price-${i}`} type="number" className={field} value={t.price} onChange={(e) => setTier(i, "price", e.target.value)} placeholder="Harga Rp" />
                  </div>
                  {tiers.length > 1 && <button onClick={() => setTiers((ts) => ts.filter((_, idx) => idx !== i))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Harga otomatis naik-tingkat sesuai Min Qty saat kasir. Tier 1 = Eceran.</p>
          </div>

          {/* Locations stock + COGS */}
          <div>
            <h4 className="font-heading font-bold text-sm mb-2">Stok & HPP per Lokasi</h4>
            <div className="space-y-2">
              {locs.map((l, i) => (
                <div key={l.location_name} className="flex items-center gap-2">
                  <div className="w-32 text-sm font-medium text-gray-600">{l.location_name}</div>
                  <input data-testid={`pf-loc-stock-${i}`} type="number" className={field} value={l.stock_quantity} onChange={(e) => setLoc(i, "stock_quantity", e.target.value)} placeholder="Stok" />
                  <input data-testid={`pf-loc-cogs-${i}`} type="number" className={field} value={l.cogs_price} onChange={(e) => setLoc(i, "cogs_price", e.target.value)} placeholder="HPP/COGS Rp" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex-shrink-0 flex gap-2">
          <button onClick={onClose} className="px-5 py-3 rounded-xl border border-gray-200 font-semibold hover:bg-gray-50">Batal</button>
          <button data-testid="pf-save" onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="animate-spin" size={20} />} Simpan Produk
          </button>
        </div>
      </div>
    </div>
  );
}
