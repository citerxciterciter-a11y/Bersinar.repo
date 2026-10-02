import { useState, useEffect, useCallback } from "react";
import api, { apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { rupiah, fmtQty, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import Numpad from "@/components/Numpad";
import { Loader2, Trash2, Plus, X, AlertOctagon } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const REASONS = ["Busuk", "Layu", "Pecah", "Dimakan Hama", "Kadaluarsa"];

export default function Waste() {
  const { location } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/waste", { params: { location } })
      .then((r) => setLogs(r.data)).catch((e) => toast.error(apiErr(e))).finally(() => setLoading(false));
  }, [location]);

  useEffect(() => { load(); }, [load]);

  const totalLoss = logs.reduce((s, l) => s + l.total_loss_cogs, 0);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-red-700 tracking-tight flex items-center gap-2">
            <AlertOctagon /> Barang Rusak / Busuk
          </h1>
          <p className="text-gray-500 text-sm">Lokasi: {location} • Total kerugian: <b className="text-red-600 font-mono">{rupiah(totalLoss)}</b></p>
        </div>
        <button data-testid="add-waste-btn" onClick={() => setModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-transform duration-150 active:scale-95">
          <Plus size={20} /> Catat Barang Rusak
        </button>
      </div>

      {loading ? <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div> : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Produk</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Alasan</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Lokasi</th>
                  <th className="px-4 py-3 font-medium">Kerugian</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Belum ada catatan barang rusak</td></tr>}
                {logs.map((l) => (
                  <tr key={l.id} data-testid={`waste-row-${l.id}`} className="hover:bg-red-50/40">
                    <td className="px-4 py-3 font-semibold">{l.product_name}</td>
                    <td className="px-4 py-3 font-mono">{fmtQty(l.qty)} {l.unit}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">{l.reason}</span></td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{l.location_name}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-red-600">-{rupiah(l.total_loss_cogs)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{fmtDate(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && <WasteForm location={location} onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
    </div>
  );
}

function WasteForm({ location, onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("Busuk");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [numpad, setNumpad] = useState(false);

  useEffect(() => { api.get("/products").then((r) => setProducts(r.data)).catch(() => {}); }, []);
  const product = products.find((p) => p.id === productId);

  const save = async () => {
    if (!productId) { toast.error("Pilih produk"); return; }
    if (!qty || Number(qty) <= 0) { toast.error("Masukkan kuantitas"); return; }
    setSaving(true);
    try {
      await api.post("/waste", { product_id: productId, location_name: location, qty: Number(qty), reason, notes });
      toast.success("Barang rusak dicatat, stok dipotong");
      onSaved();
    } catch (e) { toast.error(apiErr(e)); } finally { setSaving(false); }
  };

  const field = "w-full px-3 py-2.5 rounded-lg border border-gray-200 outline-none focus:border-red-400 text-sm";

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose} data-testid="waste-form-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-red-50 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] flex flex-col animate-slide-up shadow-2xl border border-red-200">
        <div className="flex items-center justify-between p-4 border-b border-red-200 flex-shrink-0">
          <h3 className="font-heading font-bold text-xl text-red-700">Catat Barang Rusak</h3>
          <button onClick={onClose} data-testid="waste-form-close" className="p-2 rounded-lg hover:bg-red-100"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          <div>
            <label className="text-sm font-medium text-gray-700">Produk</label>
            <Select value={productId} onValueChange={(v) => { setProductId(v); setQty(""); }}>
              <SelectTrigger data-testid="waste-product" className="mt-0.5 bg-white"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id} data-testid={`waste-prod-opt-${p.id}`}>{p.name} ({p.unit})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Kuantitas ({product?.unit || "unit"})</label>
            {product?.is_decimal_allowed ? (
              <button data-testid="waste-qty-numpad" onClick={() => setNumpad(true)} className={`${field} bg-white text-left font-mono`}>
                {qty ? `${fmtQty(qty)} ${product.unit}` : "Ketuk untuk input berat"}
              </button>
            ) : (
              <input data-testid="waste-qty" type="number" className={`${field} bg-white font-mono`} value={qty} onChange={(e) => setQty(e.target.value)} />
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Alasan</label>
            <div className="grid grid-cols-3 gap-2">
              {REASONS.map((r) => (
                <button key={r} data-testid={`waste-reason-${r}`} onClick={() => setReason(r)}
                  className={`py-2 rounded-lg text-xs font-medium border transition-colors ${reason === r ? "bg-red-600 text-white border-red-600" : "bg-white border-gray-200 text-gray-600"}`}>{r}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Catatan (opsional)</label>
            <input data-testid="waste-notes" className={`${field} bg-white`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {product && qty > 0 && (
            <div className="bg-white rounded-xl p-3 border border-red-200 text-sm">
              Estimasi kerugian HPP: <b className="font-mono text-red-600">{rupiah((product.cogs_price || 0) * Number(qty))}</b>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-red-200 flex-shrink-0">
          <button data-testid="waste-save" onClick={save} disabled={saving}
            className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-heading font-bold flex items-center justify-center gap-2 transition-transform duration-150 active:scale-95 disabled:opacity-50">
            {saving && <Loader2 className="animate-spin" size={20} />} Simpan & Potong Stok
          </button>
        </div>
      </div>
      {product && <Numpad open={numpad} product={product} initial={qty || null}
        onClose={() => setNumpad(false)} onConfirm={(v) => { setQty(String(v)); setNumpad(false); }} />}
    </div>
  );
}
