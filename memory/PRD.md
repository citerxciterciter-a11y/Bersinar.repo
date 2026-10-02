# BERSINAR — POS & Manajemen Toko Sayur & Sembako

## Original Problem Statement
Sistem Kasir/POS & Manajemen Toko Sayur & Sembako (Omnichannel, Multi-Cabang) — SPA, Tailwind, fullscreen Chrome, fully responsive. Terintegrasi POS, Stok/Gudang, Produk, Barang Rusak (Waste), Piutang (Bon).

## Architecture
- Frontend: React (CRA/craco) SPA, Tailwind, shadcn/ui, lucide-react, recharts, sonner, framer-motion.
- Backend: FastAPI + Motor (MongoDB), JWT auth (bcrypt + PyJWT), httpOnly cookie + Bearer token.
- DB collections: users, products, tier_prices, inventory, customers, transactions, transaction_items, waste_logs, credit_payments, login_attempts.

## User Choices
- Auth: JWT custom (Admin/Kasir). Struk: PDF print + WhatsApp wa.me link (gratis). Waste photo: skipped. Theme: Fresh Market hijau. App name: BERSINAR.

## Personas
- Admin/Owner: kelola produk, pengguna, lihat semua laporan, hapus data.
- Kasir: jalankan POS, catat waste, kelola pelanggan & piutang.

## Implemented (2026-06)
- JWT auth + role gating (admin/kasir), seeded admin (citerxciter.citer@gmail.com) + kasir + 12 produk + 3 pelanggan B2B.
- POS split-screen (62/38), grid 4 kolom (5 saat fullscreen), mobile 2 kolom + floating cart bar + bottom sheet.
- Numpad modal (center desktop, bottom-sheet mobile) untuk penjualan desimal/timbangan; tombol "Tambah ke Keranjang" flex-shrink-0.
- Multi-tier pricing otomatis (Eceran/Grosir/Partai) by min_qty.
- Multi-payment: Tunai (kembalian), QRIS, Transfer, Bon/Credit dengan cek credit limit.
- Cetak struk termal + kirim WhatsApp.
- Manajemen Produk (CRUD, SKU auto, satuan, toggle desimal/expired, tier, stok+HPP per lokasi).
- Stok & Gudang per cabang + safety stock alert + inline adjust.
- Waste management (potong stok realtime + kerugian HPP).
- Pelanggan B2B + Pelunasan Bon + Aging Schedule.
- Dashboard: penjualan hari ini/total, piutang, waste, grafik 7 hari & per kategori, laba rugi, stok menipis, transaksi terbaru.
- Navbar: Fullscreen API toggle + location switcher.

## Status
- Backend 23/23 pytest pass. Frontend E2E 100% flows pass. No critical issues.

## Backlog (P2, optional)
- Per-location accuracy untuk dashboard category_series.
- Gambar per-produk untuk Sembako/Minuman (saat ini pakai placeholder kategori).
- Stock lock saat checkout konkuren.
- Export laporan ke Excel/PDF; barcode scanner hardware.
