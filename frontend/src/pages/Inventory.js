import { useState, useEffect, useCallback } from "react";
import api, { apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { rupiah, fmtQty, categoryColor } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Boxes, Check, Pencil } from "lucide-react";

export default function Inventory() {
  const { location } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null); // {product_id, location_name, val}

  const load = useCallback(() => {
    setLoading(true);
    api.get("/inventory", { params: { location } })
      .then((r) => setItems(r.data)).catch((e) => toast.error(apiErr(e))).finally(() => setLoading(false));
  }, [location]);

  useEffect(() => { load(); }, [load]);

  const saveAdjust = async () => {
    try {
      await api.post("/inventory/adjust", null, { params: {
        product_id: edit.product_id, location_name: edit.location_name, new_qty: Number(edit.val) || 0,
      }});
      toast.success("Stok diperbarui"); setEdit(null); load();
    } catch (e) { toast.error(apiErr(e)); }
  };

  const lowItems = items.filter((i) => i.low);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-900 tracking-tight flex items-center gap-2">
          <Boxes /> Stok & Gudang
        </h1>
        <p className="text-gray-500 text-sm">Lokasi: {location}</p>
      </div>

      {lowItems.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-amber-800">{lowItems.length} produk stok menipis!</div>
            <div className="text-sm text-amber-700">{lowItems.slice(0, 6).map((i) => i.name).join(", ")}{lowItems.length > 6 ? "..." : ""}</div>
          </div>
        </div>
      )}

      {loading ? <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div> : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Produk</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Lokasi</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">HPP</th>
                  <th className="px-4 py-3 font-medium">Stok</th>
                  <th className="px-4 py-3 font-medium">Min</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((i) => (
                  <tr key={`${i.product_id}-${i.location_name}`} data-testid={`inv-row-${i.product_id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{i.name}</div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${categoryColor(i.category)}`}>{i.category}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{i.location_name}</td>
                    <td className="px-4 py-3 font-mono text-gray-500 hidden md:table-cell">{rupiah(i.cogs_price)}</td>
                    <td className="px-4 py-3">
                      {edit && edit.product_id === i.product_id && edit.location_name === i.location_name ? (
                        <div className="flex items-center gap-1">
                          <input data-testid="inv-edit-input" type="number" autoFocus value={edit.val} onChange={(e) => setEdit({ ...edit, val: e.target.value })}
                            className="w-20 px-2 py-1 rounded-lg border border-emerald-400 font-mono text-sm outline-none" />
                          <button data-testid="inv-save" onClick={saveAdjust} className="p-1.5 rounded-lg bg-emerald-600 text-white"><Check size={14} /></button>
                        </div>
                      ) : (
                        <span className={`font-mono font-semibold ${i.low ? "text-amber-600" : ""}`}>{fmtQty(i.stock_quantity)} {i.unit}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400">{fmtQty(i.min_stock_alert)}</td>
                    <td className="px-4 py-3 text-right">
                      <button data-testid={`inv-edit-${i.product_id}`} onClick={() => setEdit({ product_id: i.product_id, location_name: i.location_name, val: i.stock_quantity })}
                        className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600"><Pencil size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
