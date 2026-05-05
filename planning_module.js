// ================================================================
// PLANNING MODULE — zenOt Operasional — build 2026.05.03b
// Target & KPI Global + Operasional per Toko
// Storage: Supabase (tabel planning) + localStorage fallback
// ================================================================

(function() {

const PLAN = {
  keyBulan: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  },
  bulanLabel: () => {
    const months = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];
    const d = new Date();
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  },
  fmtRp: n => 'Rp ' + Number(n||0).toLocaleString('id-ID'),

  _h: () => ({
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=representation'
  }),

  async _sbLoad(toko, bulan) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/planning?toko=eq.${encodeURIComponent(toko)}&bulan=eq.${bulan}&select=data`,
        { headers: PLAN._h() }
      );
      if (!res.ok) return null;
      const rows = await res.json();
      return rows[0]?.data || null;
    } catch(e) { return null; }
  },

  async _sbSave(toko, bulan, data) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/planning?on_conflict=toko,bulan`,
        {
          method: 'POST',
          headers: { ...PLAN._h(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ toko, bulan, data, updated_at: new Date().toISOString() }])
        }
      );
      return res.ok;
    } catch(e) { return false; }
  },

  _lsKey: (toko, bulan) => `zenot_plan_${toko}_${bulan}`,
  _lsLoad(toko, bulan) {
    try { return JSON.parse(localStorage.getItem(PLAN._lsKey(toko, bulan))||'null'); } catch(e) { return null; }
  },
  _lsSave(toko, bulan, data) {
    try { localStorage.setItem(PLAN._lsKey(toko, bulan), JSON.stringify(data)); } catch(e) {}
  },

  async load(toko='global', bulan=null) {
    const b = bulan || PLAN.keyBulan();
    // 1. Supabase
    const sb = await PLAN._sbLoad(toko, b);
    if (sb) { PLAN._lsSave(toko, b, sb); return sb; }
    // 2. localStorage key baru
    const nd = PLAN._lsLoad(toko, b);
    if (nd) return nd;
    // 3. Fallback key lama (format lama: zenot_planning_2026_05)
    if (toko === 'global') {
      try {
        const old = JSON.parse(localStorage.getItem(`zenot_planning_${b.replace('-','_')}`)||'null');
        if (old) { PLAN._lsSave(toko, b, old); return old; }
      } catch(e) {}
    }
    // 4. Fallback key ops toko lama (format: zenot_ops_toko_SHP.ZENOOT)
    if (toko !== 'global') {
      try {
        const old = JSON.parse(localStorage.getItem(`zenot_ops_toko_${toko}`)||'null');
        if (old) { PLAN._lsSave(toko, b, old); return old; }
      } catch(e) {}
    }
    return {};
  },

  async save(toko='global', bulan=null, data) {
    const b = bulan || PLAN.keyBulan();
    PLAN._lsSave(toko, b, data);
    await PLAN._sbSave(toko, b, data);
  },

  loadSync(toko='global', bulan=null) {
    const b = bulan || PLAN.keyBulan();
    const nd = PLAN._lsLoad(toko, b);
    if (nd) return nd;
    // Fallback key lama global
    if (toko === 'global') {
      try {
        const old = JSON.parse(localStorage.getItem(`zenot_planning_${b.replace('-','_')}`)||'null');
        if (old) return old;
      } catch(e) {}
    }
    // Fallback key lama ops toko
    if (toko !== 'global') {
      try {
        const old = JSON.parse(localStorage.getItem(`zenot_ops_toko_${toko}`)||'null');
        if (old) return old;
      } catch(e) {}
    }
    return {};
  }
};

// ════════════════════════════════════════════════════════════════
// PAGE: TARGET & KPI
// ════════════════════════════════════════════════════════════════
async function renderPlanningKPI() {
  const el = document.getElementById('page-planning-kpi');
  if (!el) return;
  el.innerHTML = `<div style="padding:60px;text-align:center;color:var(--dusty);font-size:13px;">⏳ Memuat data...</div>`;
  const data = await PLAN.load('global');
  _renderKPIHTML(el, data);
}

