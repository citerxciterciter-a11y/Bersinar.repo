import { useState, useEffect, useCallback } from "react";
import api, { apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { rupiah } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, Plus, X, Pencil, Trash2, Users, Phone, CreditCard } from "lucide-react";

export default function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/customers").then((r) => setCustomers(r.data)).catch((e) => toast.error(apiErr(e))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = async (c) => {
    if (!window.confirm(`Hapus pelanggan ${c.name}?`)) return;
    try { await api.delete(`/customers/${c.id}`); toast.success("Pelanggan dihapus"); load(); }
    catch (e) { toast.error(apiErr(e)); }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-900 tracking-tight flex items-center gap-2"><Users /> Pelanggan B2B</h1>
          <p className="text-gray-500 text-sm">{customers.length} pelanggan terdaftar</p>
        </div>
        <button data-testid="add-customer-btn" onClick={() => setModal("new")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          <Plus size={20} /> Tambah Pelanggan
        </button>
      </div>

      {loading ? <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {customers.map((c) => {
            const used = c.credit_limit ? (c.current_credit / c.credit_limit) * 100 : 0;
            return (
              <div key={c.id} data-testid={`customer-card-${c.id}`} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-heading font-bold text-lg">{c.name}</div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">{c.customer_type}</span>
                  </div>
                  <div className="flex gap-1">
                    <button data-testid={`edit-customer-${c.id}`} onClick={() => setModal(c)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><Pencil size={15} /></button>
                    {user?.role === "admin" && <button data-testid={`del-customer-${c.id}`} onClick={() => del(c)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>}
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-500 space-y-1">
                  <div className="flex items-center gap-2"><Phone size={14} /> {c.phone || "-"}</div>
                  <div className="flex items-center gap-2"><CreditCard size={14} /> Jatuh tempo {c.payment_terms_days} hari</div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Pemakaian Kredit</span>
                    <span className="font-mono font-semibold">{rupiah(c.current_credit)} / {rupiah(c.credit_limit)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full ${used > 90 ? "bg-red-500" : used > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, used)}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && <CustomerForm customer={modal === "new" ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function CustomerForm({ customer, onClose, onSaved }) {
  const i = customer || {};
  const [form, setForm] = useState({
    name: i.name || "", phone: i.phone || "", address: i.address || "",
    customer_type: i.customer_type || "B2B", credit_limit: i.credit_limit ?? 0, payment_terms_days: i.payment_terms_days ?? 30,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const field = "w-full px-3 py-2.5 rounded-lg border border-gray-200 outline-none focus:border-emerald-500 text-sm";

  const save = async () => {
    if (!form.name) { toast.error("Nama wajib diisi"); return; }
    setSaving(true);
    const payload = { ...form, credit_limit: Number(form.credit_limit) || 0, payment_terms_days: Number(form.payment_terms_days) || 0 };
    try {
      if (customer) await api.put(`/customers/${customer.id}`, payload);
      else await api.post("/customers", payload);
      toast.success("Pelanggan disimpan"); onSaved();
    } catch (e) { toast.error(apiErr(e)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose} data-testid="customer-form-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] flex flex-col animate-slide-up border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-heading font-bold text-xl">{customer ? "Edit Pelanggan" : "Tambah Pelanggan"}</h3>
          <button onClick={onClose} data-testid="customer-form-close" className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto p-4 space-y-3 flex-1 min-h-0">
          <div><label className="text-sm font-medium text-gray-700">Nama Usaha / Toko *</label><input data-testid="cf-name" className={field} value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">No. HP / WhatsApp</label><input data-testid="cf-phone" className={field} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="628xxx" /></div>
          <div><label className="text-sm font-medium text-gray-700">Alamat</label><input data-testid="cf-address" className={field} value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium text-gray-700">Limit Kredit (Rp)</label><input data-testid="cf-limit" type="number" className={field} value={form.credit_limit} onChange={(e) => set("credit_limit", e.target.value)} /></div>
            <div><label className="text-sm font-medium text-gray-700">Jatuh Tempo (hari)</label><input data-testid="cf-terms" type="number" className={field} value={form.payment_terms_days} onChange={(e) => set("payment_terms_days", e.target.value)} /></div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button data-testid="cf-save" onClick={save} disabled={saving}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="animate-spin" size={20} />} Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
