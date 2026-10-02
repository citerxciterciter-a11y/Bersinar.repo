import { useState, useEffect, useCallback } from "react";
import api, { apiErr } from "@/lib/api";
import { rupiah, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, X, FileText, HandCoins } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function Receivables() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/reports/receivables").then((r) => setData(r.data)).catch((e) => toast.error(apiErr(e))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const aging = data?.aging || {};
  const buckets = [
    { key: "current", label: "Belum Jatuh Tempo", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { key: "d1_30", label: "1-30 Hari", color: "text-amber-700 bg-amber-50 border-amber-200" },
    { key: "d31_60", label: "31-60 Hari", color: "text-orange-700 bg-orange-50 border-orange-200" },
    { key: "d60_plus", label: "> 60 Hari", color: "text-red-700 bg-red-50 border-red-200" },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-900 tracking-tight flex items-center gap-2"><FileText /> Piutang / Bon Pelanggan</h1>
        <p className="text-gray-500 text-sm">Total piutang: <b className="text-emerald-700 font-mono">{rupiah(data?.total || 0)}</b></p>
      </div>

      {loading ? <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {buckets.map((b) => (
              <div key={b.key} data-testid={`aging-${b.key}`} className={`rounded-2xl border p-4 ${b.color}`}>
                <div className="text-xs font-medium">{b.label}</div>
                <div className="font-mono font-extrabold text-xl mt-1">{rupiah(aging[b.key] || 0)}</div>
              </div>
            ))}
          </div>

          <h2 className="font-heading font-bold text-lg mb-2">Daftar Pelanggan Berpiutang</h2>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pelanggan</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Limit</th>
                    <th className="px-4 py-3 font-medium">Sisa Piutang</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(data?.customers || []).length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Tidak ada piutang berjalan</td></tr>}
                  {(data?.customers || []).map((c) => (
                    <tr key={c.id} data-testid={`recv-row-${c.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{c.name}</td>
                      <td className="px-4 py-3 font-mono text-gray-500 hidden sm:table-cell">{rupiah(c.credit_limit)}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-red-600">{rupiah(c.current_credit)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {c.overdue ? <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">Jatuh Tempo</span>
                          : <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">Lancar</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button data-testid={`pay-recv-${c.id}`} onClick={() => setPayModal(c)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-transform active:scale-95">
                          <HandCoins size={14} /> Pelunasan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {payModal && <PaymentForm customer={payModal} onClose={() => setPayModal(null)} onSaved={() => { setPayModal(null); load(); }} />}
    </div>
  );
}

function PaymentForm({ customer, onClose, onSaved }) {
  const [amount, setAmount] = useState(customer.current_credit);
  const [method, setMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const field = "w-full px-3 py-2.5 rounded-lg border border-gray-200 outline-none focus:border-emerald-500 text-sm";

  const save = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Jumlah tidak valid"); return; }
    setSaving(true);
    try {
      await api.post("/credit-payments", { customer_id: customer.id, payment_amount: Number(amount), payment_method: method, notes });
      toast.success("Pembayaran piutang dicatat, limit dipulihkan"); onSaved();
    } catch (e) { toast.error(apiErr(e)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose} data-testid="payment-form-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col animate-slide-up shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-heading font-bold text-xl">Pelunasan Bon</h3>
          <button onClick={onClose} data-testid="payment-close" className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="font-semibold">{customer.name}</div>
            <div className="text-sm text-gray-600">Sisa piutang: <b className="font-mono text-red-600">{rupiah(customer.current_credit)}</b></div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Jumlah Pembayaran (Rp)</label>
            <input data-testid="pay-amount" type="number" className={`${field} font-mono text-lg`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Metode</label>
            <div className="grid grid-cols-2 gap-2">
              {["Cash", "Transfer"].map((m) => (
                <button key={m} data-testid={`pay-method-${m}`} onClick={() => setMethod(m)}
                  className={`py-2.5 rounded-xl border text-sm font-medium ${method === m ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-gray-200 text-gray-600"}`}>{m === "Cash" ? "Tunai" : "Transfer"}</button>
              ))}
            </div>
          </div>
          <div><label className="text-sm font-medium text-gray-700">Catatan</label><input data-testid="pay-notes" className={field} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="p-4 border-t border-gray-100">
          <button data-testid="pay-save" onClick={save} disabled={saving}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50">
            {saving && <Loader2 className="animate-spin" size={20} />} Catat Pembayaran
          </button>
        </div>
      </div>
    </div>
  );
}