function _renderKPIHTML(el, data) {
  el.innerHTML = `
  <style>
    .plan-section{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:20px;}
    .plan-section-title{font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--dusty);margin-bottom:18px;}
    .plan-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;}
    .plan-field{display:flex;flex-direction:column;gap:6px;}
    .plan-label{font-size:11px;font-weight:700;color:var(--dusty);letter-spacing:.5px;text-transform:uppercase;}
    .plan-input{padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-weight:700;font-family:'DM Mono',monospace;color:var(--charcoal);background:var(--card);outline:none;transition:border-color .2s,box-shadow .2s;width:100%;box-sizing:border-box;}
    .plan-input:focus{border-color:var(--brown);box-shadow:0 0 0 3px rgba(92,61,46,.1);}
    .plan-input-prefix{position:relative;}
    .plan-input-prefix span{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--dusty);font-weight:600;pointer-events:none;}
    .plan-input-prefix input{padding-left:30px;}
    .plan-save-btn{margin-top:20px;padding:11px 28px;background:var(--brown);color:var(--cream);border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.3px;transition:background .2s;}
    .plan-save-btn:hover{background:#3d2419;}
    .plan-divider{height:1px;background:var(--border);margin:20px 0;}
    .plan-preview{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:20px;}
    .plan-preview-card{background:var(--cream);border-radius:10px;padding:14px 16px;border:1px solid var(--border);}
    .plan-preview-label{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--dusty);margin-bottom:6px;}
    .plan-preview-val{font-size:18px;font-weight:800;font-family:'DM Mono',monospace;color:var(--charcoal);}
    .plan-preview-sub{font-size:10px;color:var(--dusty);margin-top:3px;}
    .plan-month-badge{display:inline-flex;align-items:center;padding:3px 10px;background:var(--brown);color:var(--cream);border-radius:20px;font-size:10px;font-weight:700;margin-left:8px;}
  </style>

  <div style="margin-bottom:24px;">
    <div style="font-size:22px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal);">
      Target & KPI <span class="plan-month-badge">${PLAN.bulanLabel()}</span>
    </div>
    <div style="font-size:12px;color:var(--dusty);margin-top:6px;">Data global acuan Dashboard, Daily Checklist & Intelligence. ☁️ Sync ke Supabase.</div>
  </div>

  <div class="plan-section">
    <div class="plan-section-title">📦 Produksi & Penjualan</div>
    <div class="plan-grid">
      <div class="plan-field"><div class="plan-label">Target Produksi (pcs)</div>
        <input class="plan-input" type="number" id="plan-produksi" placeholder="0" value="${data.targetProduksi||''}"></div>
      <div class="plan-field"><div class="plan-label">Target Unit Terjual (pcs)</div>
        <input class="plan-input" type="number" id="plan-unit" placeholder="0" value="${data.targetUnit||''}"></div>
      <div class="plan-field"><div class="plan-label">Target Omset (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-omset" placeholder="0" value="${data.targetOmset||''}"></div></div>
      <div class="plan-field"><div class="plan-label">Target Transaksi (order)</div>
        <input class="plan-input" type="number" id="plan-transaksi" placeholder="0" value="${data.targetTransaksi||''}"></div>
    </div>
  </div>

  <div class="plan-section">
    <div class="plan-section-title">💰 Margin & Profitabilitas</div>
    <div class="plan-grid">
      <div class="plan-field"><div class="plan-label">Target GPM (%)</div>
        <input class="plan-input" type="number" id="plan-gpm" placeholder="0" value="${data.targetGPM||''}" step="0.1"></div>
      <div class="plan-field"><div class="plan-label">Target NPM (%)</div>
        <input class="plan-input" type="number" id="plan-npm" placeholder="0" value="${data.targetNPM||''}" step="0.1"></div>
      <div class="plan-field"><div class="plan-label">Target ROAS (x)</div>
        <input class="plan-input" type="number" id="plan-roas" placeholder="0" value="${data.targetROAS||''}" step="0.1"></div>
      <div class="plan-field"><div class="plan-label">Budget Iklan (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-iklan" placeholder="0" value="${data.budgetIklan||''}"></div></div>
    </div>
  </div>

  <div class="plan-section">
    <div class="plan-section-title">🏭 Biaya Operasional Bulanan</div>
    <div class="plan-grid">
      <div class="plan-field"><div class="plan-label">Gaji & Tenaga Kerja (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-gaji" placeholder="0" value="${data.biayaGaji||''}"></div></div>
      <div class="plan-field"><div class="plan-label">Sewa & Utilitas (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-sewa" placeholder="0" value="${data.biayaSewa||''}"></div></div>
      <div class="plan-field"><div class="plan-label">Bahan Baku / Produksi (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-bahan" placeholder="0" value="${data.biayaBahan||''}"></div></div>
      <div class="plan-field"><div class="plan-label">Lain-lain (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-lain" placeholder="0" value="${data.biayaLain||''}"></div></div>
    </div>
  </div>

  <button class="plan-save-btn" id="plan-save-btn" onclick="savePlanningKPI()">💾 Simpan Target Bulan Ini</button>

  <div class="plan-divider"></div>
  <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--dusty);margin-bottom:12px;">📋 Target Tersimpan</div>
  <div class="plan-preview">
    <div class="plan-preview-card">
      <div class="plan-preview-label">Produksi</div>
      <div class="plan-preview-val">${data.targetProduksi||'—'}</div>
      <div class="plan-preview-sub">pcs target</div>
    </div>
    <div class="plan-preview-card">
      <div class="plan-preview-label">Omset</div>
      <div class="plan-preview-val" style="font-size:13px;">${data.targetOmset?PLAN.fmtRp(data.targetOmset):'—'}</div>
      <div class="plan-preview-sub">target bulanan</div>
    </div>
    <div class="plan-preview-card">
      <div class="plan-preview-label">NPM Target</div>
      <div class="plan-preview-val">${data.targetNPM||'—'}${data.targetNPM?'%':''}</div>
      <div class="plan-preview-sub">net profit margin</div>
    </div>
    <div class="plan-preview-card">
      <div class="plan-preview-label">ROAS Target</div>
      <div class="plan-preview-val">${data.targetROAS||'—'}${data.targetROAS?'x':''}</div>
      <div class="plan-preview-sub">return on ad spend</div>
    </div>
    <div class="plan-preview-card">
      <div class="plan-preview-label">Total Ops</div>
      <div class="plan-preview-val" style="font-size:13px;">${
        (data.biayaGaji||0)+(data.biayaSewa||0)+(data.biayaBahan||0)+(data.biayaLain||0)>0
        ? PLAN.fmtRp((data.biayaGaji||0)+(data.biayaSewa||0)+(data.biayaBahan||0)+(data.biayaLain||0))
        : '—'
      }</div>
      <div class="plan-preview-sub">biaya operasional</div>
    </div>
  </div>
  `;
}

