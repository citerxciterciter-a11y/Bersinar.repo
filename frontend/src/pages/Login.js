import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiErr } from "@/lib/api";
import { Sprout, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("citerxciter.citer@gmail.com");
  const [password, setPassword] = useState("bersinar123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (ex) {
      setErr(apiErr(ex));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full flex">
      {/* Left brand */}
      <div className="hidden lg:flex w-1/2 bg-emerald-900 relative overflow-hidden flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-lime-400 flex items-center justify-center text-emerald-900">
            <Sprout size={28} />
          </div>
          <span className="font-heading font-extrabold text-2xl tracking-tight">BERSINAR</span>
        </div>
        <div>
          <h1 className="font-heading font-extrabold text-5xl leading-tight tracking-tight">
            Kasir Pintar<br />untuk Toko<br /><span className="text-lime-400">Sayur & Sembako</span>
          </h1>
          <p className="mt-6 text-emerald-200 text-lg max-w-md">
            POS Omnichannel multi-cabang. Timbangan desimal, multi-tier pricing, bon piutang B2B, dan laporan laba rugi real-time.
          </p>
        </div>
        <div className="text-emerald-300 text-sm">Omnichannel • Multi-Cabang • Fully Responsive</div>
        <div className="absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-lime-400/10" />
        <div className="absolute right-20 top-20 h-40 w-40 rounded-full bg-emerald-700/40" />
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[#F9F8F6]">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white">
              <Sprout size={24} />
            </div>
            <span className="font-heading font-extrabold text-2xl text-emerald-900">BERSINAR</span>
          </div>
          <h2 className="font-heading font-bold text-3xl text-emerald-900 tracking-tight">Masuk</h2>
          <p className="text-gray-500 mt-1 mb-6">Silakan masuk untuk mengakses kasir.</p>

          {err && <div data-testid="login-error" className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{err}</div>}

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full mb-4 px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none" />

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="w-full mb-6 px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none" />

          <button data-testid="login-submit" disabled={loading}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 className="animate-spin" size={20} />} Masuk
          </button>

          <div className="mt-6 text-xs text-gray-400 text-center">
            Admin: citerxciter.citer@gmail.com / bersinar123<br />Kasir: kasir@bersinar.id / kasir123
          </div>
        </form>
      </div>
    </div>
  );
}
