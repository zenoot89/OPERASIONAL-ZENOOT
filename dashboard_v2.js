/* ═══════════════════════════════════════════════════════════════════
   dashboard_v2.js — zenOt Operasional
   Dashboard Baru: Full Data, Informatif, Tanpa Diagram/Simbol
   Menggantikan renderDashboard() dan semua widget-nya di app_core.js
   
   CARA PAKAI:
   1. Tambahkan file ini ke index.html SETELAH app_core.js:
      <script src="dashboard_v2.js"></script>
   2. Tidak perlu hapus kode lama di app_core.js — file ini override fungsinya
════════════════════════════════════════════════════════════════════ */

// ── Helper format rupiah singkat (1.2jt, 850rb) ──
function fmtShort(v) {
  v = Math.round(v || 0);
  if (v >= 1000000) return 'Rp ' + (v / 1000000).toFixed(1) + 'jt';
  if (v >= 1000)    return 'Rp ' + (v / 1000).toFixed(0) + 'rb';
  return 'Rp ' + v.toLocaleString('id-ID');
}

// ── Helper delta badge (naik/turun vs kemarin) ──
function deltaBadge(now, prev) {
  if (!prev || prev === 0) return '';
  const pct = Math.round((now - prev) / prev * 100);
  if (pct > 0)  return `<span class="db2-delta db2-up">+${pct}%</span>`;
  if (pct < 0)  return `<span class="db2-delta db2-dn">${pct}%</span>`;
  return `<span class="db2-delta db2-flat">0%</span>`;
}

