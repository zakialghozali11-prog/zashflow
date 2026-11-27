/* =========================================================
   ZashFlow — app.js
   Profil Zaki • Arus Kas • Emas 24K • Jadwal Harian •
   Market Watch Live 12 Aset • Berita • Pencarian • PWA
   ========================================================= */
(() => {
  'use strict';

  /* ===================== UTILITIES ===================== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const TZ = 'Asia/Jakarta';
  const PREFIX = 'zashflow:';
  const OZ = 31.1034768; // gram per troy ounce

  const store = {
    get(k, d) {
      try { const v = localStorage.getItem(PREFIX + k); return v === null ? d : JSON.parse(v); } catch { return d; }
    },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch { /* quota / private mode */ } },
    del(k) { try { localStorage.removeItem(PREFIX + k); } catch { /* noop */ } }
  };

  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const esc = (s) => String(s ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
  const nfCache = {};
  const nf = (d = 0, loc = 'id-ID') => (nfCache[loc + d] ||= new Intl.NumberFormat(loc, { minimumFractionDigits: d, maximumFractionDigits: d }));
  const fmtRp = (n) => (n < 0 ? '-Rp ' : 'Rp ') + nf(0).format(Math.round(Math.abs(n || 0)));
  const fmtRpShort = (n) => {
    const a = Math.abs(n), s = n < 0 ? '-' : '';
    if (a >= 1e9) return `${s}Rp ${nf(2).format(a / 1e9)} M`;
    if (a >= 1e6) return `${s}Rp ${nf(2).format(a / 1e6)} jt`;
    if (a >= 1e3) return `${s}Rp ${nf(0).format(a / 1e3)} rb`;
    return `${s}Rp ${nf(0).format(a)}`;
  };
  const fmtGram = (g) => nf(4).format(g || 0);
  const fmtPct = (p, d = 2) => `${p > 0 ? '+' : ''}${nf(d).format(p || 0)}%`;
  const parseDigits = (s) => { const n = parseInt(String(s).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : 0; };
  const parseDecimal = (s) => { const n = parseFloat(String(s).replace(/\s/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const parseGram = (s) => { const t = String(s).trim().replace(',', '.'); const n = parseFloat(t); return Number.isFinite(n) ? n : 0; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const icon = (name, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  function jkt(d = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(d);
    const o = {}; parts.forEach((p) => { o[p.type] = p.value; });
    if (o.hour === '24') o.hour = '00';
    return o;
  }
  const WD = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const todayIdx = () => WD[jkt().weekday] ?? 0;
  const todayISO = () => { const p = jkt(); return `${p.year}-${p.month}-${p.day}`; };
  const timeWIB = (d = new Date()) => { const p = jkt(d); return `${p.hour}:${p.minute}:${p.second}`; };
  const hmWIB = (d) => { const p = jkt(d); return `${p.hour}:${p.minute}`; };
  const dateLong = (d = new Date()) => new Intl.DateTimeFormat('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const dateShort = (d) => new Intl.DateTimeFormat('id-ID', { timeZone: TZ, day: 'numeric', month: 'short' }).format(d);
  const dayShort = (d) => new Intl.DateTimeFormat('id-ID', { timeZone: TZ, weekday: 'short' }).format(d);
  const fmtISODate = (iso) => {
    const [y, m, dd] = String(iso).split('-').map(Number);
    if (!y) return iso;
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, dd)));
  };

  /* ===================== CONSTANTS ===================== */
  const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const DAYS_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const DEFAULT_GOLD_IDR = 0;
  const ANTAM_BASELINE = 2505000;
  const TYPE_META = {
    subject: { label: 'Pelajaran', icon: 'book' },
    ppa: { label: 'PPA', icon: 'users' },
    les: { label: 'Les', icon: 'pen' },
    vibe: { label: 'Rutin Harian', icon: 'code' },
    custom: { label: 'Kegiatan', icon: 'sparkle' }
  };
  const CATS = {
    in: ['Uang Saku', 'Tabungan', 'Hadiah', 'Bonus', 'Penjualan', 'Saldo Awal', 'Lainnya'],
    out: ['Makan & Minum', 'Transportasi', 'Pendidikan', 'Belanja', 'Hiburan', 'Pulsa & Internet', 'Lainnya']
  };
  const VIEWS = {
    dashboard: { title: 'Dashboard', sub: 'Ringkasan kekayaan, jadwal & pasar hari ini' },
    finance: { title: 'Keuangan & Tabungan Emas', sub: 'Arus kas pribadi & tabungan emas 24K Zaki' },
    schedule: { title: 'Jadwal Harian Zaki', sub: 'Pelajaran, PPA, les & rutinitas vibe coding' },
    market: { title: 'Market Watch', sub: 'Harga pasar real-time 12 aset' },
    news: { title: 'Berita Pasar', sub: 'Sentimen emas, saham, kripto & makro' },
    settings: { title: 'Pengaturan', sub: 'Tampilan Liquid Glass, profil, pasar & cadangan data' }
  };
  const DOCK_ORDER = ['dashboard', 'finance', 'schedule', 'market', 'news'];
  const VIEW_ORDER = ['dashboard', 'finance', 'schedule', 'market', 'news', 'settings'];

  /* ===================== MARKET ASSETS ===================== */
  // Baseline terverifikasi pasar global & Indonesia (26 Nov 2026) + vol per jam untuk grafik fallback
  const MARKET_CACHE_VER = 4;
  const ASSETS = [
    { id: 'ANTAM', sym: 'ANTAM 1g', name: 'Emas Antam 24K', group: 'gold', tag: 'Emas', fmt: 'idr', base: ANTAM_BASELINE, prevBase: 2507000, vol: 0.0016 },
    { id: 'XAUUSD', sym: 'XAU/USD', name: 'Emas Spot Dunia', group: 'gold', tag: 'Emas', fmt: 'usd', base: 3588, prevBase: 3560, vol: 0.0018 },
    { id: 'BTCUSD', sym: 'BTC/USD', name: 'Bitcoin', group: 'trade', tag: 'Kripto', fmt: 'usd', base: 60180, prevBase: 59800, vol: 0.006, binance: 'BTCUSDT' },
    { id: 'ETHUSD', sym: 'ETH/USD', name: 'Ethereum', group: 'trade', tag: 'Kripto', fmt: 'usd', base: 1685, prevBase: 1680, vol: 0.008, binance: 'ETHUSDT' },
    { id: 'USDIDR', sym: 'USD/IDR', name: 'Dolar AS / Rupiah', group: 'trade', tag: 'Forex', fmt: 'idr', base: 18227, prevBase: 18231, vol: 0.0006 },
    { id: 'EURUSD', sym: 'EUR/USD', name: 'Euro / Dolar AS', group: 'trade', tag: 'Forex', fmt: 'fx', base: 1.0985, prevBase: 1.0975, vol: 0.0007, binance: 'EURUSDT' },
    {
      id: 'IHSG', sym: 'IHSG', name: 'Indeks Harga Saham Gabungan', group: 'stock', tag: 'Indeks', fmt: 'pts',
      base: 5231.82, prevBase: 5197.61, openBase: 5214.62, highBase: 5297.46, lowBase: 5214.57, vol: 0.0022, tv: 'IDX:COMPOSITE', yahoo: '^JKSE'
    },
    {
      id: 'BBCA', sym: 'BBCA', name: 'Bank Central Asia', group: 'stock', tag: 'Saham', fmt: 'idr',
      base: 5925, prevBase: 5825, openBase: 5825, highBase: 6025, lowBase: 5800, vol: 0.004, tv: 'IDX:BBCA', yahoo: 'BBCA.JK'
    },
    {
      id: 'BBRI', sym: 'BBRI', name: 'Bank Rakyat Indonesia', group: 'stock', tag: 'Saham', fmt: 'idr',
      base: 3060, prevBase: 3070, openBase: 3060, highBase: 3100, lowBase: 3050, vol: 0.005, tv: 'IDX:BBRI', yahoo: 'BBRI.JK'
    },
    {
      id: 'BMRI', sym: 'BMRI', name: 'Bank Mandiri', group: 'stock', tag: 'Saham', fmt: 'idr',
      base: 3980, prevBase: 4000, openBase: 4010, highBase: 4030, lowBase: 3970, vol: 0.0045, tv: 'IDX:BMRI', yahoo: 'BMRI.JK'
    },
    {
      id: 'TLKM', sym: 'TLKM', name: 'Telkom Indonesia', group: 'stock', tag: 'Saham', fmt: 'idr',
      base: 2000, prevBase: 2010, openBase: 2010, highBase: 2030, lowBase: 1995, vol: 0.005, tv: 'IDX:TLKM', yahoo: 'TLKM.JK'
    },
    {
      id: 'NVDA', sym: 'NVDA', name: 'NVIDIA Corp.', group: 'stock', tag: 'Saham AS', fmt: 'usd',
      base: 149.30, prevBase: 155.38, openBase: 144.06, highBase: 150.37, lowBase: 141.17, vol: 0.007, tv: 'NASDAQ:NVDA', yahoo: 'NVDA'
    }
  ];
  const A = Object.fromEntries(ASSETS.map((a) => [a.id, a]));
  const GROUPS = { gold: 'Emas Global & Antam', trade: 'Trading & Forex', stock: 'Saham' };
  const STOCKS = ASSETS.filter((a) => a.tv || a.yahoo).map((a) => a.id);
  const DASH_ASSETS = ['ANTAM', 'XAUUSD', 'BTCUSD', 'BBCA'];

  /* ---------- Asset logos (SVG, anti-broken-image) ---------- */
  const LOGOS = {
    ANTAM: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="url(#lg-gold)"/><path d="M6.5 22h8.6l-1.5-4.4H8z" fill="#fff6d6"/><path d="M16.9 22h8.6l-1.5-4.4h-5.6z" fill="#fff1c2"/><path d="M11.7 16.3h8.6l-1.5-4.4h-5.6z" fill="#fffbe9"/><path d="M6.5 22h8.6M16.9 22h8.6M11.7 16.3h8.6" stroke="#b07a10" stroke-width=".8" stroke-linecap="round"/></svg>`,
    XAUUSD: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="url(#lg-gold)"/><circle cx="16" cy="16" r="12" fill="none" stroke="#fff4c4" stroke-opacity=".7" stroke-width="1.2"/><text x="16" y="20.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="12.5" fill="#fff">Au</text></svg>`,
    BTCUSD: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#f7931a"/><g transform="rotate(12 16 16)"><path d="M12.2 9.6h5.4c2 0 3.3 1.1 3.3 2.7 0 1.2-.7 2-1.7 2.3 1.3.3 2.2 1.3 2.2 2.7 0 1.9-1.5 3.1-3.7 3.1h-5.5z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><path d="M12.2 15.4h6.2M14.3 7.6v2M17.3 7.6v2M14.3 20.4v2M17.3 20.4v2" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g></svg>`,
    ETHUSD: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#627eea"/><path d="M16 5.5v7.8l6.6 2.9z" fill="#fff" fill-opacity=".6"/><path d="M16 5.5 9.4 16.2l6.6-2.9z" fill="#fff"/><path d="M16 21.3v5.2l6.6-9.2z" fill="#fff" fill-opacity=".6"/><path d="M16 26.5v-5.2l-6.6-4z" fill="#fff"/><path d="M16 20.1l6.6-3.9L16 13.3z" fill="#fff" fill-opacity=".2"/><path d="M9.4 16.2 16 20.1v-6.8z" fill="#fff" fill-opacity=".6"/></svg>`,
    USDIDR: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#16a34a"/><text x="14" y="21.5" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="15" fill="#fff">$</text><circle cx="24" cy="24" r="6.2" fill="#fff"/><path d="M19 24a5 5 0 0 1 10 0z" fill="#e11d48"/><path d="M19 24a5 5 0 0 0 10 0z" fill="#fff"/><circle cx="24" cy="24" r="5" fill="none" stroke="#cbd5e1" stroke-width=".6"/></svg>`,
    EURUSD: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#1d4ed8"/><g fill="#fde047">${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${(16 + Math.cos(a) * 11).toFixed(2)}" cy="${(16 + Math.sin(a) * 11).toFixed(2)}" r="1"/>`; }).join('')}</g><text x="16" y="21" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="14" fill="#fff">€</text></svg>`,
    IHSG: `<svg viewBox="0 0 32 32"><path d="M0 16a16 16 0 0 1 32 0z" fill="#dc2626"/><path d="M0 16a16 16 0 0 0 32 0z" fill="#f8fafc"/><path d="M7 21l5-5 4 3 8-8" fill="none" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.5 11H24v4.5" fill="none" stroke="#0f172a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="16" r="15.5" fill="none" stroke="#e2e8f0" stroke-width="1"/></svg>`,
    BBCA: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#0060af"/><path d="M8 11.5c4.5-3 11.5-3 16 0" fill="none" stroke="#7cc4ff" stroke-width="1.6" stroke-linecap="round"/><text x="16" y="20.5" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="9.5" fill="#fff" letter-spacing=".3">BCA</text></svg>`,
    BBRI: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#00529c"/><rect x="7" y="22" width="18" height="2" rx="1" fill="#f59e0b"/><text x="16" y="19.5" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="10" fill="#fff">BRI</text></svg>`,
    BMRI: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#003d79"/><path d="M5 12.2c5.5-3.4 16.5-3.4 22 0" fill="none" stroke="#ffb700" stroke-width="2.4" stroke-linecap="round"/><text x="16" y="21.2" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="8.4" fill="#fff" letter-spacing=".2">BMRI</text></svg>`,
    TLKM: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#e60012"/><path d="M9.5 10h13v3.4h-4.7V23h-3.6v-9.6H9.5z" fill="#fff"/><path d="M22.5 20.5a8 8 0 0 1-12 2.5" fill="none" stroke="#fecaca" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    NVDA: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#76b900"/><path d="M6.5 16.2s3.7-5.6 9.6-5.6c5.9 0 9.4 5.6 9.4 5.6s-3.5 5.4-9.4 5.4c-5.9 0-9.6-5.4-9.6-5.4z" fill="none" stroke="#fff" stroke-width="2"/><circle cx="16.1" cy="16.1" r="3" fill="#fff"/></svg>`
  };
  const logo = (id) => LOGOS[id] || '';

  /* ===================== USERS ===================== */
  const USERS = {
    zaki: { id: 'zaki', name: 'Zaki', initial: 'Z', badge: 'Biru · Putih', themeDesc: 'Putih Biru Muda (Terang) atau Deep Ocean Blue (Gelap)' },
    niza: { id: 'niza', name: 'Niza', initial: 'N', badge: 'Pink Terang · Putih', themeDesc: 'Putih Pink Terang (Terang) atau Deep Rose Pink (Gelap)' }
  };
  const isNizaPage = () => /niza\.html$/i.test(location.pathname);
  const installParam = () => {
    try { const p = new URLSearchParams(location.search).get('install'); return p === 'niza' || p === 'zaki' ? p : null; } catch { return null; }
  };
  const activeUserId = () => {
    const qp = installParam();
    if (qp) { store.set('activeUser', qp); return qp; }
    const saved = store.get('activeUser', null);
    if (saved === 'niza' || saved === 'zaki') return saved;
    return document.documentElement.dataset.defaultUser === 'niza' ? 'niza' : 'zaki';
  };
  const uKey = (k, uidName = state.user) => (uidName === 'zaki' ? k : `u:${uidName}:${k}`);

  /* ===================== STATE ===================== */
  const defaultTxs = () => [];

  const defaultSchedule = (u = 'zaki') => {
    const S = (t) => ({ id: uid(), title: t, type: 'subject' });
    const V = () => ({ id: uid(), title: 'Vibe Coding', type: 'vibe' });
    const P = (time) => ({ id: uid(), title: 'PPA', type: 'ppa', time });
    const L = (time, title = 'Les') => ({ id: uid(), title, type: 'les', time });
    if (u === 'niza') {
      return [
        [S('English'), S('Agama'), S('B. Indonesia'), L('18:00 – 19:30 WIB')],
        [S('Olahraga'), S('B. Jawa'), S('Pendidikan Pancasila'), L('18:00 – 19:30 WIB')],
        [S('IPA'), S('Matematika'), S('Seni Budaya'), P('15:00 – 17:00 WIB'), L('18:00 – 19:30 WIB')],
        [S('Matematika'), S('Informatika'), S('BK'), S('IPA')],
        [S('B. Indonesia'), S('IPS'), P('13:00 – 15:00 WIB')],
        [L('13:00 – 14:30 WIB', 'Les Ngaji')],
        []
      ];
    }
    return [
      [S('English'), S('Agama'), S('B. Indonesia'), V()],
      [S('Olahraga'), S('B. Jawa'), S('Pendidikan Pancasila'), V()],
      [S('IPA'), S('Matematika'), S('Seni Budaya'), P('15:00 – 17:00 WIB'), V()],
      [S('Matematika'), S('Informatika'), S('BK'), S('IPA'), L('16:30 – 19:30 WIB'), V()],
      [S('B. Indonesia'), S('IPS'), P('13:00 – 15:00 WIB'), V()],
      [L('14:00 – 15:30 WIB'), V()],
      [V()]
    ];
  };

  const SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,40}$/;
  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const MAX_MONEY = 1e13;
  const MAX_TXS = 2000;
  const MAX_SCHED_DAY = 50;

  function sanitizeTx(x) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const type = x.type === 'out' ? 'out' : x.type === 'in' ? 'in' : null;
    const amount = Math.round(Number(x.amount));
    if (!type || !Number.isFinite(amount) || amount <= 0 || amount > MAX_MONEY) return null;
    const id = typeof x.id === 'string' && SAFE_ID_RE.test(x.id) ? x.id : uid();
    const desc = String(x.desc ?? '').trim().slice(0, 80) || (type === 'in' ? 'Pemasukan' : 'Pengeluaran');
    const cat = String(x.cat ?? '').trim().slice(0, 40) || (type === 'in' ? 'Pemasukan' : 'Pengeluaran');
    const date = typeof x.date === 'string' && ISO_DATE_RE.test(x.date) ? x.date : todayISO();
    const created = Number.isFinite(Number(x.created)) && Number(x.created) > 0 ? Math.floor(Number(x.created)) : Date.now();
    return { id, type, amount, desc, cat, date, created };
  }
  const sanitizeTxs = (arr) => (Array.isArray(arr) ? arr.slice(0, MAX_TXS).map(sanitizeTx).filter(Boolean) : []);

  function sanitizeSchedItem(x) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const title = String(x.title ?? '').trim().slice(0, 60);
    if (!title) return null;
    const type = hasOwn(TYPE_META, x.type) ? x.type : 'custom';
    const id = typeof x.id === 'string' && SAFE_ID_RE.test(x.id) ? x.id : uid();
    const time = typeof x.time === 'string' ? x.time.trim().slice(0, 30) : '';
    return time ? { id, title, type, time } : { id, title, type };
  }
  const sanitizeSchedule = (arr) => (Array.isArray(arr) && arr.length === 7 && arr.every(Array.isArray)
    ? arr.map((day) => day.slice(0, MAX_SCHED_DAY).map(sanitizeSchedItem).filter(Boolean))
    : null);
  const sanitizeGold = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= MAX_MONEY ? n : 0; };
  const sanitizeGoldGoal = (v) => ([0, 1, 2, 5, 10].includes(Number(v)) ? Number(v) : 0);

  const loadTxs = (u = 'zaki') => {
    const k = u === 'zaki' ? 'txs' : `u:${u}:txs`;
    const t = store.get(k, null);
    if (u === 'zaki' && !store.get('zakiZeroed', 0)) {
      store.set('zakiZeroed', 1);
      if (Array.isArray(t) && t.length === 2 && t.every((x) => x && (x.id === 'seed-bank' || x.id === 'seed-cash'))) {
        store.set(k, []);
        store.set('goldIDR', 0);
        return [];
      }
    }
    if (Array.isArray(t)) return sanitizeTxs(t);
    const d = defaultTxs(u); store.set(k, d); return d;
  };
  const loadSchedule = (u = 'zaki') => {
    const k = u === 'zaki' ? 'schedule' : `u:${u}:schedule`;
    const s = sanitizeSchedule(store.get(k, null));
    if (u === 'niza' && !store.get('u:niza:schedSeeded', 0) && (!s || s.every((day) => day.length === 0))) {
      const d = defaultSchedule('niza');
      store.set(k, d);
      store.set('u:niza:schedSeeded', 1);
      store.set('u:niza:lesNgajiV1', 1);
      return d;
    }
    if (s) {
      if (u === 'niza' && !store.get('u:niza:lesNgajiV1', 0)) {
        if (!s[5].some((x) => /ngaji/i.test(x.title))) {
          s[5].push({ id: uid(), title: 'Les Ngaji', type: 'les', time: '13:00 – 14:30 WIB' });
          store.set(k, s);
        }
        store.set('u:niza:lesNgajiV1', 1);
      }
      return s;
    }
    const d = defaultSchedule(u);
    store.set(k, d);
    if (u === 'niza') { store.set('u:niza:schedSeeded', 1); store.set('u:niza:lesNgajiV1', 1); }
    return d;
  };
  const loadGold = (u = 'zaki') => {
    const k = u === 'zaki' ? 'goldIDR' : `u:${u}:goldIDR`;
    const def = u === 'zaki' ? DEFAULT_GOLD_IDR : 0;
    const v = store.get(k, null);
    return v === null ? def : sanitizeGold(v);
  };
  const loadGoldGoal = (u = 'zaki') => sanitizeGoldGoal(store.get(u === 'zaki' ? 'goldGoal' : `u:${u}:goldGoal`, 0));

  const initUser = activeUserId();
  const state = {
    user: initUser,
    theme: store.get('theme', 'light') === 'dark' ? 'dark' : 'light',
    glass: ['soft', 'liquid', 'ultra'].includes(store.get('glass', 'liquid')) ? store.get('glass', 'liquid') : 'liquid',
    motion: store.get('motion', true) !== false,
    userName: USERS[initUser].name,
    goldGoal: loadGoldGoal(initUser),
    view: 'dashboard',
    txs: loadTxs(initUser),
    goldIDR: loadGold(initUser),
    schedule: loadSchedule(initUser),
    collapsed: !!store.get('sbCollapsed', false),
    live: store.get('live', true) !== false,
    interval: [30, 60, 120, 300].includes(store.get('interval', 60)) ? store.get('interval', 60) : 60,
    asset: hasOwn(A, store.get('asset', 'ANTAM')) ? store.get('asset', 'ANTAM') : 'ANTAM',
    range: '1D',
    schedDay: todayIdx(),
    txFilter: 'all',
    txType: 'in',
    newsFilter: 'all',
    countdown: 60,
    isMobile: document.documentElement.classList.contains('is-mobile'),
    calcLast: 'idr',
    goldMode: 'add',
    lesRemind: store.get('lesRemind', true) !== false,
    lesSound: store.get('lesSound', true) !== false,
    lesLead: [15, 30, 60].includes(Number(store.get('lesLead', 30))) ? Number(store.get('lesLead', 30)) : 30
  };
  state.countdown = state.interval;

  /* ===================== TOASTS ===================== */
  function toast(msg, opts = {}) {
    const { type: rawType = 'info', action, onAction, timeout = 3400 } = opts;
    const type = ['info', 'success', 'error', 'warn'].includes(rawType) ? rawType : 'info';
    const wrap = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast t-${type}`;
    const ic = type === 'success' ? 'check' : type === 'error' ? 'x' : type === 'warn' ? 'bolt' : 'sparkle';
    el.innerHTML = `<span class="toast-ico">${icon(ic)}</span><span class="toast-msg">${esc(msg)}</span>${action ? `<button class="toast-act" type="button">${esc(action)}</button>` : ''}`;
    wrap.appendChild(el);
    while (wrap.children.length > 3) wrap.firstElementChild.remove();
    let closed = false;
    const close = () => { if (closed) return; closed = true; el.classList.add('out'); setTimeout(() => el.remove(), 320); };
    if (action) el.querySelector('.toast-act').addEventListener('click', () => { try { onAction && onAction(); } finally { close(); } });
    setTimeout(close, timeout);
    return close;
  }

  /* ===================== BINDING HELPERS ===================== */
  function bind(key, text, { bump = false } = {}) {
    $$(`[data-bind="${key}"]`).forEach((el) => {
      if (el.textContent !== text) {
        el.textContent = text;
        if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      }
    });
  }
  function chgClass(p) { return p > 0.0001 ? 'up' : p < -0.0001 ? 'down' : ''; }
  function setChg(el, pct) {
    if (!el) return;
    el.className = `chg ${chgClass(pct)}`;
    el.textContent = fmtPct(pct);
  }

  /* =========================================================
     MARKET ENGINE — 12 aset real-time
     ========================================================= */
  const RANGE_CFG = {
    '1D': { n: 48, step: 30 * 60e3, binance: ['1h', 24], yahoo: ['1d', '5m'] },
    '1W': { n: 84, step: 2 * 3600e3, binance: ['1h', 168], yahoo: ['5d', '30m'] },
    '1M': { n: 60, step: 12 * 3600e3, binance: ['4h', 180], yahoo: ['1mo', '1d'] }
  };
  const SERIES_TTL = 4 * 60e3;

  const market = {
    data: {},
    usdidr: A.USDIDR.base,
    eurusdFx: null,
    xauSpot: null,
    paxg1D: null,
    lastUpdate: null,
    liveCount: 0,
    loading: false,
    yahooBlockedUntil: 0,
    online: navigator.onLine !== false
  };

  function rng(seed) {
    let t = seed >>> 0;
    return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /** Seri baseline/estimasi deterministik (stabil per hari) yang berakhir tepat di harga terakhir */
  function synth(asset, range, end, startRef = null) {
    const cfg = RANGE_CFG[range];
    const p = jkt();
    const r = rng(hash(`${asset.id}|${range}|${p.year}${p.month}${p.day}`));
    const vol = asset.vol * Math.sqrt(cfg.step / 3600e3);
    const now = Math.floor(Date.now() / cfg.step) * cfg.step;
    if (range === '1D' && startRef > 0) {
      const w = [0];
      for (let i = 1; i < cfg.n; i++) w.push(w[i - 1] + (r() - 0.5) * 2 * vol);
      const wEnd = w[cfg.n - 1];
      return w.map((v, i) => {
        const f = i / (cfg.n - 1);
        const bridge = v - f * wEnd;
        const val = startRef + f * (end - startRef) + bridge * end * 0.45;
        return { t: now - (cfg.n - 1 - i) * cfg.step, v: i === 0 ? startRef : i === cfg.n - 1 ? end : val };
      });
    }
    const vals = [1];
    for (let i = 1; i < cfg.n; i++) vals.push(vals[i - 1] * (1 + (r() - 0.5) * 2 * vol + (r() - 0.5) * vol * 0.3));
    const k = end / vals[vals.length - 1];
    return vals.map((v, i) => ({ t: now - (cfg.n - 1 - i) * cfg.step, v: v * k }));
  }
  const scaleTo = (pts, end) => {
    const last = pts[pts.length - 1].v || 1; const k = end / last;
    return pts.map((p) => ({ t: p.t, v: p.v * k, o: p.o != null ? p.o * k : undefined }));
  };

  function initMarketData() {
    const rawCache = store.get('market', null);
    const cache = rawCache && rawCache.ver === MARKET_CACHE_VER ? rawCache : null;
    const fresh = cache && cache.at && Date.now() - cache.at < 36 * 3600e3;
    for (const a of ASSETS) {
      const c = cache?.assets?.[a.id];
      const p = Number(c?.price) > 0 ? Number(c.price) : a.base;
      const prev = c ? (c.prev || a.prevBase || null) : (a.prevBase || null);
      const d = { price: p, prev, source: c ? 'cache' : 'baseline', series: {}, meta: {}, updated: 0 };
      if (fresh && Array.isArray(c?.s1) && c.s1.length > 2) {
        d.series['1D'] = c.s1; d.meta['1D'] = { at: 0, src: 'cache' };
      } else if (Array.isArray(a.intraday) && a.intraday.length > 2) {
        d.series['1D'] = a.intraday.map(([t, v]) => ({ t, v }));
        d.meta['1D'] = { at: 0, src: 'baseline' };
      } else {
        d.series['1D'] = synth(a, '1D', p, prev); d.meta['1D'] = { at: 0, src: c ? 'cache' : 'baseline' };
      }
      market.data[a.id] = d;
    }
    if (cache?.usdidr > 1000) market.usdidr = cache.usdidr;
    if (cache?.at) market.lastUpdate = new Date(cache.at);
  }

  function saveMarketCache() {
    const assets = {};
    for (const a of ASSETS) {
      const d = market.data[a.id];
      const s = d.series['1D'] || [];
      const stride = Math.max(1, Math.ceil(s.length / 60));
      assets[a.id] = {
        price: d.price, prev: d.prev,
        s1: s.filter((_, i) => i % stride === 0 || i === s.length - 1).map((p) => ({ t: p.t, v: +Number(p.v).toPrecision(8) }))
      };
    }
    store.set('market', { ver: MARKET_CACHE_VER, at: Date.now(), usdidr: market.usdidr, assets });
  }

  const price = (id) => market.data[id]?.price ?? A[id].base;
  function change24(id) {
    const d = market.data[id]; const s = d.series['1D'];
    const ref = d.prev || (s && s.length ? s[0].v : d.price);
    return ref ? ((d.price - ref) / ref) * 100 : 0;
  }
  const usdFmt = (v, d = 2) => '$' + nf(d, 'en-US').format(v);
  function fmtPrice(id, v = price(id)) {
    if (v == null || !Number.isFinite(v)) return '—';
    switch (A[id].fmt) {
      case 'idr': return 'Rp ' + nf(0).format(Math.round(v));
      case 'usd': return usdFmt(v, 2);
      case 'pts': return nf(2).format(v);
      case 'fx': return nf(4, 'en-US').format(v);
      default: return String(v);
    }
  }
  function fmtAxis(id, v, span = 0) {
    const f = A[id].fmt;
    if (f === 'idr') {
      if (v >= 1e6) return nf(span > 0 && span < 60000 ? 3 : 2).format(v / 1e6) + ' jt';
      return nf(0).format(Math.round(v));
    }
    if (f === 'usd') {
      if (v >= 1e4) return span > 0 && span < 600 ? '$' + nf(0, 'en-US').format(Math.round(v)) : '$' + nf(1, 'en-US').format(v / 1e3) + 'K';
      if (v >= 1000) return usdFmt(v, span > 0 && span < 25 ? 1 : 0);
      return usdFmt(v, 2);
    }
    if (f === 'pts') return span > 0 && span < 25 ? nf(1).format(v) : nf(0).format(Math.round(v));
    return nf(4, 'en-US').format(v);
  }
  function fmtTick(t, range) {
    const d = new Date(t);
    if (range === '1D') return hmWIB(d);
    if (range === '1W') return `${dayShort(d)} ${jkt(d).day}`;
    return dateShort(d);
  }
  const fmtTipTime = (t, range) => {
    const d = new Date(t);
    return `${dayShort(d)}, ${dateShort(d)} · ${hmWIB(d)} WIB`;
  };

  /* ---------- Fetchers ---------- */
  async function fetchJSON(url, ms = 9000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function loadFX() {
    const j = await fetchJSON('https://open.er-api.com/v6/latest/USD');
    const idr = Number(j?.rates?.IDR), eur = Number(j?.rates?.EUR);
    if (!(idr > 1000)) throw new Error('fx');
    market.usdidr = idr;
    market.eurusdFx = eur > 0 ? 1 / eur : null;
    // Referensi harian untuk perubahan % USD/IDR
    const today = todayISO();
    const h = store.get('fxHist', null) || {};
    if (h.date !== today) { h.prev = h.last || null; h.date = today; }
    h.last = idr; store.set('fxHist', h);
    return true;
  }

  async function loadXAU() {
    try {
      const j = await fetchJSON('https://api.gold-api.com/price/XAU', 8000);
      const p = Number(j?.price);
      if (p > 500) { market.xauSpot = p; return 'gold-api'; }
    } catch { /* fallback */ }
    const j2 = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd', 8000);
    const p2 = Number(j2?.['pax-gold']?.usd);
    if (p2 > 500) { market.xauSpot = p2; return 'coingecko'; }
    throw new Error('xau');
  }

  let binanceHost = null;
  const BINANCE_HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision'];
  async function binanceKlines(symbol, range) {
    const [interval, limit] = RANGE_CFG[range].binance;
    const path = `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const parse = (j) => {
      if (!Array.isArray(j) || j.length < 3) throw new Error('klines');
      return j.map((k) => ({ t: k[0], v: +k[4], o: +k[1] }));
    };
    if (binanceHost) {
      try { return parse(await fetchJSON(binanceHost + path, 7000)); } catch { binanceHost = null; }
    }
    return await Promise.any(BINANCE_HOSTS.map((h) => fetchJSON(h + path, 6500).then((j) => {
      const pts = parse(j); binanceHost = h; return pts;
    })));
  }

  async function loadCoinGeckoCrypto() {
    const j = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true', 8000);
    return {
      BTCUSD: j?.bitcoin?.usd > 0 ? { price: j.bitcoin.usd, chg: j.bitcoin.usd_24h_change } : null,
      ETHUSD: j?.ethereum?.usd > 0 ? { price: j.ethereum.usd, chg: j.ethereum.usd_24h_change } : null
    };
  }

  const TV_COLS = ['close', 'change', 'change_abs', 'open', 'high', 'low', 'Perf.W', 'Perf.1M'];
  async function tvScan(url, tickers, ms = 7500) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ symbols: { tickers }, columns: TV_COLS }),
        signal: ctl.signal,
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  function buildOhlcSeries(asset, open, high, low, close, prev) {
    const cfg = RANGE_CFG['1D'];
    const now = Date.now();
    const n = cfg.n;
    const o = open > 0 ? open : (prev > 0 ? prev : close);
    const hi = Math.max(high > 0 ? high : close, o, close);
    const lo = Math.min(low > 0 ? low : close, o, close);
    const span = hi - lo;
    const p = jkt();
    const r = rng(hash(`${asset.id}|tv1D|${p.year}${p.month}${p.day}`));
    const k1 = 10 + Math.floor(r() * 11);
    const k2 = Math.min(n - 7, k1 + 12 + Math.floor(r() * 12));
    const hiFirst = r() < 0.5 ? (close <= o) : (close < o);
    const knots = [
      { idx: 0, val: o },
      { idx: k1, val: hiFirst ? hi : lo },
      { idx: k2, val: hiFirst ? lo : hi },
      { idx: n - 1, val: close }
    ];
    const vals = new Array(n);
    for (let s = 0; s < knots.length - 1; s++) {
      const a0 = knots[s], a1 = knots[s + 1];
      const len = a1.idx - a0.idx;
      const w = [0];
      for (let j = 1; j <= len; j++) w.push(w[j - 1] + (r() - 0.5) * 2);
      const wEnd = w[len];
      const wMax = Math.max(1, ...w.map((x, j) => Math.abs(x - (j / len) * wEnd)));
      for (let j = 0; j <= len; j++) {
        const f = j / len;
        const bridge = (w[j] - f * wEnd) / wMax;
        const base = a0.val + (a1.val - a0.val) * f;
        const v = j === 0 ? a0.val : j === len ? a1.val : clamp(base + bridge * span * 0.22, lo, hi);
        vals[a0.idx + j] = v;
      }
    }
    return vals.map((v, i) => ({ t: now - (n - 1 - i) * cfg.step, v }));
  }

  async function loadTradingViewStocks() {
    const tvAssets = ASSETS.filter((a) => a.tv);
    const byTicker = Object.fromEntries(tvAssets.map((a) => [a.tv, a]));
    let rows = [];
    try {
      const j = await tvScan('https://scanner.tradingview.com/global/scan', tvAssets.map((a) => a.tv));
      rows = Array.isArray(j?.data) ? j.data : [];
    } catch {
      const idT = tvAssets.filter((a) => a.tv.startsWith('IDX:')).map((a) => a.tv);
      const usT = tvAssets.filter((a) => !a.tv.startsWith('IDX:')).map((a) => a.tv);
      const res = await Promise.allSettled([
        idT.length ? tvScan('https://scanner.tradingview.com/indonesia/scan', idT) : null,
        usT.length ? tvScan('https://scanner.tradingview.com/america/scan', usT) : null
      ]);
      res.forEach((x) => { if (x.status === 'fulfilled' && Array.isArray(x.value?.data)) rows.push(...x.value.data); });
    }
    const ok = [];
    for (const row of rows) {
      const a = byTicker[row?.s];
      const v = Array.isArray(row?.d) ? row.d : [];
      const close = Number(v[0]);
      if (!a || !(close > 0)) continue;
      const chgPct = Number(v[1]);
      const chgAbs = Number(v[2]);
      const open = Number(v[3]) > 0 ? Number(v[3]) : null;
      const high = Number(v[4]) > 0 ? Number(v[4]) : null;
      const low = Number(v[5]) > 0 ? Number(v[5]) : null;
      const perfW = Number.isFinite(Number(v[6])) ? Number(v[6]) : null;
      const perf1M = Number.isFinite(Number(v[7])) ? Number(v[7]) : null;
      const prev = Number.isFinite(chgAbs) && close - chgAbs > 0
        ? close - chgAbs
        : (Number.isFinite(chgPct) && 1 + chgPct / 100 > 0 ? close / (1 + chgPct / 100) : a.prevBase);
      const d = market.data[a.id];
      d.open = open || prev || close;
      d.high = Math.max(high || close, close, d.open);
      d.low = Math.min(low || close, close, d.open);
      d.perfW = perfW;
      d.perf1M = perf1M;
      const cur1D = d.series['1D'];
      let pts;
      if (d.source === 'live' && Array.isArray(cur1D) && cur1D.length > 5 && d.meta['1D']?.src === 'live') {
        pts = cur1D.slice();
        const last = pts[pts.length - 1];
        if (Date.now() - last.t > 45e3) { pts.push({ t: Date.now(), v: close }); if (pts.length > 96) pts.shift(); }
        else last.v = close;
      } else {
        pts = buildOhlcSeries(a, d.open, d.high, d.low, close, prev);
      }
      applyLive(a.id, pts, close, prev, 'live');
      ok.push(a.id);
    }
    return ok;
  }

  async function yahooChart(symbol, range) {
    const [r, iv] = RANGE_CFG[range].yahoo;
    const j = await fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${r}&interval=${iv}&includePrePost=false`, 7000);
    const res = j?.chart?.result?.[0];
    if (!res) throw new Error('yahoo');
    const ts = res.timestamp || [];
    const cl = res.indicators?.quote?.[0]?.close || [];
    const pts = [];
    for (let i = 0; i < ts.length; i++) if (cl[i] != null && Number.isFinite(cl[i])) pts.push({ t: ts[i] * 1000, v: +cl[i] });
    const meta = res.meta || {};
    const p = Number(meta.regularMarketPrice) || (pts.length ? pts[pts.length - 1].v : 0);
    if (!p) throw new Error('yahoo-empty');
    return { pts, price: p, prev: Number(meta.chartPreviousClose || meta.previousClose) || null };
  }

  /* ---------- Emas Antam 24K dinamis ---------- */
  // Baseline terverifikasi Rp 2.505.000/gr dikunci (anchor) pada spot live pertama,
  // lalu bergerak proporsional mengikuti XAU/USD × USD/IDR.
  function computeAntam(xau, usdidr, canAnchor) {
    const spotGr = (xau * usdidr) / OZ;
    let anchor = store.get('antamAnchor', null);
    if ((!anchor || !(anchor.spotGr > 0)) && canAnchor) {
      anchor = { spotGr, at: Date.now() };
      store.set('antamAnchor', anchor);
    }
    if (!anchor || !(anchor.spotGr > 0)) return { price: ANTAM_BASELINE, factor: ANTAM_BASELINE / spotGr, spotGr };
    const ratio = clamp(spotGr / anchor.spotGr, 0.6, 1.6);
    const p = Math.round((ANTAM_BASELINE * ratio) / 1000) * 1000;
    return { price: p, factor: p / spotGr, spotGr };
  }
  const toAntam = (xauPts, factor) => xauPts.map((p) => ({ t: p.t, v: (p.v * market.usdidr / OZ) * factor }));

  function applyLive(id, pts, p, prev, src = 'live') {
    const d = market.data[id];
    d.price = p; d.source = 'live'; d.updated = Date.now();
    if (pts && pts.length > 2) { d.series['1D'] = pts; d.meta['1D'] = { at: Date.now(), src }; }
    else { d.series['1D'] = synth(A[id], '1D', p, prev || A[id].prevBase || null); d.meta['1D'] = { at: Date.now(), src: 'est' }; }
    d.prev = prev || d.series['1D'][0].v;
    ['1W', '1M'].forEach((r) => { if (d.meta[r]) d.meta[r].at = 0; });
  }

  function setRefreshing(on) {
    $$('.refresh-btn').forEach((b) => { b.classList.toggle('spinning', on); b.disabled = on; });
  }

  async function refreshMarket({ manual = false } = {}) {
    if (market.loading) return;
    if (!navigator.onLine) {
      market.online = false; renderLiveLabels();
      if (manual) toast('Perangkat sedang offline — menampilkan harga terakhir.', { type: 'warn' });
      state.countdown = state.interval;
      return;
    }
    market.online = true;
    market.loading = true; setRefreshing(true); renderLiveLabels();
    const started = Date.now();
    const live = new Set();

    const jobs = [
      loadFX().then(() => live.add('fx')),
      loadXAU().then(() => live.add('xau')),
      binanceKlines('PAXGUSDT', '1D').then((p) => { market.paxg1D = p; live.add('paxg'); }),
      ...['BTCUSD', 'ETHUSD', 'EURUSD'].map((id) => binanceKlines(A[id].binance, '1D').then((p) => {
        applyLive(id, p, p[p.length - 1].v, p[0].o); live.add(id);
      })),
      loadTradingViewStocks().then((ids) => ids.forEach((id) => live.add(id)))
    ];
    await Promise.allSettled(jobs);

    // Fallback CoinGecko jika Binance tidak terjangkau
    if (!live.has('BTCUSD') || !live.has('ETHUSD')) {
      try {
        const cg = await loadCoinGeckoCrypto();
        for (const id of ['BTCUSD', 'ETHUSD']) {
          if (!live.has(id) && cg[id]) {
            const p = cg[id].price;
            const prev = Number.isFinite(cg[id].chg) ? p / (1 + cg[id].chg / 100) : null;
            applyLive(id, null, p, prev, 'est'); live.add(id);
          }
        }
      } catch { /* fallback baseline */ }
    }

    // EUR/USD fallback via ER-API
    if (!live.has('EURUSD') && live.has('fx') && market.eurusdFx) { applyLive('EURUSD', null, market.eurusdFx, null, 'est'); live.add('EURUSD'); }
    // USD/IDR via ER-API
    if (live.has('fx')) {
      const h = store.get('fxHist', {});
      applyLive('USDIDR', null, market.usdidr, h.prev || null, 'est'); live.add('USDIDR');
    }
    // XAU/USD spot (gold-api → coingecko → PAXG)
    const xauLive = live.has('xau') || live.has('paxg');
    if (xauLive) {
      const xp = market.xauSpot || market.paxg1D[market.paxg1D.length - 1].v;
      const s = market.paxg1D ? scaleTo(market.paxg1D, xp) : null;
      applyLive('XAUUSD', s, xp, s ? (s[0].o ?? s[0].v) : null, s ? 'live' : 'est');
      live.add('XAUUSD');
    }
    // Antam 24K
    {
      const xd = market.data.XAUUSD;
      const both = xauLive && live.has('fx');
      const { price: ap, factor } = computeAntam(xd.price, market.usdidr, both);
      const s = scaleTo(toAntam(xd.series['1D'], factor), ap);
      if (both) { applyLive('ANTAM', s, ap, s[0].v, xd.meta['1D']?.src || 'live'); live.add('ANTAM'); }
      else { const d = market.data.ANTAM; d.price = ap; d.series['1D'] = s; }
    }

    for (const a of ASSETS) {
      const d = market.data[a.id];
      if (d.source === 'live' && d.updated < started) d.source = 'cache';
    }
    market.liveCount = ASSETS.filter((a) => market.data[a.id].source === 'live').length;
    if (market.liveCount) { market.lastUpdate = new Date(); saveMarketCache(); }
    market.loading = false;
    setRefreshing(false);
    state.countdown = state.interval;

    renderMarketAll();
    renderFinance({ silentChart: true });
    renderNews();
    if (state.view === 'market' && state.range !== '1D') renderMainChart();

    if (manual) {
      const total = ASSETS.length;
      if (market.liveCount >= total) toast(`Harga pasar diperbarui • ${market.liveCount}/${total} aset live`, { type: 'success' });
      else if (market.liveCount > 0) toast(`Diperbarui • ${market.liveCount}/${total} aset live, sisanya baseline terverifikasi`, { type: 'success' });
      else toast('API pasar tidak dapat dijangkau — menampilkan harga terakhir.', { type: 'warn' });
    }
  }

  async function ensureSeries(id, range) {
    const d = market.data[id];
    const m = d.meta[range];
    if (d.series[range] && m && (range === '1D' || Date.now() - m.at < SERIES_TTL)) return;
    let pts = null, src = 'baseline';
    const a = A[id];
    try {
      if (a.binance) { pts = await binanceKlines(a.binance, range); src = 'live'; }
      else if (a.tv) {
        const pct = range === '1W' ? d.perfW : range === '1M' ? d.perf1M : null;
        const startRef = pct != null && 1 + pct / 100 > 0 ? d.price / (1 + pct / 100) : null;
        if (startRef > 0) {
          pts = synth(a, range, d.price, startRef);
          // Anchor start point strictly to TradingView's real 1W / 1M performance
          const k0 = pts[0].v, k1 = pts[pts.length - 1].v;
          if (pts.length > 2) {
            pts = pts.map((p, i) => {
              const f = i / (pts.length - 1);
              const lin = startRef + (d.price - startRef) * f;
              const dev = (p.v - (k0 + (k1 - k0) * f)) * 0.65;
              return { t: p.t, v: i === 0 ? startRef : i === pts.length - 1 ? d.price : Math.max(startRef * 0.3, lin + dev) };
            });
          }
          src = d.source === 'live' ? 'live' : 'est';
        }
      } else if (id === 'XAUUSD' || id === 'ANTAM') {
        const px = await binanceKlines('PAXGUSDT', range);
        const xs = scaleTo(px, market.data.XAUUSD.price);
        if (id === 'XAUUSD') pts = xs;
        else { const { factor } = computeAntam(market.data.XAUUSD.price, market.usdidr, false); pts = scaleTo(toAntam(xs, factor), d.price); }
        src = 'live';
      }
    } catch {
      pts = null;
    }
    if (!pts || pts.length < 3) { pts = synth(a, range, d.price); src = d.source === 'live' ? 'est' : d.source; }
    d.series[range] = pts;
    d.meta[range] = { at: Date.now(), src };
  }

  /* =========================================================
     CHARTS (SVG)
     ========================================================= */
  function downsample(pts, max) {
    if (!pts || pts.length <= max) return pts || [];
    const stride = pts.length / max; const out = [];
    for (let i = 0; i < max - 1; i++) out.push(pts[Math.floor(i * stride)]);
    out.push(pts[pts.length - 1]);
    return out;
  }
  function sparkSVG(id, w = 84, h = 30) {
    const pts = downsample(market.data[id].series['1D'], 48);
    if (pts.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}"></svg>`;
    const vals = pts.map((p) => p.v); const mn = Math.min(...vals), mx = Math.max(...vals); const rg = mx - mn || 1;
    const step = (w - 4) / (pts.length - 1);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(2 + i * step).toFixed(1)},${(2 + (1 - (p.v - mn) / rg) * (h - 4)).toFixed(1)}`).join('');
    return `<svg class="spark ${change24(id) >= 0 ? 'up' : 'down'}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function drawLineChart(el, rawPts, { id, range, animate }) {
    const W = el.clientWidth, H = el.clientHeight;
    const pts = downsample(rawPts, 240);
    if (!W || !H || !pts || pts.length < 2) return false;
    const padL = 6, padR = state.isMobile ? 64 : 76, padT = 16, padB = 28;
    const vals = pts.map((p) => p.v);
    const refVal = range === '1D' && market.data[id]?.prev ? market.data[id].prev : pts[0].v;
    let mn = Math.min(...vals, refVal), mx = Math.max(...vals, refVal);
    if (mx - mn < Math.abs(mx) * 1e-6) { mn -= Math.abs(mn) * 0.001 || 1; mx += Math.abs(mx) * 0.001 || 1; }
    const pad = (mx - mn) * 0.12; mn -= pad; mx += pad;
    const iw = W - padL - padR, ih = H - padT - padB;
    const X = (i) => padL + (i / (pts.length - 1)) * iw;
    const Y = (v) => padT + (1 - (v - mn) / (mx - mn)) * ih;
    const up = pts[pts.length - 1].v >= refVal;
    const col = up ? 'var(--green)' : 'var(--red)';
    const hex = up ? '#10b981' : '#f43f5e';
    let line = '';
    pts.forEach((p, i) => { line += `${i ? 'L' : 'M'}${X(i).toFixed(2)},${Y(p.v).toFixed(2)}`; });
    const bottom = (padT + ih).toFixed(2);
    const area = `${line}L${X(pts.length - 1).toFixed(2)},${bottom}L${padL},${bottom}Z`;
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = mn + ((mx - mn) * i) / 4; const y = Y(v).toFixed(2);
      grid += `<line class="ch-grid" x1="${padL}" x2="${W - padR + 6}" y1="${y}" y2="${y}"/><text class="ch-axis" x="${W - padR + 12}" y="${(+y + 4).toFixed(2)}">${esc(fmtAxis(id, v, mx - mn))}</text>`;
    }
    const nX = state.isMobile ? 4 : 6;
    let xl = '';
    for (let i = 0; i < nX; i++) {
      const idx = Math.round((i / (nX - 1)) * (pts.length - 1));
      const anchor = i === 0 ? 'start' : i === nX - 1 ? 'end' : 'middle';
      xl += `<text class="ch-axis" x="${X(idx).toFixed(2)}" y="${H - 6}" text-anchor="${anchor}">${esc(fmtTick(pts[idx].t, range))}</text>`;
    }
    const baseY = Y(refVal).toFixed(2);
    const gid = `cg-${el.id}`;
    const lx = X(pts.length - 1).toFixed(2), ly = Y(pts[pts.length - 1].v).toFixed(2);
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hex}" stop-opacity=".3"/><stop offset="1" stop-color="${hex}" stop-opacity="0"/></linearGradient></defs>
      ${grid}${xl}
      <line class="ch-base" x1="${padL}" x2="${W - padR}" y1="${baseY}" y2="${baseY}"/>
      <path class="ch-area${animate ? '' : ' static'}" d="${area}" fill="url(#${gid})"/>
      <path class="ch-line${animate ? ' draw' : ''}" d="${line}" stroke="${col}"/>
      <circle cx="${lx}" cy="${ly}" r="9" fill="${hex}" opacity=".18"><animate attributeName="r" values="5;12;5" dur="2s" repeatCount="indefinite"/></circle>
      <circle cx="${lx}" cy="${ly}" r="4.5" fill="${col}" stroke="#fff" stroke-width="2"/>
      <g class="ch-hover"><line class="ch-cross" x1="0" x2="0" y1="${padT}" y2="${bottom}"/><circle class="ch-dot" r="5.5" cx="0" cy="0" fill="${col}"/></g>
    </svg><div class="chart-tip"><strong></strong><small></small></div>`;
    if (animate) {
      const path = el.querySelector('.ch-line');
      try { path.style.setProperty('--len', String(Math.ceil(path.getTotalLength()))); } catch { path.classList.remove('draw'); }
    }
    el._c = { pts, X, Y, padL, iw, id, range, W };
    return true;
  }

  function attachChartHover(el) {
    let hideT;
    const move = (e) => {
      const c = el._c; if (!c) return;
      const r = el.getBoundingClientRect();
      const idx = clamp(Math.round(((e.clientX - r.left - c.padL) / c.iw) * (c.pts.length - 1)), 0, c.pts.length - 1);
      const p = c.pts[idx]; const cx = c.X(idx), cy = c.Y(p.v);
      const g = el.querySelector('.ch-hover'); if (!g) return;
      const ln = g.querySelector('line'); ln.setAttribute('x1', cx); ln.setAttribute('x2', cx);
      const dot = g.querySelector('circle'); dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
      const tip = el.querySelector('.chart-tip');
      tip.querySelector('strong').textContent = fmtPrice(c.id, p.v);
      tip.querySelector('small').textContent = fmtTipTime(p.t, c.range);
      const tw = tip.offsetWidth || 140;
      tip.style.left = `${clamp(cx - tw / 2, 0, c.W - tw)}px`;
      el.classList.add('hovering'); clearTimeout(hideT);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', move);
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') el.classList.remove('hovering'); });
    el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { clearTimeout(hideT); hideT = setTimeout(() => el.classList.remove('hovering'), 1800); } });
    el.addEventListener('pointercancel', () => { clearTimeout(hideT); hideT = setTimeout(() => el.classList.remove('hovering'), 500); });
  }

  const niceMax = (m) => { const p = Math.pow(10, Math.floor(Math.log10(m))); const n = m / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };

  function drawFlowChart(animate = true) {
    const el = $('#flowChart'); if (!el) return;
    const W = el.clientWidth, H = el.clientHeight; if (!W || !H) return;
    const f = calc();
    const data = [
      { l: 'Pemasukan', v: f.income, g: 'g-green' },
      { l: 'Pengeluaran', v: f.expense, g: 'g-red' },
      { l: 'Kas Bersih', v: f.kas, g: f.kas < 0 ? 'g-red' : 'g-blue' },
      { l: 'Emas 24K', v: f.gold, g: 'g-gold' }
    ];
    const rawMax = Math.max(0, ...data.map((d) => Math.abs(d.v)));
    const nice = rawMax > 0 ? niceMax(rawMax) : 1000000;
    const mob = state.isMobile && W < 520;
    const padT = 28, padB = 30, padL = mob ? 4 : 52, padR = 6;
    const ih = H - padT - padB, iw = W - padL - padR;
    const slot = iw / data.length, bw = Math.min(66, slot * 0.54);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const y = (padT + ih - (ih * i) / 4).toFixed(2);
      g += `<line class="bc-grid" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
      if (!mob) g += `<text class="bc-axis" x="${padL - 8}" y="${(+y + 4).toFixed(2)}" text-anchor="end">${esc(fmtRpShort((nice * i) / 4).replace('Rp ', ''))}</text>`;
    }
    let bars = '';
    const barCls = animate ? 'bar' : 'bar static';
    data.forEach((d, i) => {
      const h = Math.max(d.v ? 6 : 3, (Math.abs(d.v) / nice) * ih);
      const x = padL + slot * i + (slot - bw) / 2; const y = padT + ih - h; const cx = (x + bw / 2).toFixed(2);
      const delay = animate ? `style="animation-delay:${i * 60}ms"` : '';
      bars += `<rect class="${barCls}" ${delay} x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${h.toFixed(2)}" rx="${Math.min(12, bw / 3).toFixed(1)}" fill="url(#${d.g})"/>`;
      if (h > 14) bars += `<rect class="${barCls}" ${delay} x="${(x + 5).toFixed(2)}" y="${(y + 4).toFixed(2)}" width="${(bw * 0.24).toFixed(2)}" height="${(h - 10).toFixed(2)}" rx="4" fill="#fff" opacity=".25"/>`;
      bars += `<text class="bc-val" x="${cx}" y="${(y - 8).toFixed(2)}" text-anchor="middle" style="font-size:${mob ? 10.5 : 12}px">${esc(fmtRpShort(d.v))}</text>`;
      bars += `<text class="bc-lbl" x="${cx}" y="${H - 8}" text-anchor="middle" style="font-size:${mob ? 10.5 : 12}px">${d.l}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${g}${bars}</svg>`;
  }

  /* =========================================================
     MARKET RENDERING
     ========================================================= */
  function renderTicker() {
    const items = ASSETS.map((a) => {
      const c = change24(a.id);
      return `<div class="tk-item" data-go="market" data-asset="${a.id}"><span class="asset-logo xs">${logo(a.id)}</span><b>${a.sym}</b><span class="p">${fmtPrice(a.id)}</span><span class="chg ${chgClass(c)}">${fmtPct(c)}</span></div>`;
    }).join('');
    $('#tickerTrack').innerHTML = items + items;
  }

  function renderDashAssets() {
    const html = DASH_ASSETS.map((id) => {
      const a = A[id], c = change24(id);
      return `<button class="mini-asset ripple" type="button" data-go="market" data-asset="${id}">
        <div class="ma-top"><span class="asset-logo">${logo(id)}</span><div><b>${a.sym}</b><small>${a.name}</small></div></div>
        <div class="ma-price">${fmtPrice(id)}</div>
        <div class="ma-foot"><span class="chg ${chgClass(c)}">${fmtPct(c)}</span>${sparkSVG(id)}</div>
      </button>`;
    }).join('');
    ['#dashAssets', '#finAssets'].forEach((s) => { const el = $(s); if (el) el.innerHTML = html; });
  }

  function renderWatchlist() {
    $('#watchlist').innerHTML = Object.entries(GROUPS).map(([g, label]) => `
      <div class="wl-group"><h4>${label}</h4><div class="wl-items">
        ${ASSETS.filter((a) => a.group === g).map((a) => {
          const c = change24(a.id), d = market.data[a.id];
          const tag = d.source !== 'live' ? `<span class="src-tag">${d.source === 'cache' ? 'CACHE' : 'BASE'}</span>` : '';
          return `<button class="wl-item ${a.id === state.asset ? 'active' : ''}" type="button" data-asset="${a.id}">
            <span class="asset-logo">${logo(a.id)}</span>
            <span class="wl-name"><b>${a.sym}${tag}</b><small>${a.name}</small></span>
            ${sparkSVG(a.id, 60, 26)}
            <span class="wl-px"><strong>${fmtPrice(a.id)}</strong><span class="chg ${chgClass(c)}">${fmtPct(c)}</span></span>
          </button>`;
        }).join('')}
      </div></div>`).join('');
  }

  function renderChartHead() {
    const id = state.asset, a = A[id], d = market.data[id];
    const s = d.series[state.range] || [];
    $('#chLogo').innerHTML = logo(id);
    $('#chName').textContent = a.name;
    $('#chSym').textContent = `${a.sym} · ${a.tag}`;
    $('#chPrice').textContent = fmtPrice(id);
    const ref = state.range === '1D' && d.prev ? d.prev : (s.length ? s[0].v : d.price);
    setChg($('#chChange'), ref ? ((d.price - ref) / ref) * 100 : 0);
    const vals = s.map((p) => p.v);
    const is1D = state.range === '1D';
    const isBase1D = is1D && d.source !== 'live';
    const openDisp = is1D && d.open ? d.open : (isBase1D && a.openBase ? a.openBase : (s.length ? s[0].v : ref));
    const highDisp = is1D && d.high ? Math.max(d.high, d.price) : (isBase1D && a.highBase ? a.highBase : Math.max(d.price, ...vals));
    const lowDisp = is1D && d.low ? Math.min(d.low, d.price) : (isBase1D && a.lowBase ? a.lowBase : Math.min(d.price, ...vals));
    $('#stOpen').textContent = fmtPrice(id, openDisp);
    $('#stHigh').textContent = fmtPrice(id, highDisp);
    $('#stLow').textContent = fmtPrice(id, lowDisp);
    const diff = d.price - ref;
    $('#stDiff').textContent = `${diff >= 0 ? '+' : '−'}${fmtPrice(id, Math.abs(diff))}`;
    const src = d.meta[state.range]?.src || d.source;
    const map = { live: ['Live API', ''], est: ['Live • grafik estimasi', 'est'], cache: ['Cache terakhir', 'base'], baseline: ['Baseline terverifikasi', 'base'] };
    const [t, c] = map[src] || map.baseline;
    const chip = $('#chSource'); chip.textContent = t; chip.className = `src-chip ${c}`;
  }

  let chartKey = '';
  async function renderMainChart(forceAnim = false) {
    const el = $('#mainChart');
    if (!el || state.view !== 'market') return;
    const id = state.asset, range = state.range, d = market.data[id];
    const stale = !d.series[range] || (range !== '1D' && (!d.meta[range] || Date.now() - d.meta[range].at > SERIES_TTL));
    renderChartHead();
    if (stale) {
      el.classList.add('loading');
      await ensureSeries(id, range);
      el.classList.remove('loading');
      if (id !== state.asset || range !== state.range) return;
    }
    const key = id + range;
    const animate = forceAnim || key !== chartKey;
    if (drawLineChart(el, d.series[range], { id, range, animate })) chartKey = key;
    renderChartHead();
  }

  function renderLiveLabels() {
    let txt;
    if (!market.online) txt = `Offline • harga terakhir${market.lastUpdate ? ' ' + timeWIB(market.lastUpdate) + ' WIB' : ''}`;
    else if (market.loading && !market.liveCount) txt = 'Menghubungkan Live API…';
    else if (market.lastUpdate && market.liveCount) txt = `Live API • ${timeWIB(market.lastUpdate)} WIB`;
    else if (market.lastUpdate) txt = `Cache • ${timeWIB(market.lastUpdate)} WIB`;
    else txt = 'Baseline terverifikasi';
    bind('lastUpdate', txt);
    const status = !market.online ? 'offline' : state.live ? 'on' : 'paused';
    bind('liveText', status === 'offline' ? 'Offline' : status === 'on' ? 'Live ON' : 'Live OFF');
    $$('[data-live-chip]').forEach((el) => { el.classList.toggle('paused', status === 'paused'); el.classList.toggle('offline', status === 'offline'); });
    const pb = $('#livePause');
    if (pb) pb.innerHTML = state.live ? `${icon('pause')}<span>Jeda</span>` : `${icon('play')}<span>Aktifkan</span>`;
  }

  function renderCountdown() {
    const s = state.countdown;
    bind('countdown', state.live ? `${s}s` : '—');
    bind('countdownNum', state.live ? String(s) : '❚❚');
    const ring = $('#cdRing');
    if (ring) ring.style.strokeDashoffset = String(100.53 * (1 - (state.live ? s / state.interval : 0)));
  }

  function renderMarketAll() {
    renderTicker();
    renderDashAssets();
    renderWatchlist();
    renderLiveLabels();
    bind('antamPrice', fmtPrice('ANTAM'));
    $$('[data-bind-chg]').forEach((el) => setChg(el, change24(el.dataset.bindChg)));
    if (state.view === 'market') renderMainChart(); else renderChartHead();
  }

  function selectAsset(id, { scroll = false } = {}) {
    if (!hasOwn(A, id)) return;
    state.asset = id; store.set('asset', id);
    $$('.wl-item').forEach((b) => b.classList.toggle('active', b.dataset.asset === id));
    renderMainChart(true);
    if (scroll && state.isMobile) $('.chart-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* =========================================================
     KEUANGAN & EMAS
     ========================================================= */
  function calc() {
    let income = 0, expense = 0, nIn = 0, nOut = 0;
    for (const t of state.txs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'in') { income += amt; nIn++; } else { expense += amt; nOut++; }
    }
    const kas = income - expense;
    const gold = state.goldIDR;
    const antam = price('ANTAM');
    const grams = antam > 0 ? gold / antam : 0;
    const total = kas + gold;
    const ratio = income > 0 ? clamp((kas / income) * 100, 0, 100) : 0;
    return { income, expense, kas, gold, grams, total, ratio, nIn, nOut, antam };
  }
  const fmtRatio = (r) => (Math.abs(r - Math.round(r)) < 0.05 ? nf(0).format(Math.round(r)) : nf(1).format(r)) + '%';

  let flowSig = '';
  function renderFinance({ silentChart = false } = {}) {
    const f = calc();
    bind('total', fmtRp(f.total), { bump: true });
    bind('totalSub', `Kas ${fmtRp(f.kas)} + Emas ${fmtRp(f.gold)}`);
    bind('kas', fmtRp(f.kas), { bump: true });
    bind('income', fmtRp(f.income));
    bind('expense', fmtRp(f.expense));
    bind('gold', fmtRp(f.gold), { bump: true });
    bind('goldGram', `≈ ${fmtGram(f.grams)} gram`);
    bind('goldMeta', `${fmtGram(f.grams)} gr · Antam 24K ${fmtRpShort(f.antam)}/gr`);
    bind('kasMeta', `${f.nIn} pemasukan · ${f.nOut} pengeluaran`);
    bind('ratioText', `${fmtRatio(f.ratio)} Tersimpan`);
    bind('ratioPct', fmtRatio(f.ratio));
    bind('txCount', `${state.txs.length} transaksi tercatat`);
    const rb = $('#ratioBadge');
    if (rb) rb.className = `badge ${f.ratio >= 50 ? 'badge-green' : f.ratio >= 20 ? 'badge-amber' : 'badge-red'}`;

    // Emas: spot vs Antam
    const xau = price('XAUUSD'), usdidr = price('USDIDR');
    const spotGrUsd = xau / OZ, spotGrIdr = spotGrUsd * usdidr;
    bind('spotGrUsd', `${usdFmt(spotGrUsd)}/gr`);
    bind('spotGrIdr', `≈ ${fmtRp(spotGrIdr)}/gr`);
    bind('spotOz', `${usdFmt(xau)} / troy oz`);
    bind('antamPrice', fmtPrice('ANTAM'));
    const prem = spotGrIdr > 0 ? ((f.antam / spotGrIdr) - 1) * 100 : 0;
    bind('antamPremium', `Premium ${fmtPct(prem, 1)} vs spot`);
    const goal = state.goldGoal > 0 ? state.goldGoal : (f.grams < 1 ? 1 : Math.floor(f.grams) + 1);
    const pct = clamp((f.grams / goal) * 100, 0, 100);
    bind('goalLabel', `Menuju ${goal} gram`);
    bind('goalPct', fmtRatio(pct));
    const bar = $('#goalBar'); if (bar) bar.style.width = `${pct}%`;
    bind('calcNote', `Kurs Antam 24K: ${fmtRp(f.antam)}/gr • ${market.liveCount ? 'live' : 'baseline'}`);
    syncCalc();
    updateGoldPreview();

    const sig = `${f.income}|${f.expense}|${f.gold}|${state.isMobile}`;
    if (!silentChart || sig !== flowSig) { flowSig = sig; drawFlowChart(); }
    renderTxList();
  }

  function renderTxList() {
    const list = $('#txList'); if (!list) return;
    const items = state.txs
      .filter((t) => state.txFilter === 'all' || t.type === state.txFilter)
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created || 0) - (a.created || 0));
    if (!items.length) {
      list.innerHTML = `<li class="empty">${icon('wallet')}Belum ada transaksi ${state.txFilter === 'in' ? 'pemasukan' : state.txFilter === 'out' ? 'pengeluaran' : ''}.</li>`;
      return;
    }
    list.innerHTML = items.map((t, i) => `
      <li class="tx-item ${t.type === 'out' ? 'out' : 'in'}" style="--i:${Math.min(i, 12)}">
        <span class="tx-ico">${icon(t.type === 'in' ? 'in' : 'out')}</span>
        <div class="tx-body"><strong>${esc(t.desc)}</strong><small>${esc(t.cat || (t.type === 'in' ? 'Pemasukan' : 'Pengeluaran'))} · ${esc(fmtISODate(t.date))}</small></div>
        <span class="tx-amt">${t.type === 'in' ? '+' : '−'}${fmtRp(t.amount)}</span>
        <span class="si-acts"><button class="si-edit ripple" type="button" data-edit-tx="${esc(t.id)}" title="Edit catatan" aria-label="Edit ${esc(t.desc)}">${icon('pen')}</button><button class="si-del ripple" type="button" data-del-tx="${esc(t.id)}" title="Hapus catatan" aria-label="Hapus ${esc(t.desc)}">${icon('trash')}</button></span>
      </li>`).join('');
  }

  function setTxType(type) {
    state.txType = type;
    const seg = $('#txType');
    seg.dataset.value = type;
    $$('button', seg).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === type)));
    const sel = $('#txCat');
    sel.innerHTML = CATS[type].map((c) => `<option>${c}</option>`).join('');
    syncGlassSelect(sel);
    $('#txSubmit span').textContent = type === 'in' ? 'Simpan Pemasukan' : 'Simpan Pengeluaran';
  }

  function formatMoneyInput(input) {
    const n = parseDigits(input.value);
    input.value = n ? nf(0).format(n) : '';
  }

  function initFinance() {
    setTxType('in');
    $('#txDate').value = todayISO();
    $('#txType').addEventListener('click', (e) => { const b = e.target.closest('button[data-value]'); if (b) setTxType(b.dataset.value); });
    $('#txType').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setTxType(state.txType === 'in' ? 'out' : 'in'); $(`#txType button[data-value="${state.txType}"]`).focus(); }
    });
    ['#txAmount', '#etAmount', '#goldInput', '#egIdr', '#calcIdr'].forEach((s) => $(s)?.addEventListener('input', (e) => formatMoneyInput(e.target)));

    $('#amountChips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-amt]'); if (!b) return;
      const inp = $('#txAmount'); const add = Number(b.dataset.amt);
      inp.value = add === 0 ? '' : nf(0).format(parseDigits(inp.value) + add);
      inp.classList.remove('invalid');
    });

    $('#txForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const amtEl = $('#txAmount');
      const amount = parseDigits(amtEl.value);
      if (!amount) { amtEl.classList.remove('invalid'); void amtEl.offsetWidth; amtEl.classList.add('invalid'); amtEl.focus(); toast('Masukkan nominal terlebih dahulu.', { type: 'error' }); return; }
      const cat = $('#txCat').value;
      const desc = $('#txDesc').value.trim() || cat;
      const date = $('#txDate').value || todayISO();
      const before = calc();
      state.txs.push({ id: uid(), type: state.txType, amount, desc, cat, date, created: Date.now() });
      store.set(uKey('txs'), state.txs);
      amtEl.value = ''; $('#txDesc').value = '';
      renderFinance();
      if (state.txType === 'out' && amount > before.kas) toast(`Pengeluaran dicatat — saldo kas kini ${fmtRp(calc().kas)}.`, { type: 'warn' });
      else toast(`${state.txType === 'in' ? 'Pemasukan' : 'Pengeluaran'} ${fmtRp(amount)} tersimpan.`, { type: 'success' });
    });
    $('#txAmount').addEventListener('input', (e) => e.target.classList.remove('invalid'));

    $('#txFilter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      state.txFilter = b.dataset.f;
      $$('#txFilter button').forEach((x) => x.classList.toggle('active', x === b));
      renderTxList();
    });

    let editingTxId = null;
    let editTxType = 'in';
    const setEditTxType = (type, preferredCat = null) => {
      editTxType = type === 'out' ? 'out' : 'in';
      const seg = $('#etType');
      if (seg) {
        seg.dataset.value = editTxType;
        $$('button', seg).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === editTxType)));
      }
      const sel = $('#etCat');
      if (sel) {
        const list = CATS[editTxType].slice();
        if (preferredCat && !list.includes(preferredCat)) list.unshift(preferredCat);
        sel.innerHTML = list.map((c) => `<option>${esc(c)}</option>`).join('');
        if (preferredCat && list.includes(preferredCat)) sel.value = preferredCat;
        syncGlassSelect(sel);
      }
    };
    const openEditTx = (txId) => {
      const t = state.txs.find((x) => x.id === txId);
      if (!t) return;
      editingTxId = txId;
      setEditTxType(t.type, t.cat);
      $('#etAmount').value = t.amount ? nf(0).format(t.amount) : '';
      $('#etAmount').classList.remove('invalid');
      $('#etDesc').value = t.desc || '';
      $('#etDate').value = t.date && ISO_DATE_RE.test(t.date) ? t.date : todayISO();
      openModal('editTxModal');
      setTimeout(() => {
        const inp = $('#etAmount');
        if (inp && !state.isMobile) { inp.focus(); inp.select(); }
      }, 140);
    };

    const openEditGold = () => {
      const f = calc();
      const idrEl = $('#egIdr'), gEl = $('#egGram'), goalEl = $('#egGoal');
      if (idrEl) { idrEl.value = f.gold ? nf(0).format(f.gold) : '0'; idrEl.classList.remove('invalid'); }
      if (gEl) gEl.value = f.gold ? fmtGram(f.grams) : '0,0000';
      if (goalEl) { goalEl.value = String(state.goldGoal); syncGlassSelect(goalEl); }
      openModal('editGoldModal');
      setTimeout(() => {
        if (idrEl && !state.isMobile) { idrEl.focus(); idrEl.select(); }
      }, 140);
    };

    $('#txList').addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-tx]');
      if (editBtn) { openEditTx(editBtn.dataset.editTx); return; }
      const b = e.target.closest('[data-del-tx]'); if (!b) return;
      const idx = state.txs.findIndex((t) => t.id === b.dataset.delTx); if (idx < 0) return;
      const [removed] = state.txs.splice(idx, 1);
      store.set(uKey('txs'), state.txs); renderFinance();
      toast(`"${removed.desc}" dihapus.`, {
        action: 'Urungkan', timeout: 5000,
        onAction: () => { state.txs.splice(idx, 0, removed); store.set(uKey('txs'), state.txs); renderFinance(); }
      });
    });

    $('#etType')?.addEventListener('click', (e) => { const b = e.target.closest('button[data-value]'); if (b) setEditTxType(b.dataset.value); });
    $('#etType')?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setEditTxType(editTxType === 'in' ? 'out' : 'in');
        $(`#etType button[data-value="${editTxType}"]`)?.focus();
      }
    });
    $('#etChips')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-et-amt]'); if (!b) return;
      const inp = $('#etAmount'); const add = Number(b.dataset.etAmt);
      inp.value = add === 0 ? '' : nf(0).format(parseDigits(inp.value) + add);
      inp.classList.remove('invalid');
    });
    $('#etAmount')?.addEventListener('input', (e) => e.target.classList.remove('invalid'));
    $('#editTxForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!editingTxId) return;
      const amtEl = $('#etAmount');
      const amount = parseDigits(amtEl.value);
      if (!amount || amount > MAX_MONEY) {
        amtEl.classList.remove('invalid'); void amtEl.offsetWidth; amtEl.classList.add('invalid'); amtEl.focus();
        toast('Masukkan nominal transaksi yang valid.', { type: 'error' });
        return;
      }
      const idx = state.txs.findIndex((x) => x.id === editingTxId);
      if (idx < 0) { closeModal('editTxModal'); editingTxId = null; return; }
      const prev = { ...state.txs[idx] };
      const cat = String($('#etCat').value || '').trim().slice(0, 40) || (editTxType === 'in' ? 'Pemasukan' : 'Pengeluaran');
      const desc = String($('#etDesc').value || '').trim().slice(0, 80) || cat;
      const rawDate = $('#etDate').value;
      const date = ISO_DATE_RE.test(rawDate) ? rawDate : (prev.date || todayISO());
      state.txs[idx] = { ...prev, type: editTxType, amount, desc, cat, date };
      store.set(uKey('txs'), state.txs);
      editingTxId = null;
      closeModal('editTxModal');
      renderFinance();
      toast(`"${desc}" diperbarui (${fmtRp(amount)}).`, {
        type: 'success', action: 'Urungkan', timeout: 5500,
        onAction: () => {
          const i = state.txs.findIndex((x) => x.id === prev.id);
          if (i >= 0) { state.txs[i] = prev; store.set(uKey('txs'), state.txs); renderFinance(); }
        }
      });
    });

    $('#goldEditBtn')?.addEventListener('click', openEditGold);
    $('#sumEditGold')?.addEventListener('click', openEditGold);
    $('#egIdr')?.addEventListener('input', () => {
      const antam = price('ANTAM');
      const idr = parseDigits($('#egIdr').value);
      const gEl = $('#egGram');
      if (gEl && antam > 0) gEl.value = idr ? fmtGram(idr / antam) : '0,0000';
    });
    $('#egGram')?.addEventListener('input', () => {
      const antam = price('ANTAM');
      const g = Math.max(0, parseGram($('#egGram').value));
      const idrEl = $('#egIdr');
      if (idrEl && antam > 0) {
        const v = sanitizeGold(Math.round(g * antam));
        idrEl.value = v ? nf(0).format(v) : '0';
      }
    });
    $('#egChips')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-eg-gr]'); if (!b) return;
      const g = Math.max(0, Number(b.dataset.egGr) || 0);
      const antam = price('ANTAM');
      const v = g > 0 && antam > 0 ? sanitizeGold(Math.round(g * antam)) : 0;
      $('#egIdr').value = v ? nf(0).format(v) : '0';
      $('#egGram').value = g > 0 ? fmtGram(g) : '0,0000';
    });
    $('#editGoldForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const prevGold = state.goldIDR;
      const prevGoal = state.goldGoal;
      const nextGold = sanitizeGold(parseDigits($('#egIdr').value));
      const nextGoal = sanitizeGoldGoal($('#egGoal')?.value);
      state.goldIDR = nextGold;
      state.goldGoal = nextGoal;
      store.set(uKey('goldIDR'), nextGold);
      store.set(uKey('goldGoal'), nextGoal);
      closeModal('editGoldModal');
      renderFinance();
      syncSettingsUI();
      toast(`Tabungan emas diperbarui: ${fmtRp(nextGold)} (≈ ${fmtGram(calc().grams)} gr).`, {
        type: 'success', action: 'Urungkan', timeout: 5500,
        onAction: () => {
          state.goldIDR = prevGold;
          state.goldGoal = prevGoal;
          store.set(uKey('goldIDR'), prevGold);
          store.set(uKey('goldGoal'), prevGoal);
          renderFinance();
          syncSettingsUI();
        }
      });
    });

    $('#resetProfile').addEventListener('click', () => {
      const u = USERS[state.user];
      if (!confirm(`Reset semua catatan keuangan ${u.name} ke Rp 0?`)) return;
      const prevTx = state.txs, prevGold = state.goldIDR;
      state.txs = defaultTxs(state.user); state.goldIDR = DEFAULT_GOLD_IDR;
      store.set(uKey('txs'), state.txs); store.set(uKey('goldIDR'), state.goldIDR);
      renderFinance();
      toast(`Profil keuangan ${u.name} direset ke Rp 0.`, {
        type: 'success', action: 'Urungkan', timeout: 6000,
        onAction: () => { state.txs = prevTx; state.goldIDR = prevGold; store.set(uKey('txs'), prevTx); store.set(uKey('goldIDR'), prevGold); renderFinance(); }
      });
    });

    $('#goldMode')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-gmode]'); if (b) setGoldMode(b.dataset.gmode);
    });
    $('#goldChips')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-gamt]'); if (!b) return;
      const inp = $('#goldInput'); const add = Number(b.dataset.gamt);
      inp.value = add === 0 ? '' : nf(0).format(parseDigits(inp.value) + add);
      inp.classList.remove('invalid');
      updateGoldPreview();
    });
    $('#goldInput')?.addEventListener('input', (e) => {
      e.target.classList.remove('invalid');
      updateGoldPreview();
    });

    $('#goldForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('#goldInput'); const raw = parseDigits(inp.value);
      const isSet = state.goldMode === 'set';
      if (!inp.value.trim() || (!isSet && raw <= 0)) {
        inp.classList.remove('invalid'); void inp.offsetWidth; inp.classList.add('invalid'); inp.focus();
        toast('Masukkan nominal tabungan emas terlebih dahulu.', { type: 'error' });
        return;
      }
      const prev = state.goldIDR;
      let next = prev;
      if (state.goldMode === 'add') next = sanitizeGold(prev + raw);
      else if (state.goldMode === 'sub') next = sanitizeGold(Math.max(0, prev - raw));
      else next = sanitizeGold(raw);
      state.goldIDR = next; store.set(uKey('goldIDR'), next);
      inp.value = '';
      renderFinance();
      updateGoldPreview();
      const actionMsg = state.goldMode === 'add'
        ? `Tabungan emas ditambah ${fmtRp(raw)} → ${fmtRp(next)} (≈ ${fmtGram(calc().grams)} gr).`
        : state.goldMode === 'sub'
          ? `Tabungan emas dikurangi ${fmtRp(raw)} → ${fmtRp(next)} (≈ ${fmtGram(calc().grams)} gr).`
          : `Tabungan emas diperbarui: ${fmtRp(next)} (≈ ${fmtGram(calc().grams)} gr).`;
      toast(actionMsg, {
        type: 'success', action: 'Urungkan', timeout: 5500,
        onAction: () => { state.goldIDR = prev; store.set(uKey('goldIDR'), prev); renderFinance(); }
      });
    });

    $('#calcIdr')?.addEventListener('input', () => { state.calcLast = 'idr'; syncCalc(); });
    $('#calcGram')?.addEventListener('input', () => { state.calcLast = 'gram'; syncCalc(); });
    $('#calcSwap')?.addEventListener('click', () => {
      state.calcLast = state.calcLast === 'idr' ? 'gram' : 'idr';
      $(state.calcLast === 'idr' ? '#calcIdr' : '#calcGram')?.focus();
    });
  }

  function setGoldMode(mode) {
    state.goldMode = ['add', 'sub', 'set'].includes(mode) ? mode : 'add';
    $$('#goldMode button').forEach((b) => b.classList.toggle('active', b.dataset.gmode === state.goldMode));
    const lbl = $('#goldFieldLabel'), sub = $('#goldSubmit span'), inp = $('#goldInput');
    if (state.goldMode === 'add') {
      if (lbl) lbl.textContent = 'Nominal Tambahan (Rp)';
      if (sub) sub.textContent = 'Tambah ke Tabungan Emas';
      if (inp) inp.placeholder = '0';
    } else if (state.goldMode === 'sub') {
      if (lbl) lbl.textContent = 'Nominal Pengurangan (Rp)';
      if (sub) sub.textContent = 'Kurangi Tabungan Emas';
      if (inp) inp.placeholder = '0';
    } else {
      if (lbl) lbl.textContent = 'Edit Total Tabungan Emas (Rp)';
      if (sub) sub.textContent = 'Simpan Total Tabungan Emas';
      if (inp) {
        inp.placeholder = nf(0).format(state.goldIDR);
        if (!inp.value.trim() && state.goldIDR > 0) inp.value = nf(0).format(state.goldIDR);
      }
    }
    updateGoldPreview();
  }

  function updateGoldPreview() {
    const pv = $('#goldPreview'); if (!pv) return;
    const raw = parseDigits($('#goldInput')?.value || '');
    const antam = price('ANTAM');
    if (!raw && state.goldMode !== 'set') {
      pv.textContent = 'Masukkan nominal untuk melihat estimasi gram emas.';
      return;
    }
    const next = state.goldMode === 'add' ? sanitizeGold(state.goldIDR + raw)
      : state.goldMode === 'sub' ? sanitizeGold(Math.max(0, state.goldIDR - raw))
        : sanitizeGold(raw);
    const nextGr = antam > 0 ? next / antam : 0;
    const diffGr = antam > 0 ? raw / antam : 0;
    if (state.goldMode === 'add') pv.textContent = `Estimasi: +${fmtGram(diffGr)} gr → Total ${fmtRp(next)} (≈ ${fmtGram(nextGr)} gr)`;
    else if (state.goldMode === 'sub') pv.textContent = `Estimasi: −${fmtGram(diffGr)} gr → Sisa ${fmtRp(next)} (≈ ${fmtGram(nextGr)} gr)`;
    else pv.textContent = `Total baru: ${fmtRp(next)} (≈ ${fmtGram(nextGr)} gr)`;
  }

  function syncCalc() {
    const antam = price('ANTAM'); if (!(antam > 0)) return;
    const idrEl = $('#calcIdr'), gEl = $('#calcGram'); if (!idrEl || !gEl) return;
    if (state.calcLast === 'idr') {
      const idr = parseDigits(idrEl.value);
      if (document.activeElement !== gEl) gEl.value = idr ? fmtGram(idr / antam) : '';
    } else {
      const g = parseGram(gEl.value);
      if (document.activeElement !== idrEl) idrEl.value = g ? nf(0).format(Math.round(g * antam)) : '';
    }
  }

  /* =========================================================
     JADWAL HARIAN
     ========================================================= */
  const isLesItem = (it) => !!it && (it.type === 'les' || /\bles\b/i.test(String(it.title || '')));

  function schedItemHTML(it, i, { del = false } = {}) {
    const m = hasOwn(TYPE_META, it.type) ? TYPE_META[it.type] : TYPE_META.custom;
    const hasLesNotif = isLesItem(it) && state.lesRemind && !!parseLesRange(it.time);
    return `<li class="sched-item t-${esc(it.type)}" style="--i:${i}">
      <span class="si-ico">${icon(m.icon)}</span>
      <div class="si-body"><strong>${esc(it.title)}</strong>
        <div class="si-meta"><span class="badge b-${esc(it.type)}">${m.label}</span>${it.time ? `<span class="si-time">${icon('clock')}${esc(it.time)}</span>` : ''}${hasLesNotif ? `<span class="si-rem" title="Pengingat otomatis aktif">${icon('bell')}Notif</span>` : ''}</div>
      </div>
      ${del ? `<span class="si-acts"><button class="si-edit ripple" type="button" data-edit-sched="${esc(it.id)}" title="Edit jadwal" aria-label="Edit ${esc(it.title)}">${icon('pen')}</button><button class="si-del ripple" type="button" data-del-sched="${esc(it.id)}" title="Hapus jadwal" aria-label="Hapus ${esc(it.title)}">${icon('trash')}</button></span>` : ''}
    </li>`;
  }
  const emptySched = (msg) => `<li class="empty">${icon('calendar')}${msg}</li>`;

  function renderToday() {
    const ti = todayIdx();
    bind('todayLabel', dateLong());
    const items = state.schedule[ti] || [];
    $('#todayList').innerHTML = items.length ? items.map((it, i) => schedItemHTML(it, i)).join('') : emptySched('Tidak ada jadwal hari ini. Waktunya istirahat!');
  }

  function centerActiveDayTab(smooth = false) {
    const wrap = $('#dayTabs');
    const active = wrap?.querySelector('.day-tab.active');
    if (!wrap || !active || !wrap.clientWidth) return;
    const wr = wrap.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    if (!wr.width || !ar.width) return;
    const target = wrap.scrollLeft + (ar.left + ar.width / 2) - (wr.left + wr.width / 2);
    const max = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    const left = clamp(target, 0, max);
    if (smooth && typeof wrap.scrollTo === 'function') wrap.scrollTo({ left, behavior: 'smooth' });
    else wrap.scrollLeft = left;
  }

  let lastTodayIdx = todayIdx();
  function syncTodayRollover() {
    const d = todayIdx();
    if (d === lastTodayIdx) return false;
    if (state.schedDay === lastTodayIdx) state.schedDay = d;
    lastTodayIdx = d;
    renderSchedule();
    if (state.view === 'schedule') requestAnimationFrame(() => centerActiveDayTab(true));
    return true;
  }

  function renderSchedule({ smoothTab = true } = {}) {
    const ti = todayIdx();
    const tabs = DAYS.map((d, i) => `<button class="day-tab ripple ${state.schedDay === i ? 'active' : ''} ${i === ti ? 'today' : ''}" role="tab" data-day-idx="${i}" aria-selected="${state.schedDay === i}">${d}<small>${state.schedule[i].length} kegiatan</small></button>`).join('')
      + `<button class="day-tab week ripple ${state.schedDay === 'week' ? 'active' : ''}" role="tab" data-day-idx="week">${icon('grid')}Ringkasan 1 Minggu</button>`;
    $('#dayTabs').innerHTML = tabs;

    const isWeek = state.schedDay === 'week';
    $('#dayPanel').hidden = isWeek;
    $('#weekPanel').hidden = !isWeek;
    if (isWeek) {
      $('#weekPanel').innerHTML = DAYS.map((d, i) => `
        <article class="card week-card ${i === ti ? 'today' : ''}" data-day-idx="${i}" tabindex="0">
          <div class="wc-head"><strong>${d}</strong><span>${i === ti ? '● Hari ini · ' : ''}${state.schedule[i].length} kegiatan</span></div>
          <ul class="wc-list">${state.schedule[i].map((it) => `<li><span>${esc(it.title)}${isLesItem(it) && state.lesRemind && parseLesRange(it.time) ? `<span class="wc-bell" title="Pengingat Les aktif">${icon('bell')}</span>` : ''}</span>${it.time ? `<span class="wc-time">${esc(it.time.replace(' WIB', ''))}</span>` : `<span class="badge b-${esc(it.type)}">${(TYPE_META[it.type] || TYPE_META.custom).label}</span>`}</li>`).join('') || '<li><span>Kosong</span></li>'}</ul>
        </article>`).join('');
    } else {
      const di = state.schedDay;
      $('#dayTitle').textContent = `Jadwal ${DAYS[di]}`;
      $('#daySub').textContent = `${state.schedule[di].length} kegiatan${di === ti ? ' · ' + dateLong() : ''}`;
      $('#dayTodayBadge').hidden = di !== ti;
      const items = state.schedule[di];
      $('#dayList').innerHTML = items.length ? items.map((it, i) => schedItemHTML(it, i, { del: true })).join('') : emptySched('Belum ada jadwal. Tambahkan lewat formulir.');
      $('#sDay').value = String(di);
      syncGlassSelect($('#sDay'));
    }
    if (state.view === 'schedule') requestAnimationFrame(() => centerActiveDayTab(smoothTab));
    renderToday();
    renderLesReminderCard();
  }

  function setSchedDay(v) {
    state.schedDay = v === 'week' ? 'week' : v === 'today' ? todayIdx() : clamp(Number(v) || 0, 0, 6);
    renderSchedule();
  }

  let editingSched = null;
  function syncEditClearBtn() {
    const w = $('#esClearWrap');
    if (w) w.hidden = !($('#esStart')?.value || $('#esEnd')?.value);
  }
  function openEditSched(dayIdx, itemId) {
    const di = clamp(Number(dayIdx) || 0, 0, 6);
    const list = state.schedule[di] || [];
    const it = list.find((x) => x.id === itemId);
    if (!it) return;
    editingSched = { dayIdx: di, id: itemId };
    $('#esDay').value = String(di);
    syncGlassSelect($('#esDay'));
    $('#esTitle').value = it.title || '';
    $('#esType').value = hasOwn(TYPE_META, it.type) ? it.type : 'custom';
    syncGlassSelect($('#esType'));
    const r = parseLesRange(it.time);
    $('#esStart').value = r?.startStr || '';
    $('#esEnd').value = r?.endStr || '';
    syncEditClearBtn();
    openModal('editSchedModal');
    setTimeout(() => {
      const inp = $('#esTitle');
      if (inp && !state.isMobile) { inp.focus(); inp.select(); }
    }, 140);
  }

  function initSchedule() {
    const dayOpts = DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join('');
    $('#sDay').innerHTML = dayOpts;
    $('#sDay').value = String(todayIdx());
    syncGlassSelect($('#sDay'));
    if ($('#esDay')) { $('#esDay').innerHTML = dayOpts; syncGlassSelect($('#esDay')); }
    $('#dayTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-day-idx]'); if (b) setSchedDay(b.dataset.dayIdx); });
    $('#weekPanel').addEventListener('click', (e) => { const c = e.target.closest('[data-day-idx]'); if (c) setSchedDay(c.dataset.dayIdx); });
    $('#weekPanel').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const c = e.target.closest('[data-day-idx]'); if (c) setSchedDay(c.dataset.dayIdx); } });

    $('#dayList').addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-sched]');
      if (editBtn) { openEditSched(state.schedDay, editBtn.dataset.editSched); return; }
      const b = e.target.closest('[data-del-sched]'); if (!b) return;
      const di = state.schedDay; const list = state.schedule[di];
      const idx = list.findIndex((x) => x.id === b.dataset.delSched); if (idx < 0) return;
      const [removed] = list.splice(idx, 1);
      store.set(uKey('schedule'), state.schedule); renderSchedule();
      toast(`"${removed.title}" dihapus dari ${DAYS[di]}.`, {
        action: 'Urungkan', timeout: 5000,
        onAction: () => { state.schedule[di].splice(idx, 0, removed); store.set(uKey('schedule'), state.schedule); renderSchedule(); }
      });
    });

    ['#esStart', '#esEnd'].forEach((s) => $(s)?.addEventListener('input', syncEditClearBtn));
    $('#esClearTime')?.addEventListener('click', () => {
      $('#esStart').value = ''; $('#esEnd').value = '';
      syncEditClearBtn();
    });
    $('#editSchedForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!editingSched) return;
      const titleEl = $('#esTitle');
      const title = titleEl.value.trim().slice(0, 60);
      if (!title) { titleEl.classList.add('invalid'); setTimeout(() => titleEl.classList.remove('invalid'), 500); titleEl.focus(); return; }
      const fromDay = editingSched.dayIdx;
      const fromList = state.schedule[fromDay] || [];
      const idx = fromList.findIndex((x) => x.id === editingSched.id);
      if (idx < 0) { closeModal('editSchedModal'); editingSched = null; return; }

      const snapshot = state.schedule.map((d) => d.map((x) => ({ ...x })));
      const prevSchedDay = state.schedDay;
      const orig = fromList[idx];
      const toDay = clamp(Number($('#esDay').value) || 0, 0, 6);
      const rawType = $('#esType').value;
      const type = hasOwn(TYPE_META, rawType) ? rawType : 'custom';
      const st = $('#esStart').value, en = $('#esEnd').value;
      const updated = { id: orig.id, title, type };
      if (st) updated.time = `${st}${en ? ' – ' + en : ''} WIB`;

      if (toDay === fromDay) {
        fromList[idx] = updated;
      } else {
        fromList.splice(idx, 1);
        const toList = state.schedule[toDay];
        const lastIsVibe = toList.length && toList[toList.length - 1].type === 'vibe';
        if (type !== 'vibe' && lastIsVibe) toList.splice(toList.length - 1, 0, updated); else toList.push(updated);
        state.schedDay = toDay;
      }
      store.set(uKey('schedule'), state.schedule);
      clearLesFiredFor(orig.id);
      editingSched = null;
      closeModal('editSchedModal');
      renderSchedule();
      if (isLesItem(updated)) checkLesReminders();
      const msg = toDay === fromDay ? `"${title}" diperbarui.` : `"${title}" dipindah ke ${DAYS[toDay]}.`;
      toast(msg, {
        type: 'success', action: 'Urungkan', timeout: 5500,
        onAction: () => {
          state.schedule = snapshot;
          state.schedDay = prevSchedDay;
          store.set(uKey('schedule'), state.schedule);
          clearLesFiredFor(orig.id);
          renderSchedule();
          checkLesReminders();
        }
      });
    });

    $('#addSchedForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const titleEl = $('#sTitle'); const title = titleEl.value.trim();
      if (!title) { titleEl.classList.add('invalid'); setTimeout(() => titleEl.classList.remove('invalid'), 500); titleEl.focus(); return; }
      const di = clamp(Number($('#sDay').value) || 0, 0, 6);
      const type = $('#sType').value;
      const st = $('#sStart').value, en = $('#sEnd').value;
      const item = { id: uid(), title, type };
      if (st) item.time = `${st}${en ? ' – ' + en : ''} WIB`;
      const list = state.schedule[di];
      const lastIsVibe = list.length && list[list.length - 1].type === 'vibe';
      if (type !== 'vibe' && lastIsVibe) list.splice(list.length - 1, 0, item); else list.push(item);
      store.set(uKey('schedule'), state.schedule);
      titleEl.value = ''; $('#sStart').value = ''; $('#sEnd').value = '';
      state.schedDay = di; renderSchedule();
      if (isLesItem(item)) checkLesReminders();
      toast(`"${title}" ditambahkan ke ${DAYS[di]}.`, { type: 'success' });
    });
  }

  /* =========================================================
     PENGINGAT SEMUA JADWAL LES (SEMUA USER · CHIME HALUS)
     ========================================================= */
  let lesAudioCtx = null;
  let lesReverbBuf = null;
  let activeLesAudio = null;

  function getLesAudioCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!lesAudioCtx) lesAudioCtx = new AC();
    return lesAudioCtx;
  }
  function unlockLesAudio() {
    try {
      const ctx = getLesAudioCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch { /* noop */ }
  }
  function getVelvetReverbBuffer(ctx) {
    if (lesReverbBuf && lesReverbBuf.sampleRate === ctx.sampleRate) return lesReverbBuf;
    const sr = ctx.sampleRate;
    const dur = 1.6;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.min(1, i / (sr * 0.02)) * Math.pow(1 - t, 3.2);
        const white = Math.random() * 2 - 1;
        lp = lp * 0.78 + white * 0.22;
        data[i] = lp * env * 0.52;
      }
    }
    lesReverbBuf = buf;
    return buf;
  }

  function syncLesPlayingUI(playing) {
    const bar = $('#lesAlertBar');
    if (bar) bar.classList.toggle('ringing', playing);
  }

  function stopLesChime({ immediate = false } = {}) {
    const cur = activeLesAudio;
    if (!cur) { syncLesPlayingUI(false); return; }
    activeLesAudio = null;
    clearTimeout(cur.timer);
    syncLesPlayingUI(false);
    try {
      const now = cur.ctx.currentTime;
      const fade = immediate ? 0.025 : 0.16;
      cur.master.gain.cancelScheduledValues(now);
      cur.master.gain.setValueAtTime(Math.max(0.0001, cur.master.gain.value || 0.001), now);
      cur.master.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      setTimeout(() => {
        cur.oscs.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
        try { cur.master.disconnect(); } catch { /* noop */ }
      }, Math.ceil((fade + 0.05) * 1000));
    } catch { /* noop */ }
  }

  async function playLesChime(kind = 'pre') {
    if (!state.lesSound) return false;
    try {
      const ctx = getLesAudioCtx();
      if (!ctx) return false;
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state !== 'running') return false;

      stopLesChime({ immediate: true });

      const isStart = kind === 'start';
      const totalDur = isStart ? 2.35 : 2.10;
      const t0 = ctx.currentTime + 0.025;
      const oscs = [];

      // Velvet mastering chain: Compressor -> Warm LPF -> Master Gain -> Destination
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.linearRampToValueAtTime(0.38, t0 + 0.04);
      master.gain.setValueAtTime(0.38, t0 + totalDur - 0.55);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + totalDur);

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-16, t0);
      comp.knee.setValueAtTime(22, t0);
      comp.ratio.setValueAtTime(3.0, t0);
      comp.attack.setValueAtTime(0.012, t0);
      comp.release.setValueAtTime(0.22, t0);

      const warmLpf = ctx.createBiquadFilter();
      warmLpf.type = 'lowpass';
      warmLpf.frequency.setValueAtTime(2800, t0);
      warmLpf.Q.setValueAtTime(0.55, t0);

      // Dry bus + Silky Stereo Reverb + Soft Shimmer Echo
      const dryBus = ctx.createGain();
      dryBus.gain.setValueAtTime(0.76, t0);

      const wetBus = ctx.createGain();
      wetBus.gain.setValueAtTime(0.42, t0);
      const rev = ctx.createConvolver();
      rev.buffer = getVelvetReverbBuffer(ctx);

      const echoDelay = ctx.createDelay(0.6);
      echoDelay.delayTime.setValueAtTime(0.28, t0);
      const echoFb = ctx.createGain();
      echoFb.gain.setValueAtTime(0.20, t0);
      const echoFilt = ctx.createBiquadFilter();
      echoFilt.type = 'lowpass';
      echoFilt.frequency.setValueAtTime(1600, t0);
      const echoOut = ctx.createGain();
      echoOut.gain.setValueAtTime(0.18, t0);

      dryBus.connect(warmLpf);
      wetBus.connect(rev);
      rev.connect(warmLpf);
      dryBus.connect(echoDelay);
      echoDelay.connect(echoFilt);
      echoFilt.connect(echoFb);
      echoFb.connect(echoDelay);
      echoFilt.connect(echoOut);
      echoOut.connect(warmLpf);

      warmLpf.connect(comp);
      comp.connect(master);
      master.connect(ctx.destination);

      // Silky detuned crystal-bell voice (zero click, airy harmonic sparkle)
      const playBell = (freq, at, dur, vol = 0.27) => {
        const st = t0 + at;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, st);
        g.gain.linearRampToValueAtTime(vol, st + 0.024);
        g.gain.exponentialRampToValueAtTime(vol * 0.34, st + Math.min(dur * 0.42, 0.55));
        g.gain.exponentialRampToValueAtTime(0.0001, st + dur);

        for (const ratio of [1, 1.0018]) {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(freq * ratio, st);
          o.connect(g);
          o.start(st);
          o.stop(st + dur + 0.05);
          oscs.push(o);
        }
        const ov = ctx.createOscillator();
        const og = ctx.createGain();
        ov.type = 'sine';
        ov.frequency.setValueAtTime(freq * 2, st);
        og.gain.setValueAtTime(0.0001, st);
        og.gain.linearRampToValueAtTime(vol * 0.14, st + 0.016);
        og.gain.exponentialRampToValueAtTime(0.0001, st + Math.min(0.42, dur * 0.36));
        ov.connect(og);
        og.connect(dryBus);
        og.connect(wetBus);
        ov.start(st);
        ov.stop(st + Math.min(0.46, dur * 0.40));
        oscs.push(ov);

        g.connect(dryBus);
        g.connect(wetBus);
      };

      // Whisper-soft warm harmonic halo underneath (C4 + G4 + B4)
      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0.0001, t0);
      padGain.gain.linearRampToValueAtTime(0.068, t0 + 0.28);
      padGain.gain.exponentialRampToValueAtTime(0.0001, t0 + totalDur - 0.12);
      [261.63, 392.00, 493.88].forEach((f) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t0);
        o.connect(padGain);
        o.start(t0);
        o.stop(t0 + totalDur - 0.08);
        oscs.push(o);
      });
      padGain.connect(dryBus);
      padGain.connect(wetBus);

      // Singkat, bening, super smooth (~2 detik): E5 -> G5 -> B5 -> D6 (+ E6 halus saat tepat mulai)
      playBell(659.25, 0.00, 1.15, 0.24);
      playBell(783.99, 0.13, 1.25, 0.26);
      playBell(987.77, 0.26, 1.38, 0.27);
      playBell(1174.66, 0.41, 1.58, 0.26);
      if (isStart) playBell(1318.51, 0.56, 1.65, 0.20);

      const session = { ctx, master, oscs, timer: null };
      activeLesAudio = session;
      syncLesPlayingUI(true);
      session.timer = setTimeout(() => {
        if (activeLesAudio === session) {
          activeLesAudio = null;
          syncLesPlayingUI(false);
          try { master.disconnect(); } catch { /* noop */ }
        }
      }, Math.ceil((totalDur + 0.12) * 1000));
      return true;
    } catch {
      syncLesPlayingUI(false);
      return false;
    }
  }

  function parseLesRange(timeStr) {
    if (typeof timeStr !== 'string' || !timeStr.trim()) return null;
    const m = [...timeStr.matchAll(/(\d{1,2})[:.](\d{2})/g)];
    if (!m.length) return null;
    const h1 = Number(m[0][1]), m1 = Number(m[0][2]);
    if (!(h1 >= 0 && h1 <= 23 && m1 >= 0 && m1 <= 59)) return null;
    const pad2 = (n) => String(n).padStart(2, '0');
    const startMin = h1 * 60 + m1;
    const startStr = `${pad2(h1)}:${pad2(m1)}`;
    let endMin = null, endStr = '';
    if (m[1]) {
      const h2 = Number(m[1][1]), m2 = Number(m[1][2]);
      if (h2 >= 0 && h2 <= 23 && m2 >= 0 && m2 <= 59) { endMin = h2 * 60 + m2; endStr = `${pad2(h2)}:${pad2(m2)}`; }
    }
    return { startMin, endMin, startStr, endStr };
  }

  function getNotifPerm() {
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  }

  function fmtDurShort(mins) {
    const m = Math.max(0, Math.round(mins));
    if (m < 60) return `${m} menit`;
    const h = Math.floor(m / 60), rem = m % 60;
    return rem ? `${h} jam ${rem} mnt` : `${h} jam`;
  }

  function getAllLesItems() {
    const out = [];
    for (let di = 0; di < 7; di++) {
      const list = (state.schedule[di] || [])
        .filter((it) => isLesItem(it))
        .map((it) => ({ item: it, dayIdx: di, range: parseLesRange(it.time) }))
        .filter((x) => x.range)
        .sort((a, b) => a.range.startMin - b.range.startMin);
      out.push(...list);
    }
    return out;
  }

  function findNextLes(now = new Date()) {
    const p = jkt(now);
    const ti = WD[p.weekday] ?? 0;
    const nowMin = Number(p.hour) * 60 + Number(p.minute);
    for (let offset = 0; offset < 7; offset++) {
      const di = (ti + offset) % 7;
      const lesItems = (state.schedule[di] || [])
        .filter((it) => isLesItem(it))
        .map((it) => ({ item: it, range: parseLesRange(it.time) }))
        .filter((x) => x.range)
        .sort((a, b) => a.range.startMin - b.range.startMin);
      for (const x of lesItems) {
        if (offset === 0) {
          const endM = x.range.endMin != null ? x.range.endMin : x.range.startMin + 60;
          if (nowMin >= x.range.startMin && nowMin < endM) {
            return { item: x.item, dayIdx: di, offset: 0, range: x.range, ongoing: true, minsUntil: 0 };
          }
          if (x.range.startMin > nowMin) {
            return { item: x.item, dayIdx: di, offset: 0, range: x.range, ongoing: false, minsUntil: x.range.startMin - nowMin };
          }
        } else {
          return { item: x.item, dayIdx: di, offset, range: x.range, ongoing: false, minsUntil: offset * 1440 - nowMin + x.range.startMin };
        }
      }
    }
    return null;
  }

  function loadLesFired(todayStr) {
    const raw = store.get('lesFired', null);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    const prefix = `${todayStr}|`;
    Object.keys(raw).forEach((k) => { if (k.startsWith(prefix)) out[k] = raw[k]; });
    return out;
  }

  function saveLesFired(map, todayStr) {
    const clean = {};
    const prefix = `${todayStr}|`;
    Object.keys(map).forEach((k) => { if (k.startsWith(prefix)) clean[k] = map[k]; });
    store.set('lesFired', clean);
  }
  function clearLesFiredFor(itemId) {
    const raw = store.get('lesFired', null);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const needle = `|${state.user}|${itemId}|`;
    const next = {};
    Object.keys(raw).forEach((k) => { if (!k.includes(needle)) next[k] = raw[k]; });
    store.set('lesFired', next);
  }

  function showLesBanner({ title, msg, dayIdx = todayIdx() }) {
    const bar = $('#lesAlertBar');
    if (!bar) return;
    $('#lesAlertTitle').textContent = title;
    $('#lesAlertMsg').textContent = msg;
    bar.dataset.dayIdx = String(clamp(Number(dayIdx) || 0, 0, 6));
    bar.hidden = false;
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = '';
  }

  function hideLesBanner() {
    stopLesChime();
    const bar = $('#lesAlertBar');
    if (bar) bar.hidden = true;
  }

  async function sendLesNotification(title, body, { tag = 'zashflow-les', dayIdx = todayIdx(), kind = 'pre' } = {}) {
    if (state.lesSound) playLesChime(kind);
    if (getNotifPerm() !== 'granted') return 'in-app';
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    const ico = state.user === 'niza' ? './icon-pink-any.png?v=6' : './icon-blue-any.png?v=6';
    const androidIco = './blank.png?v=1';
    const badgeIco = './badge.png?v=1';
    const targetUrl = new URL(isNizaPage() ? './niza.html#schedule' : './#schedule', location.href).href;
    const isSilent = !state.lesSound;
    // Android: badge transparan ZashFlow di bulatan kiri atas + icon transparan 64x64 agar Chrome tidak membuat bulatan monogram huruf "Z" di kanan
    const opts = isAndroid
      ? { body, icon: androidIco, badge: badgeIco, tag, silent: isSilent, renotify: false, data: { url: targetUrl } }
      : { body, icon: ico, badge: badgeIco, tag, silent: isSilent, renotify: false, data: { url: targetUrl } };
    try {
      if ('serviceWorker' in navigator) {
        const reg = await Promise.race([
          navigator.serviceWorker.getRegistration(),
          sleep(900).then(() => null)
        ]);
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, opts);
          return 'sw';
        }
      }
    } catch { /* fallback to window Notification */ }
    try {
      const nOpts = isAndroid
        ? { body, icon: androidIco, badge: badgeIco, tag, silent: isSilent }
        : { body, icon: ico, badge: badgeIco, tag, silent: isSilent };
      const n = new Notification(title, nOpts);
      n.onclick = () => { try { window.focus(); } catch { /* noop */ } stopLesChime(); go('schedule'); setSchedDay(dayIdx); n.close(); };
      return 'web';
    } catch {
      try {
        const n2 = new Notification(title, { body, icon: ico, tag });
        n2.onclick = () => { try { window.focus(); } catch { /* noop */ } stopLesChime(); go('schedule'); setSchedDay(dayIdx); n2.close(); };
        return 'web';
      } catch {
        return 'in-app';
      }
    }
  }

  function renderLesReminderCard(now = new Date()) {
    const card = $('#lesRemindCard');
    if (!card) return;
    card.classList.toggle('is-off', !state.lesRemind);
    const tog = $('#lesRemindToggle');
    if (tog) tog.setAttribute('aria-checked', String(state.lesRemind));
    const sel = $('#lesLeadSelect');
    if (sel) { sel.value = String(state.lesLead); syncGlassSelect(sel); }

    const sBtn = $('#lesSoundBtn');
    if (sBtn) {
      sBtn.setAttribute('aria-pressed', String(state.lesSound));
      sBtn.innerHTML = `${icon(state.lesSound ? 'volume' : 'volume-x')}<span>${state.lesSound ? 'Suara ON' : 'Senyap'}</span>`;
    }

    const perm = getNotifPerm();
    const permBtn = $('#lesPermBtn');
    if (permBtn) {
      permBtn.hidden = !state.lesRemind || perm !== 'default';
    }

    const allLes = getAllLesItems();
    const chipsEl = $('#lesAllChips');
    if (chipsEl) {
      if (!allLes.length) {
        chipsEl.hidden = true;
      } else {
        chipsEl.hidden = false;
        chipsEl.innerHTML = allLes.map((x) => {
          const tShort = String(x.item.time || '').replace(/\s*WIB$/i, '');
          return `<button type="button" class="lr-tag ripple" data-les-day="${x.dayIdx}" title="Buka jadwal ${DAYS[x.dayIdx]}">${icon('bell')}<b>${DAYS_SHORT[x.dayIdx]}</b> ${esc(x.item.title)} <span>${esc(tShort)}</span></button>`;
        }).join('');
      }
    }

    const nextEl = $('#lesNextText');
    if (!nextEl) return;
    const uName = USERS[state.user].name;
    if (!state.lesRemind) {
      nextEl.textContent = `Pengingat otomatis semua jadwal Les ${uName} sedang dimatikan.`;
      return;
    }
    const next = findNextLes(now);
    if (!next) {
      nextEl.textContent = `Belum ada jadwal Les berwaktu untuk ${uName}.`;
    } else if (next.ongoing) {
      nextEl.textContent = `${allLes.length} jadwal Les ${uName} aktif · Sedang berlangsung: ${next.item.title} (${next.item.time})`;
    } else if (next.offset === 0) {
      nextEl.textContent = `${allLes.length} jadwal Les ${uName} aktif · Hari ini ${next.item.title} (${next.item.time}) · ${fmtDurShort(next.minsUntil)} lagi`;
    } else if (next.offset === 1) {
      nextEl.textContent = `${allLes.length} jadwal Les ${uName} aktif · Besok (${DAYS[next.dayIdx]}) ${next.item.title} (${next.item.time})`;
    } else {
      nextEl.textContent = `${allLes.length} jadwal Les ${uName} aktif · Terdekat: ${DAYS[next.dayIdx]} ${next.item.title} (${next.item.time})`;
    }
  }

  function checkLesReminders(now = new Date()) {
    renderLesReminderCard(now);
    if (!state.lesRemind) return [];
    const p = jkt(now);
    const todayStr = `${p.year}-${p.month}-${p.day}`;
    const ti = WD[p.weekday] ?? 0;
    const nowMin = Number(p.hour) * 60 + Number(p.minute);
    const list = state.schedule[ti] || [];
    const fired = loadLesFired(todayStr);
    const triggered = [];
    let dirty = false;

    for (const it of list) {
      // HANYA semua jadwal Les (semua user: Zaki & Niza) yang memicu pengingat
      if (!isLesItem(it)) continue;
      const r = parseLesRange(it.time);
      if (!r) continue;
      const diff = r.startMin - nowMin;
      const elapsed = nowMin - r.startMin;

      if (diff > 0 && diff <= state.lesLead) {
        const key = `${todayStr}|${state.user}|${it.id}|pre`;
        if (!fired[key]) {
          fired[key] = Date.now();
          dirty = true;
          const title = `Pengingat Les · ${diff} menit lagi`;
          const body = `${it.title} (${it.time}) · ${USERS[state.user].name}`;
          showLesBanner({ title, msg: body, dayIdx: ti });
          toast(`${title}: ${it.title}`, { type: 'info', timeout: 5200 });
          sendLesNotification(title, body, { tag: `zashflow-les-pre-${state.user}-${it.id}`, dayIdx: ti, kind: 'pre' });
          triggered.push({ phase: 'pre', item: it, title, body });
        }
      } else if (elapsed >= 0 && elapsed <= 15 && (r.endMin == null || nowMin < r.endMin)) {
        const key = `${todayStr}|${state.user}|${it.id}|start`;
        if (!fired[key]) {
          fired[key] = Date.now();
          dirty = true;
          const title = 'Waktunya Les Sekarang';
          const body = `${it.title} (${it.time}) · ${USERS[state.user].name}`;
          showLesBanner({ title, msg: body, dayIdx: ti });
          toast(`${title}: ${it.title} (${it.time})`, { type: 'warn', timeout: 5600 });
          sendLesNotification(title, body, { tag: `zashflow-les-start-${state.user}-${it.id}`, dayIdx: ti, kind: 'start' });
          triggered.push({ phase: 'start', item: it, title, body });
        }
      }
    }
    if (dirty) saveLesFired(fired, todayStr);
    return triggered;
  }

  async function requestLesNotifPermission() {
    unlockLesAudio();
    const perm = getNotifPerm();
    if (perm === 'unsupported') {
      toast('Browser ini mendukung pengingat In-App. Pasang ke Layar Utama (PWA) untuk notifikasi HP.', { type: 'info', timeout: 4800 });
      renderLesReminderCard();
      return;
    }
    if (perm === 'denied') {
      toast('Izin notifikasi browser diblokir. Aktifkan di pengaturan situs browser, sementara pengingat In-App tetap berjalan.', { type: 'warn', timeout: 5200 });
      renderLesReminderCard();
      return;
    }
    try {
      const res = await Notification.requestPermission();
      renderLesReminderCard();
      if (res === 'granted') {
        const title = 'Pengingat Jadwal Les Aktif';
        const body = `Semua jadwal Les ${USERS[state.user].name} siap diingatkan (${state.lesLead} menit sebelum mulai).`;
        await sendLesNotification(title, body, { tag: `zashflow-les-enabled-${state.user}`, dayIdx: todayIdx(), kind: 'pre' });
        toast(`Notifikasi HP & Web aktif${state.lesSound ? ' dengan chime halus' : ' (senyap)'}!`, { type: 'success' });
      } else {
        toast('Izin notifikasi sistem belum aktif — pengingat In-App tetap berjalan.', { type: 'info' });
      }
    } catch {
      toast('Pengingat In-App tetap aktif di layar.', { type: 'info' });
    }
  }

  async function triggerTestLesNotif() {
    unlockLesAudio();
    const next = findNextLes();
    const fallbackTitle = state.user === 'niza' ? 'Les Ngaji' : 'Les';
    const fallbackTime = state.user === 'niza' ? '13:00 – 14:30 WIB' : '16:30 – 19:30 WIB';
    const fallbackDay = state.user === 'niza' ? 5 : 3;
    const item = next ? next.item : { title: fallbackTitle, time: fallbackTime };
    const dayIdx = next ? next.dayIdx : fallbackDay;
    const title = `Pengingat Les · ${state.lesLead} menit lagi`;
    const body = `${item.title} (${item.time}) · ${DAYS[dayIdx]} · ${USERS[state.user].name}`;
    showLesBanner({ title, msg: body, dayIdx });
    const via = await sendLesNotification(title, body, { tag: `zashflow-les-test-${state.user}`, dayIdx, kind: 'pre' });
    const sTxt = state.lesSound ? 'dengan chime halus' : 'tanpa suara';
    if (via === 'sw' || via === 'web') {
      toast(`Tes pengingat Les terkirim ke HP/Web & layar (${sTxt}).`, { type: 'success' });
    } else if (getNotifPerm() === 'default') {
      toast(`Tes pengingat Les muncul di layar (${sTxt}). Klik "Aktifkan Notif" agar juga masuk ke panel notifikasi HP.`, { type: 'info', timeout: 5000 });
    } else {
      toast(`Tes pengingat Les tampil di layar (${sTxt}).`, { type: 'success' });
    }
  }

  function initLesReminders() {
    document.addEventListener('pointerdown', unlockLesAudio, { passive: true });
    document.addEventListener('keydown', unlockLesAudio, { passive: true });
    renderLesReminderCard();
    $('#lesRemindToggle')?.addEventListener('click', () => {
      state.lesRemind = !state.lesRemind;
      store.set('lesRemind', state.lesRemind);
      if (!state.lesRemind) hideLesBanner();
      renderSchedule();
      if (state.lesRemind) checkLesReminders();
      toast(state.lesRemind ? 'Pengingat semua jadwal Les aktif.' : 'Pengingat jadwal Les dimatikan.', { type: state.lesRemind ? 'success' : 'info' });
    });
    $('#lesSoundBtn')?.addEventListener('click', () => {
      state.lesSound = !state.lesSound;
      store.set('lesSound', state.lesSound);
      if (!state.lesSound) stopLesChime();
      renderLesReminderCard();
      if (state.lesSound) {
        playLesChime('pre');
        toast('Suara chime halus notifikasi Les aktif.', { type: 'success' });
      } else {
        toast('Suara notifikasi dimatikan (mode senyap).', { type: 'info' });
      }
    });
    $('#lesLeadSelect')?.addEventListener('change', (e) => {
      const v = Number(e.target.value);
      state.lesLead = [15, 30, 60].includes(v) ? v : 30;
      store.set('lesLead', state.lesLead);
      renderLesReminderCard();
      checkLesReminders();
      toast(`Pengingat Les diatur ${state.lesLead} menit sebelum mulai.`, { type: 'success' });
    });
    $('#lesAllChips')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-les-day]');
      if (b) setSchedDay(Number(b.dataset.lesDay));
    });
    $('#lesPermBtn')?.addEventListener('click', () => { requestLesNotifPermission(); });
    $('#lesTestBtn')?.addEventListener('click', () => { triggerTestLesNotif(); });
    $('#lesAlertClose')?.addEventListener('click', () => hideLesBanner());
    $('#lesAlertGo')?.addEventListener('click', () => {
      const di = Number($('#lesAlertBar')?.dataset.dayIdx);
      hideLesBanner();
      go('schedule');
      if (Number.isFinite(di)) setSchedDay(di);
    });
    setTimeout(() => checkLesReminders(), 1200);
    setInterval(() => checkLesReminders(), 15000);
  }

  /* =========================================================
     BERITA PASAR
     ========================================================= */
  const NEWS = [
    {
      id: 'n1', cat: 'Emas', asset: 'XAUUSD', h: 1.2, read: 3,
      title: 'Emas Spot Bertahan di {XAUUSD}, Pasar Menimbang Arah Suku Bunga Global',
      summary: 'Harga emas dunia bergerak {chg:XAUUSD} dalam 24 jam terakhir. Pelaku pasar masih mencermati sinyal bank sentral dan pergerakan dolar AS.',
      body: [
        'Harga emas spot dunia (XAU/USD) saat ini berada di kisaran {XAUUSD} per troy ounce, atau sekitar {SPOTGR} per gram dalam kurs dolar AS. Dalam 24 jam terakhir, harga bergerak {chg:XAUUSD}.',
        'Emas secara historis bergerak berlawanan dengan imbal hasil riil dan kekuatan dolar AS. Ketika ekspektasi penurunan suku bunga menguat, emas cenderung mendapat dukungan karena biaya peluang memegang aset tanpa bunga menjadi lebih rendah. Sebaliknya, data ekonomi yang terlalu kuat bisa menahan laju kenaikan.',
        'Bagi penabung emas jangka panjang, fluktuasi harian bukan sinyal utama. Strategi menabung rutin dengan nominal tetap (dollar-cost averaging) membantu meratakan harga beli dari waktu ke waktu tanpa perlu menebak titik terendah pasar.'
      ]
    },
    {
      id: 'n2', cat: 'Emas', asset: 'ANTAM', h: 2.5, read: 4,
      title: 'Emas Antam 24K Kini {ANTAM}/gram: Strategi Menabung Emas Bertahap untuk Pelajar',
      summary: 'Dengan harga acuan {ANTAM} per gram, tabungan emas bisa dimulai dari nominal kecil. Kuncinya konsisten, bukan besar nominalnya.',
      body: [
        'Acuan harga Emas Antam 24K di ZashFlow saat ini berada di {ANTAM} per gram, dihitung dinamis dari harga spot dunia dan kurs USD/IDR terkini ({USDIDR}). Harga fisik Logam Mulia umumnya memiliki premi di atas harga spot karena biaya produksi, sertifikasi, dan distribusi.',
        'Untuk pelajar, menabung emas tidak harus langsung satu gram. Banyak layanan tabungan emas resmi memungkinkan pembelian dalam pecahan gram. Menyisihkan sebagian kecil uang saku secara rutin — misalnya setiap minggu — bisa menjadi kebiasaan finansial yang sangat bernilai.',
        'Perhatikan juga selisih harga jual dan beli kembali (buyback). Emas fisik lebih cocok sebagai simpanan nilai jangka menengah hingga panjang, bukan untuk jual-beli cepat. Gunakan kalkulator konversi di halaman Keuangan untuk melihat berapa gram yang setara dengan target tabunganmu.'
      ]
    },
    {
      id: 'n3', cat: 'Saham', asset: 'IHSG', h: 0.8, read: 3,
      title: 'IHSG di Level {IHSG}: Pergerakan Saham Perbankan Besar Jadi Sorotan',
      summary: 'Indeks Harga Saham Gabungan bergerak {chg:IHSG}. Saham big caps perbankan seperti BBCA ({BBCA}), BBRI ({BBRI}), dan BMRI ({BMRI}) tetap jadi fokus utama.',
      body: [
        'Indeks Harga Saham Gabungan (IHSG) terpantau di level {IHSG}, bergerak {chg:IHSG} dibanding penutupan sebelumnya. Sektor perbankan dengan kapitalisasi pasar besar masih menjadi penggerak utama indeks.',
        'Saham Bank Central Asia (BBCA) diperdagangkan di {BBCA} ({chg:BBCA}), Bank Mandiri (BMRI) di {BMRI} ({chg:BMRI}), sementara Bank Rakyat Indonesia (BBRI) berada di {BBRI} ({chg:BBRI}). Kinerja penyaluran kredit, kualitas aset, dan arah suku bunga acuan menjadi faktor yang paling diperhatikan investor untuk saham perbankan.',
        'Arus dana investor asing dan pergerakan rupiah juga memengaruhi sentimen pasar saham domestik. Investor pemula disarankan memahami fundamental perusahaan dan tidak berinvestasi dengan dana kebutuhan sehari-hari.'
      ]
    },
    {
      id: 'n4', cat: 'Saham', asset: 'TLKM', h: 4, read: 3,
      title: 'TLKM di {TLKM}: Menimbang Narasi Digitalisasi dan Dividen',
      summary: 'Telkom Indonesia bergerak {chg:TLKM}. Bisnis data center dan konektivitas digital menjadi tema utama yang dipantau pasar.',
      body: [
        'Saham Telkom Indonesia (TLKM) saat ini berada di {TLKM}, bergerak {chg:TLKM} dalam sesi terakhir. Sebagai emiten telekomunikasi terbesar di Indonesia, TLKM kerap dipandang sebagai saham defensif dengan riwayat pembagian dividen yang konsisten.',
        'Pasar mencermati transformasi bisnis Telkom ke arah layanan digital, termasuk pusat data (data center), layanan cloud, dan infrastruktur serat optik. Pertumbuhan segmen ini dinilai penting untuk mengimbangi persaingan ketat di bisnis seluler.',
        'Seperti saham lainnya, harga TLKM dipengaruhi kondisi pasar secara umum. Selalu pertimbangkan diversifikasi agar portofolio tidak bergantung pada satu emiten saja.'
      ]
    },
    {
      id: 'n5', cat: 'Saham', asset: 'NVDA', h: 6, read: 3,
      title: 'NVIDIA di {NVDA}: Permintaan Chip AI Masih Jadi Motor Utama',
      summary: 'Saham NVIDIA bergerak {chg:NVDA}. Belanja pusat data untuk kecerdasan buatan tetap menjadi katalis terbesar.',
      body: [
        'Saham NVIDIA Corp. (NVDA) terpantau di {NVDA}, bergerak {chg:NVDA}. Perusahaan ini menjadi salah satu pemain kunci dalam rantai pasok kecerdasan buatan (AI) berkat dominasi GPU untuk pelatihan dan inferensi model AI.',
        'Pelaku pasar memperhatikan rencana belanja modal perusahaan teknologi besar untuk pusat data, serta dinamika regulasi ekspor chip. Valuasi yang tinggi membuat saham ini sensitif terhadap perubahan ekspektasi pertumbuhan.',
        'Bagi pengguna ZashFlow yang gemar vibe coding, tren AI juga relevan dari sisi keterampilan: memahami cara kerja model AI dan pemrograman menjadi aset jangka panjang yang nilainya tidak kalah penting dari portofolio investasi.'
      ]
    },
    {
      id: 'n6', cat: 'Kripto', asset: 'BTCUSD', h: 0.5, read: 3,
      title: 'Bitcoin Diperdagangkan di {BTCUSD}, Volatilitas Tetap Tinggi',
      summary: 'BTC bergerak {chg:BTCUSD} dalam 24 jam terakhir. Arus dana ETF dan likuiditas global masih menjadi penentu arah.',
      body: [
        'Bitcoin (BTC/USD) saat ini diperdagangkan di {BTCUSD}, dengan pergerakan {chg:BTCUSD} dalam 24 jam terakhir berdasarkan data pasar Binance. Bitcoin dikenal sebagai aset dengan volatilitas tinggi — pergerakan harian beberapa persen adalah hal yang biasa.',
        'Sentimen pasar kripto banyak dipengaruhi oleh arus dana produk investasi berbasis Bitcoin, kebijakan moneter global, dan perkembangan regulasi. Ketika likuiditas global longgar, aset berisiko seperti kripto cenderung lebih diminati.',
        'Penting diingat: aset kripto berisiko tinggi. Jangan pernah menempatkan dana yang tidak siap hilang, dan pahami bahwa harga bisa turun tajam dalam waktu singkat.'
      ]
    },
    {
      id: 'n7', cat: 'Kripto', asset: 'ETHUSD', h: 3, read: 3,
      title: 'Ethereum {ETHUSD}: Aktivitas Jaringan dan Ekosistem Layer-2 Jadi Sorotan',
      summary: 'ETH bergerak {chg:ETHUSD}. Pertumbuhan jaringan layer-2 dan aplikasi terdesentralisasi menjadi tema utama.',
      body: [
        'Ethereum (ETH/USD) berada di {ETHUSD}, bergerak {chg:ETHUSD} dalam 24 jam terakhir. Sebagai platform kontrak pintar terbesar, Ethereum menjadi fondasi bagi banyak aplikasi keuangan terdesentralisasi (DeFi) dan token digital.',
        'Jaringan layer-2 yang dibangun di atas Ethereum membantu menekan biaya transaksi dan meningkatkan kecepatan. Pasar memantau apakah peningkatan aktivitas ini berdampak pada permintaan ETH di jaringan utama.',
        'Bagi pengembang, ekosistem Ethereum juga menawarkan peluang belajar pemrograman smart contract. Namun dari sisi investasi, ETH tetap tergolong aset berisiko tinggi.'
      ]
    },
    {
      id: 'n8', cat: 'Makro', asset: 'USDIDR', h: 1.6, read: 3,
      title: 'Rupiah di {USDIDR} per Dolar AS: Dampaknya ke Harga Emas Lokal',
      summary: 'Kurs USD/IDR berada di {USDIDR}. Pelemahan rupiah biasanya membuat harga emas dalam rupiah ikut naik.',
      body: [
        'Nilai tukar rupiah terhadap dolar AS berada di level {USDIDR}. Kurs ini menjadi salah satu komponen utama pembentuk harga emas di dalam negeri, karena harga emas dunia ditetapkan dalam dolar AS.',
        'Rumus sederhananya: harga emas per gram dalam rupiah ≈ harga spot XAU/USD ÷ 31,1035 × kurs USD/IDR. Artinya, walau harga emas dunia stagnan, pelemahan rupiah tetap bisa membuat harga Emas Antam 24K ({ANTAM}/gr) naik.',
        'Inilah salah satu alasan emas sering dipilih sebagai pelindung nilai (hedging) bagi penabung di Indonesia: ketika rupiah melemah, nilai emas dalam rupiah cenderung terjaga.'
      ]
    },
    {
      id: 'n9', cat: 'Makro', asset: 'EURUSD', h: 5, read: 2,
      title: 'EUR/USD di {EURUSD}: Peta Kebijakan Bank Sentral Global',
      summary: 'Pasangan EUR/USD bergerak {chg:EURUSD}. Perbedaan arah kebijakan bank sentral AS dan Eropa menjadi penggerak utama.',
      body: [
        'Pasangan mata uang EUR/USD saat ini berada di {EURUSD}, bergerak {chg:EURUSD}. Sebagai pasangan forex paling likuid di dunia, EUR/USD sering dijadikan indikator kekuatan dolar AS secara global.',
        'Perbedaan suku bunga dan arah kebijakan antara bank sentral AS dan bank sentral Eropa menjadi faktor dominan. Dolar yang menguat secara global biasanya memberi tekanan pada mata uang negara berkembang, termasuk rupiah.',
        'Memahami dinamika forex membantu menjelaskan mengapa harga emas, saham, dan kripto sering bergerak bersamaan mengikuti sentimen dolar AS.'
      ]
    },
    {
      id: 'n10', cat: 'Makro', asset: null, h: 8, read: 4,
      title: 'Inflasi & Daya Beli: Kenapa Kebiasaan Menabung Sejak Muda Sangat Berharga',
      summary: 'Inflasi perlahan menggerus nilai uang tunai. Kombinasi tabungan kas, emas, dan pencatatan arus kas adalah fondasi keuangan yang sehat.',
      body: [
        'Inflasi berarti harga barang dan jasa naik dari waktu ke waktu, sehingga uang tunai dengan jumlah yang sama bisa membeli lebih sedikit di masa depan. Karena itu, menyimpan seluruh uang dalam bentuk tunai tanpa rencana kurang ideal untuk jangka panjang.',
        'Langkah sederhana yang bisa dilakukan: catat setiap pemasukan dan pengeluaran, sisihkan tabungan di awal (bukan dari sisa), dan alokasikan sebagian ke aset pelindung nilai seperti emas. Aturan 50/30/20 — kebutuhan, keinginan, tabungan — bisa disesuaikan untuk uang saku pelajar.',
        'Rasio tersimpan di Dashboard ZashFlow membantumu memantau seberapa besar pemasukan yang berhasil disimpan. Semakin tinggi rasionya, semakin kuat fondasi keuanganmu.'
      ]
    }
  ];

  function fillNews(text) {
    return String(text)
      .replace(/\{chg:([A-Z]+)\}/g, (_, id) => (A[id] ? fmtPct(change24(id)) : ''))
      .replace(/\{SPOTGR\}/g, () => usdFmt(price('XAUUSD') / OZ))
      .replace(/\{([A-Z]+)\}/g, (m, id) => (A[id] ? fmtPrice(id) : m));
  }
  const newsTime = (h) => {
    const d = new Date(Date.now() - h * 3600e3);
    const sameDay = jkt(d).day === jkt().day;
    return `${sameDay ? 'Hari ini' : 'Kemarin'} · ${hmWIB(d)} WIB`;
  };
  const CAT_ICON = { Emas: 'gold', Saham: 'trend', Kripto: 'coins', Makro: 'globe' };

  function newsCardHTML(n, i) {
    return `<article class="card news-card reveal" style="--i:${i}" data-news="${n.id}" tabindex="0" role="button" aria-label="${esc(fillNews(n.title))}">
      <div class="nc-banner cat-${n.cat}">
        <span class="nc-ico">${icon(CAT_ICON[n.cat])}</span>
        <span class="nc-cat">${icon(CAT_ICON[n.cat])}${n.cat}</span>
        ${n.asset ? `<span class="asset-logo">${logo(n.asset)}</span>` : ''}
      </div>
      <div class="nc-body">
        <h4>${esc(fillNews(n.title))}</h4>
        <p>${esc(fillNews(n.summary))}</p>
        <div class="nc-foot"><span>${newsTime(n.h)}</span><span>${n.read} mnt baca</span></div>
      </div>
    </article>`;
  }

  function renderNews() {
    const list = NEWS.filter((n) => state.newsFilter === 'all' || n.cat === state.newsFilter).sort((a, b) => a.h - b.h);
    const [feat, ...rest] = list;
    $('#newsFeatured').innerHTML = feat ? `<article class="card nf-card" data-news="${feat.id}" tabindex="0" role="button">
      <div class="nc-banner cat-${feat.cat}">
        <span class="nc-ico">${icon(CAT_ICON[feat.cat])}</span>
        <span class="nc-cat">${icon('bolt')}Sorotan · ${feat.cat}</span>
        ${feat.asset ? `<span class="asset-logo lg">${logo(feat.asset)}</span>` : ''}
      </div>
      <div class="nc-body">
        <span class="eyebrow">${newsTime(feat.h)}</span>
        <h4>${esc(fillNews(feat.title))}</h4>
        <p>${esc(fillNews(feat.summary))}</p>
        <div class="nc-foot"><span>${feat.read} mnt baca</span><span class="btn btn-ghost btn-sm">Baca ${icon('arrow-right')}</span></div>
      </div>
    </article>` : '';
    $('#newsGrid').innerHTML = rest.map((n, i) => newsCardHTML(n, i + 1)).join('');
  }

  function openNews(id) {
    const n = NEWS.find((x) => x.id === id); if (!n) return;
    const a = n.asset;
    $('#newsModalBody').innerHTML = `
      <div class="nm-banner cat-${n.cat}">
        <span class="nc-ico">${icon(CAT_ICON[n.cat])}</span>
        <span class="nc-cat" style="align-self:flex-start">${icon(CAT_ICON[n.cat])}${n.cat}</span>
        <h3>${esc(fillNews(n.title))}</h3>
        <div class="nm-meta"><span>${newsTime(n.h)}</span><span>·</span><span>${n.read} menit baca</span><span>·</span><span>Redaksi ZashFlow</span></div>
      </div>
      <div class="nm-content">
        ${a ? `<div class="nm-asset"><span class="asset-logo">${logo(a)}</span><div><b>${A[a].sym}</b><small>${A[a].name}</small></div><div style="flex:none;text-align:right"><strong>${fmtPrice(a)}</strong><br><span class="chg ${chgClass(change24(a))}">${fmtPct(change24(a))}</span></div></div>` : ''}
        ${n.body.map((p) => `<p>${esc(fillNews(p))}</p>`).join('')}
        <div class="nm-actions">
          <button class="btn btn-primary ripple read-all-btn" type="button">${icon('book-open')}<span>Read All News</span></button>
          ${a ? `<button class="btn btn-ghost ripple" type="button" data-go="market" data-asset="${a}" data-close-modal>${icon('chart')}<span>Lihat Grafik ${A[a].sym}</span></button>` : ''}
        </div>
        <p class="nm-disclaimer">Harga dalam artikel diperbarui otomatis dari data pasar live ZashFlow. Konten bersifat edukasi, bukan ajakan membeli atau menjual aset.</p>
      </div>`;
    $('#newsModalBody').scrollTop = 0;
    openModal('newsModal');
  }

  function openAllNews(focusId) {
    const list = NEWS.slice().sort((a, b) => a.h - b.h);
    bind('editionDate', `${dateLong()} · ${list.length} artikel · harga live ${market.lastUpdate ? timeWIB(market.lastUpdate) + ' WIB' : ''}`);
    $('#allNewsToc').innerHTML = list.map((n, i) => `<button type="button" data-jump="an-${n.id}">${i + 1}. ${esc(fillNews(n.title).slice(0, 34))}…</button>`).join('');
    $('#allNewsBody').innerHTML = list.map((n) => `
      <article class="an-article" id="an-${n.id}">
        <div class="an-top"><span class="an-cat cat-${n.cat}">${n.cat}</span><span class="an-time">${newsTime(n.h)} · ${n.read} mnt baca</span>${n.asset ? `<span class="chg ${chgClass(change24(n.asset))}">${A[n.asset].sym} ${fmtPct(change24(n.asset))}</span>` : ''}</div>
        <h4>${esc(fillNews(n.title))}</h4>
        ${n.body.map((p) => `<p>${esc(fillNews(p))}</p>`).join('')}
      </article>`).join('') + '<p class="nm-disclaimer">Konten bersifat edukasi, bukan saran investasi. Harga diperbarui dari data pasar live.</p>';
    closeModal('newsModal', true);
    openModal('allNewsModal');
    const body = $('#allNewsBody');
    body.scrollTop = 0;
    if (focusId && NEWS.some((n) => n.id === focusId)) setTimeout(() => { const t = document.getElementById('an-' + focusId); if (t) body.scrollTop = t.offsetTop - body.offsetTop; }, 50);
  }

  function initNews() {
    $('#newsFilters').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      state.newsFilter = b.dataset.cat;
      $$('#newsFilters button').forEach((x) => x.classList.toggle('active', x === b));
      renderNews();
      $$('#view-news .reveal').forEach((el, i) => { el.style.setProperty('--i', i); });
    });
    $('#allNewsToc').addEventListener('click', (e) => {
      const b = e.target.closest('[data-jump]'); if (!b) return;
      const t = document.getElementById(b.dataset.jump); const body = $('#allNewsBody');
      if (t) body.scrollTo({ top: t.offsetTop - body.offsetTop, behavior: 'smooth' });
    });
  }

  /* =========================================================
     MODALS
     ========================================================= */
  let lastFocus = null;
  function openModal(id) {
    const m = document.getElementById(id); if (!m) return;
    if (!$('.modal.open')) lastFocus = document.activeElement;
    m.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('open')));
    document.body.classList.add('modal-open');
  }
  function closeModal(id, instant = false) {
    closeGlassSelect();
    const m = document.getElementById(id); if (!m || m.hidden) return;
    m.classList.remove('open');
    const done = () => {
      m.hidden = true;
      if (!$('.modal.open')) { document.body.classList.remove('modal-open'); if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch { /* noop */ } }
    };
    if (instant) done(); else setTimeout(done, 300);
  }
  const closeAllModals = () => $$('.modal.open').forEach((m) => closeModal(m.id));

  /* =========================================================
     PENCARIAN GLOBAL
     ========================================================= */
  let searchSel = 0, searchItems = [];
  function buildSearchIndex() {
    const idx = [];
    VIEW_ORDER.forEach((v) => idx.push({ kind: 'Halaman', title: VIEWS[v].title, sub: VIEWS[v].sub, icon: { dashboard: 'home', finance: 'wallet', schedule: 'calendar', market: 'chart', news: 'news', settings: 'settings' }[v], run: () => go(v) }));
    idx.push({ kind: 'Fitur', title: 'Pengingat Jadwal Les', sub: 'Notifikasi + suara chime halus khusus jadwal Les', icon: 'bell', keys: 'notif notifikasi pengingat reminder suara chime les ngaji', run: () => { go('schedule', { scroll: 'lesRemindCard' }); } });
    ASSETS.forEach((a) => idx.push({ kind: 'Aset Market', title: a.sym, sub: `${a.name} · ${GROUPS[a.group]}`, logo: a.id, right: fmtPrice(a.id), chg: change24(a.id), keys: `${a.id} ${a.tag} ${a.tv || ''} ${a.yahoo || ''} ${a.binance || ''}`, run: () => { go('market'); selectAsset(a.id, { scroll: true }); } }));
    state.schedule.forEach((list, di) => list.forEach((it) => idx.push({ kind: 'Jadwal Harian', title: it.title, sub: `${DAYS[di]}${it.time ? ' · ' + it.time : ''} · ${(TYPE_META[it.type] || TYPE_META.custom).label}`, icon: (TYPE_META[it.type] || TYPE_META.custom).icon, keys: DAYS[di], run: () => { go('schedule'); setSchedDay(di); } })));
    NEWS.forEach((n) => idx.push({ kind: 'Berita Pasar', title: fillNews(n.title), sub: `${n.cat} · ${fillNews(n.summary)}`, icon: CAT_ICON[n.cat], keys: n.cat + ' ' + n.body.join(' '), run: () => { closeModal('searchModal', true); openNews(n.id); } }));
    return idx;
  }
  const hl = (text, q) => {
    const s = esc(text); if (!q) return s;
    const i = text.toLowerCase().indexOf(q); if (i < 0) return s;
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  };
  function runSearch() {
    const q = $('#searchInput').value.trim().toLowerCase();
    const idx = buildSearchIndex();
    let res;
    if (!q) res = idx.filter((x) => x.kind === 'Halaman' || (x.kind === 'Aset Market' && ['ANTAM', 'XAUUSD', 'BTCUSD', 'BBCA'].includes(x.logo)));
    else {
      const terms = q.split(/\s+/);
      res = idx.map((x) => {
        const hay = `${x.title} ${x.sub} ${x.keys || ''}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return null;
        const score = (x.title.toLowerCase().startsWith(q) ? 0 : x.title.toLowerCase().includes(q) ? 1 : 2) + (x.kind === 'Berita Pasar' ? 0.5 : 0);
        return { ...x, score };
      }).filter(Boolean).sort((a, b) => a.score - b.score).slice(0, 30);
    }
    searchItems = res; searchSel = 0;
    const box = $('#searchResults');
    if (!res.length) { box.innerHTML = `<div class="sr-empty">Tidak ada hasil untuk "<b>${esc(q)}</b>".<br><small>Coba "emas", "BTC", "Rabu", atau "PPA".</small></div>`; return; }
    let html = '', lastKind = '';
    res.forEach((x, i) => {
      if (x.kind !== lastKind) { html += `<div class="sr-group">${q ? x.kind : x.kind === 'Halaman' ? 'Navigasi cepat' : 'Aset populer'}</div>`; lastKind = x.kind; }
      html += `<button class="sr-item ${i === 0 ? 'sel' : ''}" type="button" data-sr="${i}">
        ${x.logo ? `<span class="asset-logo">${logo(x.logo)}</span>` : `<span class="sr-ico">${icon(x.icon || 'search')}</span>`}
        <span class="sr-main"><b>${hl(x.title, q)}</b><small>${esc(x.sub.slice(0, 110))}</small></span>
        ${x.right ? `<span class="sr-right">${esc(x.right)}<span class="chg ${chgClass(x.chg)}">${fmtPct(x.chg)}</span></span>` : ''}
      </button>`;
    });
    box.innerHTML = html;
  }
  function moveSearch(d) {
    if (!searchItems.length) return;
    searchSel = (searchSel + d + searchItems.length) % searchItems.length;
    $$('.sr-item').forEach((b) => b.classList.toggle('sel', Number(b.dataset.sr) === searchSel));
    $(`.sr-item[data-sr="${searchSel}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  function pickSearch(i) {
    const x = searchItems[i]; if (!x) return;
    closeModal('searchModal', true);
    setTimeout(() => x.run(), 30);
  }
  function openSearch() {
    $('#searchInput').value = '';
    runSearch();
    openModal('searchModal');
    setTimeout(() => $('#searchInput').focus(), 60);
  }
  function initSearch() {
    $('#searchInput').addEventListener('input', debounce(runSearch, 80));
    $('#searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSearch(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSearch(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); pickSearch(searchSel); }
    });
    $('#searchResults').addEventListener('click', (e) => { const b = e.target.closest('[data-sr]'); if (b) pickSearch(Number(b.dataset.sr)); });
  }

  /* =========================================================
     INSTALL PWA
     ========================================================= */
  let deferredPrompt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let installEdition = 'zaki';

  function syncInstallEditionUI(who, { syncUrl = true } = {}) {
    installEdition = who === 'niza' ? 'niza' : 'zaki';
    const isN = installEdition === 'niza';
    if (state.user !== installEdition) switchUser(installEdition, { silent: true });
    if (syncUrl && !isStandalone()) {
      try {
        const targetFile = isN ? 'niza.html' : 'index.html';
        const curFile = location.pathname.split('/').pop() || '';
        if (curFile !== targetFile) {
          history.replaceState(null, '', `./${targetFile}${location.hash || '#dashboard'}`);
        }
      } catch { /* noop */ }
    }
    const heroImg = $('#installModal .install-hero img');
    if (heroImg) heroImg.src = isN ? 'icon-pink.svg?v=6' : 'icon.svg?v=6';
    const heroTitle = $('#installModal .install-hero h3');
    if (heroTitle) heroTitle.textContent = isN ? 'Pasang ZashFlow Niza' : 'Pasang ZashFlow';

    const edWrap = $('#installEditions');
    if (edWrap) {
      edWrap.dataset.edition = installEdition;
      $$('[data-install-edition]', edWrap).forEach((b) => b.classList.toggle('active', b.dataset.installEdition === installEdition));
    }
    const btn = $('#installNow');
    if (btn) {
      btn.classList.toggle('btn-pink', isN);
      btn.classList.toggle('btn-blue-fixed', !isN);
      const sp = btn.querySelector('span');
      if (sp) sp.textContent = isN ? 'Pasang Aplikasi Niza (Logo Pink)' : 'Pasang Aplikasi Zaki (Logo Biru)';
    }
    const word = $('#installIconWord');
    if (word) word.textContent = isN ? 'ikon pink ZashFlow' : 'ikon biru ZashFlow';
  }

  function openInstall(targetUser) {
    const want = targetUser === 'niza' || targetUser === 'zaki' ? targetUser : state.user;
    installEdition = want;
    const isN = want === 'niza';

    const editions = `
      <div class="install-editions" id="installEditions" data-edition="${want}" aria-label="Pilih versi logo aplikasi">
        <span class="ie-pill" aria-hidden="true"></span>
        <button type="button" class="ie-card ${!isN ? 'active' : ''}" data-install-edition="zaki">
          <img src="icon-blue-any.png?v=6" alt="Logo Biru" width="36" height="36">
          <span><strong>Versi Zaki</strong><small>Logo Biru</small></span>
        </button>
        <button type="button" class="ie-card ${isN ? 'active' : ''}" data-install-edition="niza">
          <img src="icon-pink-any.png?v=6" alt="Logo Pink" width="36" height="36">
          <span><strong>Versi Niza</strong><small>Logo Pink</small></span>
        </button>
      </div>`;
    const feats = `<div class="install-feats"><div>${icon('bolt')}Super cepat</div><div>${icon('phone')}Layar penuh</div><div>${icon('globe')}2 Warna Tema</div></div>`;
    const note = `<p class="ie-note">Setelah dipasang, tema warna di dalam aplikasi tetap bisa diganti <b>Biru ↔ Pink</b> kapan saja lewat menu ganti pengguna.</p>
      <div class="install-share-row">
        <button class="btn btn-glass btn-sm ripple" type="button" id="copyNizaLink">${icon('share')}<span>Salin Link Download Niza (Pink)</span></button>
      </div>`;
    const iconWord = `<b id="installIconWord">${isN ? 'ikon pink ZashFlow' : 'ikon biru ZashFlow'}</b>`;
    let body;
    if (isStandalone()) {
      body = `<div class="install-ok">${icon('check')}ZashFlow sudah terpasang dan berjalan sebagai aplikasi.</div>${feats}${note}`;
    } else if (deferredPrompt) {
      const btnCls = isN ? 'btn-pink' : 'btn-blue-fixed';
      const btnTxt = isN ? 'Pasang Aplikasi Niza (Logo Pink)' : 'Pasang Aplikasi Zaki (Logo Biru)';
      body = `${editions}${feats}<button class="btn ${btnCls} btn-block btn-lg ripple" type="button" id="installNow">${icon('download')}<span>${btnTxt}</span></button>${note}`;
    } else if (isIOS()) {
      body = `${editions}<div class="steps">
        <div class="step"><span class="step-n">1</span><span>Buka halaman ini di <b>Safari</b>, lalu ketuk tombol <b>Bagikan</b> ${icon('share')}</span></div>
        <div class="step"><span class="step-n">2</span><span>Gulir ke bawah dan pilih <b>Tambah ke Layar Utama</b> ${icon('plus')}</span></div>
        <div class="step"><span class="step-n">3</span><span>Ketuk <b>Tambah</b> — ${iconWord} langsung muncul di layar utama iPhone.</span></div>
      </div>${feats}${note}`;
    } else {
      body = `${editions}<div class="steps">
        <div class="step"><span class="step-n">1</span><span>Buka menu browser (<b>⋮</b>) di Chrome / Edge.</span></div>
        <div class="step"><span class="step-n">2</span><span>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</span></div>
        <div class="step"><span class="step-n">3</span><span>Konfirmasi <b>Instal</b> — ${iconWord} langsung muncul di layar utama.</span></div>
      </div>${feats}${note}`;
    }
    $('#installBody').innerHTML = body;
    syncInstallEditionUI(want);
    openModal('installModal');
  }

  function initInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); deferredPrompt = e;
      document.documentElement.classList.add('can-install');
      if (!$('#installModal').hidden) openInstall(installEdition);
    });
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null; closeModal('installModal');
      toast('ZashFlow berhasil dipasang di perangkat 🎉', { type: 'success' });
    });
    document.addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-install-edition]');
      if (ed) {
        syncInstallEditionUI(ed.dataset.installEdition);
        return;
      }
      if (e.target.closest('#copyNizaLink')) {
        const link = new URL('./niza.html', location.href).href;
        try {
          await navigator.clipboard.writeText(link);
          toast('Link download Niza (logo pink) disalin! Kirim ke HP Niza.', { type: 'success' });
        } catch {
          const ta = document.createElement('textarea');
          ta.value = link; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); toast('Link download Niza (logo pink) disalin!', { type: 'success' }); }
          catch { toast(link, { type: 'info', timeout: 6000 }); }
          ta.remove();
        }
        return;
      }
      if (!e.target.closest('#installNow') || !deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') toast('Memasang ZashFlow…', { type: 'success' });
      } catch { /* noop */ }
      deferredPrompt = null; closeModal('installModal');
    });
  }

  /* =========================================================
     PENGATURAN & MULTI-USER (ZAKI / NIZA)
     ========================================================= */
  const makeBrandSvg = (pink, fullBleed = false) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">' +
    '<defs><linearGradient id="bg" x1=".15" y1=".05" x2=".85" y2=".95">' +
    (pink
      ? '<stop offset="0" stop-color="#ff8ec7"/><stop offset=".52" stop-color="#ff3d9a"/><stop offset="1" stop-color="#db1b77"/>'
      : '<stop offset="0" stop-color="#2299f5"/><stop offset="1" stop-color="#0b55cc"/>') +
    '</linearGradient><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
    '</linearGradient></defs>' +
    `<rect width="512" height="512" rx="${fullBleed ? 0 : 124}" fill="url(#bg)"/>` +
    `<rect width="512" height="256" rx="${fullBleed ? 0 : 124}" fill="url(#g)"/>` +
    '<path fill="#fff" d="M138 228c0-42 34-76 76-76h156c10 0 18 8 18 18v14c0 34-28 62-62 62H156c-10 0-18-8-18-18z"/>' +
    '<path fill="#fff" fill-opacity=".6" d="M374 284c0 42-34 76-76 76H142c-10 0-18-8-18-18v-14c0-34 28-62 62-62h170c10 0 18 8 18 18z"/></svg>'
  );
  const BLUE_ICON_URL = makeBrandSvg(false, false);
  const PINK_ICON_URL = makeBrandSvg(true, false);
  const PINK_BLEED_URL = makeBrandSvg(true, true);
  const BLUE_BLEED_URL = makeBrandSvg(false, true);
  const iconPngCache = new Map();
  let manifestBlobUrl = null;
  let iconUpdateSeq = 0;

  function renderIconPng(src, size) {
    const key = `${src}|${size}`;
    if (iconPngCache.has(key)) return Promise.resolve(iconPngCache.get(key));
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = size; c.height = size;
          c.getContext('2d').drawImage(img, 0, 0, size, size);
          const png = c.toDataURL('image/png');
          iconPngCache.set(key, png);
          resolve(png);
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function applyFaviconLinks(svgHref, pngHref) {
    const head = document.head;
    if (!head) return;
    $$('link[rel="icon"], link[rel="shortcut icon"]', head).forEach((el) => el.remove());
    const mk = (attrs) => {
      const l = document.createElement('link');
      Object.entries(attrs).forEach(([k, v]) => l.setAttribute(k, v));
      head.appendChild(l);
    };
    mk({ id: 'appFavicon', rel: 'icon', type: 'image/svg+xml', href: svgHref });
    if (pngHref) mk({ id: 'appFaviconPng', rel: 'icon', type: 'image/png', sizes: '512x512', href: pngHref });
    mk({ id: 'appShortcutIcon', rel: 'shortcut icon', type: 'image/png', href: pngHref || svgHref });
  }

  function updateBrandIcons() {
    const isNiza = state.user === 'niza';
    const svgSrc = isNiza ? 'icon-pink.svg?v=6' : 'icon.svg?v=6';
    const pngAny = isNiza ? 'icon-pink-any.png?v=6' : 'icon-blue-any.png?v=6';
    const pngApple = isNiza ? 'icon-pink.png?v=6' : 'icon-blue.png?v=6';

    // 1) Semua logo brand di dalam halaman
    $$('img[data-brand-logo]').forEach((img) => {
      if (img.getAttribute('src') !== svgSrc) img.setAttribute('src', svgSrc);
    });

    // 2) Favicon tab browser (di atas domain) & apple-touch-icon (HTTP PNG asli untuk iPhone 16)
    applyFaviconLinks(svgSrc, pngAny);
    const apple = $('#appAppleIcon');
    if (apple) apple.href = pngApple;

    // 3) Manifest PWA HTTPS asli (bukan blob) agar Android WebAPK & Chrome selalu memasang ikon pink/biru dengan benar
    const manEl = $('#appManifest');
    if (manEl) {
      const targetMan = isNiza ? 'manifest-niza.json?v=6' : 'manifest.json?v=6';
      if (manEl.getAttribute('href') !== targetMan) manEl.setAttribute('href', targetMan);
    }
  }

  function updateMetaTheme() {
    const isNiza = state.user === 'niza';
    const col = state.theme === 'dark' ? (isNiza ? '#180412' : '#020b1e') : (isNiza ? '#ffe3f0' : '#eaf4ff');
    const old = $('#metaTheme');
    const m = document.createElement('meta');
    m.id = 'metaTheme';
    m.name = 'theme-color';
    m.content = col;
    if (old) old.replaceWith(m);
    else document.head?.appendChild(m);
  }
  function viewMeta(v) {
    const n = USERS[state.user].name;
    if (v === 'finance') return { title: 'Keuangan & Tabungan Emas', sub: `Arus kas pribadi & tabungan emas 24K ${n}` };
    if (v === 'schedule') return { title: `Jadwal Harian ${n}`, sub: state.user === 'zaki' ? 'Pelajaran, PPA, les & rutinitas vibe coding' : 'Pelajaran, PPA & jadwal les Niza' };
    return VIEWS[v] || VIEWS.dashboard;
  }
  function applyProfile() {
    const u = USERS[state.user] || USERS.zaki;
    state.userName = u.name;
    document.documentElement.setAttribute('data-user', u.id);
    updateMetaTheme();
    updateBrandIcons();
    bind('userName', u.name);
    bind('greeting', `Halo, ${u.name}`);
    bind('avatarInitial', u.initial);
    bind('syncLabel', `Sync Profil ${u.name}`);
    bind('kasTitle', `Kas Pribadi ${u.name}`);
    bind('goldTitle', `Tabungan Emas ${u.name}`);
    bind('txSub', `Pemasukan atau pengeluaran ${u.name}`);
    bind('themeDesc', u.themeDesc);
    const vm = viewMeta(state.view);
    if ($('#viewTitle')) $('#viewTitle').textContent = vm.title;
    if ($('#viewSub')) $('#viewSub').textContent = vm.sub;
    syncSettingsUI();
  }
  function switchUser(id, { silent = false } = {}) {
    if (!hasOwn(USERS, id) || id === state.user) return;
    closeUserPop();
    state.user = id;
    store.set('activeUser', id);
    state.txs = loadTxs(id);
    state.goldIDR = loadGold(id);
    state.schedule = loadSchedule(id);
    state.goldGoal = loadGoldGoal(id);
    state.txFilter = 'all';
    $$('#txFilter button').forEach((b) => b.classList.toggle('active', b.dataset.f === 'all'));
    flowSig = '';
    applyProfile();
    renderFinance();
    renderSchedule();
    hideLesBanner();
    checkLesReminders();
    if (!silent) toast(`Beralih ke pengguna ${USERS[id].name}`, { type: 'success' });
  }
  let userPop = null;
  function closeUserPop() {
    if (!userPop) return;
    userPop.btn.setAttribute('aria-expanded', 'false');
    userPop.menu.classList.remove('open');
    const m = userPop.menu;
    setTimeout(() => m.remove(), 180);
    userPop = null;
  }
  function openUserPop(btn) {
    if (userPop && userPop.btn === btn) { closeUserPop(); return; }
    closeGlassSelect();
    closeUserPop();
    const menu = document.createElement('div');
    menu.className = 'lg-dd-menu user-pop';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `<div class="user-pop-head">Ganti Pengguna</div>`
      + Object.values(USERS).map((u) => `
        <button type="button" class="lg-dd-opt ${u.id === state.user ? 'sel' : ''}" role="menuitemradio" aria-checked="${u.id === state.user}" data-pop-user="${u.id}">
          <span class="uc-av uc-${u.id}">${u.initial}</span>
          <span class="uc-info"><strong>${u.name}</strong></span>
          ${icon('check')}
        </button>`).join('')
      + `<div class="user-pop-sep"></div>
        <button type="button" class="lg-dd-opt user-pop-set" data-pop-settings>${icon('settings')}<span>Pengaturan</span></button>`;
    document.body.appendChild(menu);

    const r = btn.getBoundingClientRect();
    const mw = Math.max(226, menu.offsetWidth);
    const mh = menu.offsetHeight;
    const isBottom = r.top > window.innerHeight / 2;
    menu.style.left = `${clamp(r.left, 12, window.innerWidth - mw - 12)}px`;
    if (isBottom) { menu.classList.add('up'); menu.style.top = `${Math.max(12, r.top - mh - 10)}px`; }
    else { menu.style.top = `${r.bottom + 8}px`; }

    btn.setAttribute('aria-expanded', 'true');
    userPop = { btn, menu };
    requestAnimationFrame(() => menu.classList.add('open'));

    menu.addEventListener('click', (e) => {
      const uBtn = e.target.closest('[data-pop-user]');
      if (uBtn) { switchUser(uBtn.dataset.popUser); return; }
      if (e.target.closest('[data-pop-settings]')) { closeUserPop(); go('settings'); }
    });
  }
  function applyGlass(g, persist = true) {
    state.glass = ['soft', 'liquid', 'ultra'].includes(g) ? g : 'liquid';
    document.documentElement.setAttribute('data-glass', state.glass);
    if (persist) store.set('glass', state.glass);
    syncSettingsUI();
  }
  function applyMotion(on, persist = true) {
    state.motion = !!on;
    document.documentElement.classList.toggle('low-motion', !state.motion);
    if (persist) store.set('motion', state.motion);
    syncSettingsUI();
  }
  function syncSettingsUI() {
    $$('#setThemePills button').forEach((b) => b.classList.toggle('active', b.dataset.setTheme === state.theme));
    $$('#setGlassPills button').forEach((b) => b.classList.toggle('active', b.dataset.setGlass === state.glass));
    $$('#setUserCards [data-pick-user]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.pickUser === state.user)));
    const mt = $('#setMotionToggle'); if (mt) mt.setAttribute('aria-checked', String(state.motion));
    const lt = $('#setLiveToggle'); if (lt) lt.setAttribute('aria-checked', String(state.live));
    const si = $('#setInterval'); if (si) { si.value = String(state.interval); syncGlassSelect(si); }
    const gg = $('#setGoldGoal'); if (gg) { gg.value = String(state.goldGoal); syncGlassSelect(gg); }
    const li = $('#liveInterval'); if (li) { li.value = String(state.interval); syncGlassSelect(li); }
  }
  function initSettings() {
    syncSettingsUI();
    $$('.user-switch-trigger').forEach((btn) => btn.addEventListener('click', (e) => { e.stopPropagation(); openUserPop(btn); }));
    document.addEventListener('click', (e) => {
      if (userPop && !userPop.menu.contains(e.target) && !userPop.btn.contains(e.target)) closeUserPop();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && userPop) closeUserPop(); });
    window.addEventListener('resize', closeUserPop, { passive: true });
    $('#setUserCards')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick-user]'); if (b) switchUser(b.dataset.pickUser);
    });
    $('#setThemePills')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-set-theme]'); if (!b) return;
      applyTheme(b.dataset.setTheme); flowSig = '';
    });
    $('#setGlassPills')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-set-glass]'); if (!b) return;
      applyGlass(b.dataset.setGlass);
      toast(`Mode kaca: ${b.textContent}`, { type: 'success' });
    });
    $('#setMotionToggle')?.addEventListener('click', () => {
      applyMotion(!state.motion);
      toast(state.motion ? 'Efek gerak halus aktif.' : 'Mode hemat baterai aktif.', { type: 'info' });
    });
    $('#setProfileForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const goal = Number($('#setGoldGoal').value) || 0;
      state.goldGoal = goal;
      store.set(uKey('goldGoal'), goal);
      renderFinance({ silentChart: true });
      toast(`Target tabungan emas ${USERS[state.user].name} tersimpan.`, { type: 'success' });
    });
    $('#setLiveToggle')?.addEventListener('click', () => {
      state.live = !state.live; store.set('live', state.live);
      if (state.live) state.countdown = state.interval;
      renderLiveLabels(); renderCountdown(); syncSettingsUI();
      toast(state.live ? 'Auto-refresh pasar aktif.' : 'Auto-refresh pasar dijeda.', { type: state.live ? 'success' : 'info' });
    });
    $('#setInterval')?.addEventListener('change', (e) => {
      state.interval = Number(e.target.value) || 60; store.set('interval', state.interval);
      state.countdown = state.interval;
      const li = $('#liveInterval'); if (li) { li.value = String(state.interval); syncGlassSelect(li); }
      renderCountdown(); syncSettingsUI();
      toast(`Interval auto-refresh: ${e.target.selectedOptions[0].text}`, { type: 'success' });
    });
    $('#setClearMarket')?.addEventListener('click', () => {
      store.del('market'); store.del('antamAnchor');
      initMarketData(); renderMarketAll(); renderFinance({ silentChart: true }); renderNews();
      refreshMarket({ manual: true });
    });
    $('#setExportBtn')?.addEventListener('click', () => {
      const payload = {
        app: 'ZashFlow', exportedAt: new Date().toISOString(),
        user: state.user, userName: state.userName, goldGoal: state.goldGoal, theme: state.theme, glass: state.glass,
        goldIDR: state.goldIDR, txs: state.txs, schedule: state.schedule
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `zashflow-${state.user}-${todayISO()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`Backup data ${USERS[state.user].name} berhasil diunduh.`, { type: 'success' });
    });
    $('#setImportBtn')?.addEventListener('click', () => $('#setImportFile')?.click());
    $('#setImportFile')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
      if (f.size > 1024 * 1024) { toast('Ukuran file backup melebihi batas 1 MB.', { type: 'error' }); return; }
      try {
        const j = JSON.parse(await f.text());
        if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('bad');
        let applied = false;
        if (Array.isArray(j.txs)) { state.txs = sanitizeTxs(j.txs); store.set(uKey('txs'), state.txs); applied = true; }
        if (typeof j.goldIDR === 'number' && Number.isFinite(j.goldIDR) && j.goldIDR >= 0) { state.goldIDR = sanitizeGold(j.goldIDR); store.set(uKey('goldIDR'), state.goldIDR); applied = true; }
        const sched = sanitizeSchedule(j.schedule);
        if (sched) { state.schedule = sched; store.set(uKey('schedule'), sched); applied = true; }
        if (typeof j.goldGoal === 'number') { state.goldGoal = sanitizeGoldGoal(j.goldGoal); store.set(uKey('goldGoal'), state.goldGoal); applied = true; }
        if (j.theme === 'dark' || j.theme === 'light') { applyTheme(j.theme); applied = true; }
        if (['soft', 'liquid', 'ultra'].includes(j.glass)) { applyGlass(j.glass); applied = true; }
        if (!applied) throw new Error('empty');
        applyProfile(); renderFinance(); renderSchedule(); syncSettingsUI();
        toast('Backup data berhasil dipulihkan!', { type: 'success' });
      } catch { toast('File backup JSON tidak valid.', { type: 'error' }); }
    });
    $('#setResetFinance')?.addEventListener('click', () => $('#resetProfile')?.click());
    $('#setResetSchedule')?.addEventListener('click', () => {
      const u = USERS[state.user];
      if (!confirm(`Kembalikan jadwal 7 hari ke bawaan ${u.name}?`)) return;
      const prev = state.schedule;
      state.schedule = defaultSchedule(state.user); store.set(uKey('schedule'), state.schedule); renderSchedule();
      toast(`Jadwal harian ${u.name} dikembalikan ke awal.`, {
        type: 'success', action: 'Urungkan', timeout: 6000,
        onAction: () => { state.schedule = prev; store.set(uKey('schedule'), prev); renderSchedule(); }
      });
    });
  }

  /* =========================================================
     CUSTOM LIQUID GLASS DROPDOWNS (all <select>)
     ========================================================= */
  let openDD = null;
  function closeGlassSelect() {
    if (!openDD) return;
    const { btn, menu } = openDD;
    btn.setAttribute('aria-expanded', 'false');
    menu.classList.remove('open');
    setTimeout(() => menu.remove(), 180);
    openDD = null;
  }
  function syncGlassSelect(sel) {
    if (!sel || !sel._ddBtn) return;
    const opt = sel.selectedOptions?.[0] || sel.options?.[sel.selectedIndex] || sel.options?.[0];
    sel._ddBtn.querySelector('.lg-dd-val').textContent = opt ? opt.textContent : '';
  }
  function openGlassSelect(sel, btn) {
    if (openDD && openDD.sel === sel) { closeGlassSelect(); return; }
    closeGlassSelect();
    const menu = document.createElement('div');
    menu.className = 'lg-dd-menu';
    menu.setAttribute('role', 'listbox');
    const opts = Array.from(sel.options);
    menu.innerHTML = opts.map((o, i) => `
      <button type="button" class="lg-dd-opt ${o.selected ? 'sel' : ''}" role="option" aria-selected="${o.selected}" data-idx="${i}">
        <span>${esc(o.textContent)}</span>${icon('check')}
      </button>`).join('');
    document.body.appendChild(menu);

    const r = btn.getBoundingClientRect();
    const minW = Math.max(r.width, 148);
    menu.style.minWidth = `${minW}px`;
    const mw = Math.min(Math.max(minW, menu.offsetWidth), window.innerWidth - 20);
    menu.style.width = `${mw}px`;
    const left = clamp(r.left + r.width > window.innerWidth - 10 ? r.right - mw : r.left, 10, window.innerWidth - mw - 10);
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const mh = Math.min(menu.scrollHeight + 12, 268);
    const flipUp = spaceBelow < mh && r.top > spaceBelow;
    menu.style.left = `${left}px`;
    if (flipUp) {
      menu.classList.add('up');
      menu.style.top = `${Math.max(10, r.top - mh - 6)}px`;
    } else {
      menu.style.top = `${r.bottom + 6}px`;
    }

    btn.setAttribute('aria-expanded', 'true');
    openDD = { sel, btn, menu, hi: Math.max(0, sel.selectedIndex) };
    requestAnimationFrame(() => menu.classList.add('open'));

    menu.addEventListener('click', (e) => {
      const b = e.target.closest('.lg-dd-opt'); if (!b) return;
      const idx = Number(b.dataset.idx);
      if (sel.selectedIndex !== idx) {
        sel.selectedIndex = idx;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncGlassSelect(sel);
      closeGlassSelect();
      btn.focus();
    });
  }
  function initGlassSelects() {
    $$('.select-wrap select').forEach((sel) => {
      if (sel._ddBtn) { syncGlassSelect(sel); return; }
      const wrap = sel.closest('.select-wrap');
      wrap.classList.add('is-custom');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lg-dd-btn ripple';
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
      btn.innerHTML = `<span class="lg-dd-val"></span>${icon('chev-down', 'lg-dd-chev')}`;
      wrap.appendChild(btn);
      sel._ddBtn = btn;
      sel.tabIndex = -1;
      syncGlassSelect(sel);

      btn.addEventListener('click', (e) => { e.stopPropagation(); openGlassSelect(sel, btn); });
      btn.addEventListener('keydown', (e) => {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && (!openDD || openDD.sel !== sel)) {
          e.preventDefault(); openGlassSelect(sel, btn);
        }
      });
      sel.addEventListener('change', () => syncGlassSelect(sel));
    });
    document.addEventListener('click', (e) => {
      if (openDD && !openDD.menu.contains(e.target) && !openDD.btn.contains(e.target)) closeGlassSelect();
    });
    document.addEventListener('keydown', (e) => {
      if (!openDD) return;
      const opts = $$('.lg-dd-opt', openDD.menu);
      if (e.key === 'Escape') { e.preventDefault(); const b = openDD.btn; closeGlassSelect(); b.focus(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openDD.hi = (openDD.hi + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
        opts.forEach((o, i) => o.classList.toggle('hi', i === openDD.hi));
        opts[openDD.hi]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        opts[openDD.hi]?.click();
      }
    });
    window.addEventListener('scroll', closeGlassSelect, { passive: true });
    window.addEventListener('resize', closeGlassSelect, { passive: true });
  }

  /* =========================================================
     NAVIGASI, SIDEBAR, DOCK
     ========================================================= */
  function placeSbPill() {
    const pill = $('#sbPill'); const item = $(`.sb-item[data-view="${state.view}"]`);
    const grp = item?.closest('.sb-group');
    if (!pill || !grp) return;
    pill.style.transform = `translateY(${grp.offsetTop}px)`;
  }
  function placeDockPill() {
    const dock = $('#dock'); if (!dock) return;
    const i = DOCK_ORDER.indexOf(state.view);
    dock.classList.toggle('on-settings', i < 0);
    if (i >= 0) dock.style.setProperty('--i', String(i));
  }
  let pillTimers = [];
  function syncPills(duration = 320) {
    pillTimers.forEach(clearTimeout); pillTimers = [];
    requestAnimationFrame(placeSbPill);
    if (duration > 60) {
      pillTimers.push(setTimeout(placeSbPill, 150));
      pillTimers.push(setTimeout(placeSbPill, Math.max(300, duration)));
    }
    placeDockPill();
  }

  function revealView(sec) {
    $$('.reveal', sec).forEach((el, i) => el.style.setProperty('--i', String(Math.min(i, 10))));
    sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter');
  }

  function go(view, opts = {}) {
    closeGlassSelect();
    closeUserPop();
    if (!VIEW_ORDER.includes(view)) view = 'dashboard';
    const changed = view !== state.view;
    state.view = view;
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
    $$('.sb-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    $$('.dock-item').forEach((b) => { b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'); });
    $$('.settings-mbtn').forEach((b) => b.classList.toggle('active', view === 'settings'));
    if (view === 'settings') syncSettingsUI();
    const vm = viewMeta(view);
    $('#viewTitle').textContent = vm.title;
    $('#viewSub').textContent = vm.sub;
    document.title = view === 'dashboard' ? 'ZashFlow' : `${vm.title} · ZashFlow`;
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);

    // Akordeon sidebar: buka sub-menu dari halaman aktif
    if (!state.collapsed) $$('.sb-group').forEach((g) => g.classList.toggle('open', g.classList.contains('has-sub') && !!g.querySelector(`.sb-item[data-view="${view}"]`)));
    syncPills();

    const sec = $(`#view-${view}`);
    if (changed && document.body.classList.contains('ready')) revealView(sec);
    if (changed && !opts.scroll) window.scrollTo(0, 0);

    if (view === 'market') { chartKey = ''; requestAnimationFrame(() => renderMainChart(true)); }
    if (view === 'dashboard') requestAnimationFrame(drawFlowChart);
    if (view === 'schedule') {
      syncTodayRollover();
      requestAnimationFrame(() => centerActiveDayTab(false));
      setTimeout(() => centerActiveDayTab(false), 120);
      setTimeout(() => centerActiveDayTab(false), 320);
    }
    if (opts.scroll) setTimeout(() => {
      const target = document.getElementById(opts.scroll);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (opts.scroll === 'goldPanel') setTimeout(() => $('#goldInput')?.focus({ preventScroll: true }), 260);
    }, changed ? 120 : 10);
  }

  function setCollapsed(c, animate = true) {
    state.collapsed = c; store.set('sbCollapsed', c);
    const sb = $('#sidebar');
    if (!animate) sb.classList.add('no-anim');
    document.documentElement.classList.remove('sb-pre-collapsed');
    sb.classList.toggle('collapsed', c);
    if (c) $$('.sb-group').forEach((g) => g.classList.remove('open'));
    else $$('.sb-group').forEach((g) => g.classList.toggle('open', g.classList.contains('has-sub') && !!g.querySelector(`.sb-item[data-view="${state.view}"]`)));
    const t = $('#sbToggle');
    t.setAttribute('aria-label', c ? 'Perbesar sidebar' : 'Perkecil sidebar');
    if (!animate) requestAnimationFrame(() => sb.classList.remove('no-anim'));
    syncPills(600);
    setTimeout(onResize, 520);
  }

  /* =========================================================
     TEMA & PERANGKAT
     ========================================================= */
  function applyTheme(t, persist = true) {
    state.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    if (persist) store.set('theme', t);
    updateMetaTheme();
    if (state.user === 'niza') updateBrandIcons();
    $$('.theme-btn use').forEach((u) => u.setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon'));
    $$('.theme-btn').forEach((b) => b.setAttribute('title', t === 'dark' ? 'Mode Terang' : 'Mode Gelap'));
    syncSettingsUI();
  }

  function detectMobile() {
    const ua = navigator.userAgent || '';
    const mUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const coarse = window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
    const w = window.innerWidth;
    return mUA || w < 1024 || (coarse && w < 1280);
  }
  function applyDevice() {
    const m = detectMobile();
    const changed = m !== state.isMobile;
    state.isMobile = m;
    const r = document.documentElement.classList;
    r.toggle('is-mobile', m); r.toggle('is-desktop', !m);
    return changed;
  }

  const onResize = debounce(() => {
    applyDevice();
    flowSig = '';
    drawFlowChart(false);
    if (state.view === 'market') renderMainChart();
    if (state.view === 'schedule') centerActiveDayTab(false);
    syncPills(50);
  }, 140);

  /* =========================================================
     EVENTS GLOBAL
     ========================================================= */
  function initGlobalEvents() {
    // Navigasi delegasi
    document.addEventListener('click', (e) => {
      const t = e.target;
      const sbItem = t.closest('.sb-item');
      if (sbItem) {
        const grp = sbItem.closest('.sb-group');
        if (t.closest('.sb-caret') && grp.classList.contains('has-sub') && !state.collapsed) {
          grp.classList.toggle('open'); syncPills(450); return;
        }
        go(sbItem.dataset.view); return;
      }
      const dockItem = t.closest('.dock-item');
      if (dockItem) { go(dockItem.dataset.view); return; }

      if (t.closest('[data-close]')) { const m = t.closest('.modal'); if (m) closeModal(m.id); return; }

      const goEl = t.closest('[data-go]');
      if (goEl) {
        e.preventDefault();
        if (goEl.hasAttribute('data-close-modal')) closeAllModals();
        go(goEl.dataset.go, { scroll: goEl.dataset.scroll });
        if (goEl.dataset.day) setSchedDay(goEl.dataset.day);
        if (goEl.dataset.asset) selectAsset(goEl.dataset.asset, { scroll: true });
        return;
      }
      const assetEl = t.closest('.wl-item[data-asset]');
      if (assetEl) { selectAsset(assetEl.dataset.asset, { scroll: true }); return; }

      const newsEl = t.closest('[data-news]');
      if (newsEl) { openNews(newsEl.dataset.news); return; }
      if (t.closest('.read-all-btn')) {
        const cur = $('#newsModal').hidden ? null : NEWS.find((n) => $('#newsModalBody h3')?.textContent === fillNews(n.title))?.id;
        openAllNews(cur); return;
      }
      if (t.closest('.search-btn')) { openSearch(); return; }
      if (t.closest('.refresh-btn')) { refreshMarket({ manual: true }); return; }
      if (t.closest('.theme-btn')) { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); flowSig = ''; return; }
      const instBtn = t.closest('.install-btn');
      if (instBtn) { openInstall(instBtn.dataset.installFor); return; }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if ($('#searchModal').hidden) openSearch(); else closeModal('searchModal'); return; }
      if (e.key === 'Escape') { closeAllModals(); return; }
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
      if (e.key === '/' && !typing && !$('.modal.open')) { e.preventDefault(); openSearch(); return; }
      if (e.key === 'Enter' && document.activeElement?.matches('[data-news], .sb-antam')) document.activeElement.click();
    });

    $('#sbToggle').addEventListener('click', () => setCollapsed(!state.collapsed));
    $('#sbNav').addEventListener('scroll', placeSbPill, { passive: true });
    $('#sbNav').addEventListener('transitionend', (e) => { if (e.propertyName === 'grid-template-rows') placeSbPill(); });

    $('#syncBtn').addEventListener('click', async () => {
      const b = $('#syncBtn'); if (b.classList.contains('spinning')) return;
      b.classList.add('spinning');
      await Promise.all([refreshMarket(), sleep(700)]);
      b.classList.remove('spinning');
      const f = calc();
      toast(`Profil ${USERS[state.user].name} tersinkron • Total ${fmtRp(f.total)} • Emas ${fmtGram(f.grams)} gr`, { type: 'success' });
    });

    $('#rangePills').addEventListener('click', (e) => {
      const b = e.target.closest('[data-range]'); if (!b) return;
      state.range = b.dataset.range;
      $$('#rangePills button').forEach((x) => x.classList.toggle('active', x === b));
      renderMainChart(true);
    });

    $('#livePause').addEventListener('click', () => {
      state.live = !state.live; store.set('live', state.live);
      if (state.live) state.countdown = state.interval;
      renderLiveLabels(); renderCountdown(); syncSettingsUI();
      toast(state.live ? `Auto-refresh aktif • setiap ${$('#liveInterval').selectedOptions[0].text}` : 'Auto-refresh dijeda', { type: state.live ? 'success' : 'info' });
    });
    $('#liveInterval').value = String(state.interval);
    $('#liveInterval').addEventListener('change', (e) => {
      state.interval = Number(e.target.value) || 60; store.set('interval', state.interval);
      state.countdown = state.interval; renderCountdown(); syncSettingsUI();
    });

    // Ripple liquid
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.ripple'); if (!el || el.disabled) return;
      const r = el.getBoundingClientRect(); const size = Math.max(r.width, r.height) * 2.2;
      const w = document.createElement('span');
      w.className = 'ripple-wave';
      w.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      el.appendChild(w); setTimeout(() => w.remove(), 700);
    }, { passive: true });

    // Bias cahaya kursor (desktop, rAF-throttled khusus sidebar agar super halus)
    let sheenRaf = 0;
    $('#sidebar')?.addEventListener('pointermove', (e) => {
      if (state.isMobile || e.pointerType !== 'mouse' || sheenRaf) return;
      const sb = e.currentTarget;
      const cx = e.clientX, cy = e.clientY;
      sheenRaf = requestAnimationFrame(() => {
        sheenRaf = 0;
        const r = sb.getBoundingClientRect();
        sb.style.setProperty('--mx', `${cx - r.left}px`);
        sb.style.setProperty('--my', `${cy - r.top}px`);
      });
    }, { passive: true });

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS[v] && v !== state.view) go(v); });
    window.addEventListener('online', () => { market.online = true; toast('Kembali online — memperbarui harga…', { type: 'success' }); refreshMarket(); });
    window.addEventListener('offline', () => { market.online = false; renderLiveLabels(); toast('Offline — data tetap tersedia dari cache.', { type: 'warn' }); });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        syncTodayRollover();
        checkLesReminders();
        if (state.view === 'schedule') requestAnimationFrame(() => centerActiveDayTab(false));
        if (state.live && market.lastUpdate && Date.now() - market.lastUpdate.getTime() > state.interval * 1000) refreshMarket();
      }
    });
    window.addEventListener('pageshow', () => {
      syncTodayRollover();
      if (state.view === 'schedule') requestAnimationFrame(() => centerActiveDayTab(false));
    });

    // Pergantian hari (jadwal hari ini otomatis geser setiap hari)
    setInterval(syncTodayRollover, 60e3);
  }

  /* ---------- Live timer ---------- */
  function startTicker() {
    setInterval(() => {
      if (!state.live || market.loading) { renderCountdown(); return; }
      if (document.hidden) return;
      state.countdown = Math.max(0, state.countdown - 1);
      renderCountdown();
      if (state.countdown <= 0) refreshMarket();
    }, 1000);
  }

  /* =========================================================
     SPLASH
     ========================================================= */
  function initSplash() {
    const splash = $('#splash');
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      if (splash) { splash.classList.add('out'); setTimeout(() => splash.remove(), 900); }
      document.body.classList.remove('pre');
      document.body.classList.add('ready');
      const t = $('.ticker'); if (t) { t.classList.add('enter'); }
      revealView($(`#view-${state.view}`));
      if (state.view === 'schedule') requestAnimationFrame(() => centerActiveDayTab(false));
      syncPills(100);
    };
    if (!splash) { finish(); return; }
    splash.addEventListener('click', finish);
    const minShow = 1700;
    const t0 = performance.now();
    const onLoad = () => setTimeout(finish, Math.max(250, minShow - (performance.now() - t0)));
    if (document.readyState === 'complete') onLoad(); else window.addEventListener('load', onLoad, { once: true });
    setTimeout(finish, 3800); // failsafe — splash tidak pernah stuck
  }

  /* =========================================================
     SERVICE WORKER
     ========================================================= */
  function registerSW() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
        reg.update().catch(() => {});
      }).catch(() => { /* SW opsional */ });
    });
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    applyDevice();
    applyTheme(state.theme, false);
    applyGlass(state.glass, false);
    applyMotion(state.motion, false);
    applyProfile();
    $$('[data-logo]').forEach((el) => { el.innerHTML = logo(el.dataset.logo); });

    initMarketData();
    initFinance();
    initSchedule();
    initLesReminders();
    initNews();
    initSearch();
    initInstall();
    initSettings();
    initGlassSelects();
    initGlobalEvents();
    attachChartHover($('#mainChart'));

    setCollapsed(state.collapsed, false);
    const startView = location.hash.slice(1);
    state.view = '';
    go(VIEWS[startView] ? startView : 'dashboard');

    renderFinance();
    renderSchedule();
    renderNews();
    renderMarketAll();
    renderCountdown();
    initSplash();
    startTicker();
    registerSW();
    refreshMarket();
    const qp = installParam();
    if (qp) {
      try { history.replaceState(null, '', location.pathname + (location.hash || '#dashboard')); } catch { /* noop */ }
      setTimeout(() => openInstall(), 600);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