async function savePlanningKPI() {
  const btn = document.getElementById('plan-save-btn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Menyimpan...'; }
  const data = PLAN.loadSync('global') || {};
  data.targetProduksi  = parseFloat(document.getElementById('plan-produksi')?.value)||0;
  data.targetUnit      = parseFloat(document.getElementById('plan-unit')?.value)||0;
  data.targetOmset     = parseFloat(document.getElementById('plan-omset')?.value)||0;
  data.targetTransaksi = parseFloat(document.getElementById('plan-transaksi')?.value)||0;
  data.targetGPM       = parseFloat(document.getElementById('plan-gpm')?.value)||0;
  data.targetNPM       = parseFloat(document.getElementById('plan-npm')?.value)||0;
  data.targetROAS      = parseFloat(document.getElementById('plan-roas')?.value)||0;
  data.budgetIklan     = parseFloat(document.getElementById('plan-iklan')?.value)||0;
  data.biayaGaji       = parseFloat(document.getElementById('plan-gaji')?.value)||0;
  data.biayaSewa       = parseFloat(document.getElementById('plan-sewa')?.value)||0;
  data.biayaBahan      = parseFloat(document.getElementById('plan-bahan')?.value)||0;
  data.biayaLain       = parseFloat(document.getElementById('plan-lain')?.value)||0;
  await PLAN.save('global', null, data);
  if (typeof renderDashboard==='function') renderDashboard();
  if (typeof toast==='function') toast('✅ Target '+PLAN.bulanLabel()+' tersimpan ke cloud!');
  if (btn) { btn.disabled=false; btn.textContent='💾 Simpan Target Bulan Ini'; }
  const el = document.getElementById('page-planning-kpi');
  if (el) _renderKPIHTML(el, data);
}

