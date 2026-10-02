import { rupiah, fmtQty, fmtDate } from "@/lib/format";

/* ---------------- Bluetooth Thermal Printer (58mm / ESC-POS) ---------------- */
// Common GATT services used by cheap 58mm BLE thermal printers.
const OPT_SERVICES = [
  0x18f0, 0xff00, 0xffe0,
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
];

let device = null;
let characteristic = null;
let state = { connected: false, name: null, printing: false };
const listeners = new Set();

function notify() {
  state = { ...state };
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function isSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

async function findWritable(server) {
  const services = await server.getPrimaryServices();
  for (const s of services) {
    let chars;
    try { chars = await s.getCharacteristics(); } catch { continue; }
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) return c;
    }
  }
  throw new Error("Karakteristik printer tidak ditemukan");
}

function onDisconnect() {
  characteristic = null;
  state.connected = false;
  state.name = null;
  notify();
}

export async function connect() {
  if (!isSupported()) throw new Error("Browser tidak mendukung Web Bluetooth. Gunakan Google Chrome.");
  device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: OPT_SERVICES });
  device.addEventListener("gattserverdisconnected", onDisconnect);
  const server = await device.gatt.connect();
  characteristic = await findWritable(server);
  state.connected = true;
  state.name = device.name || "Printer";
  notify();
  return state;
}

export function disconnect() {
  try { device?.gatt?.disconnect(); } catch {}
  onDisconnect();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function writeBytes(data) {
  const CHUNK = 180;
  for (let i = 0; i < data.length; i += CHUNK) {
    const part = data.slice(i, i + CHUNK);
    if (characteristic.properties.writeWithoutResponse) await characteristic.writeValueWithoutResponse(part);
    else await characteristic.writeValue(part);
    await sleep(25);
  }
}

/* ESC/POS builder — 58mm = 32 chars per line (Font A) */
function pad(left, right, width = 32) {
  left = String(left); right = String(right);
  if (left.length + right.length >= width) left = left.slice(0, Math.max(0, width - right.length - 1));
  return left + " ".repeat(Math.max(1, width - left.length - right.length)) + right;
}

function buildBytes(txn) {
  const b = [];
  const enc = new TextEncoder();
  const t = (s) => { for (const c of enc.encode(s)) b.push(c); };
  const line = "-".repeat(32) + "\n";

  b.push(0x1b, 0x40);            // init
  b.push(0x1b, 0x61, 0x01);     // center
  b.push(0x1d, 0x21, 0x11);     // double width+height
  b.push(0x1b, 0x45, 0x01);     // bold on
  t("BERSINAR\n");
  b.push(0x1d, 0x21, 0x00);     // normal size
  b.push(0x1b, 0x45, 0x00);     // bold off
  t("Toko Sayur & Sembako\n");
  t(txn.location_name + "\n");
  b.push(0x1b, 0x61, 0x00);     // left
  t(line);
  t(txn.invoice_number + "\n");
  t(fmtDate(txn.created_at) + "\n");
  t("Kasir: " + txn.cashier_name + "\n");
  t("Plg  : " + txn.customer_name + "\n");
  t(line);
  (txn.items || []).forEach((i) => {
    t(i.product_name + "\n");
    t(pad(`${fmtQty(i.qty)} ${i.unit} x ${rupiah(i.applied_unit_price)}`, rupiah(i.subtotal)) + "\n");
  });
  t(line);
  if (txn.discount > 0) t(pad("Diskon", "-" + rupiah(txn.discount)) + "\n");
  b.push(0x1b, 0x45, 0x01);
  t(pad("TOTAL", rupiah(txn.total_amount)) + "\n");
  b.push(0x1b, 0x45, 0x00);
  t(pad("Metode", txn.payment_method) + "\n");
  if (txn.payment_method === "Cash") {
    t(pad("Tunai", rupiah(txn.amount_paid)) + "\n");
    t(pad("Kembali", rupiah(txn.change)) + "\n");
  }
  if (txn.payment_method === "Credit") {
    b.push(0x1b, 0x61, 0x01);
    t("** BON / PIUTANG **\n");
    b.push(0x1b, 0x61, 0x00);
  }
  t(line);
  b.push(0x1b, 0x61, 0x01);
  t("Terima kasih telah berbelanja!\n");
  b.push(0x0a, 0x0a, 0x0a, 0x0a);
  b.push(0x1d, 0x56, 0x42, 0x00); // partial cut (ignored if unsupported)
  return new Uint8Array(b);
}

export async function print(txn) {
  if (!characteristic) throw new Error("Printer belum terhubung");
  state.printing = true; notify();
  try {
    await writeBytes(buildBytes(txn));
  } finally {
    state.printing = false; notify();
  }
}
