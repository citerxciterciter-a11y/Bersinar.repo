export const rupiah = (n) =>
  "Rp " + (Number(n) || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

export const fmtQty = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
};

export const fmtDate = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

export const categoryColor = (c) => ({
  Sayur: "bg-emerald-100 text-emerald-700",
  Buah: "bg-orange-100 text-orange-700",
  Sembako: "bg-amber-100 text-amber-700",
  Minuman: "bg-sky-100 text-sky-700",
  Daging: "bg-red-100 text-red-700",
  Lainnya: "bg-gray-100 text-gray-700",
}[c] || "bg-gray-100 text-gray-700");