// ════════════════════════════════════════════════════════════════
// PAGE: OPS PER TOKO
// ════════════════════════════════════════════════════════════════
async function renderPlanningOps() {
  const el = document.getElementById('page-planning-ops');
  if (!el) return;
  const channels = window._tokoList && window._tokoList.length > 0
    ? window._tokoList
    : (typeof DB!=='undefined'?DB.channel||[]:[]).filter(c=>c.nama!=='__assign__');

  const fmtRp = v => v ? 'Rp '+Number(v).toLocaleString('id-ID') : '—';

  el.innerHTML = `
  <style>
    .ops-toko-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:14px;}
    .ops-toko-header{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
    .ops-toko-name{font-size:15px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal);}
    .ops-4col{display:grid;grid-template-columns:1fr 1fr 1fr 1.2fr;gap:12px;align-items:end;}
    @media(max-width:800px){.ops-4col{grid-template-columns:1fr 1fr;}}
    @media(max-width:480px){.ops-4col{grid-template-columns:1fr;}}
    .plan-field{display:flex;flex-direction:column;gap:5px;}
    .plan-label{font-size:10px;font-weight:700;color:var(--dusty);letter-spacing:.5px;text-transform:uppercase;}
    .plan-input{padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-weight:700;font-family:'DM Mono',monospace;color:var(--charcoal);background:var(--card);outline:none;width:100%;box-sizing:border-box;transition:border-color .2s;}
    .plan-input:focus{border-color:var(--brown);}
    .ops-result-box{background:var(--cream);border:2px solid var(--brown);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;}
    .ops-result-label{font-size:10px;font-weight:700;color:var(--brown);letter-spacing:.5px;text-transform:uppercase;}
    .ops-result-val{font-size:18px;font-weight:900;font-family:'DM Serif Display',serif;color:var(--charcoal);}
    .ops-result-sub{font-size:11px;color:var(--dusty);font-weight:600;}
    .ops-save-btn{margin-top:14px;padding:8px 20px;background:var(--brown);color:var(--cream);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;transition:opacity .2s;}
    .ops-save-btn:hover{opacity:.85;}
    .ops-formula-hint{font-size:11px;color:var(--dusty);margin-top:4px;font-style:italic;}
  </style>
  <div style="margin-bottom:24px;">
    <div style="font-size:22px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal);">Biaya <span style="color:var(--brown)">Operasional</span></div>
    <div style="font-size:12px;color:var(--dusty);margin-top:6px;">Input biaya & rasio per toko → Target Omzet dihitung otomatis. ☁️ Sync ke Supabase.</div>
  </div>
  ${channels.length===0
    ? `<div style="color:var(--dusty);font-size:13px;padding:20px;">Belum ada channel aktif.</div>`
    : channels.map(ch => {
        const chNama = ch.kode || ch.nama;
        const platform = ch.platform || 'lainnya';
        const d = PLAN.loadSync(chNama) || {};
        const biaya = d.biayaOps || 0;
        const rasio = d.rasioOps || 0;
        const targetBulan = (rasio > 0 && biaya > 0) ? Math.round(biaya / (rasio / 100)) : 0;
        const targetHarian = targetBulan > 0 ? Math.round(targetBulan / 30) : 0;
        const pStyle = typeof _platformStyle==='function'?_platformStyle(platform):{bg:'#8C7B6B',color:'#fff'};
        return `
        <div class="ops-toko-card">
          <div class="ops-toko-header">
            <span style="padding:3px 10px;border-radius:20px;background:${pStyle.bg};color:${pStyle.color};font-size:10px;font-weight:700;">${platform}</span>
            <span class="ops-toko-name">${chNama}</span>
          </div>
          <div class="ops-4col">

            <div class="plan-field">
              <div class="plan-label">Channel</div>
              <div style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-weight:700;color:var(--dusty);background:var(--bg);font-family:'DM Mono',monospace;">${chNama}</div>
            </div>

            <div class="plan-field">
              <div class="plan-label">Biaya Operasional (Rp)</div>
              <input class="plan-input" type="number" id="ops-biaya-${chNama}" placeholder="0"
                value="${biaya||''}"
                oninput="recalcOpsTarget('${chNama}')">
              <div class="ops-formula-hint">Gaji, sewa, utilitas, dll</div>
            </div>

            <div class="plan-field">
              <div class="plan-label">Rasio Operasional (%)</div>
              <input class="plan-input" type="number" id="ops-rasio-${chNama}" placeholder="0"
                value="${rasio||''}" step="0.1" min="0.1" max="100"
                oninput="recalcOpsTarget('${chNama}')">
              <div class="ops-formula-hint">Target % ops dari omzet</div>
            </div>

            <div class="ops-result-box" id="ops-result-${chNama}">
              <div class="ops-result-label">🎯 Target Omzet</div>
              <div class="ops-result-val" id="ops-result-bulan-${chNama}">${targetBulan>0?fmtRp(targetBulan):'—'}</div>
              <div class="ops-result-sub" id="ops-result-harian-${chNama}">${targetHarian>0?fmtRp(targetHarian)+' / hari':'Isi biaya & rasio dulu'}</div>
            </div>

          </div>
          <button class="ops-save-btn" onclick="saveOpsToko('${chNama}')">💾 Simpan</button>
        </div>`;
      }).join('')
  }`;
}

