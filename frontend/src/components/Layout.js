import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  ShoppingCart, Package, Boxes, Trash2, Users, FileText, BarChart3,
  Maximize, Minimize, LogOut, Menu, X, Sprout, MapPin,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const NAV = [
  { to: "/", label: "Kasir / POS", icon: ShoppingCart, end: true },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/products", label: "Produk", icon: Package },
  { to: "/inventory", label: "Stok & Gudang", icon: Boxes },
  { to: "/waste", label: "Barang Rusak", icon: Trash2 },
  { to: "/customers", label: "Pelanggan B2B", icon: Users },
  { to: "/receivables", label: "Piutang / Bon", icon: FileText },
];

export default function Layout({ children }) {
  const { user, logout, location, changeLocation } = useAuth();
  const [isFull, setIsFull] = useState(false);
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState(["Gudang Utama", "Cabang 1", "Cabang 2"]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/meta").then((r) => setLocations(r.data.locations)).catch(() => {});
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const doLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#F9F8F6] overflow-hidden">
      {/* Navbar */}
      <header className="flex-shrink-0 h-16 bg-emerald-900 text-white flex items-center px-3 sm:px-5 gap-3 z-30 shadow-lg">
        <button data-testid="sidebar-toggle" onClick={() => setOpen(!open)} className="lg:hidden p-2 rounded-lg hover:bg-white/10">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-lime-400 flex items-center justify-center text-emerald-900">
            <Sprout size={22} />
          </div>
          <div className="leading-none">
            <div className="font-heading font-extrabold text-xl tracking-tight">BERSINAR</div>
            <div className="text-[10px] text-emerald-200 hidden sm:block">Toko Sayur & Sembako</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-emerald-200">
            <MapPin size={16} />
          </div>
          <Select value={location} onValueChange={changeLocation}>
            <SelectTrigger data-testid="location-switcher" className="w-[130px] sm:w-[160px] h-9 bg-emerald-800 border-emerald-700 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locations.map((l) => (
                <SelectItem key={l} value={l} data-testid={`location-opt-${l}`}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button data-testid="fullscreen-toggle" onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-emerald-800 hover:bg-emerald-700 transition-transform duration-150 active:scale-95" title="Layar Penuh">
            {isFull ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>

          <div className="hidden md:flex flex-col items-end leading-none mr-1">
            <span className="text-sm font-semibold">{user?.name}</span>
            <span className="text-[10px] text-emerald-300 uppercase">{user?.role}</span>
          </div>
          <button data-testid="logout-btn" onClick={doLogout}
            className="p-2 rounded-lg bg-emerald-800 hover:bg-red-600 transition-transform duration-150 active:scale-95" title="Keluar">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside className={`${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 transition-transform duration-200
          fixed lg:static z-20 top-16 bottom-0 left-0 w-60 bg-white border-r border-gray-200 flex flex-col py-4 gap-1 px-3`}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
              data-testid={`nav-${n.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  isActive ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20" : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
                }`}>
              <n.icon size={19} />
              {n.label}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink to="/users" onClick={() => setOpen(false)} data-testid="nav-users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  isActive ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
                }`}>
              <Users size={19} /> Pengguna
            </NavLink>
          )}
          <div className="mt-auto text-[11px] text-gray-400 px-3">v1.0 • Omnichannel POS</div>
        </aside>

        {open && <div className="fixed inset-0 top-16 bg-black/30 z-10 lg:hidden" onClick={() => setOpen(false)} />}

        <main className="flex-1 min-w-0 min-h-0 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
