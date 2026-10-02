import { useState, useEffect, useCallback } from "react";
import api, { apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2, Plus, X, Trash2, UserCog } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/users").then((r) => setUsers(r.data)).catch((e) => toast.error(apiErr(e))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = async (u) => {
    if (!window.confirm(`Hapus pengguna ${u.name}?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success("Pengguna dihapus"); load(); }
    catch (e) { toast.error(apiErr(e)); }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-900 tracking-tight flex items-center gap-2"><UserCog /> Pengguna</h1>
          <p className="text-gray-500 text-sm">Kelola akun admin & kasir</p>
        </div>
        <button data-testid="add-user-btn" onClick={() => setModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
          <Plus size={20} /> Tambah Kasir
        </button>
      </div>

      {loading ? <div className="h-40 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div> : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr><th className="px-4 py-3 font-medium">Nama</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 text-right font-medium">Aksi</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} data-testid={`user-row-${u.id}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === "admin" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>{u.role}</span></td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== user.id && <button data-testid={`del-user-${u.id}`} onClick={() => del(u)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <UserForm onClose={() => setModal(false)} onSaved={() => { setModal(false); load(); }} />}
    </div>
  );
}

function UserForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "kasir" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const field = "w-full px-3 py-2.5 rounded-lg border border-gray-200 outline-none focus:border-emerald-500 text-sm";

  const save = async () => {
    if (!form.name || !form.email || !form.password) { toast.error("Lengkapi semua field"); return; }
    setSaving(true);
    try { await api.post("/users", form); toast.success("Pengguna ditambahkan"); onSaved(); }
    catch (e) { toast.error(apiErr(e)); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose} data-testid="user-form-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col animate-slide-up border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-heading font-bold text-xl">Tambah Pengguna</h3>
          <button onClick={onClose} data-testid="user-form-close" className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div><label className="text-sm font-medium text-gray-700">Nama</label><input data-testid="uf-name" className={field} value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">Email</label><input data-testid="uf-email" type="email" className={field} value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><label className="text-sm font-medium text-gray-700">Password</label><input data-testid="uf-password" type="password" className={field} value={form.password} onChange={(e) => set("password", e.target.value)} /></div>
          <div>
            <label className="text-sm font-medium text-gray-700">Role</label>
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger data-testid="uf-role" className="mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="kasir">Kasir</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100">
          <button data-testid="uf-save" onClick={save} disabled={saving}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="animate-spin" size={20} />} Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
