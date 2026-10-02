import { X, Printer, MessageCircle, Bluetooth } from "lucide-react";
import { rupiah, fmtQty, fmtDate } from "@/lib/format";
import * as printer from "@/lib/printer";
import { toast } from "sonner";

export default function Receipt({ txn, customer, onClose }) {
  if (!txn) return null;

  const waText = () => {
    let t = `*BERSINAR - Toko Sayur & Sembako*\n`;
    t += `No: ${txn.invoice_number}\n${fmtDate(txn.created_at)}\n`;
    t += `Cabang: ${txn.location_name}\n--------------------\n`;
    txn.items.forEach((i) => {
      t += `${i.product_name}\n  ${fmtQty(i.qty)} ${i.unit} x ${rupiah(i.applied_unit_price)} = ${rupiah(i.subtotal)}\n`;
    });
    t += `--------------------\n`;
    if (txn.discount) t += `Diskon: ${rupiah(txn.discount)}\n`;
    t += `*TOTAL: ${rupiah(txn.total_amount)}*\n`;
    t += `Bayar: ${txn.payment_method}\n`;
    if (txn.payment_method === "Cash") t += `Tunai: ${rupiah(txn.amount_paid)}\nKembali: ${rupiah(txn.change)}\n`;
    t += `\nTerima kasih telah berbelanja!`;
    return encodeURIComponent(t);
  };

  const phone = customer?.phone || "";
  const waLink = `https://wa.me/${phone}?text=${waText()}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid="receipt-modal">
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90dvh] flex flex-col border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-heading font-bold text-lg">Struk Transaksi</h3>
          <button onClick={onClose} data-testid="receipt-close" className="p-2 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto p-5 flex-1 min-h-0">
          <div id="receipt-print" className="font-mono text-[12px] text-black leading-tight">
            <div className="text-center">
              <div className="font-bold text-base">BERSINAR</div>
              <div>Toko Sayur & Sembako</div>
              <div className="text-[11px]">{txn.location_name}</div>
            </div>
            <div className="border-t border-dashed border-black my-2" />
            <div className="flex justify-between"><span>{txn.invoice_number}</span></div>
            <div className="text-[11px]">{fmtDate(txn.created_at)}</div>
            <div className="text-[11px]">Kasir: {txn.cashier_name}</div>
            <div className="text-[11px]">Plg: {txn.customer_name}</div>
            <div className="border-t border-dashed border-black my-2" />
            {txn.items.map((i) => (
              <div key={i.id} className="mb-1">
                <div>{i.product_name}</div>
                <div className="flex justify-between">
                  <span>{fmtQty(i.qty)} {i.unit} x {rupiah(i.applied_unit_price)}</span>
                  <span>{rupiah(i.subtotal)}</span>
                </div>
              </div>
            ))}
            <div className="border-t border-dashed border-black my-2" />
            {txn.discount > 0 && <div className="flex justify-between"><span>Diskon</span><span>-{rupiah(txn.discount)}</span></div>}
            <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>{rupiah(txn.total_amount)}</span></div>
            <div className="flex justify-between"><span>Metode</span><span>{txn.payment_method}</span></div>
            {txn.payment_method === "Cash" && (
              <>
                <div className="flex justify-between"><span>Tunai</span><span>{rupiah(txn.amount_paid)}</span></div>
                <div className="flex justify-between"><span>Kembali</span><span>{rupiah(txn.change)}</span></div>
              </>
            )}
            {txn.payment_method === "Credit" && <div className="text-center mt-1 font-bold">** BON / PIUTANG **</div>}
            <div className="border-t border-dashed border-black my-2" />
            <div className="text-center text-[11px]">Terima kasih telah berbelanja!</div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex flex-col gap-2 flex-shrink-0">
          <button onClick={async () => {
              if (!printer.getState().connected) { toast.error("Printer Bluetooth belum terhubung (ikon printer di navbar)"); return; }
              try { await printer.print(txn); toast.success("Struk tercetak"); }
              catch (e) { toast.error("Gagal cetak: " + (e.message || "printer")); }
            }} data-testid="receipt-bt-print-btn"
            className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center justify-center gap-2">
            <Bluetooth size={18} /> Cetak ke Printer Bluetooth
          </button>
          <div className="flex gap-2">
            <button onClick={() => window.print()} data-testid="receipt-print-btn"
              className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold flex items-center justify-center gap-2">
              <Printer size={18} /> Cetak Browser
            </button>
            <a href={waLink} target="_blank" rel="noreferrer" data-testid="receipt-wa-btn"
              className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold flex items-center justify-center gap-2">
              <MessageCircle size={18} /> WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
