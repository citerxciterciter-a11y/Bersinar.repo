import { useState, useEffect } from "react";
import { X, Bluetooth, Loader2, Printer as PrinterIcon, CheckCircle2, FileText } from "lucide-react";
import * as printer from "@/lib/printer";
import { toast } from "sonner";

export default function PrinterSettings({ onClose }) {
  const [st, setSt] = useState(printer.getState());
  const [busy, setBusy] = useState(false);

  useEffect(() => printer.subscribe(setSt), []);

  const doConnect = async () => {
    if (!printer.isSupported()) { toast.error("Browser tidak mendukung Bluetooth. Gunakan Google Chrome di tablet."); return; }
    setBusy(true);
    try { const s = await printer.connect(); toast.success(`Printer "${s.name}" terhubung`); }
    catch (e) { toast.error(e.message || "Gagal menghubungkan"); }
    finally { setBusy(false); }
  };

  const doTest = async () => {
    if (!st.connected) { toast.error("Hubungkan printer dulu"); return; }
    setBusy(true);
    try { await printer.testPrint(); toast.success("Tes cetak terkirim"); }
    catch (e) { toast.error("Gagal cetak: " + (e.message || "printer")); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose} data-testid="printer-settings-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl flex flex-col border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-heading font-bold text-xl flex items-center gap-2"><PrinterIcon size={20} /> Pengaturan Printer</h3>
          <button onClick={onClose} data-testid="printer-settings-close" className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Status */}
          <div className={`rounded-xl p-3 flex items-center gap-3 border ${st.connected ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
            <span className={`h-3 w-3 rounded-full ${st.connected ? "bg-lime-500" : "bg-gray-400"}`} />
            <div className="flex-1">
              <div className="font-semibold text-sm">{st.connected ? `Terhubung: ${st.name}` : "Belum terhubung"}</div>
              <div className="text-xs text-gray-500">Printer termal Bluetooth</div>
            </div>
            {st.printing && <Loader2 className="animate-spin text-emerald-600" size={18} />}
          </div>

          {/* Paper width */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Lebar Kertas</label>
            <div className="grid grid-cols-2 gap-2">
              {["58", "80"].map((w) => (
                <button key={w} data-testid={`printer-width-${w}`} onClick={() => printer.setWidth(w)}
                  className={`py-2.5 rounded-xl border text-sm font-medium ${st.width === w ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-gray-200 text-gray-600"}`}>
                  {w} mm {w === "58" ? "(32 kolom)" : "(48 kolom)"}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            {st.connected ? (
              <button data-testid="printer-disconnect" onClick={() => { printer.disconnect(); toast.message("Printer diputus"); }}
                className="py-3 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50">Putuskan</button>
            ) : (
              <button data-testid="printer-connect" onClick={doConnect} disabled={busy}
                className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="animate-spin" size={18} /> : <Bluetooth size={18} />} Hubungkan
              </button>
            )}
            <button data-testid="printer-test" onClick={doTest} disabled={busy || !st.connected}
              className="py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              <FileText size={18} /> Tes Cetak
            </button>
          </div>

          <div className="text-[11px] text-gray-400 flex items-start gap-1.5">
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-emerald-500" />
            Printer terakhir disimpan & otomatis tersambung kembali saat aplikasi dibuka (jika dalam jangkauan). Gunakan Google Chrome.
          </div>
        </div>
      </div>
    </div>
  );
}
