import { useState, useEffect, useCallback } from "react";
import { X, Delete, Check } from "lucide-react";

export default function Numpad({ open, product, initial, onClose, onConfirm }) {
  const [val, setVal] = useState("");

  useEffect(() => {
    if (open) setVal(initial ? String(initial) : "");
  }, [open, initial]);

  const allowDecimal = product?.is_decimal_allowed;

  const press = useCallback((k) => {
    setVal((v) => {
      if (k === ".") {
        if (!allowDecimal || v.includes(".")) return v;
        return v === "" ? "0." : v + ".";
      }
      return v === "0" ? k : v + k;
    });
  }, [allowDecimal]);

  const back = useCallback(() => setVal((v) => v.slice(0, -1)), []);
  const quick = useCallback((q) => setVal(String(q)), []);

  const confirm = useCallback(() => {
    const n = parseFloat(val);
    if (!n || n <= 0) return;
    onConfirm(n);
  }, [val, onConfirm]);

  if (!open || !product) return null;

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", allowDecimal ? "." : "", "0", "back"];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50"
      onClick={onClose} data-testid="numpad-overlay">
      <div onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:w-[380px] sm:rounded-2xl rounded-t-2xl max-h-[85dvh] flex flex-col border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0">
            <div className="font-heading font-bold text-lg truncate">{product.name}</div>
            <div className="text-xs text-gray-500">Masukkan jumlah ({product.unit})</div>
          </div>
          <button onClick={onClose} data-testid="numpad-close" className="p-2 rounded-lg hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* Display */}
        <div className="px-4 pt-4 flex-shrink-0">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-4 text-right">
            <span data-testid="numpad-display" className="font-mono text-4xl font-bold text-emerald-800">
              {val || "0"}
            </span>
            <span className="text-emerald-600 ml-2 font-mono">{product.unit}</span>
          </div>
          {allowDecimal && (
            <div className="flex gap-2 mt-3">
              {[0.25, 0.5, 1, 2].map((q) => (
                <button key={q} onClick={() => quick(q)} data-testid={`numpad-quick-${q}`}
                  className="flex-1 py-1.5 rounded-lg bg-gray-100 hover:bg-emerald-100 text-sm font-mono font-semibold">
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Keys */}
        <div className="p-4 grid grid-cols-3 gap-2 flex-1 overflow-y-auto overscroll-contain">
          {keys.map((k, i) =>
            k === "" ? <div key={i} /> :
            k === "back" ? (
              <button key={i} onClick={back} data-testid="numpad-key-back"
                className="py-4 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                <Delete size={22} />
              </button>
            ) : (
              <button key={i} onClick={() => press(k)} data-testid={`numpad-key-${k === "." ? "dot" : k}`}
                className="py-4 rounded-lg bg-white border border-gray-200 hover:bg-emerald-50 font-mono text-2xl font-semibold">
                {k}
              </button>
            )
          )}
        </div>

        {/* Confirm (locked to bottom) */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <button onClick={confirm} data-testid="numpad-confirm"
            className="w-full py-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-bold text-lg flex items-center justify-center gap-2">
            <Check size={22} /> Tambah ke Keranjang
          </button>
        </div>
      </div>
    </div>
  );
}