function recalcOpsTarget(chNama) {
  const biaya  = parseFloat(document.getElementById(`ops-biaya-${chNama}`)?.value) || 0;
  const rasio  = parseFloat(document.getElementById(`ops-rasio-${chNama}`)?.value) || 0;
  const valEl  = document.getElementById(`ops-result-bulan-${chNama}`);
  const subEl  = document.getElementById(`ops-result-harian-${chNama}`);
  const boxEl  = document.getElementById(`ops-result-${chNama}`);
  if (!valEl || !subEl) return;
  if (biaya > 0 && rasio > 0) {
    const targetBulan  = Math.round(biaya / (rasio / 100));
    const targetHarian = Math.round(targetBulan / 30);
    const fmt = v => 'Rp '+Number(v).toLocaleString('id-ID');
    valEl.textContent = fmt(targetBulan) + ' / bln';
    subEl.textContent = fmt(targetHarian) + ' / hari';
    if (boxEl) boxEl.style.borderColor = 'var(--brown)';
  } else {
    valEl.textContent = '—';
    subEl.textContent = 'Isi biaya & rasio dulu';
    if (boxEl) boxEl.style.borderColor = 'var(--border)';
  }
}

async function saveOpsToko(chNama) {
  const biaya = parseFloat(document.getElementById(`ops-biaya-${chNama}`)?.value)||0;
  const rasio = parseFloat(document.getElementById(`ops-rasio-${chNama}`)?.value)||0;
  const targetBulan = (rasio > 0 && biaya > 0) ? Math.round(biaya / (rasio / 100)) : 0;
  const data = {
    biayaOps    : biaya,
    rasioOps    : rasio,
    targetOmset : targetBulan,
    // preserve field lama supaya tidak hilang
    budgetIklan : parseFloat((PLAN.loadSync(chNama)||{}).budgetIklan)||0,
    feePlatform : parseFloat((PLAN.loadSync(chNama)||{}).feePlatform)||0,
    targetROAS  : parseFloat((PLAN.loadSync(chNama)||{}).targetROAS)||0,
  };
  await PLAN.save(chNama, null, data);
  if (typeof toast==='function') toast(`✅ ${chNama} — Target Omzet tersimpan!`);
}

// ─── EXPOSE ─────────────────────────────────────────────────────
window.renderPlanningKPI  = renderPlanningKPI;
window.renderPlanningOps  = renderPlanningOps;
window.savePlanningKPI    = savePlanningKPI;
window.saveOpsToko        = saveOpsToko;
window.recalcOpsTarget    = recalcOpsTarget;
window.PLAN               = PLAN;

})();