// ── Helper: tanggal hari ini & kemarin ──
function getTodayStr()    { return new Date().toISOString().slice(0, 10); }
function getKemarinStr()  { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }
function getBulanStr()    { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function getDaysInMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function getDayOfMonth()  { return new Date().getDate(); }

// ── Override fungsi utama renderDashboard ──
function renderDashboard() {
  const todayStr   = getTodayStr();
  const kemarinStr = getKemarinStr();
  const bulanStr   = getBulanStr();

  // Filter jurnal sesuai toko aktif
  const jurnal = (typeof getFilteredJurnal === 'function') ? getFilteredJurnal() : DB.jurnal;

  // ── Slice waktu ──
  const jHari    = jurnal.filter(j => j.tgl === todayStr);
  const jKemarin = jurnal.filter(j => j.tgl === kemarinStr);
  const jBulan   = jurnal.filter(j => (j.tgl || '').startsWith(bulanStr));

  // ── Keuangan ──
  const omsetHari    = jHari.reduce((s, j)    => s + (j.harga || 0) * (j.qty || 0), 0);
  const omsetKemarin = jKemarin.reduce((s, j) => s + (j.harga || 0) * (j.qty || 0), 0);
  const omsetBulan   = jBulan.reduce((s, j)   => s + (j.harga || 0) * (j.qty || 0), 0);
  const labaBulan    = jBulan.reduce((s, j)   => s + ((j.harga || 0) - (j.hpp || 0)) * (j.qty || 0), 0);
  const qtyBulan     = jBulan.reduce((s, j)   => s + (j.qty || 0), 0);
  const trxBulan     = jBulan.length;
  const marginPct    = omsetBulan > 0 ? Math.round(labaBulan / omsetBulan * 100) : 0;

  // ── Stok ──
  const nilaiStok  = DB.stok.reduce((s, r) => s + Math.max(0, getAkhir(r)) * (r.hpp || 0), 0);
  const totalStok  = DB.stok.reduce((s, r) => s + Math.max(0, getAkhir(r)), 0);
  const stokHabis  = DB.stok.filter(r => getAkhir(r) <= 0);
  const stokKritis = DB.stok.filter(r => getAkhir(r) > 0 && getAkhir(r) <= (r.safety || 4));

  // ── Sold map ──
  const soldMap = {};
  jurnal.forEach(j => { soldMap[j.var] = (soldMap[j.var] || 0) + (j.qty || 0); });

  // ── Top SKU bulan ini ──
  const soldBulanMap = {};
  jBulan.forEach(j => { soldBulanMap[j.var] = (soldBulanMap[j.var] || 0) + (j.qty || 0); });
  const topSKU = Object.entries(soldBulanMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // ── Wajib Restock ──
  const wajibRestock = DB.stok
    .filter(r => getAkhir(r) <= (r.safety || 4) && soldMap[r.var])
    .map(r => ({ var: r.var, akhir: getAkhir(r), safety: r.safety || 4, terjual: soldMap[r.var] || 0 }))
    .sort((a, b) => b.terjual - a.terjual)
    .slice(0, 10);

  // ── No HPP ──
  const noHPP = DB.produk.filter(p => !p.hpp || p.hpp <= 0);

  // ── Channel ──
  const chMap = {};
  jBulan.forEach(j => {
    if (!j.ch) return;
    if (!chMap[j.ch]) chMap[j.ch] = { omset: 0, qty: 0, trx: 0 };
    chMap[j.ch].omset += (j.harga || 0) * (j.qty || 0);
    chMap[j.ch].qty   += (j.qty || 0);
    chMap[j.ch].trx   += 1;
  });
  const channels = Object.entries(chMap).sort((a, b) => b[1].omset - a[1].omset);

  // ── Target ──
  const yr = new Date().getFullYear();
  const mo = String(new Date().getMonth() + 1).padStart(2, '0');
  let plan = {};
  try { plan = JSON.parse(localStorage.getItem(`zenot_planning_${yr}_${mo}`) || '{}'); } catch(e) {}
  const targetOmset  = plan.targetOmset   || 0;
  const targetPcs    = plan.targetProduksi || 0;
  const pctOmset     = targetOmset > 0 ? Math.min(100, Math.round(omsetBulan / targetOmset * 100)) : 0;
  const pctPcs       = targetPcs   > 0 ? Math.min(100, Math.round(qtyBulan   / targetPcs   * 100)) : 0;
  const daysLeft     = getDaysInMonth() - getDayOfMonth();
  const sisaTarget   = Math.max(0, targetOmset - omsetBulan);
  const perHariHarus = daysLeft > 0 && sisaTarget > 0 ? Math.round(sisaTarget / daysLeft) : 0;

  // ── Target per channel (dari localStorage plan) ──
  const tokoList = (window._tokoList && window._tokoList.length > 0)
    ? window._tokoList
    : (DB.channel || []).filter(c => c.nama !== '__assign__');
  const chTargetRows = tokoList.map(ch => {
    const kode = ch.kode || ch.nama;
    let tgt = 0;
    try { tgt = (JSON.parse(localStorage.getItem(`zenot_plan_${kode}_${yr}_${mo}`) || '{}')).targetOmset || 0; } catch(e) {}
    const aktual = (chMap[kode] || {}).omset || 0;
    const pct    = tgt > 0 ? Math.min(100, Math.round(aktual / tgt * 100)) : null;
    return { kode, aktual, tgt, pct, qty: (chMap[kode] || {}).qty || 0, trx: (chMap[kode] || {}).trx || 0 };
  }).filter(r => r.aktual > 0 || r.tgt > 0);

  // ── Supplier ──
  const supMap = {};
  DB.stok.forEach(r => {
    const p   = DB.produk.find(x => (x.var || '').toUpperCase() === (r.var || '').toUpperCase());
    const sup = (p && p.suplaier) || 'Lainnya';
    if (!supMap[sup]) supMap[sup] = { stok: 0, sku: 0, nilai: 0 };
    supMap[sup].stok += Math.max(0, getAkhir(r));
    supMap[sup].sku  += 1;
    supMap[sup].nilai += Math.max(0, getAkhir(r)) * (r.hpp || 0);
  });
  const suppliers = Object.entries(supMap).sort((a, b) => b[1].stok - a[1].stok).slice(0, 8);

  // ── Transaksi terbaru ──
  const recentTrx = jurnal.slice(0, 12);

  // ── Hitung alert ──
  const alertList = [];
  stokHabis.forEach(r => alertList.push({ level: 'red', title: `Stok HABIS: ${r.var}`, sub: `Stok = 0 pcs — segera restock` }));
  stokKritis.slice(0, 5).forEach(r => alertList.push({ level: 'amber', title: `Stok kritis: ${r.var}`, sub: `Sisa ${getAkhir(r)} pcs — safety: ${r.safety || 4} pcs` }));
  if (targetOmset > 0 && pctOmset < 30 && daysLeft < 15) {
    alertList.push({ level: 'amber', title: 'Target omset tertinggal', sub: `${pctOmset}% tercapai — perlu ${fmt(perHariHarus)}/hari dalam ${daysLeft} hari tersisa` });
  }
  chTargetRows.forEach(r => {
    if (r.tgt > 0 && r.pct !== null && r.pct < 30 && daysLeft < 15) {
      alertList.push({ level: 'amber', title: `Channel ${r.kode} jauh dari target`, sub: `Aktual ${fmtShort(r.aktual)} dari target ${fmtShort(r.tgt)} (${r.pct}%)` });
    }
  });
  if (noHPP.length > 0) {
    alertList.push({ level: 'gray', title: `${noHPP.length} produk tidak ada HPP`, sub: `${noHPP.slice(0, 4).map(p => p.var).join(', ')}${noHPP.length > 4 ? ` +${noHPP.length - 4} lainnya` : ''} — laba tidak akurat` });
  }

  // ══════════════════════════════════════════════
  // RENDER HTML
  // ══════════════════════════════════════════════

  // ── STAT CARDS (4 besar di atas) ──
  document.getElementById('stat-cards').innerHTML = `
    <div class="stat c1">
      <div class="stat-label">Total Stok Aktif</div>
      <div class="stat-val">${totalStok.toLocaleString('id-ID')} <span style="font-size:14px;font-weight:400">pcs</span></div>
      <div class="stat-sub">${DB.stok.length} SKU terdaftar</div>
    </div>
    <div class="stat c2">
      <div class="stat-label">Nilai Stok (HPP)</div>
      <div class="stat-val" style="font-size:18px">${fmt(nilaiStok)}</div>
      <div class="stat-sub">Berdasarkan harga pokok</div>
    </div>
    <div class="stat c3">
      <div class="stat-label">Omset Bulan Ini</div>
      <div class="stat-val" style="font-size:18px">${fmt(omsetBulan)}</div>
      <div class="stat-sub">${trxBulan} transaksi · ${qtyBulan} pcs terjual</div>
    </div>
    <div class="stat c4">
      <div class="stat-label">Stok Bermasalah</div>
      <div class="stat-val">${stokHabis.length + stokKritis.length} <span style="font-size:14px;font-weight:400">SKU</span></div>
      <div class="stat-sub">${stokHabis.length} habis · ${stokKritis.length} kritis</div>
    </div>`;

  // ── RENDER SEMUA SECTION ──
  _renderSectionKondisiStok(stokHabis, stokKritis, wajibRestock, suppliers, totalStok, nilaiStok);
  _renderSectionKeuangan(omsetHari, omsetKemarin, omsetBulan, labaBulan, marginPct, trxBulan, qtyBulan, jHari.length, jKemarin.length);
  _renderSectionTarget(omsetBulan, targetOmset, pctOmset, qtyBulan, targetPcs, pctPcs, daysLeft, sisaTarget, perHariHarus, chTargetRows);
  _renderSectionPenjualan(topSKU, channels, recentTrx);
  _renderSectionAlert(alertList);
}

// ══════════════════════════════════════════════════════════════
// SECTION 1: KONDISI STOK
// ══════════════════════════════════════════════════════════════
function _renderSectionKondisiStok(stokHabis, stokKritis, wajibRestock, suppliers, totalStok, nilaiStok) {
  // Reuse existing notif-area untuk stok habis + kritis
  let html = '';

  // Tabel stok habis
  if (stokHabis.length > 0) {
    html += `
    <div class="db2-sec-label">STOK HABIS (${stokHabis.length} SKU)</div>
    <table class="db2-tbl">
      <thead><tr><th>SKU</th><th>Produk Induk</th><th>Supplier</th><th class="r">Safety Stock</th></tr></thead>
      <tbody>
        ${stokHabis.map(r => {
          const p = DB.produk.find(x => (x.var || '').toUpperCase() === (r.var || '').toUpperCase());
          return `<tr>
            <td><b>${r.var}</b></td>
            <td class="muted">${p ? p.induk : '—'}</td>
            <td class="muted">${p && p.suplaier ? p.suplaier : '—'}</td>
            <td class="r muted">${r.safety || 4} pcs</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  } else {
    html += `<div class="db2-ok-row">Tidak ada stok habis saat ini</div>`;
  }

  // Tabel stok kritis
  if (stokKritis.length > 0) {
    html += `
    <div class="db2-sec-label" style="margin-top:12px">STOK KRITIS — Di Bawah Safety Stock (${stokKritis.length} SKU)</div>
    <table class="db2-tbl">
      <thead><tr><th>SKU</th><th>Produk Induk</th><th class="r">Stok Sisa</th><th class="r">Safety</th><th class="r">Kurang</th></tr></thead>
      <tbody>
        ${stokKritis.map(r => {
          const p      = DB.produk.find(x => (x.var || '').toUpperCase() === (r.var || '').toUpperCase());
          const kurang = (r.safety || 4) - getAkhir(r);
          return `<tr>
            <td><b>${r.var}</b></td>
            <td class="muted">${p ? p.induk : '—'}</td>
            <td class="r warn-text">${getAkhir(r)} pcs</td>
            <td class="r muted">${r.safety || 4} pcs</td>
            <td class="r red-text">${kurang} pcs</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  const elNotif = document.getElementById('notif-area');
  if (elNotif) elNotif.innerHTML = html;

  // Wajib Restock
  const elRS = document.getElementById('db-wajib-restock');
  if (elRS) {
    if (!wajibRestock.length) {
      elRS.innerHTML = '<div class="db2-ok-row">Tidak ada produk yang perlu restock</div>';
    } else {
      elRS.innerHTML = `
      <table class="db2-tbl">
        <thead><tr><th>SKU</th><th class="r">Stok Sisa</th><th class="r">Safety</th><th class="r">Total Terjual</th><th>Status</th></tr></thead>
        <tbody>
          ${wajibRestock.map(r => `
            <tr>
              <td><b>${r.var}</b></td>
              <td class="r ${r.akhir <= 0 ? 'red-text' : 'warn-text'}">${r.akhir <= 0 ? 'HABIS' : r.akhir + ' pcs'}</td>
              <td class="r muted">${r.safety} pcs</td>
              <td class="r">${r.terjual} pcs</td>
              <td>${r.akhir <= 0
                ? '<span class="db2-badge db2-badge-red">Segera Restock</span>'
                : '<span class="db2-badge db2-badge-amber">Restock</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    }
  }

  // Supplier
  const elSup = document.getElementById('db-stok-supplier');
  if (elSup) {
    if (!suppliers.length) {
      elSup.innerHTML = '<div class="db2-ok-row">Belum ada data supplier</div>';
    } else {
      elSup.innerHTML = `
      <table class="db2-tbl">
        <thead><tr><th>Supplier</th><th class="r">Jumlah SKU</th><th class="r">Total Stok</th><th class="r">Nilai Stok (HPP)</th></tr></thead>
        <tbody>
          ${suppliers.map(([sup, d]) => `
            <tr>
              <td><b>${sup}</b></td>
              <td class="r">${d.sku}</td>
              <td class="r">${d.stok.toLocaleString('id-ID')} pcs</td>
              <td class="r">${fmt(d.nilai)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    }
  }
}

// ══════════════════════════════════════════════════════════════
// SECTION 2: KEUANGAN
// ══════════════════════════════════════════════════════════════
function _renderSectionKeuangan(omsetHari, omsetKemarin, omsetBulan, labaBulan, marginPct, trxBulan, qtyBulan, trxHari, trxKemarin) {
  // Inject ke progress-area (dipakai ulang untuk keuangan)
  const el = document.getElementById('progress-area');
  if (!el) return;

  const deltaHari    = omsetKemarin > 0 ? Math.round((omsetHari - omsetKemarin) / omsetKemarin * 100) : 0;
  const deltaSign    = deltaHari >= 0 ? '+' : '';
  const deltaColor   = deltaHari >= 0 ? 'var(--sage)' : 'var(--rust)';

  el.innerHTML = `
  <div class="db2-keu-grid">
    <div class="db2-keu-card">
      <div class="db2-keu-label">Omset Hari Ini</div>
      <div class="db2-keu-val">${fmt(omsetHari)}</div>
      <div class="db2-keu-sub">${trxHari} transaksi
        ${omsetKemarin > 0 ? `<span style="color:${deltaColor};font-weight:700;margin-left:6px">${deltaSign}${deltaHari}%</span> vs kemarin` : ''}</div>
    </div>
    <div class="db2-keu-card">
      <div class="db2-keu-label">Omset Kemarin</div>
      <div class="db2-keu-val">${fmt(omsetKemarin)}</div>
      <div class="db2-keu-sub">${trxKemarin} transaksi</div>
    </div>
    <div class="db2-keu-card">
      <div class="db2-keu-label">Omset Bulan Ini</div>
      <div class="db2-keu-val">${fmt(omsetBulan)}</div>
      <div class="db2-keu-sub">${trxBulan} transaksi · ${qtyBulan} pcs terjual</div>
    </div>
    <div class="db2-keu-card">
      <div class="db2-keu-label">Laba Kotor Estimasi</div>
      <div class="db2-keu-val" style="color:${labaBulan >= 0 ? 'var(--sage)' : 'var(--rust)'}">${fmt(labaBulan)}</div>
      <div class="db2-keu-sub">Margin ${marginPct}% dari omset bulan ini</div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════
// SECTION 3: TARGET
// ══════════════════════════════════════════════════════════════
function _renderSectionTarget(omsetBulan, targetOmset, pctOmset, qtyBulan, targetPcs, pctPcs, daysLeft, sisaTarget, perHariHarus, chTargetRows) {
  const el = document.getElementById('db-target-channel');
  if (!el) return;

  const barColor = pct => pct >= 80 ? '#16a34a' : pct >= 50 ? 'var(--gold)' : 'var(--rust)';
  const bar      = (pct, color) => `<div class="db2-prog-bar"><div style="width:${pct}%;background:${color};height:100%;border-radius:3px;transition:width .6s"></div></div>`;

  let html = `
  <div class="db2-target-grid">
    <div>
      <div class="db2-target-row">
        <span class="db2-target-label">Target Omset Bulan Ini</span>
        <span class="db2-target-nums">${fmt(omsetBulan)} / ${targetOmset > 0 ? fmt(targetOmset) : '— belum diset'}</span>
        <span class="db2-target-pct" style="color:${targetOmset > 0 ? barColor(pctOmset) : 'var(--dusty)'}">${targetOmset > 0 ? pctOmset + '%' : '—'}</span>
      </div>
      ${targetOmset > 0 ? bar(pctOmset, barColor(pctOmset)) : ''}
    </div>
    <div>
      <div class="db2-target-row">
        <span class="db2-target-label">Target Produksi Bulan Ini</span>
        <span class="db2-target-nums">${qtyBulan} pcs / ${targetPcs > 0 ? targetPcs + ' pcs' : '— belum diset'}</span>
        <span class="db2-target-pct" style="color:${targetPcs > 0 ? barColor(pctPcs) : 'var(--dusty)'}">${targetPcs > 0 ? pctPcs + '%' : '—'}</span>
      </div>
      ${targetPcs > 0 ? bar(pctPcs, barColor(pctPcs)) : ''}
    </div>
  </div>`;

  // Harus jual per hari
  if (targetOmset > 0 && daysLeft > 0 && sisaTarget > 0) {
    html += `
  <div class="db2-per-hari">
    <span class="db2-per-hari-label">Harus jual per hari (sisa target)</span>
    <span class="db2-per-hari-val">${fmt(perHariHarus)}</span>
    <span class="db2-per-hari-sub">Sisa ${fmt(sisaTarget)} dalam ${daysLeft} hari tersisa</span>
  </div>`;
  }

  // Target per channel
  if (chTargetRows.length > 0) {
    html += `
  <div class="db2-sec-label" style="margin-top:14px">TARGET OMSET VS AKTUAL PER CHANNEL</div>
  <table class="db2-tbl">
    <thead><tr><th>Channel</th><th class="r">Aktual</th><th class="r">Target</th><th class="r">Pct</th><th class="r">Sisa</th><th class="r">Qty</th></tr></thead>
    <tbody>
      ${chTargetRows.map(r => {
        const sisaCh   = Math.max(0, r.tgt - r.aktual);
        const pctColor = r.pct === null ? 'var(--dusty)' : barColor(r.pct);
        return `<tr>
          <td><b>${r.kode}</b></td>
          <td class="r">${fmt(r.aktual)}</td>
          <td class="r muted">${r.tgt > 0 ? fmt(r.tgt) : '—'}</td>
          <td class="r" style="color:${pctColor};font-weight:700">${r.pct !== null ? r.pct + '%' : '—'}</td>
          <td class="r muted">${r.tgt > 0 ? fmt(sisaCh) : '—'}</td>
          <td class="r muted">${r.qty} pcs</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
  }

  el.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════
// SECTION 4: PENJUALAN
// ══════════════════════════════════════════════════════════════
function _renderSectionPenjualan(topSKU, channels, recentTrx) {
  // Top SKU
  const elTop = document.getElementById('db-top-sku');
  if (elTop) {
    if (!topSKU.length) {
      elTop.innerHTML = '<div class="db2-ok-row">Belum ada data penjualan bulan ini</div>';
    } else {
      elTop.innerHTML = `
      <table class="db2-tbl">
        <thead><tr><th>No</th><th>SKU</th><th>Produk Induk</th><th class="r">Qty Terjual</th><th class="r">Estimasi Omset</th></tr></thead>
        <tbody>
          ${topSKU.map(([sku, qty], i) => {
            const p     = DB.produk.find(x => (x.var || '').toUpperCase() === sku.toUpperCase());
            const harga = p ? (p.jual || p.pasang || 0) : 0;
            return `<tr>
              <td class="muted">${i + 1}</td>
              <td><b>${sku}</b></td>
              <td class="muted">${p ? p.induk : '—'}</td>
              <td class="r">${qty} pcs</td>
              <td class="r muted">${harga > 0 ? fmt(harga * qty) : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    }
  }

  // Transaksi terbaru
  const elSales = document.getElementById('last-sales');
  if (elSales) {
    if (!recentTrx.length) {
      elSales.innerHTML = '<div class="db2-ok-row">Belum ada transaksi</div>';
    } else {
      elSales.innerHTML = `
      <table class="db2-tbl">
        <thead><tr><th>Tanggal</th><th>SKU</th><th>Channel</th><th class="r">Qty</th><th class="r">Harga Jual</th><th class="r">Total</th></tr></thead>
        <tbody>
          ${recentTrx.map(j => `<tr>
            <td class="muted">${j.tgl || '—'}</td>
            <td><b>${j.var}</b></td>
            <td><span class="db2-ch-pill">${j.ch || '—'}</span></td>
            <td class="r">${j.qty}</td>
            <td class="r muted">${fmt(j.harga || 0)}</td>
            <td class="r">${fmt((j.harga || 0) * (j.qty || 0))}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    }
  }

  // Channel aktif — inject ke chart-bars (dipakai ulang)
  const elChart = document.getElementById('chart-bars');
  const elLeg   = document.getElementById('chart-leg');
  if (elChart) {
    if (!channels.length) {
      elChart.innerHTML = '<div class="db2-ok-row">Belum ada data channel</div>';
      if (elLeg) elLeg.innerHTML = '';
    } else {
      elChart.style = 'display:block;height:auto';
      elChart.innerHTML = `
      <table class="db2-tbl">
        <thead><tr><th>Channel</th><th class="r">Omset Bulan Ini</th><th class="r">Qty</th><th class="r">Transaksi</th><th class="r">Rata-rata/Trx</th></tr></thead>
        <tbody>
          ${channels.map(([ch, d]) => `<tr>
            <td><b>${ch}</b></td>
            <td class="r">${fmt(d.omset)}</td>
            <td class="r muted">${d.qty} pcs</td>
            <td class="r muted">${d.trx}</td>
            <td class="r muted">${d.trx > 0 ? fmt(Math.round(d.omset / d.trx)) : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
      if (elLeg) elLeg.innerHTML = '';
    }
  }
}

// ══════════════════════════════════════════════════════════════
// SECTION 5: ALERT PRIORITAS
// ══════════════════════════════════════════════════════════════
function _renderSectionAlert(alertList) {
  // Buat/update container alert di bawah page-dashboard
  let elAlert = document.getElementById('db2-alert-section');
  if (!elAlert) {
    const page = document.getElementById('page-dashboard');
    if (!page) return;
    elAlert = document.createElement('div');
    elAlert.id = 'db2-alert-section';
    elAlert.className = 'db-row2-wide';
    page.appendChild(elAlert);
  }

  if (!alertList.length) {
    elAlert.innerHTML = `
    <div class="db-card">
      <div class="db-card-title">Alert Prioritas — Lakukan Sekarang</div>
      <div class="db2-ok-row">Semua kondisi aman. Tidak ada alert saat ini.</div>
    </div>`;
    return;
  }

  const rows = alertList.map(a => {
    const cls  = a.level === 'red' ? 'db-alert-red' : a.level === 'amber' ? 'db-alert-yellow' : 'db-alert-green';
    const bdg  = a.level === 'red'
      ? '<span class="db2-badge db2-badge-red">Segera</span>'
      : a.level === 'amber'
        ? '<span class="db2-badge db2-badge-amber">Perhatian</span>'
        : '<span class="db2-badge db2-badge-gray">Info</span>';
    return `
    <div class="db-alert ${cls}" style="font-size:13px;padding:8px 12px;">
      <div style="flex:1">
        <span class="db-alert-name" style="font-size:13px">${a.title}</span>
        <span class="db-alert-msg" style="font-size:12px;margin-left:6px">${a.sub}</span>
      </div>
      ${bdg}
    </div>`;
  }).join('');

  elAlert.innerHTML = `
  <div class="db-card db-card-urgent" style="grid-column:1/-1">
    <div class="db-card-title">Alert Prioritas — Lakukan Sekarang <span style="color:var(--rust);font-family:'DM Mono',monospace;font-size:11px">(${alertList.length} item)</span></div>
    ${rows}
  </div>`;
}

// ══════════════════════════════════════════════════════════════
// CSS TAMBAHAN — inject sekali saat file di-load
// ══════════════════════════════════════════════════════════════
(function injectDashboardV2CSS() {
  if (document.getElementById('db2-style')) return;
  const s = document.createElement('style');
  s.id = 'db2-style';
  s.textContent = `
  /* ── Ukuran font dasar lebih besar ── */
  .db-card-title { font-size: 13px !important; }

  /* ── Tabel full data ── */
  .db2-tbl { width:100%; border-collapse:collapse; font-size:13px; }
  .db2-tbl thead th { text-align:left; font-size:11px; font-weight:700; color:var(--dusty); text-transform:uppercase; letter-spacing:.4px; padding:5px 8px; border-bottom:2px solid var(--border); white-space:nowrap; }
  .db2-tbl tbody td { padding:7px 8px; border-bottom:1px solid var(--border); color:var(--charcoal); vertical-align:middle; }
  .db2-tbl tbody tr:last-child td { border-bottom:none; }
  .db2-tbl tbody tr:hover { background:rgba(0,0,0,.025); }
  .db2-tbl .r  { text-align:right; font-family:'DM Mono',monospace; }
  .db2-tbl .muted { color:var(--dusty); }

  /* ── Section label ── */
  .db2-sec-label { font-size:10px; font-weight:700; color:var(--dusty); text-transform:uppercase; letter-spacing:.8px; margin-bottom:6px; margin-top:4px; }

  /* ── OK row ── */
  .db2-ok-row { font-size:12px; color:var(--dusty); padding:8px 0; font-style:italic; }

  /* ── Badge ── */
  .db2-badge { font-size:10px; font-weight:700; padding:3px 9px; border-radius:20px; letter-spacing:.3px; white-space:nowrap; }
  .db2-badge-red   { background:rgba(192,57,43,.12); color:#a93226; border:1px solid rgba(192,57,43,.2); }
  .db2-badge-amber { background:rgba(201,168,76,.15); color:#7d6100; border:1px solid rgba(201,168,76,.3); }
  .db2-badge-gray  { background:var(--border); color:var(--dusty); border:1px solid var(--border); }
  .db2-badge-green { background:rgba(90,122,106,.12); color:#3a5e4e; border:1px solid rgba(90,122,106,.2); }

  /* ── Teks warna ── */
  .red-text  { color:#c0392b !important; font-weight:700; }
  .warn-text { color:#9a6f00 !important; font-weight:700; }

  /* ── Channel pill ── */
  .db2-ch-pill { font-size:10px; background:var(--border); color:var(--charcoal); padding:2px 7px; border-radius:10px; white-space:nowrap; font-weight:600; }

  /* ── Keuangan grid ── */
  .db2-keu-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  @media(max-width:640px){ .db2-keu-grid{ grid-template-columns:1fr; } }
  .db2-keu-card { background:var(--cream); border:1px solid var(--border); border-radius:10px; padding:10px 13px; }
  .db2-keu-label { font-size:10px; text-transform:uppercase; letter-spacing:.8px; font-weight:700; color:var(--dusty); margin-bottom:3px; }
  .db2-keu-val   { font-family:'DM Serif Display',serif; font-size:20px; color:var(--charcoal); line-height:1.2; }
  .db2-keu-sub   { font-size:12px; color:var(--dusty); margin-top:3px; }

  /* ── Target ── */
  .db2-target-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
  @media(max-width:640px){ .db2-target-grid{ grid-template-columns:1fr; } }
  .db2-target-row { display:flex; align-items:center; gap:8px; margin-bottom:5px; flex-wrap:wrap; }
  .db2-target-label { font-size:12px; color:var(--charcoal); font-weight:600; flex:1; min-width:100px; }
  .db2-target-nums  { font-size:12px; font-family:'DM Mono',monospace; color:var(--dusty); white-space:nowrap; }
  .db2-target-pct   { font-size:14px; font-family:'DM Mono',monospace; font-weight:800; white-space:nowrap; min-width:40px; text-align:right; }
  .db2-prog-bar     { height:7px; background:var(--border); border-radius:3px; overflow:hidden; }

  /* ── Harus per hari ── */
  .db2-per-hari { display:flex; align-items:center; gap:12px; background:rgba(201,168,76,.1); border:1px solid rgba(201,168,76,.3); border-radius:8px; padding:10px 14px; margin:0 0 12px; flex-wrap:wrap; }
  .db2-per-hari-label { font-size:12px; color:var(--dusty); flex:1; }
  .db2-per-hari-val   { font-family:'DM Serif Display',serif; font-size:20px; color:var(--charcoal); }
  .db2-per-hari-sub   { font-size:11px; color:var(--dusty); width:100%; margin-top:-4px; }

  /* ── Delta badge ── */
  .db2-delta { font-size:11px; font-weight:700; padding:1px 5px; border-radius:4px; }
  .db2-up   { color:#16a34a; background:rgba(22,163,74,.1); }
  .db2-dn   { color:#dc2626; background:rgba(220,38,38,.1); }
  .db2-flat { color:var(--dusty); background:var(--border); }

  /* ── Stat card font lebih besar ── */
  .stat-label { font-size:12px !important; }
  .stat-val   { font-size:22px !important; }
  .stat-sub   { font-size:13px !important; }
  `;
  document.head.appendChild(s);
})();

// ── Override renderChartBars, renderNotif, renderProgress, renderLastSales, renderTopSKU, renderStokPerSupplier, renderWajibRestock, renderTargetPerChannel ──
// Semua sudah di-handle di dalam renderDashboard() di atas — fungsi lama tidak dipakai lagi
function renderChartBars()         { /* handled by dashboard_v2 */ }
function renderProgress()          { /* handled by dashboard_v2 */ }
function renderTopSKU()            { /* handled by dashboard_v2 */ }
function renderStokPerSupplier()   { /* handled by dashboard_v2 */ }
function renderWajibRestock()      { /* handled by dashboard_v2 */ }
function renderTargetPerChannel()  { /* handled by dashboard_v2 */ }
