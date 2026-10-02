import { useState, useEffect, useCallback } from "react";
import api, { apiErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { rupiah, fmtQty, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  AreaChart, Area,
} from "recharts";
import {
  Loader2, TrendingUp, Wallet, FileText, AlertTriangle, Trash2, Receipt as RIcon,
} from "lucide-react";

const CAT_COLORS = ["#059669", "#84CC16", "#D97706", "#DC2626", "#0EA5E9", "#9CA3AF"];

export default function Dashboard() {
  const { location } = useAuth();
  const [dash, setDash] = useState(null);
  const [pl, setPl] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/reports/dashboard", { params: { location } }),
      api.get("/reports/profit-loss", { params: { location } }),
      api.get("/transactions", { params: { location, limit: 8 } }),
    ]).then(([d, p, t]) => { setDash(d.data); setPl(p.data); setTxns(t.data); })
      .catch((e) => toast.error(apiErr(e))).finally(() => setLoading(false));
  }, [location]);
  useEffect(() => { load(); }, [load]);

  if (loading || !dash) return <div className="h-full flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" /></div>;

  const stats = [
    { label: "Penjualan Hari Ini", value: rupiah(dash.today_sales), sub: `${dash.today_count} transaksi`, icon: TrendingUp, color: "bg-emerald-600" },
    { label: "Total Penjualan", value: rupiah(dash.total_sales), sub: `${dash.total_transactions} transaksi`, icon: Wallet, color: "bg-lime-600" },
    { label: "Total Piutang", value: rupiah(dash.total_receivable), sub: "Bon berjalan", icon: FileText, color: "bg-amber-600" },
    { label: "Kerugian Waste", value: rupiah(dash.total_waste_loss), sub: "Barang rusak", icon: Trash2, color: "bg-red-600" },
  ];
  const sales = (dash.sales_series || []).map((s) => ({ ...s, label: new Date(s.date).toLocaleDateString("id-ID", { weekday: "short" }) }));

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-emerald-900 tracking-tight">Dashboard Bisnis</h1>
        <p className="text-gray-500 text-sm">Ringkasan • {location}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {stats.map((s) => (
          <div key={s.label} data-testid={`stat-${s.label}`} className="bg-white rounded-2xl border border-gray-200 p-4 h-full">
            <div className={`h-10 w-10 rounded-xl ${s.color} text-white flex items-center justify-center mb-3`}><s.icon size={20} /></div>
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className="font-mono font-extrabold text-xl text-emerald-900 mt-0.5 break-words">{s.value}</div>
            <div className="text-[11px] text-gray-400">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-heading font-bold mb-3">Penjualan 7 Hari Terakhir</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={sales}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.3} /><stop offset="95%" stopColor="#059669" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v) => rupiah(v)} />
              <Area type="monotone" dataKey="total" stroke="#059669" strokeWidth={2} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-heading font-bold mb-3">Penjualan per Kategori</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dash.category_series} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={70} />
              <Tooltip formatter={(v) => rupiah(v)} />
              <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                {dash.category_series.map((e, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Profit loss */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-heading font-bold mb-3">Laba Rugi</h3>
          <div className="space-y-2 text-sm">
            <Row label="Pendapatan Kotor" value={rupiah(pl.revenue)} />
            <Row label="HPP Terjual" value={`- ${rupiah(pl.cogs_sold)}`} muted />
            <div className="border-t border-gray-100 pt-2"><Row label="Laba Kotor" value={rupiah(pl.gross_profit)} bold /></div>
            <Row label="Beban Barang Rusak" value={`- ${rupiah(pl.waste_loss)}`} danger />
            <div className="border-t-2 border-emerald-200 pt-2 mt-2">
              <Row label="Laba Bersih" value={rupiah(pl.net_profit)} bold big />
            </div>
          </div>
        </div>

        {/* Low stock */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-heading font-bold mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-500" /> Stok Menipis ({dash.low_stock_count})</h3>
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
            {dash.low_stock_items.length === 0 && <p className="text-sm text-gray-400">Semua stok aman</p>}
            {dash.low_stock_items.map((i, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm bg-amber-50 rounded-lg px-3 py-1.5">
                <span className="truncate">{i.name}</span>
                <span className="font-mono font-semibold text-amber-700">{fmtQty(i.stock_quantity)} {i.unit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent txns */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-heading font-bold mb-3 flex items-center gap-2"><RIcon size={18} /> Transaksi Terbaru</h3>
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
            {txns.length === 0 && <p className="text-sm text-gray-400">Belum ada transaksi</p>}
            {txns.map((t) => (
              <div key={t.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-1.5">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-gray-500 truncate">{t.invoice_number}</div>
                  <div className="text-[11px] text-gray-400">{t.payment_method} • {fmtDate(t.created_at)}</div>
                </div>
                <span className="font-mono font-semibold text-emerald-700">{rupiah(t.total_amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, big, muted, danger }) {
  return (
    <div className="flex justify-between">
      <span className={`${muted ? "text-gray-400" : danger ? "text-red-600" : "text-gray-600"} ${bold ? "font-semibold" : ""}`}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold" : ""} ${big ? "text-lg text-emerald-800" : ""} ${danger ? "text-red-600" : ""}`}>{value}</span>
    </div>
  );
}
