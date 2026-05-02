-- ════════════════════════════════════════════════════
-- ZENOOT OPERASIONAL — Supabase Migration
-- Jalankan di: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════

-- ── 1. TABEL PLANNING (Target & KPI + Ops per Toko) ──
CREATE TABLE IF NOT EXISTS planning (
  id          bigserial PRIMARY KEY,
  toko        text NOT NULL DEFAULT 'global',  -- 'global' atau nama toko (SHP.ZENOOT dll)
  bulan       text NOT NULL,                   -- format: '2026-04' (YYYY-MM)
  data        jsonb NOT NULL DEFAULT '{}',     -- semua field target tersimpan di sini
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (toko, bulan)                         -- 1 record per toko per bulan
);

-- ── 2. TABEL LAPORAN KEUANGAN ──
CREATE TABLE IF NOT EXISTS laporan_keuangan (
  id                    bigserial PRIMARY KEY,
  toko                  text NOT NULL,          -- nama toko: SHP.ZENOOT, LAZ.ZENOOT dll
  bulan                 text NOT NULL,          -- format: '2026-03' (YYYY-MM)
  
  -- Income dari file Shopee
  total_pendapatan      bigint DEFAULT 0,
  total_penghasilan     bigint DEFAULT 0,
  dana_dilepas          bigint DEFAULT 0,
  
  -- Biaya Shopee (semua negatif dari Income file)
  komisi_ams            bigint DEFAULT 0,
  biaya_admin           bigint DEFAULT 0,
  biaya_layanan         bigint DEFAULT 0,
  biaya_proses          bigint DEFAULT 0,
  premi                 bigint DEFAULT 0,
  biaya_hemat_kirim     bigint DEFAULT 0,
  biaya_transaksi       bigint DEFAULT 0,
  biaya_kampanye        bigint DEFAULT 0,
  biaya_saldo_otomatis  bigint DEFAULT 0,
  
  -- Input manual
  hpp_total             bigint DEFAULT 0,
  hpp_per_item          bigint DEFAULT 0,
  qty_terjual           int DEFAULT 0,
  operasional           bigint DEFAULT 0,
  iklan                 bigint DEFAULT 0,
  
  -- Hasil kalkulasi
  laba                  bigint DEFAULT 0,
  rasio_margin          numeric(8,4) DEFAULT 0,
  rasio_laba            numeric(8,4) DEFAULT 0,
  rasio_admin           numeric(8,4) DEFAULT 0,
  aov                   numeric(12,2) DEFAULT 0,
  basket_size           numeric(6,3) DEFAULT 0,
  roas                  numeric(8,3) DEFAULT 0,
  
  -- Metadata
  n_orders              int DEFAULT 0,
  uploaded_at           timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  
  UNIQUE (toko, bulan)  -- 1 laporan per toko per bulan
);

-- ── 3. UPDATE app_config untuk pin manager ──
-- (pakai tabel yang sudah ada)
-- Tidak perlu tabel baru, cukup tambah key baru di app_config

-- ── 4. RLS (Row Level Security) — disable untuk sekarang ──
-- Karena pakai anon key yang sama untuk semua user
ALTER TABLE planning DISABLE ROW LEVEL SECURITY;
ALTER TABLE laporan_keuangan DISABLE ROW LEVEL SECURITY;

-- ── 5. Index untuk performa ──
CREATE INDEX IF NOT EXISTS idx_planning_toko_bulan ON planning(toko, bulan);
CREATE INDEX IF NOT EXISTS idx_laporan_toko_bulan ON laporan_keuangan(toko, bulan);

-- ── VERIFIKASI ──
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
