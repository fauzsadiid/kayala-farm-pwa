import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update } from "firebase/database";

// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC87ft_44xEx7mQiGNVK9V2ZEOIHEzJwKU",
  authDomain: "kayala-ops.firebaseapp.com",
  databaseURL: "https://kayala-ops-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kayala-ops",
  storageBucket: "kayala-ops.firebasestorage.app",
  messagingSenderId: "796816636214",
  appId: "1:796816636214:web:fcf9f585b33628ff5fdb97",
  measurementId: "G-2YM8EQPPYN",
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const INITIAL_PRODUCTION = [];
const INITIAL_CASHFLOW = [];
const INITIAL_DELIVERIES = [];
const INITIAL_OPERASIONAL = [];
const INITIAL_ACTIVITIES = [];
const INITIAL_STOK_BARANG = [
  { id: 1, nama: "Telur Ayam", satuan: "Butir", jumlah: 0, minStok: 50 },
  { id: 2, nama: "Karton Isi 10", satuan: "Pcs", jumlah: 0, minStok: 10 },
  { id: 3, nama: "Karton Isi 4", satuan: "Pcs", jumlah: 0, minStok: 10 },
];
const INITIAL_STOK_PAKAN = { japfaKg: 0, flaxGram: 0, oilMl: 0 };
const DEFAULT_HARGA = {
  "Telur Ayam Koloni Isi 10 Butir": 30000,
  "Telur Ayam Koloni Isi 4 Butir": 14000,
  "Telur Ayam Koloni Kiloan": 35000,
  "Paket Hampers Telur Eksklusif": 35000,
};

const DEFAULT_MASTER_PRODUK = [
  {
    id: 1,
    name: "Telur Ayam Koloni Isi 10 Butir",
    type: "Pcs",
    price: 30000,
    isiTelur: 10,
    active: true,
  },
  {
    id: 2,
    name: "Telur Ayam Koloni Isi 4 Butir",
    type: "Pcs",
    price: 14000,
    isiTelur: 4,
    active: true,
  },
  {
    id: 3,
    name: "Telur Ayam Koloni Kiloan",
    type: "Kg",
    price: 35000,
    isiTelur: 0,
    active: true,
  },
  {
    id: 4,
    name: "Paket Hampers Telur Eksklusif",
    type: "Pcs",
    price: 35000,
    isiTelur: 12,
    active: true,
  },
];
const DEFAULT_ACTIVE_PRODUCT =
  DEFAULT_MASTER_PRODUK.find((p) => p.active !== false)?.name ||
  DEFAULT_MASTER_PRODUK[0]?.name ||
  "";
const INITIAL_PELANGGAN = [];
const INITIAL_PAKAN_JADWAL = {
  pagi: { japfaKg: 2.4, flaxGram: 24, oilMl: 12 },
  sore: { japfaKg: 3.6, flaxGram: 36, oilMl: 18 },
  updatedAt: "",
};

const INITIAL_VENDOR_LINKS = [];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function formatCompact(num) {
  const val = parseInt(num) || 0;
  if (Math.abs(val) >= 1000000) {
    return `${(val / 1000000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }
  if (Math.abs(val) >= 1000) {
    return `${(val / 1000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} rb`;
  }
  return `${val.toLocaleString("id-ID")}`;
}
function formatNominal(num) {
  const val = Math.trunc(Number(num) || 0);
  return val.toLocaleString("id-ID");
}
function formatTakaran(num) {
  const val = Number(num) || 0;
  return String(val);
}
function formatRupiah(num) {
  return `Rp ${formatNominal(num)}`;
}
function formatToK(num) {
  return formatCompact(num);
}
function buildHargaMapFromProduk(list = []) {
  const map = {};
  list.forEach((p) => {
    if (p && p.name) map[p.name] = parseInt(p.price) || 0;
  });
  return map;
}

function normalizeOutboundLink(link = "") {
  const raw = String(link || "").trim();
  if (!raw) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return raw;
  return raw.startsWith("//") ? `https:${raw}` : `https://${raw}`;
}
function openOutboundLink(link = "") {
  const url = normalizeOutboundLink(link);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function getProdukHargaByNama(nama, hargaMap = {}, produkList = []) {
  if (!nama) return 0;
  const fromMap = hargaMap?.[nama];
  if (fromMap !== undefined && fromMap !== null && fromMap !== "") {
    return parseInt(fromMap) || 0;
  }
  const fromList = (produkList || []).find((p) => p?.name === nama);
  if (fromList) return parseInt(fromList.price) || 0;
  return parseInt(DEFAULT_HARGA[nama]) || 0;
}

function getProdukAktifPertama(list = []) {
  const active = list.find((p) => p?.active !== false);
  return active?.name || list[0]?.name || DEFAULT_ACTIVE_PRODUCT || "";
}

const QUICK_HARVEST_LABEL = "🥚 Panen Cepat";
function isQuickHarvestCategory(kandang = "") {
  return kandang.includes("Panen Cepat") || kandang.includes("Belum Sortir");
}
function isSpecificEggCategory(kandang = "") {
  return (
    kandang.includes("Jumbo") ||
    kandang.includes("Ideal") ||
    kandang.includes("Sedang") ||
    kandang.includes("Kecil")
  );
}
function isCacatEggCategory(kandang = "") {
  return kandang.includes("Cacat") || kandang.includes("BS");
}
function summarizeEggEntries(entries = []) {
  const quick = entries.reduce(
    (sum, r) =>
      isQuickHarvestCategory(r.kandang) ? sum + (parseInt(r.jumlah) || 0) : sum,
    0
  );
  const specific = entries.reduce(
    (sum, r) =>
      isSpecificEggCategory(r.kandang) ? sum + (parseInt(r.jumlah) || 0) : sum,
    0
  );
  const loss = entries.reduce(
    (sum, r) =>
      isCacatEggCategory(r.kandang) ? sum + (parseInt(r.jumlah) || 0) : sum,
    0
  );
  const hasSpecific = specific > 0;
  const total = Math.max(0, (hasSpecific ? specific : quick) - loss);
  return { quick, specific, loss, total, hasSpecific };
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function formatDateTimeShort(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function makeInvoiceCode(dateStr, id) {
  const clean = String(dateStr || todayStr()).replace(/-/g, "");
  const suffix = String(id || Date.now()).slice(-4);
  return `INV-KV3-${clean}-${suffix}`;
}
function classNames(...args) {
  return args.filter(Boolean).join(" ");
}

function ActivityDot({ color }) {
  return (
    <span
      className={`kyl-activity-dot kyl-activity-dot--${color || "neutral"}`}
      aria-hidden="true"
    />
  );
}

const KAYALA_ICON_PATHS = {
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V20h5v-6h2v6h5V9.5" />
    </>
  ),
  egg: (
    <>
      <path d="M12 4.2c3.8 0 6.5 4.6 6.5 8.8 0 3.5-2.4 6.4-6.5 6.4S5.5 16.5 5.5 13C5.5 8.8 8.2 4.2 12 4.2Z" />
      <path d="M9.5 13.2c.5 1.1 1.4 1.8 2.5 1.8s2-.7 2.5-1.8" />
    </>
  ),
  wallet: (
    <>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 17.5V8.5Z" />
      <path d="M17 13h4" />
      <circle cx="19" cy="13" r="1" />
    </>
  ),
  truck: (
    <>
      <path d="M3 7h11v10H3z" />
      <path d="M14 9h3.2L21 13v4h-7" />
      <circle cx="7.5" cy="18.5" r="2" />
      <circle cx="17.5" cy="18.5" r="2" />
    </>
  ),
  box: (
    <>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
      <path d="M3 7.5V16.5L12 21l9-4.5V7.5" />
      <path d="M12 12v9" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16.5 16.5 5 5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),
  moon: (
    <path d="M20 14.5A7.5 7.5 0 0 1 9.5 4 7.5 7.5 0 1 0 20 14.5Z" />
  ),
  alert: (
    <>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20V7" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3 13.5 8.5 19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
      <path d="M5 4.5 5.8 7 8 7.8 5.8 8.6 5 11 4.2 8.6 2 7.8 4.2 7 5 4.5Z" />
      <path d="M18 15.5 18.6 17.5 20.5 18.1 18.6 18.7 18 20.7 17.4 18.7 15.5 18.1 17.4 17.5 18 15.5Z" />
    </>
  ),
  chevronRight: <path d="m9 6 6 6-6 6" />,
};

function KylIcon({ name, title, size = "md" }) {
  return (
    <svg
      className={classNames("kyl-svg-icon", size !== "md" && `kyl-svg-icon--${size}`)}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {KAYALA_ICON_PATHS[name] || KAYALA_ICON_PATHS.home}
    </svg>
  );
}

const PAGE_HEADERS = {
  produksi: {
    title: "Produksi Telur",
    desc: "Catat panen harian per gramasi dan kategori",
    icon: "egg",
  },
  cashflow: {
    title: "Keuangan",
    desc: "Kas masuk, keluar, dan ringkasan laba",
    icon: "wallet",
  },
  delivery: {
    title: "Pesanan",
    desc: "Antrean pesanan, packing, dan pengiriman",
    icon: "truck",
  },
  stok: {
    title: "Stok & Pakan",
    desc: "Inventaris barang, pakan, dan nutrisi",
    icon: "box",
  },
  more: {
    title: "Pengaturan",
    desc: "Konfigurasi kandang dan master data",
    icon: "more",
  },
  omega: {
    title: "Panduan Omega-3",
    desc: "Standar nutrisi dan SOP KAYALA FARM",
    icon: "sparkles",
  },
};

function PageHeader({ pageId }) {
  const meta = PAGE_HEADERS[pageId];
  if (!meta) return null;
  return (
    <header className="kyl-page-header">
      <div className="kyl-page-header-icon" aria-hidden="true">
        <KylIcon name={meta.icon} title={meta.title} size="lg" />
      </div>
      <div className="kyl-page-header-copy">
        <h2 className="kyl-page-header-title">{meta.title}</h2>
        <p className="kyl-page-header-desc">{meta.desc}</p>
      </div>
    </header>
  );
}

function BrandSocialIcon({ type }) {
  if (type === "instagram") {
    return (
      <span className="kyl-social-icon kyl-social-icon--ig" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            rx="4.5"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <circle
            cx="12"
            cy="12"
            r="3.5"
            stroke="currentColor"
            strokeWidth="1.75"
          />
          <circle cx="16.8" cy="7.2" r="0.85" fill="currentColor" />
        </svg>
      </span>
    );
  }
  return (
    <span className="kyl-social-icon kyl-social-icon--wa" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3.5c-4.42 0-8 3.36-8 7.5 0 1.64.6 3.16 1.62 4.38L4.5 20.5l5.02-1.31A7.82 7.82 0 0 0 12 18.5c4.42 0 8-3.36 8-7.5s-3.58-7.5-8-7.5Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d="M9.8 9.2c.12-.28.52-.3.68-.3.14 0 .34.02.5.22.16.2.62.92.68 1.08.06.16.08.3-.02.46-.1.16-.14.24-.26.36-.12.12-.24.26-.3.38-.06.12-.04.22.04.36.08.14.56 1.02 1.18 1.34.82.48.98.4 1.14-.08.16-.48.34-.48.56-.18.22 1 .58 1.18.68.18.1.28.16.32.24.04.08.04.36-.08.7"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

const ISLAMIC_REMINDERS = [
  {
    tag: "Niat",
    arabic: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
    title: "Awali pekerjaan dengan niat yang lurus.",
    text: "Setiap catatan, pelayanan, dan keputusan akan bernilai lebih ketika dimulai karena Allah dan dijalankan dengan amanah.",
    ref: "HR. Bukhari dan Muslim",
  },
  {
    tag: "Syukur",
    arabic: "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ",
    title: "Syukur membuka jalan tambahan nikmat.",
    text: "Rawat rezeki hari ini dengan jujur, teliti, dan tidak meremehkan kebaikan kecil.",
    ref: "QS. Ibrahim: 7",
  },
  {
    tag: "Takwa",
    arabic: "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا",
    title: "Takwa memberi jalan keluar.",
    text: "Saat pekerjaan terasa padat, jaga kejujuran dan kesabaran. Allah membukakan jalan dari arah yang tidak disangka.",
    ref: "QS. At-Talaq: 2-3",
  },
  {
    tag: "Kemudahan",
    arabic: "يَسِّرُوا وَلَا تُعَسِّرُوا",
    title: "Mudahkan, jangan mempersulit.",
    text: "Bangun layanan yang menenangkan. Beri kabar baik, jaga tutur kata, dan selesaikan urusan dengan lembut.",
    ref: "HR. Bukhari dan Muslim",
  },
  {
    tag: "Sedekah",
    arabic: "تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ صَدَقَةٌ",
    title: "Senyum juga termasuk sedekah.",
    text: "Mulai hari dengan wajah yang ramah. Kebaikan sederhana sering menjadi pembuka keberkahan kerja.",
    ref: "HR. Tirmidzi",
  },
  {
    tag: "Sabar",
    arabic: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
    title: "Allah bersama orang-orang yang sabar.",
    text: "Ambil keputusan dengan tenang. Data yang rapi, hati yang sabar, dan ikhtiar yang bersih membuat kerja lebih berkah.",
    ref: "QS. Al-Baqarah: 153",
  },
];

function getRandomIslamicReminder() {
  return ISLAMIC_REMINDERS[Math.floor(Math.random() * ISLAMIC_REMINDERS.length)] || ISLAMIC_REMINDERS[0];
}

function FridayBanner() {
  if (new Date().getDay() !== 5) return null;
  return (
    <div className="kyl-sedekah-banner no-print">
      <h3>🤲 Jumat Berkah</h3>
      <p>
        Alhamdulillah hari ini Jumat. Jangan lupa sisihkan{" "}
        <strong>Sedekah Telur</strong> sebagai wujud syukur agar rezeki semakin
        lapang dan kandang semakin berkah.
      </p>
    </div>
  );
}

// ─── GLOBAL DESIGN SYSTEM ─────────────────────────────────────────────────────
const KAYALA_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&display=swap');

  :root {
    --bg:#07090b; --surface:#0d1117; --surface2:#131920; --surface3:#1a2230;
    --border:rgba(255,255,255,0.07); --border2:rgba(255,255,255,0.04);
    --primary:#16a360; --primary-d:#0a5c38; --primary-l:#34d468;
    --primary-glow:rgba(22,163,96,0.18);
    --gold:#c8a84b; --gold-l:#f0c060; --gold-glow:rgba(200,168,75,0.12);
    --brown:#8b5e3c; --brown-d:#5c3a20; --brown-l:#c8956a;
    --brown-glow:rgba(139,94,60,0.18);
    --indigo:#5a70e8; --indigo-glow:rgba(90,112,232,0.18);
    --red:#ff3b30; --amber:#f59e0b; --teal:#0891b2;
    --text:#f0f0f4; --text2:#8e8e93; --text3:#48484a;
    --safe-bottom:env(safe-area-inset-bottom,0px);
    --safe-top:env(safe-area-inset-top,0px);
    --r:18px; --rsm:13px; --rpill:99px;
    --font:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    --mono:'JetBrains Mono','SF Mono',monospace;
    --ar:'Noto Naskh Arabic',serif;
  }
  .kyl-light {
    --bg:#f2f2f7; --surface:#fff; --surface2:#f8f8fb; --surface3:#efeff4;
    --border:rgba(0,0,0,0.08); --border2:rgba(0,0,0,0.04);
    --primary:#0f6e45; --primary-d:#0a5535; --primary-l:#1a9e65;
    --primary-glow:rgba(15,110,69,0.12);
    --gold:#a07c10; --gold-l:#c89b18; --gold-glow:rgba(160,124,16,0.08);
    --brown:#6e4e36; --brown-d:#4a3525; --brown-l:#9b7255;
    --brown-glow:rgba(110,78,54,0.12);
    --indigo:#3a52d4; --indigo-glow:rgba(58,82,212,0.12);
    --text:#1a1a1c; --text2:#48484a; --text3:#8e8e93;
  }

  *,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0}
  html,body{font-family:var(--font);background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;transition:background .25s,color .25s}
  html{scroll-behavior:smooth}

  .kyl-app{min-height:100svh;display:flex;justify-content:center;background:var(--bg);padding-top:var(--safe-top)}
  .kyl-wrap{width:100%;max-width:440px;padding:0 16px calc(var(--safe-bottom) + 104px);position:relative}

  /* ── BISMILLAH ── */
  .kyl-bismillah{text-align:center;padding:14px 0 11px;border-bottom:.5px solid var(--border2)}
  .kyl-bismillah-label{display:block;font-size:7px;letter-spacing:.28em;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:4px}
  .kyl-bismillah-ar{font-family:var(--ar);font-size:16px;color:var(--text2);line-height:1.7}

  /* ── BRAND ── */
  .kyl-brand{text-align:center;margin:14px 0 10px}
  .kyl-brand-pill{display:inline-block;background:linear-gradient(135deg,var(--gold-glow),transparent);border:.5px solid rgba(200,168,75,.22);border-radius:var(--r);padding:10px 22px 9px;margin-bottom:10px}
  .kyl-brand-name{display:block;font-size:11.5px;font-weight:900;letter-spacing:.24em;text-transform:uppercase;color:var(--gold)}
  .kyl-brand-owner{display:block;font-size:7.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);opacity:.75;margin-top:2px}
  .kyl-brand-strain{display:block;font-size:9px;color:var(--text2);font-weight:500;margin-top:4px;letter-spacing:.04em}
  .kyl-app-title{font-size:26px;font-weight:900;letter-spacing:-.6px;color:var(--text);margin-bottom:6px;line-height:1}
  .kyl-sync-badge{display:inline-flex;align-items:center;gap:6px;justify-content:center}
  .kyl-pulse{animation:kylPulse 1.5s infinite}
  @keyframes kylPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}
  .kyl-pulse-dot{width:7px;height:7px;border-radius:50%;background:var(--primary-l)}
  .kyl-sync-text{font-family:var(--mono);font-size:8px;font-weight:700;color:var(--primary-l);text-transform:uppercase;letter-spacing:.14em}

  /* ── SOCIAL ── */
  .kyl-social{display:flex;gap:10px;justify-content:center;margin:14px 0 8px}
  .kyl-social-btn{display:flex;align-items:center;gap:10px;padding:8px 16px;border-radius:var(--rpill);border:.5px solid var(--border);background:var(--surface);color:var(--text2);font-size:11px;font-weight:700;text-decoration:none;transition:background .15s;line-height:1}
  .kyl-social-btn:active{opacity:.7}

  /* ── CLOCK CARD ── */
  .kyl-clock-card{background:linear-gradient(135deg,var(--primary-d) 0%,var(--primary) 55%,#2ac870 100%);border-radius:22px;padding:22px 20px 20px;margin-bottom:10px;color:#fff;box-shadow:0 8px 32px var(--primary-glow),0 2px 12px rgba(0,0,0,.25);position:relative;overflow:hidden;text-align:center}
  .kyl-clock-card::before{content:'';position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.06)}
  .kyl-clock-card::after{content:'';position:absolute;bottom:-20px;left:20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.04)}
  .kyl-clock-greeting{font-size:12px;font-weight:700;opacity:.85;margin-bottom:4px}
  .kyl-clock-time{font-family:var(--mono);font-size:clamp(48px,13vw,68px);font-weight:800;letter-spacing:-2px;line-height:1;margin:6px 0 4px}
  .kyl-clock-date{font-size:11.5px;opacity:.78;font-weight:500;letter-spacing:.02em}
  .kyl-live-badge{position:absolute;top:14px;right:16px;display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.15);border-radius:var(--rpill);padding:4px 10px;backdrop-filter:blur(8px)}
  .kyl-live-dot{width:6px;height:6px;border-radius:50%;background:#fff}
  .kyl-live-text{font-family:var(--mono);font-size:7.5px;font-weight:700;color:#fff;letter-spacing:.1em}

  /* ── SEDEKAH BANNER (CENTERED) ── */
  .kyl-sedekah-banner{background:linear-gradient(135deg,rgba(200,168,75,.15),rgba(200,168,75,.04));border:.5px solid rgba(200,168,75,.25);border-top:4px solid var(--gold);border-radius:var(--r);padding:16px 18px;margin-bottom:10px;text-align:center;display:flex;flex-direction:column;align-items:center;}
  .kyl-sedekah-banner h3{font-size:14px;font-weight:800;color:var(--gold);margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px}
  .kyl-sedekah-banner p{font-size:12px;color:var(--text2);line-height:1.55;text-align:center;}

  /* ── OMEGA HERO CARD ── */
  .kyl-omega-hero{background:linear-gradient(135deg,var(--brown-d),var(--brown),#b87a4a);border-radius:22px;padding:28px 22px 22px;margin-bottom:10px;color:#fff;box-shadow:0 8px 32px var(--brown-glow),0 2px 12px rgba(0,0,0,.3);position:relative;overflow:hidden;text-align:center}
  .kyl-omega-hero::before{content:'';position:absolute;top:-40px;left:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.05)}
  .kyl-omega-hero::after{content:'';position:absolute;bottom:-30px;right:-20px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,.04)}
  .kyl-omega-badge{display:inline-flex;align-items:center;background:rgba(255,255,255,.14);border:.5px solid rgba(255,255,255,.2);color:#fff;padding:5px 14px;border-radius:var(--rpill);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:12px}
  .kyl-omega-title{font-size:clamp(26px,7vw,36px);font-weight:900;letter-spacing:-.5px;line-height:1.1;margin-bottom:4px}
  .kyl-omega-sub{color:#fde68a;font-size:15px;font-weight:700;letter-spacing:.02em;margin-bottom:10px}
  .kyl-omega-desc{color:rgba(255,255,255,.85);font-size:13px;line-height:1.6;max-width:340px;margin:0 auto 18px}
  .kyl-omega-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .kyl-omega-stat{background:rgba(255,255,255,.09);border:.5px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 8px;backdrop-filter:blur(8px)}
  .kyl-omega-stat-title{color:rgba(255,255,255,.65);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px}
  .kyl-omega-stat-val{color:#fff;font-family:var(--mono);font-size:18px;font-weight:800}

  /* ── STANDAR NUTRISI BANNER ── */
  .kyl-nutrisi-banner{background:linear-gradient(135deg,#1e3a8a,#1d4ed8);border-left:4px solid var(--amber);border-radius:var(--r);padding:18px 20px;color:#fff;margin-bottom:10px;box-shadow:0 8px 24px rgba(29,78,216,.15)}
  .kyl-nutrisi-banner h3{font-size:15px;font-weight:800;margin-bottom:6px;letter-spacing:.04em}
  .kyl-nutrisi-banner p{font-size:13px;opacity:.92;line-height:1.65}

  /* ── STRAIN CARD (CENTERED) ── */
  .kyl-strain-card{background:linear-gradient(135deg,rgba(200,168,75,.09),rgba(200,168,75,.02));border:.5px solid rgba(200,168,75,.25);border-radius:var(--r);padding:16px 16px;margin-bottom:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px}
  .kyl-strain-icon{font-size:28px;flex-shrink:0;line-height:1}
  .kyl-strain-label{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);opacity:.8;display:block;margin-bottom:3px}
  .kyl-strain-val{font-size:15px;font-weight:800;color:var(--gold);letter-spacing:.02em}

  /* ── ISU AKTIF ── */
  .kyl-isu-item{padding:12px 14px;border-radius:var(--rsm);border:.5px solid rgba(245,158,11,.3);background:rgba(245,158,11,.05);margin-bottom:6px}
  .kyl-isu-lbl{display:block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--amber);margin-bottom:8px;padding-left:2px}

  /* ── PESANAN AKTIF ── */
  .kyl-pending-item{padding:12px 14px;border-radius:var(--rsm);border:.5px solid rgba(245,158,11,.22);background:rgba(245,158,11,.04);margin-bottom:6px}
  .kyl-product-tag{display:inline-block;padding:3px 10px;border-radius:8px;font-size:10.5px;font-weight:700;background:rgba(90,112,232,.12);color:var(--indigo);border:.5px solid rgba(90,112,232,.25);margin-top:4px}
  .kyl-badge-selesai{background:rgba(52,212,104,.1);color:#34d468;padding:3px 10px;border-radius:8px;font-weight:700;font-size:11px;display:inline-block;border:.5px solid rgba(52,212,104,.2)}

  /* ── TOMBOL SELESAI ── */
  .kyl-selesai-btn{background:rgba(52,212,104,.12);border:.5px solid rgba(52,212,104,.25);color:var(--primary-l);font-family:var(--font);font-size:10.5px;font-weight:700;padding:5px 12px;border-radius:8px;cursor:pointer;transition:all .15s;white-space:nowrap;display:inline-block}
  .kyl-selesai-btn:active{transform:scale(.95)}

  /* ── SOCIAL ICON CIRCLE ── */
  .kyl-social-icon{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}

  /* ── CARDS ── */
  .kyl-card{background:var(--surface);border-radius:var(--r);padding:15px 15px 14px;margin-bottom:10px;border:.5px solid var(--border);box-shadow:0 2px 16px rgba(0,0,0,.14);transition:background .25s;display:flex;flex-direction:column;gap:10px}
  .kyl-card-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text2);margin-bottom:8px;display:block}
  .kyl-card-lbl-gold{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--gold);margin-bottom:8px;display:block}
  .kyl-card-lbl-brown{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--brown-l);margin-bottom:8px;display:block}

  /* ── SECTION HEADING ── */
  .kyl-sec-title{display:flex;align-items:center;gap:9px;font-size:16px;font-weight:800;color:var(--text);margin-bottom:8px;line-height:1.3}
  .kyl-section-shell{display:flex;flex-direction:column;gap:10px}
  .kyl-section-head{display:flex;flex-direction:column;gap:4px}
  .kyl-section-desc{font-size:11px;color:var(--text2);line-height:1.6}
  .kyl-section-note{padding:12px 14px;border:.5px solid var(--border2);border-radius:var(--rsm);background:var(--surface2)}

  /* ── STATUS BOX ── */
  .kyl-status-box{border-radius:var(--rsm);padding:10px 14px;font-size:11px;font-weight:600;text-align:center;border:.5px solid;margin-bottom:10px;line-height:1.55}

  /* ── FLOCK SECTION ── */
  .kyl-flock-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;margin-bottom:10px}
  .kyl-flock-lbl{display:block;font-size:7.5px;text-transform:uppercase;font-weight:700;color:var(--text2);letter-spacing:.07em;margin-bottom:4px}
  .kyl-flock-val{font-family:var(--mono);font-size:17px;font-weight:700;color:var(--text);line-height:1}
  .kyl-flock-unit{font-size:9px;font-weight:400;color:var(--text2);margin-left:2px}
  .kyl-flock-val.gold{color:var(--gold)}
  .kyl-flock-afkir{font-family:var(--mono);font-size:10.5px;font-weight:700;color:var(--primary-l);text-align:center;padding:8px 0 0;border-top:.5px solid var(--border2);letter-spacing:.02em}

  /* ── STAT GRID ── */
  .kyl-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
  .kyl-stat-card{background:var(--surface);border-radius:var(--rsm);padding:14px 12px;border:.5px solid var(--border);box-shadow:0 2px 8px rgba(0,0,0,.1);display:flex;flex-direction:column;gap:4px;min-height:96px}
  .kyl-stat-lbl{display:block;font-size:8px;text-transform:uppercase;font-weight:700;letter-spacing:.08em;color:var(--text2);margin-bottom:6px}
  .kyl-stat-val{font-family:var(--mono);font-size:19px;font-weight:700;color:var(--text);line-height:1;margin-bottom:3px}
  .kyl-stat-sub{font-size:9.5px;color:var(--text3)}

  /* ── CHART ── */
  .kyl-chart-wrap{display:flex;align-items:flex-end;gap:5px;height:70px;margin-bottom:8px}
  .kyl-chart-col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;gap:2px}
  .kyl-chart-num{font-family:var(--mono);font-size:7px;margin-bottom:3px;transition:color .25s}
  .kyl-chart-bar{width:100%;border-radius:4px 4px 2px 2px;min-height:3px;transition:height .55s cubic-bezier(.4,0,.2,1), background .25s}
  .kyl-chart-footer{display:flex;justify-content:space-between;padding-top:8px;border-top:.5px solid var(--border2);font-size:10px;color:var(--text2)}

  /* ── ACTIVITY/LOG ITEMS ── */
  .kyl-section-lbl{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text2);margin-bottom:8px;padding-left:2px}
  .kyl-activity-item{padding:10px 12px;border-radius:var(--rsm);border:.5px solid var(--border2);background:var(--surface);margin-bottom:6px;font-size:12px;display:flex;flex-direction:column;gap:6px}
  .kyl-log-item{padding:12px;border-radius:var(--rsm);border:.5px solid var(--border2);background:var(--surface);margin-bottom:6px;font-size:12px;display:flex;flex-direction:column;gap:8px}

  /* ── TABLE SYSTEM ── */
  .kyl-table-wrap{width:100%;overflow-x:auto;border-radius:var(--rsm);border:.5px solid var(--border)}
  .kyl-table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}
  .kyl-table th{background:var(--surface2);color:var(--text);padding:12px 14px;font-weight:700;border-bottom:.5px solid var(--border);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
  .kyl-table td{padding:12px 14px;border-bottom:.5px solid var(--border2);color:var(--text2);vertical-align:middle;line-height:1.55}
  .kyl-table tr:last-child td{border-bottom:none}
  .kyl-table tbody tr:hover td{background:rgba(255,255,255,.015)}
  .kyl-table td.bold{color:var(--text);font-weight:700}

  /* ── BADGE/TAG SYSTEM ── */
  .kyl-badge-good{background:rgba(52,212,104,.12);color:#34d468;padding:3px 10px;border-radius:8px;font-weight:700;font-size:11.5px;display:inline-block;border:.5px solid rgba(52,212,104,.2)}
  .kyl-badge-warn{background:rgba(245,158,11,.1);color:#f59e0b;padding:3px 10px;border-radius:8px;font-weight:700;font-size:11.5px;display:inline-block;border:.5px solid rgba(245,158,11,.2)}
  .kyl-badge-bad{background:rgba(255,59,48,.1);color:#ff6b63;padding:3px 10px;border-radius:8px;font-weight:700;font-size:11.5px;display:inline-block;border:.5px solid rgba(255,59,48,.2)}
  .kyl-badge-blue{background:rgba(90,112,232,.1);color:var(--indigo);padding:3px 10px;border-radius:8px;font-weight:700;font-size:11.5px;display:inline-block;border:.5px solid rgba(90,112,232,.2)}
  .kyl-badge-brown{background:rgba(139,94,60,.12);color:var(--brown-l);padding:3px 10px;border-radius:8px;font-weight:700;font-size:11.5px;display:inline-block;border:.5px solid rgba(139,94,60,.2)}
  .kyl-highlight{color:var(--red);font-weight:800}

  /* ── TIMELINE (SOP STEPS) ── */
  .kyl-timeline-item{display:flex;gap:16px;margin-bottom:10px}
  .kyl-timeline-item:last-child{margin-bottom:0}
  .kyl-timeline-num{min-width:56px;font-family:var(--mono);color:var(--brown-l);font-weight:800;font-size:13px;padding-top:13px;text-align:right;flex-shrink:0}
  .kyl-timeline-body{background:var(--surface2);border:.5px solid var(--border);border-radius:var(--rsm);padding:13px 16px;width:100%;font-size:13px;color:var(--text2);line-height:1.65}
  .kyl-timeline-body .bold{color:var(--text);font-weight:700}

  /* ── RESULT BOX (HDP/FORMULA) ── */
  .kyl-result-box{padding:14px 18px;border-radius:var(--rsm);font-size:13.5px;font-weight:600;margin-top:14px;line-height:1.65;border:.5px solid;animation:kylFadeIn .3s ease forwards}
  @keyframes kylFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
  .kyl-result-good{background:rgba(52,212,104,.08);color:#34d468;border-color:rgba(52,212,104,.2)}
  .kyl-result-warn{background:rgba(245,158,11,.08);color:#f59e0b;border-color:rgba(245,158,11,.2)}
  .kyl-result-bad{background:rgba(255,59,48,.08);color:#ff6b63;border-color:rgba(255,59,48,.2)}

  /* ── CUSTOM CHECKBOX ── */
  .kyl-chk-wrap{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;border:2px solid var(--border);background:var(--surface2);cursor:pointer;transition:all .2s;flex-shrink:0}
  .kyl-chk-wrap.checked{background:var(--brown);border-color:var(--brown)}
  .kyl-chk-wrap.checked::after{content:'✓';color:#fff;font-size:13px;font-weight:700;line-height:1}

  /* ── FORMS ── */
  .kyl-form-lbl{display:block;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);margin-bottom:7px}
  .kyl-input{width:100%;border-radius:var(--rsm);border:.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font);font-size:14px;padding:11px 14px;outline:none;-webkit-appearance:none;appearance:none;transition:border-color .15s,background .15s}
  .kyl-input:focus{border-color:var(--primary);background:var(--surface)}
  .kyl-input::placeholder{color:var(--text3)}
  .kyl-input.mono{font-family:var(--mono)}
  .kyl-input.brown:focus{border-color:var(--brown)}
  .kyl-select{width:100%;border-radius:var(--rsm);border:.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font);font-size:14px;padding:11px 14px;outline:none;-webkit-appearance:none;cursor:pointer}
  .kyl-edit-input{padding:7px 10px;font-size:12px;border-radius:8px;border:.5px solid var(--border);background:rgba(0,0,0,.25);color:var(--text);width:100%;font-family:var(--font);outline:none}

  /* ── CATEGORY PILLS ── */
  .kyl-cat-btn{padding:9px 6px;border-radius:11px;border:.5px solid var(--border);background:var(--surface2);color:var(--text2);font-family:var(--font);font-size:10.5px;font-weight:600;cursor:pointer;text-align:center;transition:all .15s;line-height:1.3}
  .kyl-cat-btn.active{background:var(--indigo);border-color:var(--indigo);color:#fff}
  .kyl-cat-btn.general.active{background:var(--primary);border-color:var(--primary);color:#fff}
  .kyl-cat-btn.danger{color:var(--red);border-color:rgba(255,59,48,.2)}
  .kyl-cat-btn.danger.active{background:var(--red);border-color:var(--red);color:#fff}

  /* ── BUTTONS ── */
  .kyl-btn{width:100%;padding:13px 16px;border:none;border-radius:var(--rsm);cursor:pointer;font-family:var(--font);font-size:12px;font-weight:700;letter-spacing:.02em;transition:transform .1s,box-shadow .15s;display:flex;align-items:center;justify-content:center;gap:7px}
  .kyl-btn:active{transform:scale(.975);box-shadow:none!important}
  .kyl-btn-primary{background:var(--primary);color:#fff;box-shadow:0 4px 18px var(--primary-glow)}
  .kyl-btn-indigo{background:var(--indigo);color:#fff;box-shadow:0 4px 18px var(--indigo-glow)}
  .kyl-btn-danger{background:var(--red);color:#fff}
  .kyl-btn-gold{background:var(--gold);color:#000;font-weight:800}
  .kyl-btn-brown{background:var(--brown);color:#fff;box-shadow:0 4px 18px var(--brown-glow)}
  .kyl-btn-ghost{background:none;color:var(--text2);box-shadow:none;font-size:11px;width:auto;padding:4px 8px}
  .kyl-btn-secondary{background:var(--surface2);color:var(--text);border:.5px solid var(--border)}
  .kyl-btn-quick{flex:1;padding:10px 12px;border:none;border-radius:var(--rsm);cursor:pointer;font-family:var(--font);font-size:11px;font-weight:700;transition:transform .1s}
  .kyl-btn-quick:active{transform:scale(.97)}
  .kyl-btn-quick.sell{background:linear-gradient(135deg,var(--gold-glow),var(--surface2));border:.5px solid rgba(200,168,75,.25);color:var(--gold)}

  /* ── BOTTOM NAVBAR ── */
  .kyl-navbar{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:center;padding:6px 10px calc(var(--safe-bottom) + 8px);background:linear-gradient(to top,var(--bg) 50%,transparent 100%);pointer-events:none;z-index:40}
  .kyl-navbar-pill{width:100%;max-width:440px;border:.5px solid var(--border);border-radius:20px;padding:4px 5px;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 6px 32px rgba(0,0,0,.3);pointer-events:auto;transition:background .25s}
  .kyl-navbar-pill.dark{background:rgba(13,17,23,.88)}
  .kyl-navbar-pill.light{background:rgba(255,255,255,.92);box-shadow:0 4px 24px rgba(0,0,0,.1)}
  .kyl-tab-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px 1px;border:none;background:none;cursor:pointer;gap:1px;border-radius:11px;transition:background .15s}
  .kyl-tab-btn:active{opacity:.6}
  .kyl-tab-icon{font-size:16px;line-height:1;transition:transform .2s}
  .kyl-tab-btn.active .kyl-tab-icon{transform:scale(1.12)}
  .kyl-tab-lbl{font-family:var(--font);font-size:7px;font-weight:700;letter-spacing:.01em;color:var(--text3);transition:color .15s;white-space:nowrap}
  .kyl-tab-btn.active .kyl-tab-lbl{color:var(--text)}


  /* ── TOAST ── */
  .kyl-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:100;background:var(--surface2);border:.5px solid rgba(90,112,232,.25);border-radius:var(--rsm);padding:10px 18px;font-size:12px;font-weight:700;color:var(--indigo);white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.28);backdrop-filter:blur(10px)}

  /* ── UTILS ── */
  .kyl-flex-between{display:flex;justify-content:space-between;align-items:center}
  .kyl-flex-center{display:flex;align-items:center}
  .kyl-gap2{gap:8px}
  .kyl-space{display:flex;flex-direction:column;gap:10px}
  .kyl-space-sm{display:flex;flex-direction:column;gap:6px}
  .kyl-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}
  .kyl-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;align-items:start}
  .kyl-hr{border:none;border-top:.5px solid var(--border2);margin:10px 0}
  .kyl-empty{text-align:center;padding:20px;font-size:11px;color:var(--text3)}
  .kyl-text{color:var(--text)}.kyl-text2{color:var(--text2)}.kyl-text3{color:var(--text3)}
  .kyl-green{color:var(--primary-l)}.kyl-gold{color:var(--gold)}.kyl-indigo{color:var(--indigo)}
  .kyl-red{color:var(--red)}.kyl-amber{color:var(--amber)}.kyl-brown{color:var(--brown-l)}
  .kyl-mono{font-family:var(--mono)}.kyl-bold{font-weight:700}.kyl-small{font-size:12px}.kyl-xsmall{font-size:9.5px}
  .kyl-tag{display:inline-block;padding:2px 8px;border-radius:var(--rpill);font-size:10px;font-weight:700;background:var(--surface2);border:.5px solid var(--border);color:var(--text2)}
  .kyl-note-input{width:100%;padding:9px 12px;border:.5px solid var(--border);border-radius:9px;background:var(--surface2);color:var(--text);font-family:var(--font);font-size:13px;outline:none;transition:border-color .15s}
  .kyl-note-input:focus{border-color:var(--brown)}
  .kyl-quote-card{background:linear-gradient(135deg,rgba(139,94,60,.05),rgba(92,58,32,.05));border:.5px dashed var(--border);border-radius:var(--r);padding:18px;text-align:center;margin-top:10px}
  .kyl-quote-text{font-size:15px;font-weight:800;color:var(--brown-l);line-height:1.6}
  ul.kyl-ul{padding-left:0;list-style:none;display:flex;flex-direction:column;gap:7px}
  ul.kyl-ul li{font-size:13px;color:var(--text2);line-height:1.5;padding-left:20px;position:relative}
  ul.kyl-ul li::before{content:'✅';position:absolute;left:0;top:0;font-size:11px}


  /* ── STOK HERO ── */
  .kyl-stok-hero{background:linear-gradient(135deg,#1e293b 0%,#334155 60%,#475569 100%);border-radius:22px;padding:22px 20px 20px;margin-bottom:10px;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,.35);position:relative;overflow:hidden}
  .kyl-stok-hero::before{content:'';position:absolute;top:-30px;right:-30px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.05)}
  .kyl-stok-hero::after{content:'';position:absolute;bottom:-20px;left:10px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.04)}
  .kyl-stok-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}
  .kyl-stok-mini{background:rgba(255,255,255,.09);border:.5px solid rgba(255,255,255,.1);border-radius:14px;padding:11px 8px;text-align:center;backdrop-filter:blur(8px)}
  .kyl-stok-mini-lbl{color:rgba(255,255,255,.6);font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px;display:block}
  .kyl-stok-mini-val{color:#fff;font-family:var(--mono);font-size:17px;font-weight:800;line-height:1}
  .kyl-stok-mini-unit{color:rgba(255,255,255,.5);font-size:9px}

  /* ── STOK ITEM CARD ── */
  .kyl-stok-item{background:var(--surface);border-radius:var(--r);padding:14px 16px;border:.5px solid var(--border);margin-bottom:8px}
  .kyl-stok-bar-wrap{background:var(--surface3);border-radius:var(--rpill);height:5px;margin:8px 0 10px;overflow:hidden}
  .kyl-stok-bar{height:100%;border-radius:var(--rpill);transition:width .5s ease}
  .kyl-stok-bar.ok{background:linear-gradient(90deg,var(--primary),var(--primary-l))}
  .kyl-stok-bar.warn{background:linear-gradient(90deg,var(--amber),#fcd34d)}
  .kyl-stok-bar.kritis{background:linear-gradient(90deg,var(--red),#ff6b63)}
  .kyl-badge-kritis{background:rgba(255,59,48,.12);color:#ff6b63;padding:2px 8px;border-radius:6px;font-weight:700;font-size:9.5px;display:inline-block;border:.5px solid rgba(255,59,48,.2)}

  /* ── PAKAN STOCK ── */
  .kyl-pakan-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:.5px solid var(--border2)}
  .kyl-pakan-row:last-child{border-bottom:none}
  .kyl-pakan-icon{font-size:20px;width:36px;text-align:center;flex-shrink:0}
  .kyl-pakan-info{flex:1;margin:0 12px}
  .kyl-pakan-nama{font-size:12px;font-weight:700;color:var(--text)}
  .kyl-pakan-hari{font-size:10px;color:var(--text2);margin-top:2px}
  .kyl-pakan-val{font-family:var(--mono);font-size:14px;font-weight:800;text-align:right}

  /* ── ADJ INLINE ── */
  .kyl-adj-row{display:flex;gap:6px;align-items:center;background:var(--surface2);border-radius:var(--rsm);padding:8px 10px;margin-top:8px}
  .kyl-adj-input{flex:1;padding:6px 10px;border-radius:8px;border:.5px solid var(--border);background:transparent;color:var(--text);font-family:var(--mono);font-size:13px;font-weight:700;outline:none;min-width:0}
  .kyl-adj-btn{background:var(--primary);color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:var(--font)}
  .kyl-adj-cancel{background:none;border:none;cursor:pointer;font-size:11px;color:var(--text3);padding:4px;font-family:var(--font)}


  /* ── BOTTOM SHEET ── */
  .kyl-sheet-overlay{position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;justify-content:flex-end}
  .kyl-sheet-dim{position:absolute;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(3px)}
  .kyl-sheet-body{position:relative;background:var(--surface);border-radius:24px 24px 0 0;padding:0 16px calc(var(--safe-bottom,0px) + 28px);max-height:90svh;overflow-y:auto;box-shadow:0 -12px 60px rgba(0,0,0,.5)}
  .kyl-sheet-handle{width:44px;height:4px;border-radius:2px;background:var(--border);margin:14px auto 0}
  .kyl-sheet-title{font-weight:900;font-size:18px;color:var(--text);padding:16px 0 4px;letter-spacing:-.3px}

  /* ── SUB-TABS ── */
  .kyl-subtab-row{display:flex;gap:6px;background:var(--surface2);border-radius:var(--rsm);padding:4px;margin-bottom:14px}
  .kyl-subtab-btn{flex:1;padding:8px 10px;border:none;border-radius:10px;font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;text-align:center}
  .kyl-subtab-btn.active{background:var(--surface);color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,.15)}
  .kyl-subtab-btn:not(.active){background:none;color:var(--text3)}

  /* ── P&L ROWS ── */
  .kyl-pl-section{background:var(--surface);border-radius:var(--r);padding:16px;margin-bottom:10px;border:.5px solid var(--border)}
  .kyl-pl-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:.5px solid var(--border2)}
  .kyl-pl-row:last-child{border-bottom:none}
  .kyl-pl-total{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-radius:var(--rsm);margin-top:8px}
  .kyl-pl-label{font-size:12px;font-weight:600;color:var(--text2)}
  .kyl-pl-val{font-family:var(--mono);font-size:15px;font-weight:800}

  /* ── ALERT BANNER ── */
  .kyl-alert-bar{border-radius:var(--rsm);padding:10px 14px;margin-bottom:10px;border:.5px solid;display:flex;align-items:flex-start;gap:10px}

  /* ── NAV BADGE ── */
  .kyl-nav-badge{position:absolute;top:1px;right:3px;background:var(--red);color:#fff;border-radius:99px;min-width:14px;height:14px;font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 3px;line-height:1;border:1.5px solid var(--bg)}

  /* ── SKELETON ── */
  .kyl-skel{background:linear-gradient(90deg,var(--surface2) 25%,var(--surface3) 50%,var(--surface2) 75%);background-size:400% 100%;animation:kylSkel 1.4s ease infinite;border-radius:8px}
  @keyframes kylSkel{0%{background-position:100% 50%}100%{background-position:0% 50%}}

  /* ── SEARCH BAR ── */
  .kyl-search-wrap{position:relative;margin-bottom:10px}
  .kyl-search-wrap input{padding-left:36px!important}
  .kyl-search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--text3);pointer-events:none}

  /* ── FCR CARD ── */
  .kyl-fcr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
  .kyl-fcr-cell{background:var(--surface2);border-radius:var(--rsm);padding:12px 8px;text-align:center;border:.5px solid var(--border)}
  .kyl-fcr-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);margin-bottom:4px;display:block}
  .kyl-fcr-val{font-family:var(--mono);font-size:20px;font-weight:800;line-height:1}

  /* ── PELANGGAN CARD ── */
  .kyl-pel-card{background:var(--surface);border-radius:var(--rsm);padding:13px 15px;border:.5px solid var(--border);margin-bottom:6px}
  .kyl-pel-initial{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--indigo),#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;flex-shrink:0}

  /* ── SWIPE ITEM ── */
  .kyl-swipe-wrap{position:relative;overflow:hidden;border-radius:var(--rsm);margin-bottom:6px}
  .kyl-swipe-actions{position:absolute;right:0;top:0;bottom:0;display:flex;align-items:center;gap:4px;padding:0 10px}
  .kyl-swipe-del{background:var(--red);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font)}
  .kyl-swipe-done{background:var(--primary);color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font)}

  /* ── FAB ── */
  .kyl-fab{position:fixed;bottom:calc(var(--safe-bottom,0px) + 90px);right:16px;width:52px;height:52px;border-radius:50%;border:none;background:var(--primary);color:#fff;font-size:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px var(--primary-glow);z-index:30;transition:transform .15s}
  .kyl-fab:active{transform:scale(.9)}

  /* ── ONBOARDING ── */
  .kyl-onboard{background:linear-gradient(135deg,rgba(90,112,232,.1),rgba(90,112,232,.03));border:.5px solid rgba(90,112,232,.2);border-radius:var(--r);padding:20px;text-align:center;margin-bottom:10px}


  /* ──────────────────────────────────────────────────────────────────────────
     KAYALA V2 PREMIUM OVERRIDE
     Modern mobile UI, refined light/dark mode, cleaner icons, safer contrast.
     Semua class lama tetap dipakai agar fungsi tidak berubah.
  ────────────────────────────────────────────────────────────────────────── */
  :root {
    color-scheme: dark;
    --bg:#05070b;
    --surface:rgba(14,18,24,.84);
    --surface2:rgba(22,27,36,.86);
    --surface3:rgba(34,41,52,.86);
    --glass:rgba(255,255,255,.075);
    --glass-strong:rgba(255,255,255,.115);
    --border:rgba(255,255,255,.105);
    --border2:rgba(255,255,255,.055);
    --primary:#22c55e;
    --primary-d:#0f6b3e;
    --primary-l:#7ee787;
    --primary-glow:rgba(34,197,94,.22);
    --gold:#f2c94c;
    --gold-l:#ffe08a;
    --gold-glow:rgba(242,201,76,.16);
    --brown:#b77945;
    --brown-d:#74431f;
    --brown-l:#e0a66f;
    --brown-glow:rgba(183,121,69,.16);
    --indigo:#8b9cff;
    --indigo-glow:rgba(139,156,255,.18);
    --red:#ff6b63;
    --amber:#fbbf24;
    --teal:#22d3ee;
    --text:#f8fafc;
    --text2:#b7c0ce;
    --text3:#768195;
    --shadow-soft:0 18px 60px rgba(0,0,0,.36);
    --shadow-card:0 10px 32px rgba(0,0,0,.24);
    --hairline:0 0 0 .5px var(--border);
    --r:24px;
    --rsm:16px;
    --rpill:999px;
  }
  .kyl-light {
    color-scheme: light;
    --bg:#f5f6f8;
    --surface:rgba(255,255,255,.92);
    --surface2:rgba(247,248,251,.94);
    --surface3:#edf0f5;
    --glass:rgba(255,255,255,.72);
    --glass-strong:rgba(255,255,255,.9);
    --border:rgba(16,24,40,.09);
    --border2:rgba(16,24,40,.055);
    --primary:#11834d;
    --primary-d:#0b5e38;
    --primary-l:#18a761;
    --primary-glow:rgba(17,131,77,.14);
    --gold:#a77808;
    --gold-l:#ce9d16;
    --gold-glow:rgba(167,120,8,.1);
    --brown:#825336;
    --brown-d:#5b3420;
    --brown-l:#9c6745;
    --brown-glow:rgba(130,83,54,.12);
    --indigo:#4056d8;
    --indigo-glow:rgba(64,86,216,.13);
    --red:#d92d20;
    --amber:#b7791f;
    --teal:#0e7490;
    --text:#121826;
    --text2:#475467;
    --text3:#8b95a5;
    --shadow-soft:0 18px 60px rgba(16,24,40,.13);
    --shadow-card:0 12px 32px rgba(16,24,40,.09);
  }

  html, body {
    min-height:100%;
    font-family:var(--font);
    background:var(--bg);
    text-rendering:optimizeLegibility;
  }
  body::before{
    content:'';
    position:fixed;
    inset:0;
    z-index:-2;
    background:
      radial-gradient(circle at 10% 0%, rgba(34,197,94,.20), transparent 30%),
      radial-gradient(circle at 96% 8%, rgba(242,201,76,.12), transparent 28%),
      radial-gradient(circle at 55% 90%, rgba(139,156,255,.14), transparent 34%),
      linear-gradient(180deg, var(--bg), var(--bg));
  }
  .kyl-light body::before,
  body:has(.kyl-light)::before{
    background:
      radial-gradient(circle at 8% 0%, rgba(17,131,77,.12), transparent 30%),
      radial-gradient(circle at 96% 8%, rgba(167,120,8,.12), transparent 28%),
      radial-gradient(circle at 55% 90%, rgba(64,86,216,.10), transparent 34%),
      linear-gradient(180deg, #f8fafc, #eef2f7);
  }
  .kyl-app{
    background:
      radial-gradient(circle at 10% 0%, rgba(34,197,94,.20), transparent 30%),
      radial-gradient(circle at 96% 8%, rgba(242,201,76,.12), transparent 28%),
      radial-gradient(circle at 55% 90%, rgba(139,156,255,.14), transparent 34%),
      linear-gradient(180deg, var(--bg), var(--bg));
    min-height:100dvh;
    padding-top:calc(var(--safe-top) + 6px);
  }
  .kyl-app.kyl-light{
    background:
      radial-gradient(circle at 8% 0%, rgba(17,131,77,.12), transparent 30%),
      radial-gradient(circle at 96% 8%, rgba(167,120,8,.12), transparent 28%),
      radial-gradient(circle at 55% 90%, rgba(64,86,216,.10), transparent 34%),
      linear-gradient(180deg, var(--bg), #eef2f7);
  }
  .kyl-wrap{
    max-width:470px;
    padding:0 16px calc(var(--safe-bottom) + 116px);
  }

  .kyl-bismillah{
    position:sticky;
    top:0;
    z-index:25;
    margin:0 -6px 12px;
    padding:12px 10px 10px;
    border:none;
    border-radius:0 0 22px 22px;
    background:linear-gradient(180deg, rgba(5,7,11,.94), rgba(5,7,11,.60) 78%, transparent);
    backdrop-filter:blur(18px);
    -webkit-backdrop-filter:blur(18px);
  }
  .kyl-light .kyl-bismillah{
    background:linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.65) 78%, transparent);
  }
  .kyl-bismillah-label{font-size:8px;color:var(--gold);letter-spacing:.24em;}
  .kyl-bismillah-ar{font-size:18px;color:var(--text);opacity:.92;}

  .kyl-brand{margin:8px 0 18px;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 4px;}
  .kyl-brand-pill{
    display:inline-flex;
    flex-direction:column;
    align-items:center;
    width:auto;
    max-width:100%;
    border-radius:22px;
    padding:12px 20px 11px;
    text-align:center;
    background:
      linear-gradient(135deg, rgba(242,201,76,.16), transparent 38%),
      linear-gradient(145deg, var(--surface), var(--surface2));
    border:.5px solid rgba(242,201,76,.20);
    box-shadow:var(--shadow-card);
  }
  .kyl-brand-name{font-size:10px;letter-spacing:.18em;color:var(--gold-l);text-align:center;}
  .kyl-brand-owner{font-size:8px;letter-spacing:.16em;color:var(--text2);opacity:1;text-align:center;}
  .kyl-app-title{
    margin:16px 0 10px;
    font-size:32px;
    letter-spacing:-1.2px;
    line-height:.96;
    text-align:center;
    width:100%;
  }
  .kyl-sync-badge{
    margin:0 auto 14px;
    padding:7px 13px;
    border-radius:var(--rpill);
    background:rgba(34,197,94,.10);
    border:.5px solid rgba(34,197,94,.18);
  }
  .kyl-sync-text{font-size:8px;color:var(--primary-l);letter-spacing:.11em;}
  .kyl-social{
    display:flex;
    flex-direction:row;
    flex-wrap:nowrap;
    justify-content:center;
    align-items:stretch;
    gap:8px;
    width:100%;
    margin:12px 0 4px;
    overflow:hidden;
  }
  .kyl-social-btn{
    flex:1 1 0;
    min-width:0;
    display:inline-flex;
    flex-direction:row;
    align-items:center;
    justify-content:center;
    gap:7px;
    padding:7px 10px;
    border-radius:999px;
    background:var(--glass);
    color:var(--text2);
    border:.5px solid var(--border);
    font-size:10px;
    font-weight:700;
    text-decoration:none;
    white-space:nowrap;
    line-height:1;
    backdrop-filter:blur(12px);
    transition:opacity .15s, transform .12s;
  }
  .kyl-social-btn:active{transform:scale(.98);opacity:.82;}
  .kyl-social-text{
    overflow:hidden;
    text-overflow:ellipsis;
    min-width:0;
    letter-spacing:.01em;
  }
  .kyl-social-icon{
    width:18px;height:18px;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
    background:none;box-shadow:none;border-radius:0;
  }
  .kyl-social-icon svg{width:18px;height:18px;display:block;}
  .kyl-social-icon--ig{color:#e4405f;}
  .kyl-social-icon--wa{color:#25d366;}
  .kyl-light .kyl-social-icon--ig{color:#c13584;}
  .kyl-light .kyl-social-icon--wa{color:#128c7e;}

  .kyl-card,
  .kyl-stat-card,
  .kyl-stok-item,
  .kyl-pel-card,
  .kyl-pl-section,
  .kyl-activity-item,
  .kyl-log-item,
  .kyl-section-note{
    background:linear-gradient(180deg, var(--surface), var(--surface2));
    border:.5px solid var(--border);
    box-shadow:var(--shadow-card);
    backdrop-filter:blur(18px) saturate(1.1);
    -webkit-backdrop-filter:blur(18px) saturate(1.1);
  }
  .kyl-card{padding:18px;border-radius:24px;margin-bottom:12px;gap:12px;}
  .kyl-stat-card{border-radius:22px;padding:16px;min-height:112px;}
  .kyl-card-lbl,
  .kyl-card-lbl-gold,
  .kyl-card-lbl-brown,
  .kyl-section-lbl{
    font-size:10px;
    letter-spacing:.12em;
    line-height:1.25;
  }
  .kyl-sec-title{font-size:18px;letter-spacing:-.35px;}
  .kyl-section-desc{font-size:12px;color:var(--text2);}

  .kyl-clock-card,
  .kyl-omega-hero,
  .kyl-stok-hero{
    border-radius:30px;
    padding:24px 20px;
    border:.5px solid rgba(255,255,255,.13);
    box-shadow:0 24px 64px rgba(0,0,0,.34);
    isolation:isolate;
  }
  .kyl-clock-card{
    background:
      radial-gradient(circle at 85% 5%, rgba(255,255,255,.25), transparent 20%),
      linear-gradient(135deg, #0b5e38 0%, #16a34a 48%, #72df8b 120%);
  }
  .kyl-clock-time{font-size:clamp(52px,14vw,76px);letter-spacing:-3px;}
  .kyl-live-badge{background:rgba(255,255,255,.17);border:.5px solid rgba(255,255,255,.22);}
  .kyl-status-box{
    border-radius:18px;
    padding:12px 15px;
    box-shadow:var(--shadow-card);
    backdrop-filter:blur(12px);
  }
  .kyl-strain-card,
  .kyl-onboard,
  .kyl-sedekah-banner,
  .kyl-nutrisi-banner{
    border-radius:24px;
    box-shadow:var(--shadow-card);
    backdrop-filter:blur(16px);
  }

  .kyl-input,
  .kyl-select,
  .kyl-note-input,
  .kyl-edit-input,
  .kyl-adj-input{
    min-height:46px;
    border-radius:16px;
    background:var(--glass);
    border:.5px solid var(--border);
    color:var(--text);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
  }
  .kyl-input:focus,
  .kyl-select:focus,
  .kyl-note-input:focus,
  .kyl-edit-input:focus,
  .kyl-adj-input:focus{
    border-color:rgba(34,197,94,.55);
    box-shadow:0 0 0 4px rgba(34,197,94,.12), inset 0 1px 0 rgba(255,255,255,.05);
    background:var(--surface);
  }
  .kyl-form-lbl{font-size:10px;letter-spacing:.09em;}

  .kyl-btn,
  .kyl-btn-quick,
  .kyl-adj-btn,
  .kyl-selesai-btn,
  .kyl-cat-btn,
  .kyl-subtab-btn{
    min-height:42px;
    border-radius:16px;
    font-weight:800;
    letter-spacing:.01em;
  }
  .kyl-btn-primary{background:linear-gradient(135deg, #0f8f55, #22c55e);box-shadow:0 10px 26px var(--primary-glow);}
  .kyl-btn-indigo{background:linear-gradient(135deg, #4f63e8, #8b9cff);box-shadow:0 10px 26px var(--indigo-glow);}
  .kyl-btn-gold{background:linear-gradient(135deg, #f2c94c, #ffe08a);box-shadow:0 10px 24px var(--gold-glow);color:#1f1600;}
  .kyl-btn-brown{background:linear-gradient(135deg, #86512d, #c78955);box-shadow:0 10px 24px var(--brown-glow);}
  .kyl-btn-secondary{background:var(--glass);border:.5px solid var(--border);}
  .kyl-btn-danger{background:linear-gradient(135deg, #d92d20, #ff6b63);}

  .kyl-stat-grid{gap:10px;}
  .kyl-stat-lbl{font-size:8.5px;letter-spacing:.11em;}
  .kyl-stat-val{font-size:22px;letter-spacing:-.6px;}
  .kyl-flock-grid{gap:8px;}
  .kyl-flock-val{font-size:20px;}
  .kyl-chart-bar{border-radius:10px 10px 4px 4px;}
  .kyl-table-wrap{border-radius:18px;background:var(--surface);box-shadow:var(--shadow-card);}
  .kyl-table th{font-size:10px;background:var(--surface3);}
  .kyl-table td{font-size:12.5px;}
  .kyl-badge-good,.kyl-badge-warn,.kyl-badge-bad,.kyl-badge-blue,.kyl-badge-brown,.kyl-badge-selesai,.kyl-badge-kritis,.kyl-product-tag,.kyl-tag{
    border-radius:999px;
    padding:4px 10px;
    line-height:1.1;
  }

  .kyl-navbar{padding:8px 12px calc(var(--safe-bottom) + 10px);background:linear-gradient(to top, rgba(5,7,11,.94) 0%, rgba(5,7,11,.62) 58%, transparent 100%);}
  .kyl-light .kyl-navbar{background:linear-gradient(to top, rgba(245,246,248,.94) 0%, rgba(245,246,248,.62) 58%, transparent 100%);}
  .kyl-navbar-pill{
    max-width:470px;
    min-height:66px;
    border-radius:28px;
    padding:6px;
    gap:2px;
    border:.5px solid var(--border);
    background:rgba(14,18,24,.82);
    box-shadow:0 20px 64px rgba(0,0,0,.38);
  }
  .kyl-navbar-pill.light{background:rgba(255,255,255,.82);box-shadow:0 18px 48px rgba(16,24,40,.16);}
  .kyl-tab-btn{min-height:52px;border-radius:21px;color:var(--text3);gap:4px;}
  .kyl-tab-btn.active{
    background:linear-gradient(180deg, var(--glass-strong), var(--glass));
    box-shadow:inset 0 .5px 0 rgba(255,255,255,.12), 0 8px 20px rgba(0,0,0,.16);
    color:var(--text);
  }
  .kyl-tab-icon{font-size:0;line-height:1;color:currentColor;}
  .kyl-tab-btn.active .kyl-tab-icon{color:var(--primary-l);transform:none;}
  .kyl-tab-lbl{font-size:8px;font-weight:800;color:currentColor;}
  .kyl-svg-icon{width:21px;height:21px;display:block;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;fill:none;}
  .kyl-nav-badge{top:3px;right:8px;border-color:var(--surface);}

  .kyl-sheet-body{
    background:linear-gradient(180deg, var(--surface), var(--bg));
    border:.5px solid var(--border);
    border-bottom:none;
    box-shadow:0 -22px 80px rgba(0,0,0,.48);
  }
  .kyl-sheet-title{font-size:20px;letter-spacing:-.5px;}
  .kyl-toast{
    top:calc(var(--safe-top) + 12px);
    border-radius:999px;
    background:var(--glass-strong);
    border:.5px solid var(--border);
    color:var(--text);
  }

  .kyl-islamic-overlay{
    position:fixed;
    inset:0;
    z-index:999;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:22px;
    background:
      radial-gradient(circle at 30% 16%, rgba(242,201,76,.18), transparent 26%),
      radial-gradient(circle at 80% 76%, rgba(34,197,94,.22), transparent 28%),
      rgba(3,6,12,.74);
    backdrop-filter:blur(18px) saturate(1.1);
    -webkit-backdrop-filter:blur(18px) saturate(1.1);
    animation:kylOverlayIn .22s ease forwards;
  }
  .kyl-islamic-modal{
    width:min(100%,430px);
    border-radius:34px;
    padding:26px 24px 22px;
    text-align:center;
    color:#fff;
    background:
      linear-gradient(160deg, rgba(255,255,255,.14), rgba(255,255,255,.06)),
      linear-gradient(145deg, rgba(9,14,23,.96), rgba(17,29,22,.94));
    border:.5px solid rgba(255,255,255,.20);
    box-shadow:0 28px 90px rgba(0,0,0,.54);
    position:relative;
    overflow:hidden;
    cursor:pointer;
    transform-origin:center;
    animation:kylModalPop .28s cubic-bezier(.2,.85,.2,1) forwards;
  }
  .kyl-islamic-modal::before{
    content:'';
    position:absolute;
    top:-90px;right:-70px;
    width:190px;height:190px;
    border-radius:999px;
    background:rgba(242,201,76,.18);
  }
  .kyl-islamic-kicker{
    position:relative;
    display:inline-flex;
    align-items:center;
    gap:8px;
    padding:7px 12px;
    border-radius:999px;
    background:rgba(242,201,76,.14);
    border:.5px solid rgba(242,201,76,.25);
    color:#ffe08a;
    font-size:10px;
    font-weight:900;
    letter-spacing:.15em;
    text-transform:uppercase;
  }
  .kyl-islamic-ar{
    position:relative;
    margin:18px 0 10px;
    font-family:var(--ar);
    font-size:26px;
    line-height:1.9;
    color:#fff7d6;
  }
  .kyl-islamic-title{
    position:relative;
    font-size:22px;
    line-height:1.2;
    letter-spacing:-.65px;
    margin:10px 0 10px;
    font-weight:900;
  }
  .kyl-islamic-text{
    position:relative;
    font-size:14px;
    line-height:1.75;
    color:rgba(255,255,255,.82);
    margin:0 auto 14px;
    max-width:350px;
  }
  .kyl-islamic-ref{
    position:relative;
    display:inline-flex;
    justify-content:center;
    align-items:center;
    min-height:30px;
    border-radius:999px;
    padding:6px 12px;
    font-size:11px;
    color:#7ee787;
    background:rgba(34,197,94,.12);
    border:.5px solid rgba(34,197,94,.20);
    font-weight:800;
  }
  .kyl-islamic-hint{
    position:relative;
    margin-top:18px;
    font-size:11px;
    color:rgba(255,255,255,.54);
    font-weight:700;
    letter-spacing:.06em;
  }
  @keyframes kylOverlayIn{from{opacity:0}to{opacity:1}}
  @keyframes kylModalPop{from{opacity:0;transform:scale(.96) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}

  /* ── KAYALA V3 ULTIMATE REFINEMENT ── */
  ::selection{background:rgba(34,197,94,.28);color:var(--text)}
  *:focus-visible{outline:2px solid rgba(34,197,94,.55);outline-offset:2px}
  .kyl-wrap::-webkit-scrollbar{width:4px}
  .kyl-wrap::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px}

  .kyl-page-view{
    display:flex;
    flex-direction:column;
    gap:10px;
    animation:kylPageIn .34s cubic-bezier(.2,.85,.2,1) both;
  }
  @keyframes kylPageIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

  .kyl-page-header{
    display:flex;
    align-items:center;
    gap:14px;
    padding:4px 2px 14px;
    margin-bottom:2px;
  }
  .kyl-page-header-icon{
    width:52px;height:52px;border-radius:18px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
    background:linear-gradient(145deg, rgba(34,197,94,.18), rgba(242,201,76,.10));
    border:.5px solid rgba(242,201,76,.22);
    box-shadow:var(--shadow-card);
    color:var(--gold-l);
  }
  .kyl-light .kyl-page-header-icon{color:var(--gold);}
  .kyl-page-header-title{
    font-size:24px;font-weight:800;letter-spacing:-.7px;line-height:1.05;color:var(--text);margin:0;
  }
  .kyl-page-header-desc{font-size:12px;color:var(--text2);line-height:1.55;margin:4px 0 0;}

  .kyl-activity-dot{
    display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;
    box-shadow:0 0 0 3px rgba(255,255,255,.04);
  }
  .kyl-activity-dot--green{background:#34d468;box-shadow:0 0 0 3px rgba(52,212,104,.16)}
  .kyl-activity-dot--red{background:#ff3b30;box-shadow:0 0 0 3px rgba(255,59,48,.14)}
  .kyl-activity-dot--amber{background:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.14)}
  .kyl-activity-dot--blue{background:#5a70e8;box-shadow:0 0 0 3px rgba(90,112,232,.14)}
  .kyl-activity-dot--brown{background:#c8956a;box-shadow:0 0 0 3px rgba(139,94,60,.14)}
  .kyl-activity-dot--neutral{background:#636366}

  .kyl-svg-icon--sm{width:16px;height:16px}
  .kyl-svg-icon--lg{width:26px;height:26px}

  .kyl-theme-toggle{
    width:58px;height:32px;border-radius:999px;border:none;cursor:pointer;position:relative;flex-shrink:0;
    background:linear-gradient(135deg, rgba(34,197,94,.35), rgba(34,197,94,.18));
    border:.5px solid rgba(34,197,94,.28);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 8px 20px rgba(34,197,94,.12);
    transition:background .25s, box-shadow .25s;
  }
  .kyl-theme-toggle.is-light{
    background:linear-gradient(135deg, rgba(251,191,36,.35), rgba(251,191,36,.16));
    border-color:rgba(251,191,36,.28);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.25), 0 8px 20px rgba(251,191,36,.12);
  }
  .kyl-theme-toggle-knob{
    position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;
    background:#fff;display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 8px rgba(0,0,0,.22);
    transition:transform .28s cubic-bezier(.2,.85,.2,1);
    color:#0f172a;
  }
  .kyl-theme-toggle.is-dark .kyl-theme-toggle-knob{transform:translateX(26px)}
  .kyl-theme-toggle .kyl-svg-icon{width:14px;height:14px;stroke-width:2.2}

  .kyl-reminder-banner{
    padding:14px 16px;border-radius:20px;margin-bottom:10px;
    background:linear-gradient(135deg, rgba(242,201,76,.12), rgba(242,201,76,.04));
    border:.5px solid rgba(242,201,76,.24);
    display:flex;justify-content:space-between;align-items:center;gap:12px;
    box-shadow:var(--shadow-card);
  }
  .kyl-reminder-title{font-weight:800;font-size:12.5px;color:var(--gold);line-height:1.35}
  .kyl-reminder-sub{font-size:10.5px;color:var(--text2);margin-top:3px;line-height:1.45}
  .kyl-reminder-done{font-size:10px;color:var(--primary-l);margin-top:4px;font-weight:700}
  .kyl-reminder-action{
    background:linear-gradient(135deg, var(--gold), var(--gold-l));color:#1f1600;border:none;
    border-radius:12px;padding:8px 14px;font-size:11px;font-weight:800;cursor:pointer;flex-shrink:0;
    display:inline-flex;align-items:center;gap:4px;font-family:var(--font);
    box-shadow:0 8px 20px var(--gold-glow);
  }
  .kyl-reminder-action:active{transform:scale(.96)}

  .kyl-chip{
    padding:6px 12px;border-radius:999px;border:.5px solid var(--border);
    background:var(--glass);color:var(--text2);font-size:10px;font-weight:700;
    cursor:pointer;font-family:var(--font);transition:background .15s, color .15s, border-color .15s;
  }
  .kyl-chip:active{background:var(--surface3);color:var(--text)}

  .kyl-stat-card{
    transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease;
    cursor:pointer;
  }
  .kyl-stat-card:active{transform:scale(.98)}
  @media (hover:hover){
    .kyl-stat-card:hover{
      transform:translateY(-2px);
      box-shadow:0 16px 40px rgba(0,0,0,.22);
      border-color:rgba(34,197,94,.22);
    }
  }

  .kyl-toast{
    animation:kylToastIn .32s cubic-bezier(.2,.85,.2,1) both;
    max-width:min(92vw, 360px);white-space:normal;text-align:center;line-height:1.45;
  }
  @keyframes kylToastIn{from{opacity:0;transform:translate(-50%,-12px)}to{opacity:1;transform:translate(-50%,0)}}

  .kyl-search-icon{
    position:absolute;left:12px;top:50%;transform:translateY(-50%);
    color:var(--text3);pointer-events:none;display:flex;align-items:center;
  }
  .kyl-search-icon .kyl-svg-icon{width:17px;height:17px;stroke-width:2.1}

  .kyl-alert-bar{
    border-radius:18px;padding:12px 14px;align-items:flex-start;
    backdrop-filter:blur(12px);box-shadow:var(--shadow-card);
  }
  .kyl-alert-icon{
    width:34px;height:34px;border-radius:12px;display:flex;align-items:center;justify-content:center;
    background:rgba(255,59,48,.12);color:#ff6b63;flex-shrink:0;
  }
  .kyl-alert-icon .kyl-svg-icon{width:18px;height:18px}

  .kyl-empty{
    border:.5px dashed var(--border);border-radius:18px;padding:28px 18px;
    background:linear-gradient(180deg, var(--surface2), transparent);
  }
  .kyl-empty::before{
    content:'';display:block;width:36px;height:36px;margin:0 auto 10px;border-radius:12px;
    background:linear-gradient(135deg, rgba(34,197,94,.12), rgba(242,201,76,.10));
    border:.5px solid var(--border);
  }

  .kyl-sec-title{
    position:relative;padding-left:2px;
  }
  .kyl-sec-title::after{
    content:'';display:block;width:42px;height:3px;border-radius:999px;margin-top:8px;
    background:linear-gradient(90deg, var(--gold), transparent);
    opacity:.85;
  }

  .kyl-tab-btn.active::before{
    content:'';position:absolute;top:6px;left:50%;transform:translateX(-50%);
    width:18px;height:3px;border-radius:999px;
    background:linear-gradient(90deg, var(--primary-l), var(--gold));
    opacity:.95;
  }
  .kyl-tab-btn{position:relative}

  .kyl-islamic-modal .kyl-islamic-kicker .kyl-islamic-tag{
    margin-left:6px;padding:2px 8px;border-radius:999px;
    background:rgba(255,255,255,.12);color:#fff;font-size:9px;letter-spacing:.08em;
  }

  .kyl-chart-bar{box-shadow:0 -4px 16px rgba(34,197,94,.12)}
  .kyl-subtab-row{box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
  .kyl-subtab-btn.active{box-shadow:0 6px 18px rgba(0,0,0,.12)}

  .kyl-tab-btn.active .kyl-tab-icon .kyl-svg-icon{
    stroke-width:2.35;
    filter:drop-shadow(0 2px 8px rgba(34,197,94,.22));
  }
  .kyl-clock-card{
    text-shadow:0 1px 18px rgba(0,0,0,.12);
  }
  .kyl-brand-pill::after{
    content:'';position:absolute;inset:auto 18px 0 18px;height:1px;
    background:linear-gradient(90deg, transparent, rgba(242,201,76,.45), transparent);
  }
  .kyl-brand-pill{position:relative;overflow:hidden}

  .kyl-fab{
    background:linear-gradient(135deg, #0f8f55, #22c55e);
    box-shadow:0 10px 30px var(--primary-glow);
  }

  @media (max-width:360px){
    .kyl-wrap{padding-left:12px;padding-right:12px;}
    .kyl-tab-lbl{font-size:7.2px;}
    .kyl-svg-icon{width:19px;height:19px;}
    .kyl-stat-val{font-size:19px;}
    .kyl-social-btn{font-size:9px;padding:7px 8px;gap:5px;}
    .kyl-social-icon,.kyl-social-icon svg{width:16px;height:16px;}
  }
  @media (prefers-reduced-motion:reduce){
    *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important;}
  }

  @media print{body{background:white!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.no-print{display:none!important}@page{margin:1cm}}
`;

function statusStyle(type) {
  if (type === "welcome")
    return {
      color: "var(--indigo)",
      background: "rgba(90,112,232,0.05)",
      borderColor: "rgba(90,112,232,0.12)",
    };
  if (type === "warn")
    return {
      color: "var(--amber)",
      background: "rgba(245,158,11,0.05)",
      borderColor: "rgba(245,158,11,0.15)",
    };
  if (type === "danger")
    return {
      color: "#ff6b63",
      background: "rgba(255,59,48,0.05)",
      borderColor: "rgba(255,59,48,0.12)",
    };
  return {
    color: "var(--primary-l)",
    background: "rgba(52,212,104,0.05)",
    borderColor: "rgba(52,212,104,0.12)",
  };
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home");
  const [dark, setDark] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [showIslamicReminder, setShowIslamicReminder] = useState(true);
  const [openingReminder] = useState(() => getRandomIslamicReminder());

  // Clock
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [currentDateStr, setCurrentDateStr] = useState("");

  // Ops form states
  const [eggInputQty, setEggInputQty] = useState("");
  const [operasionalInput, setOperasionalInput] = useState("");
  const [eggCategory, setEggCategory] = useState(QUICK_HARVEST_LABEL);
  const [prodDate, setProdDate] = useState(todayStr());
  const [cfDate, setCfDate] = useState(todayStr());
  const [cfName, setCfName] = useState("");
  const [cfNominalDisplay, setCfNominalDisplay] = useState("");
  const [cfNominalRaw, setCfNominalRaw] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(todayStr());
  const [deliveryCust, setDeliveryCust] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(
    DEFAULT_ACTIVE_PRODUCT
  );
  const [deliveryQty, setDeliveryQty] = useState("1");
  const [deliveryTime, setDeliveryTime] = useState("08:00");

  // Packing center
  const [packingProduct, setPackingProduct] = useState(DEFAULT_ACTIVE_PRODUCT);
  const [packingQty, setPackingQty] = useState("");
  const [packingEggPerBox, setPackingEggPerBox] = useState("10");
  const [packingNote, setPackingNote] = useState("");

  // Inline editor
  const [editId, setEditId] = useState(null);
  const [editVal1, setEditVal1] = useState("");
  const [editVal2, setEditVal2] = useState("");
  const [editVal3, setEditVal3] = useState("");
  const [editVal4, setEditVal4] = useState("");

  // Flock data
  const [flockData, setFlockData] = useState({
    tanggalMasuk: todayStr(),
    jenisAyam: "Lohman Brown Platinum",
    umurAwalMinggu: 13,
    targetAfkirMinggu: 120,
    totalAyam: 49,
  });

  // Cloud data
  const [production, setProduction] = useState(INITIAL_PRODUCTION);
  const [cashflow, setCashflow] = useState(INITIAL_CASHFLOW);
  const [deliveries, setDeliveries] = useState(INITIAL_DELIVERIES);
  const [operasional, setOperasional] = useState(INITIAL_OPERASIONAL);
  const [activities, setActivities] = useState(INITIAL_ACTIVITIES);

  // ─── OMEGA-3 SYSTEM STATES ────────────────────────────────────────────────
  const [hdpInput, setHdpInput] = useState("");
  const [hdpResult, setHdpResult] = useState(null); // { text, type }
  const [feedWeightInput, setFeedWeightInput] = useState("6");
  const [formulaCalc, setFormulaCalc] = useState({
    feed: 6,
    f1Flax: 60,
    f2Flax: 90,
    f3Flax: 120,
    oil: 30,
  });
  const [omegaChecklist, setOmegaChecklist] = useState({});
  const [weekNotes, setWeekNotes] = useState({
    m1: "",
    m2: "",
    m3: "",
    m4: "",
  });

  // ─── STOK STATES ──────────────────────────────────────────────────────────
  const [stokBarang, setStokBarang] = useState(INITIAL_STOK_BARANG);
  const [stokPakan, setStokPakan] = useState(INITIAL_STOK_PAKAN);
  const [pakanJadwal, setPakanJadwal] = useState(INITIAL_PAKAN_JADWAL);
  const [pakanJadwalEdit, setPakanJadwalEdit] = useState(INITIAL_PAKAN_JADWAL);
  // ─── MASTER PRODUK, HARGA & PELANGGAN ──────────────────────────────────────
  const [masterProduk, setMasterProduk] = useState(DEFAULT_MASTER_PRODUK);
  const [produkNama, setProdukNama] = useState("");
  const [produkType, setProdukType] = useState("Pcs");
  const [produkHarga, setProdukHarga] = useState("");
  const [produkIsiTelur, setProdukIsiTelur] = useState("0");
  const [produkCatatan, setProdukCatatan] = useState("");
  const [produkAktif, setProdukAktif] = useState(true);
  const [produkEditId, setProdukEditId] = useState(null);
  const [hargaProduk, setHargaProduk] = useState(DEFAULT_HARGA);
  const [pelanggan, setPelanggan] = useState(INITIAL_PELANGGAN);
  const [hargaEdit, setHargaEdit] = useState({ ...DEFAULT_HARGA });

  const [noWAEdit, setNoWAEdit] = useState({});
  const [vendorLinks, setVendorLinks] = useState(INITIAL_VENDOR_LINKS);
  const [vendorNama, setVendorNama] = useState("");
  const [vendorKategori, setVendorKategori] = useState("Pakan");
  const [vendorLink, setVendorLink] = useState("");
  const [vendorCatatan, setVendorCatatan] = useState("");
  const [vendorAktif, setVendorAktif] = useState(true);
  const [vendorEditId, setVendorEditId] = useState(null);
  const [flockMutations, setFlockMutations] = useState([]);
  const [mutasiJenis, setMutasiJenis] = useState("mati");
  const [mutasiTanggal, setMutasiTanggal] = useState(todayStr());
  const [mutasiJam, setMutasiJam] = useState(
    new Date().toTimeString().slice(0, 5)
  );
  const [mutasiJumlah, setMutasiJumlah] = useState("");
  const [mutasiCatatan, setMutasiCatatan] = useState("");

  // ─── LOADING & SHEET ──────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [sheet, setSheet] = useState(null);

  // ─── SUB-TABS ─────────────────────────────────────────────────────────────
  const [kasSubTab, setKasSubTab] = useState("transaksi");
  const [pesananSubTab, setPesananSubTab] = useState("log");

  // ─── SEARCH / FILTER ──────────────────────────────────────────────────────
  const [searchProd, setSearchProd] = useState("");
  const [searchKas, setSearchKas] = useState("");
  const [searchDelivery, setSearchDelivery] = useState("");
  const [searchPelanggan, setSearchPelanggan] = useState("");

  // ─── SWIPE STATE ──────────────────────────────────────────────────────────
  const [swiped, setSwiped] = useState({});
  const [confirmPakan, setConfirmPakan] = useState(false);
  const [confirmResetChecklist, setConfirmResetChecklist] = useState(false);
  const touchStartX = React.useRef({});

  // Form stok barang
  const [stokNama, setStokNama] = useState("Telur Ayam");
  const [stokSatuan, setStokSatuan] = useState("Butir");
  const [stokJumlah, setStokJumlah] = useState("");
  const [stokMinAlert, setStokMinAlert] = useState("10");
  // Penyesuaian inline
  const [stokAdjId, setStokAdjId] = useState(null);
  const [stokAdjVal, setStokAdjVal] = useState("");
  // Tambah pakan
  const [tambahJapfa, setTambahJapfa] = useState("");
  const [tambahFlax, setTambahFlax] = useState("");
  const [tambahOil, setTambahOil] = useState("");

  // ─── PAKAN INLINE EDIT ────────────────────────────────────────────────────
  const [pakanEditKey, setPakanEditKey] = useState(null);
  const [pakanEditMode, setPakanEditMode] = useState(null);
  const [pakanEditVal, setPakanEditVal] = useState("");
  const [confirmPakanBeranda, setConfirmPakanBeranda] = useState(false);
  const [showPakanReminder, setShowPakanReminder] = useState(false);
  const [confirmPakanSesi, setConfirmPakanSesi] = useState(null);
  const [pagiDone, setPagiDone] = useState(
    () =>
      localStorage.getItem(
        "pakan-pagi-" + new Date().toISOString().slice(0, 10)
      ) === "1"
  );
  const [soreDone, setSoreDone] = useState(
    () =>
      localStorage.getItem(
        "pakan-sore-" + new Date().toISOString().slice(0, 10)
      ) === "1"
  );
  const [pakanSesiWindow, setPakanSesiWindow] = useState(null);
  const [laporanBulan, setLaporanBulan] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [kritikInput, setKritikInput] = useState("");
  const [kritikList, setKritikList] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("kayala-kritik") || "[]");
    } catch (e) {
      return [];
    }
  });

  const productMenu = masterProduk
    .filter((p) => p.active !== false)
    .map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type || "Pcs",
      price: parseInt(p.price) || 0,
      isiTelur: parseInt(p.isiTelur) || 0,
    }));

  // ─── FIREBASE SYNC ────────────────────────────────────────────────────────
  useEffect(() => {
    const kayalaRef = ref(db, "kayala_farm_cloud_data");
    const unsubscribe = onValue(kayalaRef, (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.val() || {};
        setFlockData(
          d.flockData || {
            tanggalMasuk: todayStr(),
            jenisAyam: "Lohman Brown Platinum",
            umurAwalMinggu: 0,
            targetAfkirMinggu: 120,
            totalAyam: 0,
          }
        );
        setProduction(d.production || INITIAL_PRODUCTION);
        setCashflow(d.cashflow || INITIAL_CASHFLOW);
        setDeliveries(d.deliveries || INITIAL_DELIVERIES);
        setOperasional(d.operasional || INITIAL_OPERASIONAL);
        setActivities(d.activities || INITIAL_ACTIVITIES);
        setStokBarang(d.stokBarang || INITIAL_STOK_BARANG);
        setStokPakan(d.stokPakan || INITIAL_STOK_PAKAN);
        const nextPakan = d.pakanJadwal || INITIAL_PAKAN_JADWAL;
        setPakanJadwal(normalizePakanJadwal(nextPakan));
        setPakanJadwalEdit(normalizePakanJadwal(nextPakan));
        const nextMaster = d.masterProduk || DEFAULT_MASTER_PRODUK;
        setMasterProduk(nextMaster);
        setHargaProduk(
          d.hargaProduk || buildHargaMapFromProduk(nextMaster) || DEFAULT_HARGA
        );
        setPelanggan(d.pelanggan || INITIAL_PELANGGAN);
        setHargaEdit(
          d.hargaProduk || buildHargaMapFromProduk(nextMaster) || DEFAULT_HARGA
        );
        setFlockMutations(d.flockMutations || []);
        setVendorLinks(d.vendorLinks || INITIAL_VENDOR_LINKS);
      } else {
        set(kayalaRef, {
          flockData: {
            tanggalMasuk: todayStr(),
            jenisAyam: "Lohman Brown Platinum",
            umurAwalMinggu: 0,
            targetAfkirMinggu: 120,
            totalAyam: 0,
          },
          production: INITIAL_PRODUCTION,
          cashflow: INITIAL_CASHFLOW,
          deliveries: INITIAL_DELIVERIES,
          operasional: INITIAL_OPERASIONAL,
          activities: INITIAL_ACTIVITIES,
          stokBarang: INITIAL_STOK_BARANG,
          stokPakan: INITIAL_STOK_PAKAN,
          pakanJadwal: INITIAL_PAKAN_JADWAL,
          masterProduk: DEFAULT_MASTER_PRODUK,
          hargaProduk: DEFAULT_HARGA,
          pelanggan: INITIAL_PELANGGAN,
          vendorLinks: INITIAL_VENDOR_LINKS,
          flockMutations: [],
        });
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const pushToFirebase = (u = {}) => {
    const r2 = ref(db, "kayala_farm_cloud_data");
    const payload = {};
    Object.entries(u).forEach(([key, value]) => {
      if (value !== undefined) payload[key] = value;
    });
    if (Object.keys(payload).length > 0) {
      update(r2, payload);
    }
  };

  useEffect(() => {
    const hargaMap = buildHargaMapFromProduk(masterProduk);
    setHargaProduk(hargaMap);
    setHargaEdit(hargaMap);
    if (
      masterProduk.length > 0 &&
      !masterProduk.some((p) => p.name === selectedProduct)
    ) {
      setSelectedProduct(getProdukAktifPertama(masterProduk));
    }
    if (
      masterProduk.length > 0 &&
      !masterProduk.some((p) => p.name === packingProduct)
    ) {
      setPackingProduct(getProdukAktifPertama(masterProduk));
    }
  }, [masterProduk]);

  // ─── CLOCK ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const upd = () => {
      const d = new Date();
      setCurrentTimeStr(d.toTimeString().slice(0, 5));
      setCurrentDateStr(
        d.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
      // Window pakan: Pagi 05:00-10:00, Sore 14:00-19:00
      const h = d.getHours();
      const totalMin = h * 60 + d.getMinutes();
      const inPagi = totalMin >= 300 && totalMin < 600;
      const inSore = totalMin >= 840 && totalMin < 1140;
      setShowPakanReminder(inPagi || inSore);
      setPakanSesiWindow(inPagi ? "pagi" : inSore ? "sore" : null);
      // Reset done status at midnight
      const todayKey = d.toISOString().slice(0, 10);
      const pg = localStorage.getItem("pakan-pagi-" + todayKey) === "1";
      const sr = localStorage.getItem("pakan-sore-" + todayKey) === "1";
      setPagiDone(pg);
      setSoreDone(sr);
    };
    upd();
    const t = setInterval(upd, 1000);
    return () => clearInterval(t);
  }, []);

  // ─── OMEGA-3 LOCALSTORAGE ─────────────────────────────────────────────────
  useEffect(() => {
    const ids = [
      "chk-air-p",
      "chk-air-s",
      "chk-air-o",
      "chk-telur-p",
      "chk-telur-s",
      "chk-telur-o",
      "chk-lemas-p",
      "chk-lemas-s",
      "chk-lemas-o",
      "chk-feses-p",
      "chk-feses-s",
      "chk-feses-o",
      "chk-pk-p",
      "chk-pk-o",
      "chk-flax-p",
      "chk-flax-o",
      "chk-oil-p",
      "chk-oil-o",
    ];
    const saved = {};
    ids.forEach((id) => {
      if (localStorage.getItem(id) === "1") saved[id] = true;
    });
    setOmegaChecklist(saved);
    const notes = {};
    ["m1", "m2", "m3", "m4"].forEach((k) => {
      const v = localStorage.getItem("note-" + k);
      if (v) notes[k] = v;
    });
    setWeekNotes((n) => ({ ...n, ...notes }));
    if (localStorage.getItem("kyl-theme") === "light") setDark(false);
  }, []);

  useEffect(() => {
    Object.entries(omegaChecklist).forEach(([id, val]) =>
      localStorage.setItem(id, val ? "1" : "0")
    );
  }, [omegaChecklist]);

  useEffect(() => {
    localStorage.setItem("kyl-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") setShowIslamicReminder(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", dark ? "#05070b" : "#f5f6f8");
  }, [dark]);

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  const getSapaanWaktu = () => {
    const h = new Date().getHours();
    if (h >= 4 && h < 11) return "Selamat Pagi";
    if (h >= 11 && h < 15) return "Selamat Siang";
    if (h >= 15 && h < 18) return "Selamat Sore";
    return "Selamat Malam";
  };

  const calculateFlockAge = () => {
    if (!flockData.totalAyam || flockData.totalAyam === 0)
      return { mingguNow: 0, hariNow: 0, sisaMinggu: 0, sisaHari: 0 };
    const sel = Math.floor(
      (new Date() - new Date(flockData.tanggalMasuk)) / (1000 * 3600 * 24)
    );
    const total =
      parseInt(flockData.umurAwalMinggu || 0) * 7 + (sel > 0 ? sel : 0);
    const sisa = parseInt(flockData.targetAfkirMinggu || 120) * 7 - total;
    return {
      mingguNow: Math.floor(total / 7),
      hariNow: total,
      sisaMinggu: Math.max(0, Math.floor(sisa / 7)),
      sisaHari: Math.max(0, sisa % 7),
    };
  };
  const timeAge = calculateFlockAge();

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 2200);
  };

  // ─── OPS HANDLERS ────────────────────────────────────────────────────────
  const handleFastInput = (type, value) => {
    if (!value || value.trim() === "")
      return showToast("⚠️ Kolom laporan masih kosong!");
    const id = Date.now();
    if (type === "operasional") {
      const entry = {
        id,
        kategori: "Lainnya",
        deskripsi: value,
        prioritas: "normal",
        date: todayStr(),
      };
      const nOps = [entry, ...operasional];
      const nAct = [
        {
          id,
          refId: id,
          title: "Kondisi Kandang",
          detail: value,
          time: currentTimeStr,
          dot: "blue",
        },
        ...activities,
      ];
      setOperasional(nOps);
      setActivities(nAct);
      pushToFirebase({ operasional: nOps, activities: nAct });
      setOperasionalInput("");
    }
    if (type === "produksi") setEggInputQty("");
    showToast("✅ Log operasional kandang disimpan!");
  };

  const handleInputProduksi = () => {
    if (!eggInputQty) return showToast("⚠️ Jumlah butir wajib diisi!");
    const qty = parseInt(eggInputQty) || 0;
    const id = Date.now();
    const entry = {
      id,
      date: prodDate,
      jumlah: qty,
      kandang: eggCategory,
      catatan: "",
    };
    const nProd = [entry, ...production];
    const nAct = [
      {
        id,
        refId: id,
        title: `Produksi ${eggCategory}`,
        detail: `${eggCategory} • ${qty} butir (${prodDate})`,
        time: currentTimeStr,
        dot: isCacatEggCategory(eggCategory)
          ? "red"
          : isQuickHarvestCategory(eggCategory)
          ? "green"
          : "amber",
      },
      ...activities,
    ];
    // Auto-update stok telur dari produksi
    let nSB = [...stokBarang];
    const telurItem = nSB.find(
      (s) =>
        s.nama.toLowerCase().includes("telur") &&
        s.satuan.toLowerCase() === "butir"
    );
    if (telurItem) {
      if (isCacatEggCategory(eggCategory)) {
        nSB = nSB.map((s) =>
          s.id === telurItem.id
            ? { ...s, jumlah: Math.max(0, s.jumlah - qty) }
            : s
        );
      } else if (isQuickHarvestCategory(eggCategory)) {
        nSB = nSB.map((s) =>
          s.id === telurItem.id ? { ...s, jumlah: s.jumlah + qty } : s
        );
      }
      // Kategori spesifik dipakai sebagai hasil sortir; tidak mengubah stok total lagi.
    }
    setProduction(nProd);
    setActivities(nAct);
    setStokBarang(nSB);
    pushToFirebase({ production: nProd, activities: nAct, stokBarang: nSB });
    setEggInputQty("");
    setProdDate(todayStr());
    setSheet(null);
    showToast("✅ Data produksi tersimpan!");
  };

  const handleInputKas = (jenis) => {
    if (!cfNominalRaw || !cfName)
      return showToast("⚠️ Nominal & keterangan wajib diisi!");
    const id = Date.now();
    const nominal = parseInt(cfNominalRaw) || 0;
    const entry = { id, date: cfDate, jenis, nominal, keterangan: cfName };
    const nCf = [entry, ...cashflow];
    const nAct = [
      {
        id,
        refId: id,
        title: cfName,
        detail: `${jenis === "masuk" ? "+" : "-"}${formatToK(
          nominal
        )} (${cfDate})`,
        time: currentTimeStr,
        dot: jenis === "masuk" ? "green" : "red",
      },
      ...activities,
    ];
    setCashflow(nCf);
    setActivities(nAct);
    pushToFirebase({ cashflow: nCf, activities: nAct });
    setCfName("");
    setCfDate(todayStr());
    setCfNominalDisplay("");
    setCfNominalRaw("");
    showToast("✅ Transaksi arus kas disimpan!");
  };

  const handleInputDelivery = () => {
    if (!deliveryCust || !deliveryQty)
      return showToast("⚠️ Nama pembeli & volume wajib diisi!");
    const id = Date.now();
    const match = productMenu.find((p) => p.name === selectedProduct);
    const unitLabel = match ? match.type : "Pcs";
    const entry = {
      id,
      invoice: makeInvoiceCode(deliveryDate, id),
      customer: deliveryCust,
      jumlah: deliveryQty,
      product: selectedProduct,
      unit: unitLabel,
      date: deliveryDate,
      note: deliveryNote,
      jam: deliveryTime,
      status: "pending",
    };
    const nDeliv = [entry, ...deliveries];
    const nAct = [
      {
        id,
        refId: id,
        title: `Pesanan: ${deliveryCust}`,
        detail: `Muatan ${deliveryQty} ${unitLabel} (${deliveryDate})`,
        time: currentTimeStr,
        dot: "amber",
      },
      ...activities,
    ];
    // Auto-save / update pelanggan baru — single push setelah semua state siap
    let nPel = [...pelanggan];
    const existPel = nPel.find(
      (p) => p.nama.toLowerCase() === deliveryCust.toLowerCase()
    );
    if (!existPel) {
      nPel = [
        {
          id: Date.now() + 99,
          nama: deliveryCust,
          noWA: "",
          totalOrder: 1,
          lastOrder: deliveryDate,
        },
        ...nPel,
      ];
    } else {
      nPel = nPel.map((p) =>
        p.nama.toLowerCase() === deliveryCust.toLowerCase()
          ? {
              ...p,
              totalOrder: (p.totalOrder || 0) + 1,
              lastOrder: deliveryDate,
            }
          : p
      );
    }
    setDeliveries(nDeliv);
    setActivities(nAct);
    setPelanggan(nPel);
    pushToFirebase({ deliveries: nDeliv, activities: nAct, pelanggan: nPel });
    setDeliveryCust("");
    setDeliveryQty("1");
    setDeliveryNote("");
    setDeliveryDate(todayStr());
    setSheet(null);
    showToast("✅ Log distribusi pesanan disimpan!");
  };

  const handleDeleteItem = (targetType, id) => {
    let nP = production,
      nC = cashflow,
      nD = deliveries,
      nO = operasional;
    let nA = activities.filter((x) => x.id !== id && x.refId !== id);
    if (targetType === "produksi") {
      nP = production.filter((x) => x.id !== id);
      setProduction(nP);
    }
    if (targetType === "cashflow") {
      nC = cashflow.filter((x) => x.id !== id);
      setCashflow(nC);
    }
    if (targetType === "delivery") {
      nD = deliveries.filter((x) => x.id !== id);
      setDeliveries(nD);
    }
    if (targetType === "operasional") {
      nO = operasional.filter((x) => x.id !== id);
      setOperasional(nO);
    }
    if (targetType === "activities") {
      nA = activities.filter((x) => x.id !== id);
    }
    setActivities(nA);
    setEditVal4("");
    pushToFirebase({
      production: nP,
      cashflow: nC,
      deliveries: nD,
      operasional: nO,
      activities: nA,
    });
    showToast("🗑️ Data dan Log Aktivitas dibersihkan!");
  };

  const handleUpdateItem = (targetType, id) => {
    let nP = production,
      nC = cashflow,
      nD = deliveries,
      nA = activities;
    if (targetType === "produksi") {
      nP = production.map((x) =>
        x.id === id
          ? { ...x, kandang: editVal1, jumlah: parseInt(editVal2) || 0 }
          : x
      );
      nA = activities.map((a) =>
        a.refId === id
          ? {
              ...a,
              title: `Produksi ${editVal1}`,
              detail: `+${editVal2} butir telur`,
            }
          : a
      );
      setProduction(nP);
    } else if (targetType === "cashflow") {
      nC = cashflow.map((x) =>
        x.id === id
          ? { ...x, keterangan: editVal1, nominal: parseInt(editVal2) || 0 }
          : x
      );
      nA = activities.map((a) =>
        a.refId === id
          ? {
              ...a,
              title: editVal1,
              detail: `Ubah mutasi data ke Rp ${formatNominal(editVal2)}`,
            }
          : a
      );
      setCashflow(nC);
    } else if (targetType === "delivery") {
      const match = productMenu.find((p) => p.name === editVal4);
      const unitLabel = match ? match.type : "Pcs";
      nD = deliveries.map((x) =>
        x.id === id
          ? {
              ...x,
              customer: editVal1,
              jumlah: editVal2,
              jam: editVal3,
              product: editVal4 || x.product,
              unit: unitLabel,
            }
          : x
      );
      nA = activities.map((a) =>
        a.refId === id
          ? {
              ...a,
              title: `Pesanan: ${editVal1}`,
              detail: `Muatan ${editVal2} ${unitLabel} jam ${editVal3}`,
            }
          : a
      );
      setDeliveries(nD);
    } else if (targetType === "activities") {
      nA = activities.map((x) =>
        x.id === id ? { ...x, title: editVal1, detail: editVal2 } : x
      );
    }
    setActivities(nA);
    setEditVal4("");
    pushToFirebase({
      production: nP,
      cashflow: nC,
      deliveries: nD,
      activities: nA,
    });
    setEditId(null);
    showToast("✏️ Perubahan data berhasil disimpan!");
  };

  const handleUpdateFlock = () => {
    pushToFirebase({ flockData });
    showToast("✅ Data konfigurasi siklus kandang cloud diperbarui!");
  };

  const handleCompleteDelivery = (id) => {
    const d = deliveries.find((x) => x.id === id);
    const nD = deliveries.map((x) =>
      x.id === id ? { ...x, status: "selesai" } : x
    );
    let nA = [...activities];
    let nCf = [...cashflow];

    // ── Auto-cashflow dari harga produk ──
    if (d) {
      const harga = getProdukHargaByNama(d.product, hargaProduk, masterProduk);
      const totalHarga = harga * (parseInt(d.jumlah) || 1);
      if (totalHarga > 0) {
        const kasId = Date.now() + 1;
        const kasEntry = {
          id: kasId,
          date: todayStr(),
          jenis: "masuk",
          nominal: totalHarga,
          keterangan: `Penjualan ${d.product} — ${d.customer}`,
        };
        nCf = [kasEntry, ...nCf];
        nA = [
          {
            id: Date.now() + 2,
            refId: kasId,
            title: kasEntry.keterangan,
            detail: `+${formatToK(totalHarga)} otomatis`,
            time: currentTimeStr,
            dot: "green",
          },
          ...nA,
        ];
      }
      nA = [
        {
          id: Date.now(),
          refId: id,
          title: "✅ Pesanan Selesai",
          detail: `${d.customer} — ${d.product} (${d.jumlah} ${
            d.unit || "Pcs"
          })`,
          time: currentTimeStr,
          dot: "green",
        },
        ...nA,
      ];
    }

    // ── Auto-kurang stok telur & karton ──
    let nSB = [...stokBarang];
    if (d) {
      const telurItem = nSB.find(
        (s) =>
          s.nama.toLowerCase().includes("telur") &&
          s.satuan.toLowerCase() === "butir"
      );
      if (telurItem) {
        let telurKurang = 0;
        const qty = parseInt(d.jumlah) || 1;
        if (d.product.includes("Isi 10")) telurKurang = 10 * qty;
        else if (d.product.includes("Isi 4")) telurKurang = 4 * qty;
        else if (d.product.includes("Hampers")) telurKurang = 12 * qty;
        if (telurKurang > 0)
          nSB = nSB.map((s) =>
            s.id === telurItem.id
              ? { ...s, jumlah: Math.max(0, s.jumlah - telurKurang) }
              : s
          );
      }
      if (d.product.includes("Isi 10")) {
        const k10 = nSB.find(
          (s) =>
            s.nama.toLowerCase().includes("karton") && s.nama.includes("10")
        );
        if (k10)
          nSB = nSB.map((s) =>
            s.id === k10.id
              ? {
                  ...s,
                  jumlah: Math.max(0, s.jumlah - (parseInt(d.jumlah) || 1)),
                }
              : s
          );
      }
      if (d.product.includes("Isi 4")) {
        const k4 = nSB.find(
          (s) => s.nama.toLowerCase().includes("karton") && s.nama.includes("4")
        );
        if (k4)
          nSB = nSB.map((s) =>
            s.id === k4.id
              ? {
                  ...s,
                  jumlah: Math.max(0, s.jumlah - (parseInt(d.jumlah) || 1)),
                }
              : s
          );
      }
    }

    setDeliveries(nD);
    setCashflow(nCf);
    setActivities(nA);
    setStokBarang(nSB);
    pushToFirebase({
      deliveries: nD,
      cashflow: nCf,
      activities: nA,
      stokBarang: nSB,
    });
    showToast("✅ Pesanan selesai — kas & stok diperbarui otomatis!");
  };

  const handleCompleteOperasional = (id) => {
    const nO = operasional.filter((o) => o.id !== id);
    const nA = [
      {
        id: Date.now(),
        refId: id,
        title: "✅ Isu Kandang Beres",
        detail: `Laporan diselesaikan (${currentTimeStr})`,
        time: currentTimeStr,
        dot: "green",
      },
      ...activities.filter((a) => a.refId !== id),
    ];
    setOperasional(nO);
    setActivities(nA);
    pushToFirebase({ operasional: nO, activities: nA });
    showToast("✅ Laporan isu kandang diselesaikan!");
  };

  // ─── STOK HANDLERS ───────────────────────────────────────────────────────
  const handleTambahStokBarang = () => {
    if (!stokNama || !stokJumlah)
      return showToast("⚠️ Nama & jumlah stok wajib diisi!");
    const jumlah = parseInt(stokJumlah) || 0;
    // Cek apakah item dengan nama yang sama sudah ada
    const existing = stokBarang.find(
      (s) =>
        s.nama.toLowerCase() === stokNama.toLowerCase() &&
        s.satuan.toLowerCase() === stokSatuan.toLowerCase()
    );
    let nSB;
    if (existing) {
      nSB = stokBarang.map((s) =>
        s.id === existing.id ? { ...s, jumlah: s.jumlah + jumlah } : s
      );
      showToast(`📦 Stok ${stokNama} ditambah ${jumlah} ${stokSatuan}!`);
    } else {
      const newItem = {
        id: Date.now(),
        nama: stokNama,
        satuan: stokSatuan,
        jumlah,
        minStok: parseInt(stokMinAlert) || 10,
      };
      nSB = [newItem, ...stokBarang];
      showToast(`📦 Item stok baru "${stokNama}" ditambahkan!`);
    }
    setStokBarang(nSB);
    pushToFirebase({ stokBarang: nSB });
    setStokJumlah("");
  };

  const handlePackingCenter = () => {
    const boxQty = parseInt(packingQty) || 0;
    const eggsPerPack = parseInt(packingEggPerBox) || 0;
    if (!packingProduct)
      return showToast("⚠️ Pilih produk packing terlebih dahulu!");
    if (boxQty <= 0 || eggsPerPack <= 0)
      return showToast("⚠️ Jumlah kemasan dan isi per kemasan wajib diisi!");
    const totalEggs = boxQty * eggsPerPack;
    const telurItem = stokBarang.find(
      (s) =>
        s.nama.toLowerCase().includes("telur") &&
        s.satuan.toLowerCase() === "butir"
    );
    if (!telurItem) return showToast("⚠️ Stok telur mentah belum ditemukan!");
    if ((telurItem.jumlah || 0) < totalEggs)
      return showToast(
        `⚠️ Stok telur kurang. Butuh ${totalEggs} butir, tersedia ${
          telurItem.jumlah || 0
        } butir.`
      );

    const nSB = stokBarang.map((s) =>
      s.id === telurItem.id ? { ...s, jumlah: s.jumlah - totalEggs } : s
    );

    const existingPack = nSB.find(
      (s) => s.nama.toLowerCase() === packingProduct.toLowerCase()
    );
    let finalSB;
    if (existingPack) {
      finalSB = nSB.map((s) =>
        s.id === existingPack.id ? { ...s, jumlah: s.jumlah + boxQty } : s
      );
    } else {
      finalSB = [
        {
          id: Date.now() + 7,
          nama: packingProduct,
          satuan: "Pcs",
          jumlah: boxQty,
          minStok: 10,
        },
        ...nSB,
      ];
    }

    const logId = Date.now();
    const nA = [
      {
        id: logId,
        refId: logId,
        title: `Packing ${packingProduct}`,
        detail: `${boxQty} kemasan × ${eggsPerPack} butir = ${totalEggs} butir${
          packingNote ? ` · ${packingNote}` : ""
        }`,
        time: currentTimeStr,
        dot: "amber",
      },
      ...activities,
    ];

    setStokBarang(finalSB);
    setActivities(nA);
    pushToFirebase({ stokBarang: finalSB, activities: nA });
    setPackingQty("");
    setPackingEggPerBox("10");
    setPackingNote("");
    showToast("✅ Packing otomatis berhasil disimpan!");
  };

  const handleAdjustStok = (id) => {
    const newQty = parseInt(stokAdjVal);
    if (isNaN(newQty) || newQty < 0)
      return showToast("⚠️ Masukkan angka yang valid!");
    const nSB = stokBarang.map((s) =>
      s.id === id ? { ...s, jumlah: newQty } : s
    );
    setStokBarang(nSB);
    pushToFirebase({ stokBarang: nSB });
    setStokAdjId(null);
    setStokAdjVal("");
    showToast("✅ Stok berhasil disesuaikan!");
  };

  const handleTambahSatuStok = (id) => {
    const nSB = stokBarang.map((s) =>
      s.id === id ? { ...s, jumlah: s.jumlah + 1 } : s
    );
    setStokBarang(nSB);
    pushToFirebase({ stokBarang: nSB });
  };

  const handleDeleteStok = (id) => {
    const nSB = stokBarang.filter((s) => s.id !== id);
    setStokBarang(nSB);
    pushToFirebase({ stokBarang: nSB });
    showToast("🗑️ Item stok dihapus!");
  };

  const handleTambahPakan = () => {
    if (!tambahJapfa && !tambahFlax && !tambahOil)
      return showToast("⚠️ Minimal satu pakan wajib diisi!");
    const addJapfa = parseFloat(tambahJapfa) || 0;
    const addFlax = parseFloat(tambahFlax) || 0;
    const addOil = parseFloat(tambahOil) || 0;
    const nSP = {
      japfaKg: (stokPakan.japfaKg || 0) + addJapfa,
      flaxGram: (stokPakan.flaxGram || 0) + addFlax,
      oilMl: (stokPakan.oilMl || 0) + addOil,
    };
    const nA = [
      {
        id: Date.now(),
        refId: Date.now(),
        title: "🌾 Stok Pakan Ditambah",
        detail: `Japfa +${formatTakaran(
          addJapfa
        )} kg · Flaxseed +${formatTakaran(
          addFlax
        )} g · Minyak Ikan +${formatTakaran(
          addOil
        )} ml (${todayStr()} ${currentTimeStr})`,
        time: currentTimeStr,
        dot: "brown",
      },
      ...activities,
    ];
    setStokPakan(nSP);
    setActivities(nA);
    pushToFirebase({ stokPakan: nSP, activities: nA });
    setTambahJapfa("");
    setTambahFlax("");
    setTambahOil("");
    showToast("🌾 Stok pakan berhasil ditambahkan!");
  };

  const normalizePakanJadwal = (draft = INITIAL_PAKAN_JADWAL) => ({
    pagi: {
      japfaKg: Math.max(0, Number(draft?.pagi?.japfaKg) || 0),
      flaxGram: Math.max(0, Number(draft?.pagi?.flaxGram) || 0),
      oilMl: Math.max(0, Number(draft?.pagi?.oilMl) || 0),
    },
    sore: {
      japfaKg: Math.max(0, Number(draft?.sore?.japfaKg) || 0),
      flaxGram: Math.max(0, Number(draft?.sore?.flaxGram) || 0),
      oilMl: Math.max(0, Number(draft?.sore?.oilMl) || 0),
    },
    updatedAt: draft?.updatedAt || "",
  });

  const handleSimpanPakanJadwal = () => {
    const next = {
      ...normalizePakanJadwal(pakanJadwalEdit),
      updatedAt: new Date().toISOString(),
    };
    setPakanJadwal(next);
    setPakanJadwalEdit(next);
    const nA = [
      {
        id: Date.now(),
        refId: Date.now(),
        title: "🌾 Takaran Pakan Harian Diperbarui",
        detail: `Pagi: Japfa ${formatTakaran(
          next.pagi.japfaKg
        )} kg · Flaxseed ${formatTakaran(
          next.pagi.flaxGram
        )} g · Minyak Ikan ${formatTakaran(
          next.pagi.oilMl
        )} ml | Sore: Japfa ${formatTakaran(
          next.sore.japfaKg
        )} kg · Flaxseed ${formatTakaran(
          next.sore.flaxGram
        )} g · Minyak Ikan ${formatTakaran(next.sore.oilMl)} ml`,
        time: currentTimeStr,
        dot: "brown",
      },
      ...activities,
    ];
    setActivities(nA);
    pushToFirebase({ pakanJadwal: next, activities: nA });
    showToast("✅ Takaran pakan harian diperbarui!");
  };

  const handleCatatPemberian = () => {
    const pagi = normalizePakanJadwal(pakanJadwal).pagi;
    const sore = normalizePakanJadwal(pakanJadwal).sore;
    const totalJapfa = (pagi.japfaKg || 0) + (sore.japfaKg || 0);
    const totalFlax = (pagi.flaxGram || 0) + (sore.flaxGram || 0);
    const totalOil = (pagi.oilMl || 0) + (sore.oilMl || 0);
    const nSP = {
      japfaKg: Math.max(0, (stokPakan.japfaKg || 0) - totalJapfa),
      flaxGram: Math.max(0, (stokPakan.flaxGram || 0) - totalFlax),
      oilMl: Math.max(0, (stokPakan.oilMl || 0) - totalOil),
    };
    const nA = [
      {
        id: Date.now(),
        refId: Date.now(),
        title: "🌾 Pemberian Pakan Harian",
        detail: `Japfa −${formatTakaran(
          totalJapfa
        )}kg · Flaxseed −${formatTakaran(
          totalFlax
        )}g · Minyak Ikan −${formatTakaran(totalOil)}ml (${todayStr()})`,
        time: currentTimeStr,
        dot: "green",
      },
      ...activities,
    ];
    setStokPakan(nSP);
    setActivities(nA);
    pushToFirebase({ stokPakan: nSP, activities: nA });
    setConfirmPakan(false);
    showToast("🌾 Pemberian pakan dicatat, stok diperbarui!");
  };

  // ─── PAKAN SESI HANDLERS ─────────────────────────────────────────────────
  const handlePakanInlineEdit = (key) => {
    const val = parseFloat(pakanEditVal);
    if (isNaN(val) || val < 0) return showToast("⚠️ Nilai tidak valid!");
    let nSP = { ...stokPakan };
    if (pakanEditMode === "tambah") {
      nSP[key] = (nSP[key] || 0) + val;
    } else {
      nSP[key] = val;
    }
    const labelMap = {
      japfaKg: "Japfa PAR L1 Red",
      flaxGram: "Flaxseed Giling",
      oilMl: "Minyak Ikan Murni",
    };
    const nA = [
      {
        id: Date.now(),
        refId: Date.now(),
        title:
          pakanEditMode === "tambah"
            ? "🌾 Stok Pakan Ditambah"
            : "✏️ Stok Pakan Diubah",
        detail: `${labelMap[key] || key} ${
          pakanEditMode === "tambah" ? "+" : "="
        }${formatTakaran(val)} ${
          key === "japfaKg" ? "kg" : key === "flaxGram" ? "g" : "ml"
        } (${todayStr()} ${currentTimeStr})`,
        time: currentTimeStr,
        dot: "brown",
      },
      ...activities,
    ];
    setStokPakan(nSP);
    setActivities(nA);
    pushToFirebase({ stokPakan: nSP, activities: nA });
    setPakanEditKey(null);
    setPakanEditMode(null);
    setPakanEditVal("");
    showToast(
      pakanEditMode === "tambah"
        ? "✅ Stok pakan ditambahkan!"
        : "✅ Stok pakan diedit!"
    );
  };

  const handleHapusPakan = (key) => {
    const nSP = { ...stokPakan, [key]: 0 };
    const labelMap = {
      japfaKg: "Japfa PAR L1 Red",
      flaxGram: "Flaxseed Giling",
      oilMl: "Minyak Ikan Murni",
    };
    const nA = [
      {
        id: Date.now(),
        refId: Date.now(),
        title: "🗑️ Stok Pakan Dihapus",
        detail: `${
          labelMap[key] || key
        } dihapus (${todayStr()} ${currentTimeStr})`,
        time: currentTimeStr,
        dot: "red",
      },
      ...activities,
    ];
    setStokPakan(nSP);
    setActivities(nA);
    pushToFirebase({ stokPakan: nSP, activities: nA });
    showToast("🗑️ Stok pakan dihapus!");
  };

  const handleCatatPemberianSesi = (sesi) => {
    const pagi = sesi === "pagi";
    const jadwal = normalizePakanJadwal(pakanJadwal);
    const sumber = pagi ? jadwal.pagi : jadwal.sore;
    const nSP = {
      japfaKg: Math.max(0, (stokPakan.japfaKg || 0) - (sumber.japfaKg || 0)),
      flaxGram: Math.max(0, (stokPakan.flaxGram || 0) - (sumber.flaxGram || 0)),
      oilMl: Math.max(0, (stokPakan.oilMl || 0) - (sumber.oilMl || 0)),
    };
    const detail = `Japfa −${formatTakaran(
      sumber.japfaKg
    )}kg · Flaxseed −${formatTakaran(
      sumber.flaxGram
    )}g · Minyak Ikan −${formatTakaran(sumber.oilMl)}ml`;
    const nA = [
      {
        id: Date.now(),
        refId: Date.now(),
        title: `🌾 Pemberian Pakan ${pagi ? "Pagi" : "Sore"}`,
        detail: `${detail} (${todayStr()})`,
        time: currentTimeStr,
        dot: "green",
      },
      ...activities,
    ];
    setStokPakan(nSP);
    setActivities(nA);
    pushToFirebase({ stokPakan: nSP, activities: nA });
    const key = `pakan-${sesi}-${todayStr()}`;
    localStorage.setItem(key, "1");
    if (pagi) setPagiDone(true);
    else setSoreDone(true);
    setConfirmPakanSesi(null);
    showToast(`🌾 Pakan ${pagi ? "pagi" : "sore"} dicatat!`);
  };

  const handleSimpanKritik = () => {
    if (!kritikInput.trim()) return showToast("⚠️ Masukan tidak boleh kosong!");
    const newEntry = {
      id: Date.now(),
      teks: kritikInput.trim(),
      date: todayStr(),
      time: currentTimeStr,
    };
    const nList = [newEntry, ...kritikList];
    setKritikList(nList);
    localStorage.setItem("kayala-kritik", JSON.stringify(nList));
    setKritikInput("");
    showToast("✅ Masukan/saran berhasil disimpan!");
  };

  const handleHapusKritik = (id) => {
    const nList = kritikList.filter((k) => k.id !== id);
    setKritikList(nList);
    localStorage.setItem("kayala-kritik", JSON.stringify(nList));
    showToast("🗑️ Masukan dihapus!");
  };

  // ─── HARGA & PELANGGAN HANDLERS ─────────────────────────────────────────
  const handleSaveHarga = () => {
    const nMaster = masterProduk.map((p) => {
      const rawHarga = hargaEdit[p.name];
      const nextHarga =
        rawHarga === undefined || rawHarga === null || rawHarga === ""
          ? p.price || 0
          : parseInt(rawHarga) || 0;
      return { ...p, price: nextHarga };
    });
    const nH = buildHargaMapFromProduk(nMaster);
    setMasterProduk(nMaster);
    setHargaProduk(nH);
    setHargaEdit(nH);
    pushToFirebase({ masterProduk: nMaster, hargaProduk: nH });
    showToast("✅ Harga produk berhasil disimpan!");
  };

  const resetVendorForm = () => {
    setVendorNama("");
    setVendorKategori("Pakan");
    setVendorLink("");
    setVendorCatatan("");
    setVendorAktif(true);
    setVendorEditId(null);
  };

  const loadVendorKeForm = (v) => {
    setVendorEditId(v.id);
    setVendorNama(v.nama || "");
    setVendorKategori(v.kategori || "Pakan");
    setVendorLink(v.link || "");
    setVendorCatatan(v.catatan || "");
    setVendorAktif(v.aktif !== false);
  };

  const handleSimpanVendorLink = () => {
    if (!vendorNama.trim()) return showToast("⚠️ Nama link wajib diisi!");
    if (!vendorLink.trim()) return showToast("⚠️ Link tujuan wajib diisi!");
    const payload = {
      id: vendorEditId || Date.now(),
      nama: vendorNama.trim(),
      kategori: vendorKategori || "Pakan",
      link: normalizeOutboundLink(vendorLink),
      catatan: vendorCatatan.trim(),
      aktif: !!vendorAktif,
      updatedAt: `${todayStr()} ${currentTimeStr}`,
      ...(vendorEditId ? {} : { createdAt: `${todayStr()} ${currentTimeStr}` }),
    };
    let nVendor;
    if (vendorEditId) {
      nVendor = vendorLinks.map((v) =>
        v.id === vendorEditId ? { ...v, ...payload } : v
      );
    } else {
      const existingIdx = vendorLinks.findIndex(
        (v) =>
          v.nama.toLowerCase() === payload.nama.toLowerCase() &&
          (v.kategori || "Pakan") === payload.kategori
      );
      if (existingIdx >= 0) {
        nVendor = vendorLinks.map((v, idx) =>
          idx === existingIdx
            ? {
                ...payload,
                id: v.id,
                createdAt: v.createdAt || payload.createdAt,
              }
            : v
        );
      } else {
        nVendor = [payload, ...vendorLinks];
      }
    }
    setVendorLinks(nVendor);
    pushToFirebase({ vendorLinks: nVendor });
    resetVendorForm();
    showToast(
      vendorEditId
        ? "✏️ Link pembelian diperbarui!"
        : "✅ Link pembelian ditambahkan!"
    );
  };

  const handleHapusVendorLink = (id) => {
    const nVendor = vendorLinks.filter((v) => v.id !== id);
    setVendorLinks(nVendor);
    pushToFirebase({ vendorLinks: nVendor });
    showToast("🗑️ Link pembelian dihapus!");
  };

  const handleToggleVendorAktif = (id) => {
    const nVendor = vendorLinks.map((v) =>
      v.id === id ? { ...v, aktif: !v.aktif } : v
    );
    setVendorLinks(nVendor);
    pushToFirebase({ vendorLinks: nVendor });
    showToast(
      nVendor.find((v) => v.id === id)?.aktif === false
        ? "🚫 Link dinonaktifkan!"
        : "✅ Link diaktifkan!"
    );
  };

  const resetProdukForm = () => {
    setProdukNama("");
    setProdukType("Pcs");
    setProdukHarga("");
    setProdukIsiTelur("0");
    setProdukCatatan("");
    setProdukAktif(true);
    setProdukEditId(null);
  };

  const loadProdukKeForm = (p) => {
    setProdukEditId(p.id);
    setProdukNama(p.name || "");
    setProdukType(p.type || "Pcs");
    setProdukHarga(String(parseInt(p.price) || 0));
    setProdukIsiTelur(String(parseInt(p.isiTelur) || 0));
    setProdukCatatan(p.note || "");
    setProdukAktif(p.active !== false);
  };

  const handleSimpanProduk = () => {
    if (!produkNama.trim()) return showToast("⚠️ Nama produk wajib diisi!");
    const hargaNum = parseInt(produkHarga) || 0;
    if (hargaNum < 0) return showToast("⚠️ Harga produk tidak valid!");
    const isiNum = parseInt(produkIsiTelur) || 0;
    const payload = {
      id: produkEditId || Date.now(),
      name: produkNama.trim(),
      type: produkType || "Pcs",
      price: hargaNum,
      isiTelur: isiNum,
      active: !!produkAktif,
      note: produkCatatan.trim(),
    };
    let nMaster;
    if (produkEditId) {
      nMaster = masterProduk.map((p) => (p.id === produkEditId ? payload : p));
    } else {
      const existingIdx = masterProduk.findIndex(
        (p) => p.name.toLowerCase() === payload.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        nMaster = masterProduk.map((p, idx) =>
          idx === existingIdx ? { ...payload, id: p.id } : p
        );
      } else {
        nMaster = [payload, ...masterProduk];
      }
    }
    const nHarga = buildHargaMapFromProduk(nMaster);
    setMasterProduk(nMaster);
    setHargaProduk(nHarga);
    setHargaEdit(nHarga);
    pushToFirebase({ masterProduk: nMaster, hargaProduk: nHarga });
    resetProdukForm();
    showToast(
      produkEditId ? "✏️ Produk diperbarui!" : "✅ Produk baru ditambahkan!"
    );
  };

  const handleHapusProduk = (id) => {
    const nMaster = masterProduk.filter((p) => p.id !== id);
    const nHarga = buildHargaMapFromProduk(nMaster);
    setMasterProduk(nMaster);
    setHargaProduk(nHarga);
    setHargaEdit(nHarga);
    pushToFirebase({ masterProduk: nMaster, hargaProduk: nHarga });
    showToast("🗑️ Produk dihapus!");
  };

  const handleToggleProdukAktif = (id) => {
    const nMaster = masterProduk.map((p) =>
      p.id === id ? { ...p, active: !p.active } : p
    );
    const nHarga = buildHargaMapFromProduk(nMaster);
    setMasterProduk(nMaster);
    setHargaProduk(nHarga);
    setHargaEdit(nHarga);
    pushToFirebase({ masterProduk: nMaster, hargaProduk: nHarga });
    showToast(
      nMaster.find((p) => p.id === id)?.active === false
        ? "🚫 Produk dinonaktifkan!"
        : "✅ Produk diaktifkan!"
    );
  };

  const handleSimpanMutasiAyam = () => {
    const jumlah = parseInt(mutasiJumlah) || 0;
    if (jumlah <= 0) return showToast("⚠️ Jumlah mutasi wajib diisi!");
    const totalSebelum = parseInt(flockData.totalAyam) || 0;
    let delta = 0;
    let title = "Mutasi Ayam";
    let dot = "blue";

    if (mutasiJenis === "masuk") {
      delta = jumlah;
      title = "🐔 Ayam Masuk";
      dot = "green";
    } else if (mutasiJenis === "mati") {
      delta = -jumlah;
      title = "☠️ Ayam Mati";
      dot = "red";
    } else if (mutasiJenis === "afkir") {
      delta = -jumlah;
      title = "🧓 Ayam Afkir";
      dot = "amber";
    } else if (mutasiJenis === "jual") {
      delta = -jumlah;
      title = "💸 Ayam Dijual";
      dot = "indigo";
    }

    const tanggal = mutasiTanggal || todayStr();
    const jam =
      mutasiJam || currentTimeStr || new Date().toTimeString().slice(0, 5);
    const totalSesudah = Math.max(0, totalSebelum + delta);
    const mutasi = {
      id: Date.now(),
      tanggal,
      jam,
      date: tanggal,
      time: jam,
      jenis: mutasiJenis,
      jumlah,
      catatan: mutasiCatatan.trim(),
      totalSebelum,
      totalSesudah,
    };
    const nMutasi = [mutasi, ...flockMutations];
    const nFlock = { ...flockData, totalAyam: totalSesudah };
    const nAct = [
      {
        id: Date.now() + 1,
        refId: mutasi.id,
        title,
        detail: `${title.replace(/^.*? /, "")} ${jumlah} ekor${
          mutasiCatatan.trim() ? ` · ${mutasiCatatan.trim()}` : ""
        }`,
        time: jam,
        dot,
      },
      ...activities,
    ];
    setFlockMutations(nMutasi);
    setFlockData(nFlock);
    setActivities(nAct);
    pushToFirebase({
      flockMutations: nMutasi,
      flockData: nFlock,
      activities: nAct,
    });
    setMutasiJumlah("");
    setMutasiCatatan("");
    setMutasiTanggal(todayStr());
    setMutasiJam(currentTimeStr || new Date().toTimeString().slice(0, 5));
    showToast("✅ Mutasi ayam tersimpan dan populasi diperbarui!");
  };

  const handleDeletePelanggan = (id) => {
    const nPel = pelanggan.filter((p) => p.id !== id);
    setPelanggan(nPel);
    pushToFirebase({ pelanggan: nPel });
    showToast("🗑️ Data pelanggan dihapus!");
  };

  const handleKirimWA = (d) => {
    const harga = getProdukHargaByNama(d.product, hargaProduk, masterProduk);
    const total = harga * (parseInt(d.jumlah) || 1);
    const tgl = new Date(d.date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const invoice = d.invoice || makeInvoiceCode(d.date, d.id);
    const pesan = [
      "*NOTA KAYALA FARM*",
      "━━━━━━━━━━━━━━━━━━",
      `Invoice: ${invoice}`,
      `Pelanggan: ${d.customer}`,
      `Produk: ${d.product}`,
      `Jumlah: ${d.jumlah} ${d.unit || "Pcs"}`,
      harga > 0 ? `Harga/Unit: ${formatRupiah(harga)}` : "",
      harga > 0 ? `*Total: ${formatRupiah(total)}*` : "",
      `Tanggal: ${tgl}`,
      d.jam ? `Jam: ${d.jam}` : "",
      d.note ? `Catatan: ${d.note}` : "",
      "━━━━━━━━━━━━━━━━━━",
      "Terima kasih sudah berbelanja!",
      "KAYALA FARM Wonosobo 🐔🥚",
      "IG: @kayalafarm | WA: +62 82224404626",
    ]
      .filter(Boolean)
      .join("\n");
    const pel = pelanggan.find(
      (p) => p.nama.toLowerCase() === d.customer.toLowerCase()
    );
    const noWA = pel?.noWA || "";
    const url = noWA
      ? `https://wa.me/${noWA.replace(/\D/g, "")}?text=${encodeURIComponent(
          pesan
        )}`
      : `https://wa.me/?text=${encodeURIComponent(pesan)}`;
    window.open(url, "_blank");
  };

  // ─── SWIPE HANDLERS ──────────────────────────────────────────────────────
  const onTouchStart = (id, e) => {
    touchStartX.current[id] = e.touches[0].clientX;
  };
  const onTouchEnd = (id, e) => {
    const delta = (touchStartX.current[id] || 0) - e.changedTouches[0].clientX;
    if (delta > 60) setSwiped((prev) => ({ ...prev, [id]: true }));
    else if (delta < -30) setSwiped((prev) => ({ ...prev, [id]: false }));
  };

  // ─── OMEGA-3 HANDLERS ─────────────────────────────────────────────────────
  const hitungHDP = () => {
    const popTotal = parseInt(flockData.totalAyam) || 0;
    if (popTotal <= 0) {
      return setHdpResult({
        text: "Populasi ayam belum diisi atau masih 0. Simpan data populasi dulu sebelum hitung HDP!",
        type: "warn",
      });
    }
    if (hdpInput === "" || parseInt(hdpInput) < 0) {
      return setHdpResult({
        text: "Mohon masukkan angka produksi telur harian yang valid!",
        type: "bad",
      });
    }
    const calc = ((parseInt(hdpInput) / popTotal) * 100).toFixed(1);
    if (calc >= 85.0)
      setHdpResult({
        text: `🔥 Kategori Bagus! Capaian HDP di angka ${calc}% (${hdpInput} Butir). Produktivitas kandang berjalan stabil!`,
        type: "good",
      });
    else if (calc >= 65.0)
      setHdpResult({
        text: `⚠️ Kategori Oke/Aman! Capaian HDP di angka ${calc}% (${hdpInput} Butir). Masih dalam batas wajar produksi.`,
        type: "warn",
      });
    else
      setHdpResult({
        text: `🚨 Kategori Jelek/Drop! Capaian HDP anjlok ke ${calc}% (${hdpInput} Butir). Segera audit manajemen pakan dan kesehatan ayam!`,
        type: "bad",
      });
  };

  const hitungFormula = () => {
    const fw = parseFloat(feedWeightInput);
    if (isNaN(fw) || fw <= 0) return;
    const base = 6.0;
    setFormulaCalc({
      feed: fw,
      f1Flax: Math.round((60 / base) * fw),
      f2Flax: Math.round((90 / base) * fw),
      f3Flax: Math.round((120 / base) * fw),
      oil: Math.round((30 / base) * fw),
    });
    showToast("✅ Takaran formula diperbarui!");
  };

  const toggleOmegaCheck = (id) => {
    setOmegaChecklist((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(id, next[id] ? "1" : "0");
      return next;
    });
  };

  const resetOmegaChecklist = () => {
    const ids = [
      "chk-air-p",
      "chk-air-s",
      "chk-air-o",
      "chk-telur-p",
      "chk-telur-s",
      "chk-telur-o",
      "chk-lemas-p",
      "chk-lemas-s",
      "chk-lemas-o",
      "chk-feses-p",
      "chk-feses-s",
      "chk-feses-o",
      "chk-pk-p",
      "chk-pk-o",
      "chk-flax-p",
      "chk-flax-o",
      "chk-oil-p",
      "chk-oil-o",
    ];
    ids.forEach((id) => localStorage.removeItem(id));
    setOmegaChecklist({});
    setConfirmResetChecklist(false);
    showToast("🔄 Checklist direset untuk hari baru!");
  };

  const saveNote = (key, val) => {
    setWeekNotes((prev) => ({ ...prev, [key]: val }));
    localStorage.setItem("note-" + key, val);
  };

  // ─── CALCULATIONS ─────────────────────────────────────────────────────────
  const todayEntries = production.filter((p) => p.date === todayStr());
  const todaySummary = summarizeEggEntries(todayEntries);
  const todayTotal = todaySummary.total;
  const todayHasSpecific = todaySummary.hasSpecific;

  const prodDateEntries = production.filter((p) => p.date === prodDate);
  const prodDateSummary = summarizeEggEntries(prodDateEntries);
  const prodDateHasSpecific = prodDateSummary.hasSpecific;
  const prodDateHasQuick = prodDateSummary.quick > 0;

  const totalSaldo = cashflow.reduce(
    (s, r) =>
      s +
      (r.jenis === "masuk"
        ? parseInt(r.nominal) || 0
        : -(parseInt(r.nominal) || 0)),
    0
  );
  const totalKeluar = cashflow
    .filter((r) => r.jenis === "keluar")
    .reduce((s, r) => s + (parseInt(r.nominal) || 0), 0);
  const pendingDeliveries = deliveries.filter((d) => d.status === "pending");
  const pendingCount = pendingDeliveries.length;

  // Mengelompokkan data Grafik Pasokan berdasarkan Tanggal (7 Hari Terakhir)
  const prodByDate = {};
  production.forEach((p) => {
    if (!prodByDate[p.date]) prodByDate[p.date] = [];
    prodByDate[p.date].push(p);
  });

  const allDates = Object.keys(prodByDate).sort();
  const last7Dates = allDates.slice(-7);
  const chartDataDays = last7Dates.map((date) => {
    const entries = prodByDate[date] || [];
    const summary = summarizeEggEntries(entries);
    return {
      date,
      jumlah: summary.total,
      quick: summary.quick,
      specific: summary.specific,
    };
  });
  const maxValDays = Math.max(...chartDataDays.map((r) => r.jumlah), 1);
  const avg7Days =
    chartDataDays.length > 0
      ? (
          chartDataDays.reduce((s, r) => s + r.jumlah, 0) / chartDataDays.length
        ).toFixed(1)
      : 0;

  // ─── P&L CALCULATIONS ────────────────────────────────────────────────────
  const bulanIni = new Date().toISOString().slice(0, 7);
  const totalMasukBulan = cashflow
    .filter((r) => r.jenis === "masuk" && r.date && r.date.startsWith(bulanIni))
    .reduce((s, r) => s + (parseInt(r.nominal) || 0), 0);
  const totalKeluarBulan = cashflow
    .filter(
      (r) => r.jenis === "keluar" && r.date && r.date.startsWith(bulanIni)
    )
    .reduce((s, r) => s + (parseInt(r.nominal) || 0), 0);
  const labaBersihBulan = totalMasukBulan - totalKeluarBulan;
  const labaBersihTotal = cashflow.reduce(
    (s, r) =>
      s +
      (r.jenis === "masuk"
        ? parseInt(r.nominal) || 0
        : -(parseInt(r.nominal) || 0)),
    0
  );

  // ─── FCR (Feed Conversion Ratio) ──────────────────────────────────────────
  const fcr = avg7Days > 0 ? Math.round(6000 / parseFloat(avg7Days)) : null;
  const fcrStatus =
    fcr === null ? "none" : fcr <= 130 ? "good" : fcr <= 160 ? "warn" : "bad";

  // ─── ALERT COUNTS ─────────────────────────────────────────────────────────
  const stokKritisItems = stokBarang.filter(
    (s) => s.jumlah < s.minStok && (s.jumlah > 0 || production.length > 0)
  );
  const stokKritisCount = stokKritisItems.length;
  const pakanKritis = stokPakan.japfaKg > 0 && stokPakan.japfaKg < 12;
  const alertCount = stokKritisCount + (pakanKritis ? 1 : 0);

  const getKandangStatusReport = () => {
    if (production.length === 0)
      return {
        text: "📢 Selamat datang di Aplikasi Kayala! Silakan isi catatan pasokan telur hari ini.",
        type: "welcome",
      };
    if (todayTotal <= 0)
      return {
        text: "🚨 Data telur bersih hari ini belum diinput atau masih minus, jangan lupa isi dengan telaten!",
        type: "warn",
      };
    const popTotal = parseInt(flockData.totalAyam) || 0;
    const rataBatasAman = Math.floor(popTotal * 0.65);

    if (todayTotal < rataBatasAman)
      return {
        text: `📉 Produksi bersih hari ini (${todayTotal} butir) tergolong jelek. Cek kondisi pakan atau cacat!`,
        type: "danger",
      };
    return {
      text: "🍏 Alhamdulillah, hari ini kondisi kandang bagus dan produktivitas telur berjalan aman.",
      type: "good",
    };
  };
  const statusKandangBox = getKandangStatusReport();

  // ─── INJECT STYLES ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = KAYALA_STYLES;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "KAYALA FARM";
    return () => {
      document.title = prevTitle;
    };
  }, []);

  // Reusable tiny components
  const Chk = ({ id }) => (
    <div
      className={`kyl-chk-wrap ${omegaChecklist[id] ? "checked" : ""}`}
      onClick={() => toggleOmegaCheck(id)}
    />
  );

  // ─── SUB-COMPONENTS ──────────────────────────────────────────────────────
  // renderSheet: fungsi (bukan component) agar input tidak kehilangan fokus saat mengetik
  const renderSheet = (id, title, children) => {
    if (sheet !== id) return null;
    return (
      <div className="kyl-sheet-overlay no-print">
        <div className="kyl-sheet-dim" onClick={() => setSheet(null)} />
        <div className="kyl-sheet-body" onClick={(e) => e.stopPropagation()}>
          <div className="kyl-sheet-handle" />
          <div className="kyl-sheet-title">{title}</div>
          <div style={{ paddingTop: 8 }}>{children}</div>
        </div>
      </div>
    );
  };

  const SkelCard = ({ h = 14, w = "60%" }) => (
    <div className="kyl-card" style={{ opacity: 1 }}>
      <div
        className="kyl-skel"
        style={{ height: h, width: w, marginBottom: 10 }}
      />
      <div className="kyl-skel" style={{ height: 10, width: "40%" }} />
    </div>
  );

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className={`kyl-app ${dark ? "" : "kyl-light"}`}>
      <style>{`@media print{body{background:white!important;}.no-print{display:none!important;}}`}</style>

      <div className="kyl-wrap">
        {/* TOAST */}
        {toastMsg && <div className="kyl-toast no-print kyl-toast-show">{toastMsg}</div>}

        {showIslamicReminder && openingReminder && (
          <div
            className="kyl-islamic-overlay no-print"
            role="dialog"
            aria-modal="true"
            aria-label="Pengingat Islami pembuka aplikasi"
            onClick={() => setShowIslamicReminder(false)}
          >
            <div className="kyl-islamic-modal">
              <div className="kyl-islamic-kicker">
                Pengingat Islami
                <span className="kyl-islamic-tag">{openingReminder.tag}</span>
              </div>
              <div className="kyl-islamic-ar">{openingReminder.arabic}</div>
              <h2 className="kyl-islamic-title">{openingReminder.title}</h2>
              <p className="kyl-islamic-text">{openingReminder.text}</p>
              <div className="kyl-islamic-ref">{openingReminder.ref}</div>
              <div className="kyl-islamic-hint">Ketuk sembarang untuk masuk</div>
            </div>
          </div>
        )}

        {/* BISMILLAH */}
        <div className="kyl-bismillah">
          <span className="kyl-bismillah-label">Awali dengan Bismillah</span>
          <span className="kyl-bismillah-ar">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </span>
        </div>

        {page !== "home" && <PageHeader pageId={page} />}

        {/* ═══════════════ BRAND HEADER (Home only) ═══════════════ */}
        {page === "home" && (
          <div className="kyl-brand">
            <div className="kyl-brand-pill">
              <span className="kyl-brand-name">KAYALA FARM | WONOSOBO</span>
              <span className="kyl-brand-owner">
                PEMILIK FAUZSADIID &amp; RAMAYOOY
              </span>
            </div>
            <h1 className="kyl-app-title">BUKU KAYALA</h1>
            <div className="kyl-sync-badge">
              <span className="kyl-pulse-dot kyl-pulse" />
              <span className="kyl-sync-text">
                CLOUD SYNC AKTIF
              </span>
            </div>
            <div className="kyl-social no-print">
              <a
                href="https://instagram.com/kayalafarm"
                target="_blank"
                rel="noopener noreferrer"
                className="kyl-social-btn"
              >
                <BrandSocialIcon type="instagram" />
                <span className="kyl-social-text">kayalafarm</span>
              </a>
              <a
                href="https://wa.me/6282224404626"
                target="_blank"
                rel="noopener noreferrer"
                className="kyl-social-btn"
              >
                <BrandSocialIcon type="whatsapp" />
                <span className="kyl-social-text">+62 82224404626</span>
              </a>
            </div>
          </div>
        )}

        {/* ═══════════════ VIEW: BERANDA ═══════════════ */}
        {page === "home" && (
          <div className="kyl-page-view kyl-space">
            {/* SKELETON — only if loading AND no cached data yet */}
            {isLoading && production.length === 0 && cashflow.length === 0 && (
              <div style={{ marginBottom: 10 }}>
                <SkelCard h={60} w="100%" />
                <SkelCard h={30} w="80%" />
              </div>
            )}

            {/* ONBOARDING BANNER jika data masih kosong */}
            {!isLoading &&
              production.length === 0 &&
              flockData.totalAyam === 0 && (
                <div className="kyl-onboard">
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🐔</div>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 16,
                      color: "var(--indigo)",
                      marginBottom: 6,
                    }}
                  >
                    Selamat Datang di Aplikasi Kayala!
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--text2)",
                      lineHeight: 1.6,
                      marginBottom: 14,
                    }}
                  >
                    Mulai dengan mengisi konfigurasi kandang di tab{" "}
                    <strong>⚙️ Lainnya</strong>, lalu catat produksi pertama di
                    tab <strong>🥚 Produksi</strong>.
                  </p>
                  <button
                    onClick={() => setPage("more")}
                    className="kyl-btn kyl-btn-indigo"
                    style={{
                      width: "auto",
                      padding: "10px 24px",
                      margin: "0 auto",
                    }}
                  >
                    ⚙️ Atur Kandang Sekarang
                  </button>
                </div>
              )}

            {/* ALERT BANNER kritis */}
            {!isLoading && alertCount > 0 && (
              <div
                className="kyl-alert-bar"
                style={{
                  background: "rgba(255,59,48,.05)",
                  borderColor: "rgba(255,59,48,.2)",
                  color: "#ff6b63",
                }}
              >
                <span className="kyl-alert-icon" aria-hidden="true">
                  <KylIcon name="alert" />
                </span>
                <div>
                  <div
                    style={{ fontWeight: 800, fontSize: 12, marginBottom: 3 }}
                  >
                    Perhatian Diperlukan
                  </div>
                  {stokKritisItems.slice(0, 2).map((s) => (
                    <div key={s.id} style={{ fontSize: 11 }}>
                      • Stok {s.nama} kritis ({s.jumlah} {s.satuan})
                    </div>
                  ))}
                  {pakanKritis && (
                    <div style={{ fontSize: 11 }}>
                      • Stok pakan Japfa &lt; 2 hari ({stokPakan.japfaKg} kg)
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="kyl-clock-card">
              <div className="kyl-live-badge">
                <span className="kyl-live-dot kyl-pulse" />
                <span className="kyl-live-text">WIB AKTIF</span>
              </div>
              <div className="kyl-clock-greeting">
                {getSapaanWaktu()}, Sadiid &amp; Rama 👋
              </div>
              <div className="kyl-clock-time">{currentTimeStr || "00:00"}</div>
              <div className="kyl-clock-date">{currentDateStr}</div>
            </div>

            <div
              className="kyl-status-box"
              style={statusStyle(statusKandangBox.type)}
            >
              {statusKandangBox.text}
            </div>

            <FridayBanner />
            {/* STRAIN CARD — centered */}
            <div
              className="kyl-strain-card"
              style={{
                flexDirection: "column",
                textAlign: "center",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span className="kyl-strain-icon">🐣</span>
              <div>
                <span
                  className="kyl-strain-label"
                  style={{ display: "block", marginBottom: 4 }}
                >
                  Strain / Ras Ayam Aktif
                </span>
                <span className="kyl-strain-val">
                  {!flockData.jenisAyam ||
                  flockData.jenisAyam === "Lohman Brown Platinum"
                    ? "Belum dikonfigurasi"
                    : flockData.jenisAyam}
                </span>
              </div>
            </div>

            <div className="kyl-card">
              <div className="kyl-flock-grid">
                <div>
                  <span className="kyl-flock-lbl">Umur Ayam</span>
                  <span className="kyl-flock-val">
                    {timeAge.mingguNow}
                    <span className="kyl-flock-unit">Mgg</span>
                  </span>
                </div>
                <div>
                  <span className="kyl-flock-lbl">Total Hari</span>
                  <span className="kyl-flock-val">
                    {timeAge.hariNow}
                    <span className="kyl-flock-unit">Hari</span>
                  </span>
                </div>
                <div>
                  <span
                    className="kyl-flock-lbl"
                    style={{ color: "var(--gold)" }}
                  >
                    Total Ayam
                  </span>
                  <span className="kyl-flock-val gold">
                    {flockData.totalAyam}
                    <span className="kyl-flock-unit">Ekor</span>
                  </span>
                </div>
              </div>
              {flockData.totalAyam > 0 ? (
                <div className="kyl-flock-afkir">
                  InsyaAllah {timeAge.sisaMinggu} Mgg {timeAge.sisaHari} Hari
                  Menuju Afkir
                </div>
              ) : (
                <div
                  className="kyl-flock-afkir"
                  style={{ color: "var(--text3)" }}
                >
                  Konfigurasi populasi belum diisi di menu Lainnya ⚙️
                </div>
              )}
            </div>

            <div className="kyl-stat-grid">
              {[
                {
                  label: "Telur Hari Ini",
                  val: `${todayTotal} Pcs`,
                  sub: "Butir terhitung hari ini",
                  page: "produksi",
                },
                {
                  label: "Saldo Kas",
                  val: formatToK(totalSaldo),
                  sub: "Kas bersih",
                  page: "cashflow",
                },
                {
                  label: "Antrean",
                  val: `${pendingCount} Slot`,
                  sub: "Pesanan aktif",
                  page: "delivery",
                },
                {
                  label: "Laba Bulan Ini",
                  val: totalMasukBulan > 0 ? formatToK(labaBersihBulan) : "–",
                  sub:
                    totalMasukBulan > 0
                      ? labaBersihBulan >= 0
                        ? "✅ Untung"
                        : "⚠️ Rugi"
                      : "Belum ada transaksi",
                  page: "cashflow",
                },
              ].map((m, i) => (
                <div
                  key={i}
                  className="kyl-stat-card"
                  onClick={() => m.page && setPage(m.page)}
                  style={{ cursor: m.page ? "pointer" : "default" }}
                >
                  <span className="kyl-stat-lbl">{m.label}</span>
                  <div className="kyl-stat-val kyl-mono">{m.val}</div>
                  <div className="kyl-stat-sub">{m.sub}</div>
                </div>
              ))}
            </div>

            {/* GRAFIK 7 HARI & AKUMULASI PANEN GENERAL */}
            <div className="kyl-card">
              <span className="kyl-card-lbl">
                Grafik Pasokan 7 Hari Input Terakhir
              </span>
              {chartDataDays.length > 0 ? (
                <>
                  <div className="kyl-chart-wrap" style={{ height: 80 }}>
                    {chartDataDays.map((r, i) => {
                      const popTotal =
                        flockData.totalAyam > 0 ? flockData.totalAyam : 49;
                      const targetBagus = Math.floor(popTotal * 0.85); // HDP > 85% Hijau
                      const targetOke = Math.floor(popTotal * 0.65); // HDP 65% - 84% Kuning

                      let barColor, numColor;
                      if (r.jumlah >= targetBagus) {
                        barColor =
                          "linear-gradient(180deg, var(--primary-l), rgba(52,212,104,0.25))";
                        numColor = "var(--primary-l)";
                      } else if (r.jumlah >= targetOke) {
                        barColor =
                          "linear-gradient(180deg, var(--amber), rgba(245,158,11,0.25))";
                        numColor = "var(--amber)";
                      } else {
                        barColor =
                          "linear-gradient(180deg, var(--red), rgba(255,59,48,0.25))";
                        numColor = "var(--red)";
                      }

                      const shortDate = r.date
                        ? `${r.date.split("-")[2]}/${r.date.split("-")[1]}`
                        : "";

                      return (
                        <div key={i} className="kyl-chart-col" title={r.date}>
                          <span
                            className="kyl-chart-num kyl-mono"
                            style={{ color: numColor, fontWeight: 700 }}
                          >
                            {r.jumlah}
                          </span>
                          <div
                            className="kyl-chart-bar"
                            style={{
                              height: Math.max(
                                Math.round((r.jumlah / maxValDays) * 45),
                                3
                              ),
                              background: barColor,
                            }}
                          />
                          <span
                            className="kyl-mono"
                            style={{
                              fontSize: 7.5,
                              color: "var(--text3)",
                              marginTop: 4,
                              fontWeight: 600,
                            }}
                          >
                            {shortDate}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="kyl-chart-footer">
                    <span>
                      Produksi Hari Ini:{" "}
                      <strong className="kyl-text kyl-mono">
                        {todayTotal} butir bersih
                      </strong>
                    </span>
                    <span>
                      Rerata Harian:{" "}
                      <strong className="kyl-text kyl-mono">
                        {avg7Days}/hari
                      </strong>
                    </span>
                  </div>
                </>
              ) : (
                <div
                  className="kyl-empty"
                  style={{
                    border: ".5px dashed var(--border)",
                    borderRadius: "var(--rsm)",
                  }}
                >
                  Belum ada data produksi masuk
                </div>
              )}
            </div>

            {/* PAKAN REMINDER — tampil sesuai jam */}
            {showPakanReminder && (
              <div className="kyl-reminder-banner">
                <div>
                  <div className="kyl-reminder-title">
                    {pakanSesiWindow === "pagi"
                      ? "🌅 Waktunya Pemberian Pakan Pagi!"
                      : "🌇 Waktunya Pemberian Pakan Sore!"}
                  </div>
                  <div className="kyl-reminder-sub">
                    {pakanSesiWindow === "pagi"
                      ? "2.4 kg Japfa · 24 g Flaxseed · 12 ml Minyak Ikan"
                      : "3.6 kg Japfa · 36 g Flaxseed · 18 ml Minyak Ikan"}
                  </div>
                  {pakanSesiWindow === "pagi" && pagiDone && (
                    <div className="kyl-reminder-done">
                      ✅ Sesi pagi sudah dicatat
                    </div>
                  )}
                  {pakanSesiWindow === "sore" && soreDone && (
                    <div className="kyl-reminder-done">
                      ✅ Sesi sore sudah dicatat
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPage("stok")}
                  className="kyl-reminder-action"
                >
                  Catat
                  <KylIcon name="chevronRight" size="sm" />
                </button>
              </div>
            )}

            {/* ISU AKTIF KANDANG */}
            {operasional.length > 0 && (
              <div>
                <div className="kyl-flex-between" style={{ marginBottom: 8 }}>
                  <span className="kyl-isu-lbl" style={{ marginBottom: 0 }}>
                    ⚠️ Isu Aktif Kandang ({operasional.length})
                  </span>
                  {operasional.length > 3 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--amber)",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={() => setPage("more")}
                    >
                      Lihat semua →
                    </span>
                  )}
                </div>
                <div className="kyl-space-sm">
                  {operasional.slice(0, 3).map((o) => (
                    <div key={o.id} className="kyl-isu-item">
                      <div
                        className="kyl-flex-between"
                        style={{ alignItems: "flex-start" }}
                      >
                        <div style={{ flex: 1, marginRight: 10 }}>
                          <div
                            className="kyl-bold kyl-small"
                            style={{ color: "var(--amber)" }}
                          >
                            {o.deskripsi}
                          </div>
                          <div
                            className="kyl-xsmall kyl-text2"
                            style={{ marginTop: 3 }}
                          >
                            {o.date} · {o.kategori}
                          </div>
                        </div>
                        <button
                          onClick={() => handleCompleteOperasional(o.id)}
                          className="kyl-selesai-btn"
                        >
                          ✅ Selesai
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PESANAN AKTIF */}
            {pendingDeliveries.length > 0 && (
              <div>
                <div className="kyl-flex-between" style={{ marginBottom: 8 }}>
                  <span
                    className="kyl-section-lbl"
                    style={{ color: "var(--amber)", marginBottom: 0 }}
                  >
                    🚚 Pesanan Aktif ({pendingCount})
                  </span>
                  {pendingCount > 3 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--amber)",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={() => setPage("delivery")}
                    >
                      Lihat semua →
                    </span>
                  )}
                </div>
                <div className="kyl-space-sm">
                  {pendingDeliveries.slice(0, 3).map((d) => (
                    <div key={d.id} className="kyl-pending-item">
                      <div
                        className="kyl-flex-between"
                        style={{ alignItems: "flex-start" }}
                      >
                        <div style={{ flex: 1, marginRight: 10 }}>
                          <div className="kyl-bold kyl-small kyl-text">
                            {d.customer}
                          </div>
                          <span className="kyl-product-tag">{d.product}</span>
                          <div
                            className="kyl-xsmall kyl-text2"
                            style={{ marginTop: 5 }}
                          >
                            {d.date} · Jam {d.jam || "–"} · {d.jumlah}{" "}
                            {d.unit || "Pcs"}
                          </div>
                          {d.note && (
                            <div
                              className="kyl-xsmall kyl-amber"
                              style={{ marginTop: 2 }}
                            >
                              📝 {d.note}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleCompleteDelivery(d.id)}
                          className="kyl-selesai-btn"
                        >
                          ✅ Selesai
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="kyl-section-lbl">Log Aktivitas Terkini</span>
              <div className="kyl-space-sm">
                {activities.length > 0 ? (
                  activities.slice(0, 4).map((a) => (
                    <div key={a.id} className="kyl-activity-item">
                      {editId === a.id ? (
                        <div className="kyl-space-sm no-print">
                          <input
                            type="text"
                            value={editVal1}
                            onChange={(e) => setEditVal1(e.target.value)}
                            className="kyl-edit-input"
                          />
                          <input
                            type="text"
                            value={editVal2}
                            onChange={(e) => setEditVal2(e.target.value)}
                            className="kyl-edit-input"
                          />
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              justifyContent: "flex-end",
                              marginTop: 4,
                            }}
                          >
                            <button
                              onClick={() =>
                                handleUpdateItem("activities", a.id)
                              }
                              className="kyl-btn kyl-btn-indigo"
                              style={{
                                width: "auto",
                                padding: "5px 12px",
                                fontSize: 10,
                              }}
                            >
                              Simpan
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="kyl-btn kyl-btn-ghost"
                              style={{ fontSize: 10 }}
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="kyl-flex-between">
                          <div className="kyl-flex-center" style={{ gap: 10 }}>
                            <ActivityDot color={a.dot} />
                            <div>
                              <div className="kyl-bold kyl-small kyl-text">
                                {a.title}
                              </div>
                              <div
                                className="kyl-xsmall kyl-text2"
                                style={{ marginTop: 2 }}
                              >
                                {a.detail}
                              </div>
                            </div>
                          </div>
                          <div className="kyl-flex-center" style={{ gap: 10 }}>
                            <span
                              className="kyl-mono"
                              style={{ fontSize: 9, color: "var(--text3)" }}
                            >
                              {a.time}
                            </span>
                            <div
                              className="kyl-flex-center no-print"
                              style={{ gap: 8 }}
                            >
                              <button
                                onClick={() => {
                                  setEditId(a.id);
                                  setEditVal1(a.title);
                                  setEditVal2(a.detail);
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: 13,
                                  opacity: 0.55,
                                }}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteItem("activities", a.id)
                                }
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: 13,
                                  opacity: 0.55,
                                  color: "var(--red)",
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="kyl-empty">Belum ada log aktivitas</p>
                )}
              </div>
            </div>
          </div>
        )}
        {/* FAB: Quick catat produksi dari beranda */}
        {page === "home" && !isLoading && (
          <button
            className="kyl-fab no-print"
            onClick={() => {
              setPage("produksi");
              setSheet("produksi");
            }}
            title="Catat Produksi Cepat"
            aria-label="Catat Produksi"
          >
            🥚
          </button>
        )}

        {/* ═══════════════ VIEW: PRODUKSI ═══════════════ */}
        {/* Bottom Sheet: Form Input Produksi */}
        {renderSheet(
          "produksi",
          "🥚 Catat Produksi Telur",
          <div className="kyl-space" style={{ paddingBottom: 8 }}>
            <div>
              <label className="kyl-form-lbl">Tanggal Panen</label>
              <input
                type="date"
                value={prodDate}
                onChange={(e) => setProdDate(e.target.value)}
                className="kyl-input"
              />
            </div>
            <div>
              <label className="kyl-form-lbl" style={{ marginBottom: 8 }}>
                Kategori Gramasi
              </label>
              {!prodDateHasSpecific && (
                <button
                  type="button"
                  onClick={() => setEggCategory(QUICK_HARVEST_LABEL)}
                  className={`kyl-cat-btn general ${
                    eggCategory === QUICK_HARVEST_LABEL ? "active" : ""
                  }`}
                  style={{
                    width: "100%",
                    marginBottom: 8,
                    padding: "10px",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  🥚 Panen Cepat — Belum Sortir
                </button>
              )}
              <div className="kyl-grid2" style={{ marginBottom: 8 }}>
                {[
                  "Jumbo (>60g)",
                  "Ideal (55-60g)",
                  "Sedang (50g)",
                  "Kecil (<50g)",
                ].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setEggCategory(cat)}
                    className={`kyl-cat-btn ${
                      eggCategory === cat ? "active" : ""
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setEggCategory("🚨 Telur Cacat (BS)")}
                className={`kyl-cat-btn danger ${
                  eggCategory === "🚨 Telur Cacat (BS)" ? "active" : ""
                }`}
                style={{ width: "100%" }}
              >
                🚨 Telur Cacat (BS)
              </button>
            </div>
            <div>
              <label className="kyl-form-lbl">Jumlah (Butir)</label>
              <input
                type="number"
                placeholder="0"
                value={eggInputQty}
                onChange={(e) => setEggInputQty(e.target.value)}
                className="kyl-input"
              />
            </div>
            {prodDateSummary.total > 0 && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(52,212,104,.06)",
                  borderRadius: "var(--rsm)",
                  border: ".5px solid rgba(52,212,104,.18)",
                }}
              >
                <span className="kyl-xsmall kyl-text2">
                  Total Bersih Tanggal Terpilih:{" "}
                </span>
                <span
                  className="kyl-mono kyl-bold kyl-green"
                  style={{ fontSize: 14 }}
                >
                  {prodDateSummary.total} Butir
                </span>
              </div>
            )}
            {prodDateHasSpecific && prodDateHasQuick && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "rgba(245,158,11,.07)",
                  borderRadius: "var(--rsm)",
                  border: ".5px solid rgba(245,158,11,.2)",
                  fontSize: 11,
                  color: "var(--amber)",
                }}
              >
                ℹ️ Data quick harvest sudah digantikan oleh hasil sortir pada
                tanggal ini.
              </div>
            )}
            <button
              onClick={() => {
                handleInputProduksi();
                setSheet(null);
              }}
              className="kyl-btn kyl-btn-indigo"
            >
              ✅ Simpan Produksi
            </button>
          </div>
        )}

        {page === "produksi" && (
          <div className="kyl-page-view kyl-space">
            <div className="kyl-card">
              <span className="kyl-card-lbl">Catat Telur Sesuai Gramasi</span>
              <div className="kyl-space">
                <div>
                  <label className="kyl-form-lbl">Tanggal Panen Telur</label>
                  <input
                    type="date"
                    value={prodDate}
                    onChange={(e) => setProdDate(e.target.value)}
                    className="kyl-input"
                  />
                </div>
                <div>
                  <label className="kyl-form-lbl" style={{ marginBottom: 8 }}>
                    Pilih Kategori Gramasi
                  </label>
                  {!prodDateHasSpecific && (
                    <button
                      type="button"
                      onClick={() => setEggCategory(QUICK_HARVEST_LABEL)}
                      className={`kyl-cat-btn general ${
                        eggCategory === QUICK_HARVEST_LABEL ? "active" : ""
                      }`}
                      style={{
                        width: "100%",
                        marginBottom: 8,
                        padding: "11px",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      🥚 Panen Cepat — Belum Sortir
                    </button>
                  )}
                  <div className="kyl-grid2" style={{ marginBottom: 8 }}>
                    {[
                      "Jumbo (>60g)",
                      "Ideal (55-60g)",
                      "Sedang (50g)",
                      "Kecil (<50g)",
                    ].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setEggCategory(cat)}
                        className={`kyl-cat-btn ${
                          eggCategory === cat ? "active" : ""
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEggCategory("🚨 Telur Cacat (BS)")}
                    className={`kyl-cat-btn danger ${
                      eggCategory === "🚨 Telur Cacat (BS)" ? "active" : ""
                    }`}
                    style={{ width: "100%" }}
                  >
                    🚨 Telur Cacat (BS)
                  </button>
                </div>
                <div>
                  <label className="kyl-form-lbl">Jumlah Volume (Butir)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={eggInputQty}
                    onChange={(e) => setEggInputQty(e.target.value)}
                    className="kyl-input"
                  />
                </div>

                {prodDateSummary.total > 0 && (
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "rgba(52,212,104,.06)",
                      borderRadius: "var(--rsm)",
                      border: ".5px solid rgba(52,212,104,.18)",
                    }}
                  >
                    <span className="kyl-xsmall kyl-text2">
                      Total Bersih Tanggal Terpilih:{" "}
                    </span>
                    <span
                      className="kyl-mono kyl-bold kyl-green"
                      style={{ fontSize: 14 }}
                    >
                      {prodDateSummary.total} Butir
                    </span>
                    {prodDateSummary.loss > 0 && (
                      <span
                        className="kyl-xsmall kyl-red"
                        style={{ marginLeft: 8 }}
                      >
                        (sudah dikurangi cacat)
                      </span>
                    )}
                  </div>
                )}
                <button
                  onClick={handleInputProduksi}
                  className="kyl-btn kyl-btn-indigo"
                >
                  Simpan Catatan Produksi
                </button>
              </div>
            </div>
            <div>
              <span className="kyl-section-lbl">Riwayat Pasokan Harian</span>
              {/* Search */}
              <div className="kyl-search-wrap">
                <span className="kyl-search-icon" aria-hidden="true">
                  <KylIcon name="search" />
                </span>
                <input
                  type="text"
                  placeholder="Cari kategori atau tanggal..."
                  value={searchProd}
                  onChange={(e) => setSearchProd(e.target.value)}
                  className="kyl-input"
                  style={{ marginBottom: 8 }}
                />
              </div>
              <div className="kyl-space-sm">
                {(() => {
                  const filteredProd = production.filter(
                    (r) =>
                      !searchProd ||
                      r.kandang
                        .toLowerCase()
                        .includes(searchProd.toLowerCase()) ||
                      r.date.includes(searchProd)
                  );
                  return filteredProd.length > 0 ? (
                    filteredProd.map((r) => (
                      <div key={r.id} className="kyl-log-item">
                        {editId === r.id ? (
                          <div className="kyl-space-sm">
                            <input
                              type="text"
                              value={editVal1}
                              onChange={(e) => setEditVal1(e.target.value)}
                              className="kyl-edit-input"
                            />
                            <input
                              type="number"
                              value={editVal2}
                              onChange={(e) => setEditVal2(e.target.value)}
                              className="kyl-edit-input"
                            />
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                justifyContent: "flex-end",
                              }}
                            >
                              <button
                                onClick={() =>
                                  handleUpdateItem("produksi", r.id)
                                }
                                className="kyl-btn kyl-btn-indigo"
                                style={{
                                  width: "auto",
                                  padding: "5px 12px",
                                  fontSize: 10,
                                }}
                              >
                                Simpan
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="kyl-btn kyl-btn-ghost"
                                style={{ fontSize: 10 }}
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="kyl-flex-between">
                            <span className="kyl-text kyl-small">
                              {r.kandang} ·{" "}
                              <span className="kyl-text2">{r.date}</span>
                            </span>
                            <div
                              className="kyl-flex-center"
                              style={{ gap: 12 }}
                            >
                              <span
                                className="kyl-bold kyl-mono"
                                style={{
                                  fontSize: 12,
                                  color: r.kandang.includes("Cacat")
                                    ? "var(--red)"
                                    : "var(--primary-l)",
                                }}
                              >
                                {r.kandang.includes("Cacat") ? "-" : ""}
                                {r.jumlah} Pcs
                              </span>
                              <div
                                className="kyl-flex-center"
                                style={{ gap: 8 }}
                              >
                                <button
                                  onClick={() => {
                                    setEditId(r.id);
                                    setEditVal1(r.kandang);
                                    setEditVal2(r.jumlah.toString());
                                  }}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    opacity: 0.55,
                                  }}
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteItem("produksi", r.id)
                                  }
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    opacity: 0.55,
                                    color: "var(--red)",
                                  }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="kyl-empty">
                      {searchProd
                        ? "Tidak ada hasil pencarian."
                        : "Belum ada riwayat produksi."}
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ VIEW: KEUANGAN ═══════════════ */}
        {page === "cashflow" && (
          <div className="kyl-page-view kyl-space">
            {/* SUB-TABS */}
            <div className="kyl-subtab-row">
              {[
                { id: "transaksi", label: "💳 Transaksi" },
                { id: "pl", label: "📊 Laba Rugi" },
                { id: "laporan", label: "📅 Laporan" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setKasSubTab(t.id)}
                  className={`kyl-subtab-btn ${
                    kasSubTab === t.id ? "active" : ""
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── TAB: TRANSAKSI ── */}
            {kasSubTab === "transaksi" && (
              <>
                {/* Quick summary saldo */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div className="kyl-stat-card">
                    <span className="kyl-stat-lbl">💰 Saldo Total</span>
                    <div
                      className="kyl-stat-val kyl-mono"
                      style={{
                        color:
                          totalSaldo >= 0 ? "var(--primary-l)" : "var(--red)",
                      }}
                    >
                      {formatToK(totalSaldo)}
                    </div>
                    <div className="kyl-stat-sub">
                      {totalSaldo >= 0 ? "Kas positif" : "Kas minus"}
                    </div>
                  </div>
                  <div className="kyl-stat-card">
                    <span className="kyl-stat-lbl">📤 Total Keluar</span>
                    <div
                      className="kyl-stat-val kyl-mono"
                      style={{ color: "var(--red)" }}
                    >
                      {formatToK(totalKeluar)}
                    </div>
                    <div className="kyl-stat-sub">Akumulasi pengeluaran</div>
                  </div>
                </div>
                <div className="kyl-card">
                  <span className="kyl-card-lbl">
                    Catat Arus Keuangan Tunai
                  </span>
                  <div className="kyl-space">
                    <div>
                      <label className="kyl-form-lbl">
                        Tanggal Transaksi Kas
                      </label>
                      <input
                        type="date"
                        value={cfDate}
                        onChange={(e) => setCfDate(e.target.value)}
                        className="kyl-input"
                      />
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => setCfDate(todayStr())}
                          className="kyl-btn kyl-btn-secondary"
                          style={{
                            width: "auto",
                            padding: "6px 10px",
                            fontSize: 10,
                            minHeight: 30,
                          }}
                        >
                          Hari Ini
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 1);
                            setCfDate(d.toISOString().slice(0, 10));
                          }}
                          className="kyl-btn kyl-btn-secondary"
                          style={{
                            width: "auto",
                            padding: "6px 10px",
                            fontSize: 10,
                            minHeight: 30,
                          }}
                        >
                          Kemarin
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="kyl-form-lbl">
                        Keterangan Aliran Kas
                      </label>
                      <input
                        type="text"
                        placeholder="Ketik deskripsi keuangan..."
                        value={cfName}
                        onChange={(e) => setCfName(e.target.value)}
                        className="kyl-input"
                      />
                    </div>
                    <div>
                      <label className="kyl-form-lbl">Nominal Uang (Rp)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={cfNominalDisplay}
                        onChange={(e) => {
                          const raw = e.target.value
                            .replace(/\./g, "")
                            .replace(/\D/g, "");
                          if (!raw) {
                            setCfNominalDisplay("");
                            setCfNominalRaw("");
                            return;
                          }
                          setCfNominalRaw(raw);
                          setCfNominalDisplay(raw ? formatNominal(raw) : "");
                        }}
                        className="kyl-input kyl-mono"
                      />
                    </div>
                    <div className="kyl-grid2">
                      <button
                        onClick={() => handleInputKas("masuk")}
                        className="kyl-btn kyl-btn-primary"
                      >
                        📥 Pemasukan
                      </button>
                      <button
                        onClick={() => handleInputKas("keluar")}
                        className="kyl-btn kyl-btn-danger"
                      >
                        📤 Pengeluaran
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <span className="kyl-section-lbl">Riwayat Jurnal Kas</span>
                  <div className="kyl-search-wrap">
                    <span className="kyl-search-icon" aria-hidden="true">
                  <KylIcon name="search" />
                </span>
                    <input
                      type="text"
                      placeholder="Cari keterangan atau tanggal..."
                      value={searchKas}
                      onChange={(e) => setSearchKas(e.target.value)}
                      className="kyl-input"
                      style={{ marginBottom: 8 }}
                    />
                  </div>
                  <div className="kyl-space-sm">
                    {(() => {
                      const fCf = cashflow.filter(
                        (r) =>
                          !searchKas ||
                          r.keterangan
                            ?.toLowerCase()
                            .includes(searchKas.toLowerCase()) ||
                          r.date?.includes(searchKas)
                      );
                      return fCf.length > 0 ? (
                        fCf.map((r) => (
                          <div key={r.id} className="kyl-log-item">
                            {editId === r.id ? (
                              <div className="kyl-space-sm">
                                <input
                                  type="text"
                                  value={editVal1}
                                  onChange={(e) => setEditVal1(e.target.value)}
                                  className="kyl-edit-input"
                                />
                                <input
                                  type="number"
                                  value={editVal2}
                                  onChange={(e) => setEditVal2(e.target.value)}
                                  className="kyl-edit-input"
                                />
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    justifyContent: "flex-end",
                                  }}
                                >
                                  <button
                                    onClick={() =>
                                      handleUpdateItem("cashflow", r.id)
                                    }
                                    className="kyl-btn kyl-btn-indigo"
                                    style={{
                                      width: "auto",
                                      padding: "5px 12px",
                                      fontSize: 10,
                                    }}
                                  >
                                    Simpan
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditId(null);
                                      setEditVal4("");
                                    }}
                                    className="kyl-btn kyl-btn-ghost"
                                    style={{ fontSize: 10 }}
                                  >
                                    Batal
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="kyl-flex-between">
                                <div>
                                  <div className="kyl-bold kyl-small kyl-text">
                                    {r.keterangan}
                                  </div>
                                  <div
                                    className="kyl-xsmall kyl-text2"
                                    style={{ marginTop: 2 }}
                                  >
                                    {r.date}
                                  </div>
                                </div>
                                <div
                                  className="kyl-flex-center"
                                  style={{ gap: 12 }}
                                >
                                  <span
                                    className="kyl-mono kyl-bold"
                                    style={{
                                      fontSize: 13,
                                      color:
                                        r.jenis === "masuk"
                                          ? "var(--primary-l)"
                                          : "var(--red)",
                                    }}
                                  >
                                    {r.jenis === "masuk" ? "+" : "-"}
                                    {formatToK(r.nominal)}
                                  </span>
                                  <div
                                    className="kyl-flex-center"
                                    style={{ gap: 8 }}
                                  >
                                    <button
                                      onClick={() => {
                                        setEditId(r.id);
                                        setEditVal1(r.keterangan);
                                        setEditVal2(r.nominal.toString());
                                      }}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        opacity: 0.55,
                                      }}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteItem("cashflow", r.id)
                                      }
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        opacity: 0.55,
                                        color: "var(--red)",
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="kyl-empty">
                          {searchKas
                            ? "Tidak ada hasil."
                            : "Belum ada riwayat transaksi finansial."}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}

            {/* ── TAB: LABA RUGI ── */}
            {kasSubTab === "pl" && (
              <>
                {/* Summary bulan ini */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  {[
                    {
                      label: "Pemasukan Bulan Ini",
                      val: formatToK(totalMasukBulan),
                      color: "var(--primary-l)",
                      icon: "📥",
                    },
                    {
                      label: "Pengeluaran Bulan Ini",
                      val: formatToK(totalKeluarBulan),
                      color: "var(--red)",
                      icon: "📤",
                    },
                  ].map((m, i) => (
                    <div key={i} className="kyl-stat-card">
                      <span className="kyl-stat-lbl">
                        {m.icon} {m.label}
                      </span>
                      <div
                        className="kyl-stat-val kyl-mono"
                        style={{ color: m.color }}
                      >
                        {m.val}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Laba bersih bulan ini */}
                <div
                  className="kyl-pl-total"
                  style={{
                    background:
                      labaBersihBulan >= 0
                        ? "rgba(52,212,104,.08)"
                        : "rgba(255,59,48,.08)",
                    border:
                      ".5px solid " +
                      (labaBersihBulan >= 0
                        ? "rgba(52,212,104,.2)"
                        : "rgba(255,59,48,.2)"),
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--text2)",
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Laba Bersih Bulan Ini
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text3)",
                        marginTop: 2,
                      }}
                    >
                      {new Date().toLocaleDateString("id-ID", {
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 20,
                      fontWeight: 900,
                      color:
                        labaBersihBulan >= 0
                          ? "var(--primary-l)"
                          : "var(--red)",
                    }}
                  >
                    {labaBersihBulan >= 0 ? "+" : ""}
                    {formatNominal(labaBersihBulan)}
                  </div>
                </div>
                {/* Akumulasi semua waktu */}
                <div className="kyl-pl-section">
                  <span className="kyl-card-lbl">Akumulasi Semua Waktu</span>
                  {[
                    {
                      label: "Total Pemasukan",
                      val: cashflow
                        .filter((r) => r.jenis === "masuk")
                        .reduce((s, r) => s + (parseInt(r.nominal) || 0), 0),
                      color: "var(--primary-l)",
                    },
                    {
                      label: "Total Pengeluaran",
                      val: totalKeluar,
                      color: "var(--red)",
                    },
                    {
                      label: "Saldo Bersih",
                      val: labaBersihTotal,
                      color:
                        labaBersihTotal >= 0
                          ? "var(--primary-l)"
                          : "var(--red)",
                      bold: true,
                    },
                  ].map((r, i) => (
                    <div
                      key={i}
                      className="kyl-pl-row"
                      style={
                        r.bold
                          ? {
                              borderTop: "1px solid var(--border)",
                              paddingTop: 14,
                              marginTop: 4,
                            }
                          : {}
                      }
                    >
                      <span
                        className="kyl-pl-label"
                        style={
                          r.bold
                            ? { fontWeight: 800, color: "var(--text)" }
                            : {}
                        }
                      >
                        {r.label}
                      </span>
                      <span className="kyl-pl-val" style={{ color: r.color }}>
                        {r.bold ? (labaBersihTotal >= 0 ? "+" : "") : ""}
                        {formatNominal(r.val)}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Breakdown per kategori */}
                <div className="kyl-card">
                  <span className="kyl-card-lbl">
                    Breakdown Transaksi Terbesar
                  </span>
                  {cashflow.slice(0, 5).map((r) => (
                    <div key={r.id} className="kyl-pl-row">
                      <span style={{ fontSize: 12, color: "var(--text2)" }}>
                        {r.keterangan}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            r.jenis === "masuk"
                              ? "var(--primary-l)"
                              : "var(--red)",
                        }}
                      >
                        {r.jenis === "masuk" ? "+" : "-"}
                        {formatToK(r.nominal)}
                      </span>
                    </div>
                  ))}
                  {cashflow.length === 0 && (
                    <p className="kyl-empty">Belum ada transaksi</p>
                  )}
                </div>
              </>
            )}

            {/* ── TAB: LAPORAN ── */}
            {kasSubTab === "laporan" &&
              (() => {
                // Kumpulkan semua bulan dari cashflow + produksi (permanent, semua waktu)
                const allBulanSet = new Set(
                  [
                    ...cashflow.map((r) => r.date?.slice(0, 7)),
                    ...production.map((p) => p.date?.slice(0, 7)),
                  ].filter(Boolean)
                );
                const allBulan = [...allBulanSet].sort().reverse();
                const selBulan =
                  laporanBulan ||
                  allBulan[0] ||
                  new Date().toISOString().slice(0, 7);
                const cfBln = cashflow.filter((r) =>
                  r.date?.startsWith(selBulan)
                );
                const masukBln = cfBln
                  .filter((r) => r.jenis === "masuk")
                  .reduce((s, r) => s + (parseInt(r.nominal) || 0), 0);
                const keluarBln = cfBln
                  .filter((r) => r.jenis === "keluar")
                  .reduce((s, r) => s + (parseInt(r.nominal) || 0), 0);
                const lbBln = masukBln - keluarBln;
                return (
                  <>
                    {/* Navigasi bulan */}
                    <div className="kyl-card" style={{ padding: "12px 14px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 10,
                        }}
                      >
                        <button
                          onClick={() => {
                            const i = allBulan.indexOf(selBulan);
                            if (i < allBulan.length - 1)
                              setLaporanBulan(allBulan[i + 1]);
                          }}
                          style={{
                            background: "var(--surface2)",
                            border: ".5px solid var(--border)",
                            borderRadius: 8,
                            padding: "5px 10px",
                            cursor: "pointer",
                            color: "var(--text2)",
                            fontSize: 13,
                          }}
                        >
                          ‹
                        </button>
                        <select
                          value={selBulan}
                          onChange={(e) => setLaporanBulan(e.target.value)}
                          style={{
                            flex: 1,
                            textAlign: "center",
                            fontWeight: 800,
                            fontSize: 14,
                            color: "var(--text)",
                            background: "var(--surface2)",
                            border: ".5px solid var(--border)",
                            borderRadius: 8,
                            padding: "6px 10px",
                            fontFamily: "var(--font)",
                          }}
                        >
                          {allBulan.length > 0 ? (
                            allBulan.map((b) => (
                              <option key={b} value={b}>
                                {new Date(b + "-01").toLocaleDateString(
                                  "id-ID",
                                  { month: "long", year: "numeric" }
                                )}
                              </option>
                            ))
                          ) : (
                            <option value={selBulan}>
                              {new Date(selBulan + "-01").toLocaleDateString(
                                "id-ID",
                                { month: "long", year: "numeric" }
                              )}
                            </option>
                          )}
                        </select>
                        <button
                          onClick={() => {
                            const i = allBulan.indexOf(selBulan);
                            if (i > 0) setLaporanBulan(allBulan[i - 1]);
                          }}
                          style={{
                            background: "var(--surface2)",
                            border: ".5px solid var(--border)",
                            borderRadius: 8,
                            padding: "5px 10px",
                            cursor: "pointer",
                            color: "var(--text2)",
                            fontSize: 13,
                          }}
                        >
                          ›
                        </button>
                      </div>
                      {/* Ringkasan bulan terpilih */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2,1fr)",
                          gap: 6,
                          marginBottom: 12,
                        }}
                      >
                        {[
                          {
                            lbl: "Pemasukan",
                            val: formatNominal(masukBln),
                            unit: "Rp",
                            c: "var(--primary-l)",
                          },
                          {
                            lbl: "Laba Bersih",
                            val: (lbBln >= 0 ? "+" : "") + formatNominal(lbBln),
                            unit: "Rp",
                            c: lbBln >= 0 ? "var(--primary-l)" : "var(--red)",
                          },
                        ].map((m, i) => (
                          <div
                            key={i}
                            style={{
                              background: "var(--surface2)",
                              borderRadius: "var(--rsm)",
                              padding: "10px 8px",
                              textAlign: "center",
                              border: ".5px solid var(--border)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 8,
                                fontWeight: 700,
                                color: "var(--text3)",
                                textTransform: "uppercase",
                                marginBottom: 4,
                              }}
                            >
                              {m.lbl}
                            </div>
                            <div
                              style={{
                                fontFamily: "var(--mono)",
                                fontWeight: 800,
                                fontSize: 13,
                                color: m.c,
                              }}
                            >
                              {m.val}
                            </div>
                            <div
                              style={{
                                fontSize: 8,
                                color: "var(--text3)",
                                marginTop: 2,
                              }}
                            >
                              {m.unit}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Summary P&L */}
                      <div
                        style={{
                          padding: "10px 12px",
                          background:
                            lbBln >= 0
                              ? "rgba(52,212,104,.06)"
                              : "rgba(255,59,48,.06)",
                          borderRadius: "var(--rsm)",
                          border:
                            ".5px solid " +
                            (lbBln >= 0
                              ? "rgba(52,212,104,.2)"
                              : "rgba(255,59,48,.2)"),
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "var(--text2)",
                          }}
                        >
                          Pengeluaran
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontWeight: 800,
                            fontSize: 13,
                            color: "var(--red)",
                          }}
                        >
                          -{formatNominal(keluarBln)}
                        </span>
                      </div>
                    </div>

                    {/* Detail transaksi bulan ini */}
                    <div>
                      <span className="kyl-section-lbl">
                        📋 Semua Transaksi —{" "}
                        {new Date(selBulan + "-01").toLocaleDateString(
                          "id-ID",
                          { month: "long", year: "numeric" }
                        )}
                      </span>
                      {cfBln.length > 0 ? (
                        cfBln.map((r) => (
                          <div key={r.id} className="kyl-log-item">
                            <div className="kyl-flex-between">
                              <div>
                                <div className="kyl-bold kyl-small kyl-text">
                                  {r.keterangan}
                                </div>
                                <div
                                  className="kyl-xsmall kyl-text2"
                                  style={{ marginTop: 2 }}
                                >
                                  {r.date}
                                </div>
                              </div>
                              <span
                                className="kyl-mono kyl-bold"
                                style={{
                                  fontSize: 13,
                                  color:
                                    r.jenis === "masuk"
                                      ? "var(--primary-l)"
                                      : "var(--red)",
                                }}
                              >
                                {r.jenis === "masuk" ? "+" : "-"}
                                {formatNominal(r.nominal)}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="kyl-empty">
                          Belum ada transaksi bulan ini
                        </p>
                      )}
                    </div>

                    {/* Ringkasan semua bulan */}
                    {allBulan.length > 1 && (
                      <div className="kyl-card">
                        <span className="kyl-card-lbl">
                          📊 Ringkasan Semua Bulan
                        </span>
                        {allBulan.map((bln) => {
                          const msk = cashflow
                            .filter(
                              (r) =>
                                r.jenis === "masuk" && r.date?.startsWith(bln)
                            )
                            .reduce(
                              (s, r) => s + (parseInt(r.nominal) || 0),
                              0
                            );
                          const klr = cashflow
                            .filter(
                              (r) =>
                                r.jenis === "keluar" && r.date?.startsWith(bln)
                            )
                            .reduce(
                              (s, r) => s + (parseInt(r.nominal) || 0),
                              0
                            );
                          const lb = msk - klr;
                          return (
                            <div
                              key={bln}
                              className="kyl-pl-row"
                              style={{ cursor: "pointer" }}
                              onClick={() => setLaporanBulan(bln)}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: bln === selBulan ? 800 : 500,
                                  color:
                                    bln === selBulan
                                      ? "var(--text)"
                                      : "var(--text2)",
                                }}
                              >
                                {bln === selBulan ? "▶ " : ""}
                                {new Date(bln + "-01").toLocaleDateString(
                                  "id-ID",
                                  { month: "short", year: "numeric" }
                                )}
                              </span>
                              <span
                                style={{
                                  fontFamily: "var(--mono)",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color:
                                    lb >= 0 ? "var(--primary-l)" : "var(--red)",
                                }}
                              >
                                {lb >= 0 ? "+" : ""}
                                {formatToK(lb)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
          </div>
        )}

        {/* ═══════════════ VIEW: PESANAN ═══════════════ */}
        {/* Bottom Sheet: Form Input Pesanan */}
        {/* Bottom Sheet: Form Input Pesanan - menggunakan renderSheet agar input tidak kehilangan fokus */}
        {renderSheet(
          "pesanan",
          "🚚 Catat Pesanan Baru",
          <div className="kyl-space" style={{ paddingBottom: 8 }}>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="kyl-input"
            />
            <input
              type="text"
              placeholder="Nama pelanggan / outlet..."
              value={deliveryCust}
              onChange={(e) => setDeliveryCust(e.target.value)}
              className="kyl-input"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <div>
              <label className="kyl-form-lbl" style={{ marginBottom: 8 }}>
                Pilih Produk
              </label>
              <div className="kyl-space-sm">
                {productMenu.map((p) => {
                  const h = getProdukHargaByNama(
                    p.name,
                    hargaProduk,
                    masterProduk
                  );
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProduct(p.name)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        textAlign: "left",
                        borderRadius: "var(--rsm)",
                        border:
                          selectedProduct === p.name
                            ? ".5px solid var(--indigo)"
                            : ".5px solid var(--border)",
                        background:
                          selectedProduct === p.name
                            ? "rgba(90,112,232,.1)"
                            : "var(--surface2)",
                        color:
                          selectedProduct === p.name
                            ? "var(--indigo)"
                            : "var(--text)",
                        fontFamily: "var(--font)",
                        fontSize: 12,
                        fontWeight: selectedProduct === p.name ? 700 : 500,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{p.name}</span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {h > 0 && (
                          <span style={{ fontSize: 10, color: "var(--text3)" }}>
                            {formatRupiah(h)}
                          </span>
                        )}
                        {selectedProduct === p.name && (
                          <span
                            style={{
                              fontSize: 10,
                              background: "var(--indigo)",
                              color: "#fff",
                              padding: "2px 7px",
                              borderRadius: 6,
                              fontWeight: 700,
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="kyl-grid3">
              <div>
                <label className="kyl-form-lbl">Volume</label>
                <input
                  type="number"
                  placeholder="1"
                  value={deliveryQty}
                  onChange={(e) => setDeliveryQty(e.target.value)}
                  className="kyl-input kyl-mono"
                />
              </div>
              <div>
                <label className="kyl-form-lbl">Jam</label>
                <input
                  type="time"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  className="kyl-input kyl-mono"
                />
              </div>
              <div>
                <label className="kyl-form-lbl">Catatan</label>
                <input
                  type="text"
                  placeholder="Catatan pesanan..."
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="kyl-input"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </div>
            {/* Preview total harga */}
            {(() => {
              const h = getProdukHargaByNama(
                selectedProduct,
                hargaProduk,
                masterProduk
              );
              const tot = h * (parseInt(deliveryQty) || 1);
              return h > 0 ? (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(22,163,96,.06)",
                    borderRadius: "var(--rsm)",
                    border: ".5px solid rgba(22,163,96,.15)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--primary-l)",
                  }}
                >
                  💰 Total: {formatRupiah(tot)} · akan otomatis masuk kas saat
                  Selesai
                </div>
              ) : null;
            })()}
            <button
              onClick={() => {
                handleInputDelivery();
              }}
              className="kyl-btn kyl-btn-indigo"
            >
              ✅ Simpan Pesanan
            </button>
          </div>
        )}

        {page === "delivery" && (
          <div className="kyl-page-view kyl-space">
            {/* SUB-TABS */}
            <div className="kyl-subtab-row">
              {[
                { id: "log", label: "📋 Log Pesanan" },
                { id: "nota", label: "🧾 Nota" },
                { id: "pelanggan", label: "👥 Pelanggan" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setPesananSubTab(t.id)}
                  className={`kyl-subtab-btn ${
                    pesananSubTab === t.id ? "active" : ""
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── TAB: LOG PESANAN ── */}
            {pesananSubTab === "log" && (
              <>
                <div
                  className="kyl-card"
                  style={{ border: ".5px dashed var(--border)" }}
                >
                  <div
                    className="kyl-flex-between"
                    style={{ cursor: "pointer" }}
                    onClick={() => setSheet("pesanan")}
                  >
                    <span
                      className="kyl-card-lbl"
                      style={{ marginBottom: 0, color: "var(--indigo)" }}
                    >
                      + Catat Pesanan Baru
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--indigo)",
                        fontWeight: 700,
                      }}
                    >
                      Tap ↗
                    </span>
                  </div>
                </div>

                <div>
                  <span className="kyl-section-lbl">
                    Log Antrean Pengantaran Aktif
                  </span>
                  <div className="kyl-search-wrap">
                    <span className="kyl-search-icon" aria-hidden="true">
                  <KylIcon name="search" />
                </span>
                    <input
                      type="text"
                      placeholder="Cari nama pelanggan atau produk..."
                      value={searchDelivery}
                      onChange={(e) => setSearchDelivery(e.target.value)}
                      className="kyl-input"
                      style={{ marginBottom: 8 }}
                    />
                  </div>
                  <div className="kyl-space-sm">
                    {(() => {
                      const filteredDel = deliveries.filter(
                        (d) =>
                          !searchDelivery ||
                          d.customer
                            ?.toLowerCase()
                            .includes(searchDelivery.toLowerCase()) ||
                          d.product
                            ?.toLowerCase()
                            .includes(searchDelivery.toLowerCase())
                      );
                      return filteredDel.length > 0 ? (
                        filteredDel.map((d) => (
                          <div
                            key={d.id}
                            className="kyl-log-item"
                            style={{
                              border:
                                d.status === "selesai"
                                  ? ".5px solid rgba(52,212,104,.15)"
                                  : ".5px solid var(--border)",
                              background:
                                d.status === "selesai"
                                  ? "rgba(52,212,104,.03)"
                                  : "var(--surface)",
                            }}
                          >
                            {editId === d.id ? (
                              <div className="kyl-space-sm">
                                <input
                                  type="text"
                                  value={editVal1}
                                  onChange={(e) => setEditVal1(e.target.value)}
                                  className="kyl-edit-input"
                                />
                                <input
                                  type="number"
                                  value={editVal2}
                                  onChange={(e) => setEditVal2(e.target.value)}
                                  className="kyl-edit-input"
                                />
                                <select
                                  value={editVal4}
                                  onChange={(e) => setEditVal4(e.target.value)}
                                  className="kyl-edit-input"
                                >
                                  <option value="">Pilih produk</option>
                                  {productMenu.map((p) => (
                                    <option key={p.id} value={p.name}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="time"
                                  value={editVal3}
                                  onChange={(e) => setEditVal3(e.target.value)}
                                  className="kyl-edit-input kyl-mono"
                                />
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    justifyContent: "flex-end",
                                  }}
                                >
                                  <button
                                    onClick={() =>
                                      handleUpdateItem("delivery", d.id)
                                    }
                                    className="kyl-btn kyl-btn-indigo"
                                    style={{
                                      width: "auto",
                                      padding: "5px 12px",
                                      fontSize: 10,
                                    }}
                                  >
                                    Simpan
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditId(null);
                                      setEditVal4("");
                                    }}
                                    className="kyl-btn kyl-btn-ghost"
                                    style={{ fontSize: 10 }}
                                  >
                                    Batal
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div
                                  className="kyl-flex-between"
                                  style={{ marginBottom: 6 }}
                                >
                                  <div>
                                    <span
                                      className="kyl-bold kyl-text"
                                      style={{ fontSize: 13 }}
                                    >
                                      {d.customer}
                                    </span>
                                    {d.status === "selesai" && (
                                      <span
                                        className="kyl-badge-selesai"
                                        style={{ marginLeft: 8 }}
                                      >
                                        ✅ Selesai
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className="kyl-mono"
                                    style={{
                                      fontSize: 9,
                                      color: "var(--text3)",
                                    }}
                                  >
                                    Jam: {d.jam || "00:00"} ({d.date})
                                  </span>
                                </div>
                                {/* PRODUCT HIGHLIGHT TAG + HARGA */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    marginBottom: 8,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span className="kyl-product-tag">
                                    {d.product}
                                  </span>
                                  {(() => {
                                    const h = getProdukHargaByNama(
                                      d.product,
                                      hargaProduk,
                                      masterProduk
                                    );
                                    return h > 0 ? (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 700,
                                          color: "var(--primary-l)",
                                          fontFamily: "var(--mono)",
                                        }}
                                      >
                                        {formatRupiah(
                                          h * (parseInt(d.jumlah) || 1)
                                        )}
                                      </span>
                                    ) : null;
                                  })()}
                                </div>
                                {d.note && (
                                  <p
                                    className="kyl-small kyl-amber"
                                    style={{
                                      background: "rgba(245,158,11,0.06)",
                                      padding: "5px 10px",
                                      borderRadius: 8,
                                      border: ".5px solid rgba(245,158,11,.15)",
                                      marginBottom: 6,
                                    }}
                                  >
                                    📝 {d.note}
                                  </p>
                                )}
                                <div
                                  className="kyl-flex-between"
                                  style={{
                                    paddingTop: 8,
                                    borderTop: ".5px solid var(--border2)",
                                  }}
                                >
                                  <span
                                    className="kyl-tag kyl-mono kyl-bold"
                                    style={{ fontSize: 11 }}
                                  >
                                    {d.jumlah} {d.unit || "Pcs"}
                                  </span>
                                  <div
                                    className="kyl-flex-center"
                                    style={{ gap: 8 }}
                                  >
                                    {d.status !== "selesai" && (
                                      <button
                                        onClick={() =>
                                          handleCompleteDelivery(d.id)
                                        }
                                        className="kyl-selesai-btn"
                                      >
                                        ✅ Selesai
                                      </button>
                                    )}
                                    {d.status === "selesai" && (
                                      <button
                                        onClick={() => handleKirimWA(d)}
                                        style={{
                                          background: "rgba(37,211,102,.12)",
                                          border:
                                            ".5px solid rgba(37,211,102,.25)",
                                          color: "#25d366",
                                          borderRadius: 8,
                                          padding: "5px 10px",
                                          fontSize: 10,
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                      >
                                        📤 WA
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setEditId(d.id);
                                        setEditVal1(d.customer);
                                        setEditVal2(d.jumlah.toString());
                                        setEditVal3(d.jam || "00:00");
                                        setEditVal4(d.product || "");
                                      }}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        opacity: 0.55,
                                      }}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteItem("delivery", d.id)
                                      }
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        opacity: 0.55,
                                        color: "var(--red)",
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="kyl-empty">
                          {searchDelivery
                            ? "Tidak ada hasil."
                            : "Belum ada antrean pengiriman."}
                        </p>
                      );
                    })()}
                  </div>
                </div>
                {/* FAB pesanan */}
                <button
                  className="kyl-fab no-print"
                  onClick={() => setSheet("pesanan")}
                  title="Catat Pesanan Baru"
                >
                  +
                </button>
              </>
            )}

            {/* ── TAB: NOTA ── */}
            {pesananSubTab === "nota" && (
              <>
                <div
                  className="kyl-card"
                  style={{ border: ".5px solid var(--border)" }}
                >
                  <span
                    className="kyl-card-lbl"
                    style={{ color: "var(--indigo)" }}
                  >
                    🧾 Nota Siap Kirim
                  </span>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text2)",
                      lineHeight: 1.6,
                    }}
                  >
                    Menu ini menampilkan pesanan yang sudah selesai dan siap
                    dikirim ke WhatsApp sebagai nota.
                  </div>
                </div>

                <div className="kyl-search-wrap">
                  <span className="kyl-search-icon" aria-hidden="true">
                  <KylIcon name="search" />
                </span>
                  <input
                    type="text"
                    placeholder="Cari nama pelanggan atau produk nota..."
                    value={searchDelivery}
                    onChange={(e) => setSearchDelivery(e.target.value)}
                    className="kyl-input"
                    style={{ marginBottom: 8 }}
                  />
                </div>

                {(() => {
                  const notaList = deliveries.filter(
                    (d) =>
                      d.status === "selesai" &&
                      (!searchDelivery ||
                        d.customer
                          ?.toLowerCase()
                          .includes(searchDelivery.toLowerCase()) ||
                        d.product
                          ?.toLowerCase()
                          .includes(searchDelivery.toLowerCase()))
                  );
                  return notaList.length > 0 ? (
                    notaList.map((d) => {
                      const h = getProdukHargaByNama(
                        d.product,
                        hargaProduk,
                        masterProduk
                      );
                      const total = h * (parseInt(d.jumlah) || 1);
                      return (
                        <div
                          key={`nota-${d.id}`}
                          className="kyl-log-item"
                          style={{
                            border: ".5px solid rgba(37,211,102,.18)",
                            background: "rgba(37,211,102,.03)",
                          }}
                        >
                          <div
                            className="kyl-flex-between"
                            style={{ marginBottom: 6, gap: 10 }}
                          >
                            <div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  fontSize: 13,
                                  color: "var(--text)",
                                }}
                              >
                                {d.customer}
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--text3)",
                                  marginTop: 2,
                                }}
                              >
                                {d.date} · {d.jam || "00:00"}
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--indigo)",
                                  marginTop: 2,
                                  fontFamily: "var(--mono)",
                                }}
                              >
                                {d.invoice || makeInvoiceCode(d.date, d.id)}
                              </div>
                            </div>
                            <span className="kyl-badge-selesai">
                              ✅ Selesai
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span className="kyl-product-tag">{d.product}</span>
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: 11,
                                fontWeight: 800,
                                color: "var(--primary-l)",
                              }}
                            >
                              {d.jumlah} {d.unit || "Pcs"}
                            </span>
                            {h > 0 && (
                              <span
                                style={{
                                  fontFamily: "var(--mono)",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: "var(--gold)",
                                }}
                              >
                                {formatRupiah(total)}
                              </span>
                            )}
                          </div>
                          {d.note && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text2)",
                                background: "rgba(245,158,11,.06)",
                                border: ".5px solid rgba(245,158,11,.15)",
                                borderRadius: 8,
                                padding: "6px 10px",
                                marginBottom: 8,
                              }}
                            >
                              📝 {d.note}
                            </div>
                          )}
                          <div className="kyl-flex-between" style={{ gap: 8 }}>
                            <button
                              onClick={() => handleKirimWA(d)}
                              style={{
                                background: "rgba(37,211,102,.12)",
                                border: ".5px solid rgba(37,211,102,.25)",
                                color: "#25d366",
                                borderRadius: 8,
                                padding: "7px 12px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              📤 Kirim Nota WA
                            </button>
                            <button
                              onClick={() => {
                                setPage("delivery");
                                setPesananSubTab("log");
                                setSearchDelivery(d.customer);
                              }}
                              style={{
                                background: "var(--surface2)",
                                border: ".5px solid var(--border)",
                                color: "var(--text)",
                                borderRadius: 8,
                                padding: "7px 12px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              ↩️ Lihat Log
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="kyl-empty">
                      Belum ada nota selesai yang siap dikirim.
                    </p>
                  );
                })()}
              </>
            )}

            {/* ── TAB: PELANGGAN ── */}
            {pesananSubTab === "pelanggan" && (
              <>
                <div className="kyl-search-wrap">
                  <span className="kyl-search-icon" aria-hidden="true">
                  <KylIcon name="search" />
                </span>
                  <input
                    type="text"
                    placeholder="Cari nama pelanggan..."
                    value={searchPelanggan}
                    onChange={(e) => setSearchPelanggan(e.target.value)}
                    className="kyl-input"
                    style={{ marginBottom: 8 }}
                  />
                </div>
                {(() => {
                  const fPel = pelanggan.filter(
                    (p) =>
                      !searchPelanggan ||
                      p.nama
                        .toLowerCase()
                        .includes(searchPelanggan.toLowerCase())
                  );
                  return fPel.length > 0 ? (
                    fPel.map((p) => (
                      <div key={p.id} className="kyl-pel-card">
                        <div
                          className="kyl-flex-between"
                          style={{ marginBottom: 8 }}
                        >
                          <div className="kyl-flex-center" style={{ gap: 12 }}>
                            <div className="kyl-pel-initial">
                              {p.nama.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  fontSize: 13,
                                  color: "var(--text)",
                                }}
                              >
                                {p.nama}
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--text3)",
                                  marginTop: 2,
                                }}
                              >
                                {p.totalOrder || 0}x order · Last:{" "}
                                {p.lastOrder || "–"}
                              </div>
                              {p.noWA && (
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: "#25d366",
                                    marginTop: 1,
                                  }}
                                >
                                  📱 {p.noWA}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeletePelanggan(p.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 14,
                              color: "var(--red)",
                              opacity: 0.5,
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                        {/* Input nomor WA */}
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="tel"
                            placeholder="Simpan no. WA (contoh: 0812...)"
                            value={
                              noWAEdit[p.id] !== undefined
                                ? noWAEdit[p.id]
                                : p.noWA || ""
                            }
                            onChange={(e) =>
                              setNoWAEdit((prev) => ({
                                ...prev,
                                [p.id]: e.target.value,
                              }))
                            }
                            className="kyl-input"
                            style={{
                              flex: 1,
                              fontSize: 12,
                              padding: "8px 12px",
                            }}
                          />
                          <button
                            onClick={() => handleSavePelangganWA(p.id)}
                            style={{
                              background: "#25d366",
                              color: "#fff",
                              border: "none",
                              borderRadius: "var(--rsm)",
                              padding: "9px 14px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            💾 Simpan
                          </button>
                        </div>
                        {/* Riwayat order pelanggan ini */}
                        {deliveries.filter(
                          (d) =>
                            d.customer.toLowerCase() === p.nama.toLowerCase()
                        ).length > 0 && (
                          <div
                            style={{
                              marginTop: 10,
                              paddingTop: 10,
                              borderTop: ".5px solid var(--border2)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: "var(--text3)",
                                textTransform: "uppercase",
                                letterSpacing: ".08em",
                                marginBottom: 6,
                              }}
                            >
                              Riwayat Pembelian
                            </div>
                            {deliveries
                              .filter(
                                (d) =>
                                  d.customer.toLowerCase() ===
                                  p.nama.toLowerCase()
                              )
                              .slice(0, 3)
                              .map((d) => (
                                <div
                                  key={d.id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: 11,
                                    marginBottom: 4,
                                    color: "var(--text2)",
                                  }}
                                >
                                  <span>
                                    {d.date} ·{" "}
                                    {d.product.split(" ").slice(0, 3).join(" ")}
                                  </span>
                                  <span
                                    style={{
                                      fontFamily: "var(--mono)",
                                      color:
                                        d.status === "selesai"
                                          ? "var(--primary-l)"
                                          : "var(--amber)",
                                    }}
                                  >
                                    {d.jumlah} {d.unit || "Pcs"}{" "}
                                    {d.status === "selesai" ? "✅" : "⏳"}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="kyl-empty">
                      {searchPelanggan
                        ? "Tidak ditemukan."
                        : "Belum ada data pelanggan. Pelanggan otomatis tersimpan saat pesanan dibuat."}
                    </p>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* ═══════════════ VIEW: OMEGA-3 SYSTEM ═══════════════ */}
        {page === "omega" && (
          <div className="kyl-page-view kyl-space">
            {/* Hero Card */}
            <div className="kyl-omega-hero">
              <div className="kyl-omega-badge">
                🥚 SISTEM BEBAS SANGKAR PREMIUM
              </div>
              <div className="kyl-omega-title">KAYALA FARM</div>
              <div className="kyl-omega-sub">
                Sistem Omega-3 Bebas Sangkar Premium
              </div>
              <div className="kyl-omega-desc">
                Fokus Utama: Mempertahankan <strong>HDP Tinggi</strong>{" "}
                sekaligus meningkatkan kandungan <strong>Omega-3 & ALA</strong>{" "}
                secara stabil dan berkelanjutan.
              </div>
              <div className="kyl-omega-stats">
                <div className="kyl-omega-stat">
                  <div className="kyl-omega-stat-title">TARGET HDP</div>
                  <div className="kyl-omega-stat-val">95–97%</div>
                </div>
                <div className="kyl-omega-stat">
                  <div className="kyl-omega-stat-title">POPULASI</div>
                  <div className="kyl-omega-stat-val">
                    {parseInt(flockData.totalAyam) || 0}
                    <span style={{ fontSize: 12 }}> Ekor</span>
                  </div>
                </div>
                <div className="kyl-omega-stat">
                  <div className="kyl-omega-stat-title">FOKUS UTAMA</div>
                  <div className="kyl-omega-stat-val">Omega-3</div>
                </div>
              </div>
            </div>

            {/* FCR & Performa Card */}
            <div className="kyl-card">
              <div className="kyl-sec-title">📊 Performa Real-Time Kandang</div>
              <div className="kyl-fcr-grid">
                {(() => {
                  const recent = production
                    .filter((p) => !p.kandang.includes("Panen General"))
                    .slice(0, 7);
                  const avgVal =
                    recent.length > 0
                      ? recent.reduce(
                          (s, r) => s + (parseInt(r.jumlah) || 0),
                          0
                        ) / recent.length
                      : 0;
                  const fcrVal = avgVal > 0 ? Math.round(6000 / avgVal) : null;
                  const fcrCol = !fcrVal
                    ? "var(--text3)"
                    : fcrVal <= 130
                    ? "var(--primary-l)"
                    : fcrVal <= 160
                    ? "var(--amber)"
                    : "var(--red)";
                  const hdpPct =
                    flockData.totalAyam > 0
                      ? ((todayTotal / flockData.totalAyam) * 100).toFixed(1)
                      : null;
                  const hdpCol = !hdpPct
                    ? "var(--text3)"
                    : hdpPct >= 95
                    ? "var(--primary-l)"
                    : hdpPct >= 90
                    ? "var(--amber)"
                    : "var(--red)";
                  return (
                    <>
                      <div className="kyl-fcr-cell">
                        <span className="kyl-fcr-lbl">HDP Hari Ini</span>
                        <div className="kyl-fcr-val" style={{ color: hdpCol }}>
                          {hdpPct || "–"}
                          <span style={{ fontSize: 10 }}>%</span>
                        </div>
                      </div>
                      <div className="kyl-fcr-cell">
                        <span className="kyl-fcr-lbl">FCR g/butir</span>
                        <div className="kyl-fcr-val" style={{ color: fcrCol }}>
                          {fcrVal || "–"}
                        </div>
                      </div>
                      <div className="kyl-fcr-cell">
                        <span className="kyl-fcr-lbl">Rerata 7 Input</span>
                        <div
                          className="kyl-fcr-val"
                          style={{ color: "var(--indigo)" }}
                        >
                          {avgVal > 0 ? avgVal.toFixed(0) : "–"}
                          <span style={{ fontSize: 10 }}> btr</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: "rgba(0,0,0,.1)",
                  borderRadius: "var(--rsm)",
                  fontSize: 11,
                  color: "var(--text2)",
                  lineHeight: 1.6,
                }}
              >
                FCR ideal:{" "}
                <strong style={{ color: "var(--primary-l)" }}>≤130</strong>{" "}
                g/butir ✅ · 130–160 ⚠️ ·{" "}
                <strong style={{ color: "var(--red)" }}>&gt;160</strong> perlu
                evaluasi pakan 🚨
              </div>
            </div>

            {/* Standar Nutrisi Banner */}
            <div className="kyl-nutrisi-banner">
              <h3>📢 STANDAR MANAJEMEN NUTRISI</h3>
              <p>
                Seluruh formulasi enrichment KAYALA FARM berpedoman penuh pada
                standar nutrisi pakan utama <strong>JAPFA PAR L1 Red</strong>.
                Jangan ubah standar pakan ini tanpa perhitungan matang — seluruh
                fortifikasi Omega-3 dirancang sinkron dengan spesifikasi pakan
                ini.
              </p>
            </div>

            {/* ── HDP CALCULATOR ── */}
            <div className="kyl-card">
              <div className="kyl-sec-title">🧮 Kalkulator HDP Hari Ini</div>
              <p className="kyl-small kyl-text2" style={{ marginBottom: 14 }}>
                Hitung pencapaian target produksi harian berbasis populasi tetap
                ayam di kandang.
              </p>
              <label className="kyl-form-lbl">
                Jumlah Produksi Telur Hari Ini (Butir)
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="number"
                  value={hdpInput}
                  onChange={(e) => setHdpInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && hitungHDP()}
                  className="kyl-input kyl-mono"
                  placeholder="0"
                  min="0"
                  max="100"
                  style={{ maxWidth: 160 }}
                />
                <button
                  onClick={hitungHDP}
                  className="kyl-btn kyl-btn-brown"
                  style={{ flex: 1 }}
                >
                  Hitung HDP
                </button>
              </div>
              {hdpResult && (
                <div
                  className={`kyl-result-box ${
                    hdpResult.type === "good"
                      ? "kyl-result-good"
                      : hdpResult.type === "warn"
                      ? "kyl-result-warn"
                      : "kyl-result-bad"
                  }`}
                >
                  <span
                    dangerouslySetInnerHTML={{
                      __html: hdpResult.text.replace(
                        /\*\*(.*?)\*\*/g,
                        "<strong>$1</strong>"
                      ),
                    }}
                  />
                </div>
              )}
            </div>

            {/* ── FORMULA CALCULATOR ── */}
            {/* ── PANDUAN FORMULA BERTAHAP ── */}
            <div className="kyl-card">
              <div className="kyl-sec-title">
                🥣 Panduan Formula Bertahap (Standar Dasar)
              </div>
              <p className="kyl-small kyl-text2" style={{ marginBottom: 14 }}>
                Program dilakukan berjenjang agar metabolisme pencernaan ayam
                beradaptasi sempurna.
              </p>
              <div className="kyl-table-wrap">
                <table className="kyl-table">
                  <thead>
                    <tr>
                      <th>Tahapan</th>
                      <th>PAR L1 Red</th>
                      <th>Flaxseed Giling</th>
                      <th>Minyak Ikan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="bold">Minggu 1</td>
                      <td>6 kg</td>
                      <td>60 gram</td>
                      <td>30 ml</td>
                    </tr>
                    <tr>
                      <td className="bold">Minggu 2</td>
                      <td>6 kg</td>
                      <td>90 gram</td>
                      <td>30 ml</td>
                    </tr>
                    <tr>
                      <td className="bold">Minggu 3+</td>
                      <td>6 kg</td>
                      <td>120 gram</td>
                      <td>30 ml</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  background: "rgba(90,112,232,.07)",
                  borderRadius: "var(--rsm)",
                  border: ".5px solid rgba(90,112,232,.15)",
                }}
              >
                <span className="kyl-indigo kyl-small kyl-bold">ATURAN:</span>
                <span className="kyl-small kyl-text2">
                  {" "}
                  Jangan naikkan dosis ke tahap berikutnya jika HDP menunjukkan
                  tren menurun atau ayam kurang lahap.
                </span>
              </div>
            </div>

            {/* ── STANDARISASI FLAXSEED ── */}
            <div className="kyl-card">
              <div className="kyl-sec-title">
                🌾 Standarisasi Pemakaian Flaxseed
              </div>
              <div className="kyl-table-wrap">
                <table className="kyl-table">
                  <thead>
                    <tr>
                      <th>✅ PRAKTIK BENAR</th>
                      <th>❌ KESALAHAN OPERASIONAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ color: "var(--primary-l)" }}>
                        Digiling kasar (biji pecah / retak).
                      </td>
                      <td style={{ color: "var(--red)" }}>
                        Diberikan utuh (biji keluar bersama kotoran).
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: "var(--primary-l)" }}>
                        Digiling segar sesuai porsi harian.
                      </td>
                      <td style={{ color: "var(--red)" }}>
                        Digiling terlalu halus / jadi tepung (cepat tengik).
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: "var(--primary-l)" }}>
                        Disimpan dalam wadah rapat kedap udara.
                      </td>
                      <td style={{ color: "var(--red)" }}>
                        Dibiarkan terbuka lama (kualitas asam lemak rusak).
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── SOP MIXING ── */}
            <div className="kyl-card">
              <div className="kyl-sec-title">
                🐟 SOP Pencampuran Pakan Omega-3
              </div>
              {[
                {
                  n: "Langkah 1",
                  t: "Timbang dan masukkan pakan utama <strong>Japfa PAR L1 Red</strong> ke dalam wadah pencampuran besar.",
                },
                {
                  n: "Langkah 2",
                  t: "Tuangkan minyak ikan sesuai takaran secara bertahap sedikit demi sedikit.",
                },
                {
                  n: "Langkah 3",
                  t: "Aduk pakan secara konstan hingga seluruh cairan minyak menempel merata di permukaan pakan utama.",
                },
                {
                  n: "Langkah 4",
                  t: "Taburkan bahan baku flaxseed yang telah digiling kasar di atas pakan yang sudah berminyak.",
                },
                {
                  n: "Langkah 5",
                  t: "Lakukan pengadukan akhir hingga seluruh campuran terlihat homogen dan menyatu sempurna.",
                },
                {
                  n: "Langkah 6",
                  t: "Pakan siap didistribusikan ke palung pakan ayam di kandang.",
                },
              ].map((s, i) => (
                <div key={i} className="kyl-timeline-item">
                  <div className="kyl-timeline-num">{s.n}</div>
                  <div
                    className="kyl-timeline-body"
                    dangerouslySetInnerHTML={{ __html: s.t }}
                  />
                </div>
              ))}
            </div>

            {/* ── JADWAL HARIAN ── */}
            <div className="kyl-card">
              <div className="kyl-sec-title">
                📅 Jadwal & Sesi Pemeliharaan Harian
              </div>
              {[
                {
                  time: "06.00",
                  label: "SESI PAGI",
                  items: [
                    "Kuras dan ganti air minum dengan kondisi bersih & segar.",
                    "Lakukan pemanenan produksi telur periode pagi.",
                    "Cek kondisi klinis ayam (waspadai jika ada ayam lemas/sakit).",
                    "Pemberian pakan utama: <strong>2.4 kg Japfa PAR L1 Red</strong>.",
                    "Campuran suplemen: Flaxseed (24g / 36g / 48g) & Minyak Ikan (12 ml).",
                  ],
                },
                {
                  time: "12.00",
                  label: "SESI SIANG",
                  items: [
                    "Monitoring volume air minum di dalam kandang koloni.",
                    "Lakukan pemanenan produksi telur periode siang.",
                    "Inspeksi visual warna dan tekstur feses / kotoran ayam harian.",
                    "<em>Opsional:</em> Pemberian hijauan aman (Kelor/Azolla) maksimal 5-10% dari total pakan.",
                  ],
                },
                {
                  time: "16.00",
                  label: "SESI SORE",
                  items: [
                    "Pemberian pakan utama: <strong>3.6 kg Japfa PAR L1 Red</strong>.",
                    "Campuran suplemen: Flaxseed (36g / 54g / 72g) & Minyak Ikan (18 ml).",
                    "Lakukan pemanenan akhir dan catat total hasil hari ini.",
                  ],
                },
              ].map((s, i) => (
                <div key={i} className="kyl-timeline-item">
                  <div className="kyl-timeline-num">{s.time}</div>
                  <div className="kyl-timeline-body">
                    <div className="bold" style={{ marginBottom: 8 }}>
                      {s.label}
                    </div>
                    <ul
                      style={{
                        paddingLeft: 18,
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                      }}
                    >
                      {s.items.map((item, j) => (
                        <li
                          key={j}
                          style={{
                            fontSize: 12.5,
                            color: "var(--text2)",
                            lineHeight: 1.55,
                          }}
                          dangerouslySetInnerHTML={{ __html: item }}
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            {/* ── AIR MINUM ── */}
            <div className="kyl-card">
              <div className="kyl-sec-title">
                💧 Standarisasi Manajemen Air Minum
              </div>
              <p className="kyl-small kyl-text2" style={{ marginBottom: 14 }}>
                Pasokan air minum berkualitas adalah kunci mutlak kelancaran
                metabolisme pembentukan telur harian.
              </p>
              <div className="kyl-table-wrap">
                <table className="kyl-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Target Standar</th>
                      <th>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="bold">Ketersediaan Kontinu</td>
                      <td>
                        <span className="kyl-badge-good">WAJIB</span>
                      </td>
                      <td>Kekurangan air beberapa jam memicu drop produksi.</td>
                    </tr>
                    <tr>
                      <td className="bold">Pembersihan Bak Minum</td>
                      <td>
                        <span className="kyl-badge-good">TIAP PAGI</span>
                      </td>
                      <td>Mencegah penumpukan lumut dan bakteri patogen.</td>
                    </tr>
                    <tr>
                      <td className="bold">Kontrol Suhu Air</td>
                      <td>
                        <span className="kyl-badge-warn">TEDUH / SEJUK</span>
                      </td>
                      <td>
                        Hindari air panas akibat paparan matahari langsung.
                      </td>
                    </tr>
                    <tr>
                      <td className="bold">Indikator Fisik Air</td>
                      <td>
                        <span className="kyl-badge-bad">
                          JANGAN BERBAU/KERUH
                        </span>
                      </td>
                      <td>
                        Air tercemar merusak selera minum dan imunitas koloni.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── PENYIMPANAN BAHAN BAKU ── */}
            <div className="kyl-card">
              <div className="kyl-sec-title">
                📦 Standar Penyimpanan Bahan Baku
              </div>
              <div className="kyl-table-wrap">
                <table className="kyl-table">
                  <thead>
                    <tr>
                      <th>Bahan Baku</th>
                      <th>SOP Penyimpanan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="bold">Biji Rami (Flaxseed) Utuh</td>
                      <td>
                        Wadah tertutup rapat, kering, dan bebas dari kelembaban.
                      </td>
                    </tr>
                    <tr>
                      <td className="bold">Flaxseed Giling Kasar</td>
                      <td>
                        Giling dalam jumlah terbatas untuk konsumsi maksimal 2-3
                        hari.
                      </td>
                    </tr>
                    <tr>
                      <td className="bold">Minyak Ikan Cair</td>
                      <td>
                        Pastikan segel tutup botol rapat sesaat setelah
                        pemakaian harian.
                      </td>
                    </tr>
                    <tr>
                      <td className="bold">Kondisi Gudang</td>
                      <td>
                        Area sejuk, sirkulasi udara baik, dan bebas hama tikus.
                      </td>
                    </tr>
                    <tr>
                      <td className="bold">Paparan Sinar Matahari</td>
                      <td>
                        <span className="kyl-badge-bad">HINDARI TOTAL</span> —
                        merusak dan mengoksidasi ikatan lemak omega.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: "9px 13px",
                  background: "rgba(245,158,11,.07)",
                  borderRadius: "var(--rsm)",
                  border: ".5px solid rgba(245,158,11,.18)",
                }}
              >
                <span className="kyl-amber kyl-small">
                  ⚠️ <strong>Tanda Lemak Rusak/Oksidasi:</strong> Bau tengik
                  menyengat, pakan disortir/dibuang ayam, atau nafsu makan
                  menurun drastis.
                </span>
              </div>
            </div>

            {/* ── CHECKLIST HARIAN ── */}

            {/* ── JURNAL CATATAN ── */}

            {/* ── MITIGASI KRISIS ── */}
            <div className="kyl-card">
              <div className="kyl-sec-title">
                🚨 Manajemen Mitigasi Krisis Lapangan
              </div>
              <div className="kyl-table-wrap">
                <table className="kyl-table">
                  <thead>
                    <tr>
                      <th>Indikator Gejala</th>
                      <th>Batas Toleransi</th>
                      <th>Prosedur Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="bold">Volume Telur Harian Turun</td>
                      <td>
                        <span className="kyl-badge-warn">1–2 Hari Pantau</span>
                      </td>
                      <td>
                        Jika berlanjut &gt;3 hari, stop suplemen, kembalikan ke
                        pakan murni.
                      </td>
                    </tr>
                    <tr>
                      <td className="bold">Aroma Telur Amis Tajam</td>
                      <td>
                        <span className="kyl-badge-bad">Tidak Ditoleransi</span>
                      </td>
                      <td>
                        Segera kurangi porsi minyak ikan ke batas minimal.
                      </td>
                    </tr>
                    <tr>
                      <td className="bold">Feses Berminyak / Diare</td>
                      <td>
                        <span className="kyl-badge-warn">Pantau Vitalitas</span>
                      </td>
                      <td>
                        Turunkan atau evaluasi ulang porsi flaxseed giling.
                      </td>
                    </tr>
                    <tr>
                      <td className="bold">Ayam Memilah / Sortir Pakan</td>
                      <td>
                        <span className="kyl-badge-warn">Cek Aroma Wadah</span>
                      </td>
                      <td>
                        Pastikan kualitas bahan enrichment bebas dari indikasi
                        tengik.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── LOGISTIK STOK ── */}
            <div className="kyl-card">
              <div className="kyl-sec-title">
                📦 Logistik & Estimasi Kebutuhan Stok (Populasi Aktif)
              </div>
              <div className="kyl-table-wrap">
                <table className="kyl-table">
                  <thead>
                    <tr>
                      <th>Item Bahan</th>
                      <th>Kebutuhan / Hari</th>
                      <th>Durasi Stok Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="bold">Flaxseed (Kemasan 1 Kg)</td>
                      <td>60 – 120 gram / hari</td>
                      <td>
                        <span className="kyl-badge-blue">
                          ± 8 – 16 Hari Kerja
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="bold">Minyak Ikan Murni (Botol 1 L)</td>
                      <td>30 ml / hari</td>
                      <td>
                        <span className="kyl-badge-blue">± 33 Hari Kerja</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── FAKTA ILMIAH ── */}
            <div className="kyl-card">
              <div className="kyl-sec-title">
                🧠 Fakta Ilmiah Edukasi Komoditas
              </div>
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <span
                  className="kyl-highlight"
                  style={{ fontSize: 15, letterSpacing: 0.5 }}
                >
                  WARNA KUNING TELUR OREN ≠ OTOMATIS OMEGA TINGGI
                </span>
              </div>
              <p className="kyl-small kyl-text2" style={{ lineHeight: 1.7 }}>
                Warna oranye pekat pada telur hanya menunjukkan kadar pigmen
                (xantofil/karotenoid) — bukan indikator tingginya Omega-3. Kadar
                Omega-3 nyata hanya bisa dibuktikan melalui fortifikasi pakan
                yang terukur dan konsisten.
              </p>
            </div>

            {/* ── GOLDEN RULES ── */}
            <div
              className="kyl-card"
              style={{
                background:
                  "linear-gradient(135deg,rgba(139,94,60,.05),rgba(92,58,32,.05))",
              }}
            >
              <div
                className="kyl-sec-title"
                style={{ justifyContent: "center" }}
              >
                🏆 Aturan Emas & Kesimpulan Utama
              </div>
              <ul className="kyl-ul" style={{ marginBottom: 14 }}>
                <li>
                  Performa produksi aktual sudah sangat mengagumkan (95%+),
                  pertahankan kondisi kandang tetap tenang dan minim stres.
                </li>
                <li>
                  Program fortifikasi omega-3 bertindak murni sebagai strategi
                  peningkatan nilai jual premium, bukan pondasi mutlak kehidupan
                  ayam.
                </li>
                <li>
                  Gunakan data riil kalkulator HDP sebagai rujukan utama
                  pengambilan kebijakan — hindari asumsi subjektif.
                </li>
              </ul>
              <div className="kyl-quote-card">
                <div className="kyl-quote-text">
                  "Peternakan sukses bukan yang paling rumit racikan formulanya,
                  <br />
                  melainkan yang paling konsisten dan disiplin dijalankan setiap
                  hari."
                </div>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div
              style={{
                textAlign: "center",
                padding: "20px 0 8px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.5px",
                color: "var(--text3)",
              }}
            >
              ©KAYALA FARM 2026 • PREMIUM OMEGA-3 SYSTEM • PEMILIK : FAUZSADIID
              DAN ALRAMA YOY
            </div>
          </div>
        )}

        {/* ═══════════════ VIEW: STOK BARANG & PAKAN ═══════════════ */}
        {page === "stok" && (
          <div className="kyl-page-view kyl-space">
            {/* ── HERO SUMMARY ── */}
            <div className="kyl-stok-hero">
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,.55)",
                    marginBottom: 6,
                  }}
                >
                  📦 RINGKASAN INVENTARIS
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: "#fff",
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  Stok Barang & Pakan
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>
                  KAYALA FARM — Wonosobo
                </div>
              </div>
              <div className="kyl-stok-grid">
                {(() => {
                  const telurItem = stokBarang.find(
                    (s) =>
                      s.nama.toLowerCase().includes("telur") &&
                      s.satuan.toLowerCase() === "butir"
                  );
                  const hariJapfa =
                    stokPakan.japfaKg > 0
                      ? Math.floor(stokPakan.japfaKg / 6)
                      : 0;
                  const kritis = stokBarang.filter(
                    (s) => s.jumlah < s.minStok
                  ).length;
                  return (
                    <>
                      <div className="kyl-stok-mini">
                        <span className="kyl-stok-mini-lbl">Stok Telur</span>
                        <div className="kyl-stok-mini-val">
                          {telurItem
                            ? telurItem.jumlah.toLocaleString("id-ID")
                            : todayTotal > 0
                            ? todayTotal
                            : "–"}
                          <span className="kyl-stok-mini-unit"> btr</span>
                        </div>
                      </div>
                      <div className="kyl-stok-mini">
                        <span className="kyl-stok-mini-lbl">Pakan Sisa</span>
                        <div className="kyl-stok-mini-val">
                          {hariJapfa}
                          <span className="kyl-stok-mini-unit"> hari</span>
                        </div>
                      </div>
                      <div
                        className="kyl-stok-mini"
                        style={{
                          background:
                            kritis > 0
                              ? "rgba(255,59,48,.25)"
                              : "rgba(255,255,255,.09)",
                        }}
                      >
                        <span className="kyl-stok-mini-lbl">Item Kritis</span>
                        <div
                          className="kyl-stok-mini-val"
                          style={{ color: kritis > 0 ? "#ff6b63" : "#fff" }}
                        >
                          {kritis}
                          <span className="kyl-stok-mini-unit"> item</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ── TAMBAH / CATAT STOK MASUK ── */}
            <div className="kyl-card">
              <span className="kyl-card-lbl">Catat Stok Masuk Barang</span>
              <div className="kyl-space">
                <div>
                  <label className="kyl-form-lbl" style={{ marginBottom: 8 }}>
                    Pilih Produk Cepat
                  </label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      { nama: "Telur Ayam", satuan: "Butir" },
                      { nama: "Karton Isi 10", satuan: "Pcs" },
                      { nama: "Karton Isi 4", satuan: "Pcs" },
                      { nama: "Hampers Box", satuan: "Pcs" },
                    ].map((q) => (
                      <button
                        key={q.nama}
                        type="button"
                        onClick={() => {
                          setStokNama(q.nama);
                          setStokSatuan(q.satuan);
                        }}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "var(--rpill)",
                          border:
                            stokNama === q.nama
                              ? ".5px solid var(--primary)"
                              : ".5px solid var(--border)",
                          background:
                            stokNama === q.nama
                              ? "rgba(22,163,96,.12)"
                              : "var(--surface2)",
                          color:
                            stokNama === q.nama
                              ? "var(--primary-l)"
                              : "var(--text2)",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "var(--font)",
                        }}
                      >
                        {q.nama}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="kyl-grid2">
                  <div>
                    <label className="kyl-form-lbl">Nama Item</label>
                    <input
                      type="text"
                      value={stokNama}
                      onChange={(e) => setStokNama(e.target.value)}
                      className="kyl-input"
                      placeholder="Nama barang..."
                    />
                  </div>
                  <div>
                    <label className="kyl-form-lbl">Satuan</label>
                    <select
                      value={stokSatuan}
                      onChange={(e) => setStokSatuan(e.target.value)}
                      className="kyl-select"
                    >
                      {[
                        "Butir",
                        "Pcs",
                        "Kg",
                        "Gram",
                        "Ml",
                        "Liter",
                        "Karton",
                        "Sak",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="kyl-grid2">
                  <div>
                    <label className="kyl-form-lbl">Jumlah Masuk</label>
                    <input
                      type="number"
                      value={stokJumlah}
                      onChange={(e) => setStokJumlah(e.target.value)}
                      className="kyl-input kyl-mono"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="kyl-form-lbl">Min Alert</label>
                    <input
                      type="number"
                      value={stokMinAlert}
                      onChange={(e) => setStokMinAlert(e.target.value)}
                      className="kyl-input kyl-mono"
                      placeholder="10"
                      min="0"
                    />
                  </div>
                </div>
                <button
                  onClick={handleTambahStokBarang}
                  className="kyl-btn kyl-btn-primary"
                >
                  📦 Catat Stok Masuk
                </button>
              </div>
            </div>

            {/* ── DAFTAR STOK BARANG ── */}
            <div>
              <span className="kyl-section-lbl">Daftar Stok Barang</span>
              {stokBarang.length > 0 ? (
                stokBarang.map((s) => {
                  const pct =
                    s.minStok > 0
                      ? Math.min(
                          100,
                          Math.round((s.jumlah / (s.minStok * 3)) * 100)
                        )
                      : 100;
                  const barClass =
                    s.jumlah === 0
                      ? "kritis"
                      : s.jumlah < s.minStok
                      ? "warn"
                      : "ok";
                  const barColor =
                    s.jumlah === 0
                      ? "var(--red)"
                      : s.jumlah < s.minStok
                      ? "var(--amber)"
                      : "var(--primary-l)";
                  return (
                    <div key={s.id} className="kyl-stok-item">
                      <div
                        className="kyl-flex-between"
                        style={{ marginBottom: 4 }}
                      >
                        <div className="kyl-flex-center" style={{ gap: 8 }}>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "var(--text)",
                            }}
                          >
                            {s.nama}
                          </span>
                          {s.jumlah < s.minStok && (
                            <span className="kyl-badge-kritis">⚠️ Kritis!</span>
                          )}
                        </div>
                        <div className="kyl-flex-center" style={{ gap: 10 }}>
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 18,
                              fontWeight: 800,
                              color: barColor,
                            }}
                          >
                            {s.jumlah}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text2)",
                              marginTop: 3,
                            }}
                          >
                            {s.satuan}
                          </span>
                        </div>
                      </div>
                      <div className="kyl-stok-bar-wrap">
                        <div
                          className={`kyl-stok-bar ${barClass}`}
                          style={{ width: `${Math.max(3, pct)}%` }}
                        />
                      </div>
                      <div className="kyl-flex-between">
                        <span style={{ fontSize: 10, color: "var(--text3)" }}>
                          Min stok: {s.minStok} {s.satuan}
                        </span>
                        <div className="kyl-flex-center" style={{ gap: 6 }}>
                          <button
                            onClick={() => handleTambahSatuStok(s.id)}
                            style={{
                              background: "rgba(22,163,96,.12)",
                              border: ".5px solid rgba(22,163,96,.25)",
                              color: "var(--primary-l)",
                              borderRadius: 8,
                              padding: "4px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            +1
                          </button>
                          <button
                            onClick={() => {
                              setStokAdjId(stokAdjId === s.id ? null : s.id);
                              setStokAdjVal(s.jumlah.toString());
                            }}
                            style={{
                              background: "rgba(90,112,232,.1)",
                              border: ".5px solid rgba(90,112,232,.2)",
                              color: "var(--indigo)",
                              borderRadius: 8,
                              padding: "4px 10px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            ✏️ Set
                          </button>
                          <button
                            onClick={() => handleDeleteStok(s.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 14,
                              color: "var(--red)",
                              opacity: 0.6,
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      {stokAdjId === s.id && (
                        <div className="kyl-adj-row">
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text2)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Set ke:
                          </span>
                          <input
                            type="number"
                            value={stokAdjVal}
                            onChange={(e) => setStokAdjVal(e.target.value)}
                            className="kyl-adj-input"
                            placeholder={s.jumlah.toString()}
                            min="0"
                          />
                          <span style={{ fontSize: 11, color: "var(--text3)" }}>
                            {s.satuan}
                          </span>
                          <button
                            onClick={() => handleAdjustStok(s.id)}
                            className="kyl-adj-btn"
                          >
                            ✅ Simpan
                          </button>
                          <button
                            onClick={() => setStokAdjId(null)}
                            className="kyl-adj-cancel"
                          >
                            Batal
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="kyl-empty">
                  Belum ada item stok. Tambahkan di form atas.
                </p>
              )}
            </div>

            {/* ── PACKING CENTER ── */}
            <div
              className="kyl-card"
              style={{ borderColor: "rgba(245,158,11,.22)" }}
            >
              <span className="kyl-card-lbl-gold">🧾 Packing Center</span>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text2)",
                  lineHeight: 1.6,
                  marginBottom: 10,
                }}
              >
                Telur mentah akan berkurang otomatis dan stok produk jadi
                bertambah sesuai hasil packing.
              </p>
              <div className="kyl-space">
                <div className="kyl-grid2">
                  <div>
                    <label className="kyl-form-lbl">Jenis Packing</label>
                    <select
                      value={packingProduct}
                      onChange={(e) => setPackingProduct(e.target.value)}
                      className="kyl-select"
                    >
                      {productMenu.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="kyl-form-lbl">Jumlah Kemasan</label>
                    <input
                      type="number"
                      value={packingQty}
                      onChange={(e) => setPackingQty(e.target.value)}
                      className="kyl-input kyl-mono"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
                <div className="kyl-grid2">
                  <div>
                    <label className="kyl-form-lbl">
                      Isi per Kemasan (butir)
                    </label>
                    <input
                      type="number"
                      value={packingEggPerBox}
                      onChange={(e) => setPackingEggPerBox(e.target.value)}
                      className="kyl-input kyl-mono"
                      placeholder="10"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="kyl-form-lbl">Catatan Packing</label>
                    <input
                      type="text"
                      value={packingNote}
                      onChange={(e) => setPackingNote(e.target.value)}
                      className="kyl-input"
                      placeholder="Opsional..."
                    />
                  </div>
                </div>
                <button
                  onClick={handlePackingCenter}
                  className="kyl-btn kyl-btn-gold"
                >
                  📦 Proses Packing Otomatis
                </button>
              </div>
            </div>

            {/* ── STOK PAKAN ── */}
            {/* ── STOK PAKAN KANDANG ── */}
            <div className="kyl-card">
              <span className="kyl-card-lbl-brown">
                🌾 Stok Pakan Kandang (Omega-3 Supply)
              </span>
              {(() => {
                const hariJapfa =
                  stokPakan.japfaKg > 0 ? Math.floor(stokPakan.japfaKg / 6) : 0;
                const hariFlax =
                  stokPakan.flaxGram > 0
                    ? Math.floor(stokPakan.flaxGram / 120)
                    : 0;
                const hariOil =
                  stokPakan.oilMl > 0 ? Math.floor(stokPakan.oilMl / 30) : 0;
                const pakanItems = [
                  {
                    key: "japfaKg",
                    icon: "🌾",
                    nama: "Japfa PAR L1 Red",
                    val: stokPakan.japfaKg || 0,
                    unit: "Kg",
                    hari: hariJapfa,
                    kurang: "6 kg/hari",
                    color:
                      hariJapfa <= 3
                        ? "var(--red)"
                        : hariJapfa <= 7
                        ? "var(--amber)"
                        : "var(--primary-l)",
                  },
                  {
                    key: "flaxGram",
                    icon: "🟤",
                    nama: "Flaxseed Giling",
                    val: stokPakan.flaxGram || 0,
                    unit: "Gram",
                    hari: hariFlax,
                    kurang: "120 g/hari",
                    color:
                      hariFlax <= 3
                        ? "var(--red)"
                        : hariFlax <= 7
                        ? "var(--amber)"
                        : "var(--primary-l)",
                  },
                  {
                    key: "oilMl",
                    icon: "🐟",
                    nama: "Minyak Ikan Murni",
                    val: stokPakan.oilMl || 0,
                    unit: "Ml",
                    hari: hariOil,
                    kurang: "30 ml/hari",
                    color:
                      hariOil <= 3
                        ? "var(--red)"
                        : hariOil <= 7
                        ? "var(--amber)"
                        : "var(--primary-l)",
                  },
                ];
                return pakanItems.map((p) => (
                  <div key={p.key}>
                    <div className="kyl-pakan-row">
                      <span className="kyl-pakan-icon">{p.icon}</span>
                      <div className="kyl-pakan-info">
                        <div className="kyl-pakan-nama">{p.nama}</div>
                        <div
                          className="kyl-pakan-hari"
                          style={{ color: p.color }}
                        >
                          {p.hari > 0 ? (
                            `Cukup ≈ ${p.hari} hari`
                          ) : (
                            <strong>⚠️ Stok kosong!</strong>
                          )}
                        </div>
                        <div
                          style={{
                            background: "var(--surface3)",
                            borderRadius: 4,
                            height: 4,
                            marginTop: 4,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              borderRadius: 4,
                              background: p.color,
                              width: `${Math.min(
                                100,
                                Math.round((p.hari / 30) * 100)
                              )}%`,
                              transition: "width .5s ease",
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div
                          className="kyl-pakan-val"
                          style={{ color: p.color }}
                        >
                          {p.val > 0 ? p.val.toLocaleString("id-ID") : "0"}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: "var(--text3)",
                            marginTop: 1,
                          }}
                        >
                          {p.unit} · {p.kurang}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 4,
                            justifyContent: "flex-end",
                            marginTop: 5,
                          }}
                        >
                          <button
                            onClick={() => {
                              setPakanEditKey(p.key);
                              setPakanEditMode("tambah");
                              setPakanEditVal("");
                            }}
                            style={{
                              background: "rgba(22,163,96,.12)",
                              border: ".5px solid rgba(22,163,96,.25)",
                              color: "var(--primary-l)",
                              borderRadius: 6,
                              padding: "3px 8px",
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            + Tambah
                          </button>
                          <button
                            onClick={() => {
                              setPakanEditKey(p.key);
                              setPakanEditMode("edit");
                              setPakanEditVal(String(p.val));
                            }}
                            style={{
                              background: "rgba(90,112,232,.1)",
                              border: ".5px solid rgba(90,112,232,.2)",
                              color: "var(--indigo)",
                              borderRadius: 6,
                              padding: "3px 8px",
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleHapusPakan(p.key)}
                            style={{
                              background: "rgba(255,59,48,.08)",
                              border: ".5px solid rgba(255,59,48,.2)",
                              color: "var(--red)",
                              borderRadius: 6,
                              padding: "3px 8px",
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Inline edit/tambah form */}
                    {pakanEditKey === p.key && (
                      <div className="kyl-adj-row" style={{ marginBottom: 8 }}>
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text2)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pakanEditMode === "tambah" ? "Tambah:" : "Set ke:"}
                        </span>
                        <input
                          type="number"
                          value={pakanEditVal}
                          onChange={(e) => setPakanEditVal(e.target.value)}
                          className="kyl-adj-input"
                          placeholder="0"
                          min="0"
                          step={p.key === "japfaKg" ? "0.1" : "1"}
                        />
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>
                          {p.unit}
                        </span>
                        <button
                          onClick={() => handlePakanInlineEdit(p.key)}
                          className="kyl-adj-btn"
                        >
                          ✅ Simpan
                        </button>
                        <button
                          onClick={() => {
                            setPakanEditKey(null);
                            setPakanEditMode(null);
                          }}
                          className="kyl-adj-cancel"
                        >
                          Batal
                        </button>
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>

            <div
              className="kyl-card"
              style={{
                marginTop: 10,
                padding: "12px 14px",
                background: "var(--surface2)",
                borderRadius: "var(--rsm)",
                border: ".5px solid var(--border2)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  color: "var(--text2)",
                  marginBottom: 8,
                }}
              >
                Link Pembelian Pakan
              </div>
              {(() => {
                const pakanLinks = vendorLinks.filter(
                  (v) =>
                    (v.kategori || "Pakan") === "Pakan" && v.aktif !== false
                );
                return pakanLinks.length > 0 ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {pakanLinks.slice(0, 4).map((v) => (
                      <button
                        key={v.id}
                        onClick={() => openOutboundLink(v.link)}
                        className="kyl-btn kyl-btn-ghost"
                        style={{
                          padding: "5px 8px",
                          fontSize: 10,
                          border: ".5px solid var(--border)",
                          background: "var(--surface2)",
                        }}
                      >
                        🔗 {v.nama}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text3)",
                      lineHeight: 1.55,
                    }}
                  >
                    Belum ada link pakan aktif. Tambahkan dari menu{" "}
                    <strong>Link Pembelian & Vendor</strong>.
                  </div>
                );
              })()}
            </div>

            {/* ── RIWAYAT PACKING ── */}
            <div className="kyl-card">
              <span className="kyl-card-lbl-gold">
                🧾 Riwayat Packing Terbaru
              </span>
              {(() => {
                const recentPacking = activities
                  .filter((a) =>
                    (a.title || "").toLowerCase().includes("packing")
                  )
                  .slice(0, 5);
                return recentPacking.length > 0 ? (
                  <div className="kyl-space-sm">
                    {recentPacking.map((a) => (
                      <div key={a.id} className="kyl-activity-item">
                        <div className="kyl-flex-between" style={{ gap: 10 }}>
                          <div
                            style={{ fontWeight: 700, color: "var(--text)" }}
                          >
                            {a.title}
                          </div>
                          <span
                            className="kyl-mono"
                            style={{ fontSize: 9, color: "var(--text3)" }}
                          >
                            {a.time}
                          </span>
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: "var(--text2)",
                            lineHeight: 1.5,
                          }}
                        >
                          {a.detail}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="kyl-empty">Belum ada riwayat packing.</p>
                );
              })()}
            </div>

            {/* ── MASUKAN, KRITIK & SARAN ── */}
            <div
              className="kyl-card"
              style={{ borderColor: "rgba(90,112,232,.2)" }}
            >
              <span className="kyl-card-lbl" style={{ color: "var(--indigo)" }}>
                💡 Masukan, Kritik &amp; Saran
              </span>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text2)",
                  lineHeight: 1.6,
                  marginBottom: 12,
                }}
              >
                Sampaikan masukan fitur, kendala teknis, atau saran pengembangan
                Kayala Ops ke depannya.
              </p>
              <div className="kyl-space">
                <textarea
                  value={kritikInput}
                  onChange={(e) => setKritikInput(e.target.value)}
                  placeholder="Tulis masukan atau saran di sini..."
                  style={{
                    width: "100%",
                    minHeight: 90,
                    padding: "10px 12px",
                    borderRadius: "var(--rsm)",
                    border: ".5px solid var(--border)",
                    background: "var(--surface2)",
                    color: "var(--text)",
                    fontFamily: "var(--font)",
                    fontSize: 13,
                    resize: "vertical",
                    outline: "none",
                    lineHeight: 1.6,
                  }}
                />
                <button
                  onClick={handleSimpanKritik}
                  className="kyl-btn kyl-btn-indigo"
                >
                  💾 Simpan Masukan
                </button>
              </div>
              {kritikList.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <span className="kyl-section-lbl">Riwayat Masukan</span>
                  <div className="kyl-space-sm">
                    {kritikList.map((k) => (
                      <div
                        key={k.id}
                        style={{
                          padding: "10px 13px",
                          background: "var(--surface2)",
                          borderRadius: "var(--rsm)",
                          border: ".5px solid var(--border2)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text)",
                            lineHeight: 1.6,
                            marginBottom: 5,
                          }}
                        >
                          {k.teks}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{ fontSize: 9.5, color: "var(--text3)" }}
                          >
                            {k.date} · {k.time}
                          </span>
                          <button
                            onClick={() => handleHapusKritik(k.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 13,
                              color: "var(--red)",
                              opacity: 0.6,
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div
              className="kyl-card"
              style={{
                background:
                  "linear-gradient(135deg,rgba(139,94,60,.08),rgba(92,58,32,.04))",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <span style={{ fontSize: 24 }}>🌾</span>
                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      color: "var(--text)",
                    }}
                  >
                    Catat Pemberian Pakan Harian
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text2)",
                      marginTop: 2,
                    }}
                  >
                    2 sesi per hari — Pagi &amp; Sore (Minggu 3+)
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "var(--surface2)",
                  borderRadius: "var(--rsm)",
                  padding: "12px 12px",
                  marginBottom: 10,
                  border: ".5px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 12,
                        color: "var(--brown-l)",
                      }}
                    >
                      ✏️ Edit Takaran Pakan Harian
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--text2)",
                        marginTop: 3,
                        lineHeight: 1.5,
                      }}
                    >
                      Ubah besaran pakan untuk sesi pagi dan sore dari sini.
                      Saat disimpan, stok dan riwayat ikut mengikuti angka baru.
                      Perubahan terakhir tercatat otomatis.
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 9.5,
                      color: "var(--text3)",
                      textAlign: "right",
                      lineHeight: 1.45,
                    }}
                  >
                    Terakhir diubah
                    <br />
                    {formatDateTimeShort(pakanJadwal.updatedAt)}
                  </div>
                </div>

                {["pagi", "sore"].map((sesi) => (
                  <div
                    key={sesi}
                    style={{
                      marginTop: 10,
                      padding: "10px 10px",
                      borderRadius: 10,
                      border: ".5px solid var(--border2)",
                      background: "var(--surface)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color:
                          sesi === "pagi" ? "var(--gold)" : "var(--indigo)",
                        marginBottom: 8,
                      }}
                    >
                      {sesi === "pagi" ? "🌅 Pagi" : "🌇 Sore"}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3,1fr)",
                        gap: 6,
                      }}
                    >
                      {[
                        { key: "japfaKg", label: "Japfa (kg)" },
                        { key: "flaxGram", label: "Flaxseed (g)" },
                        { key: "oilMl", label: "Minyak (ml)" },
                      ].map((item) => (
                        <label key={item.key} style={{ display: "block" }}>
                          <div
                            style={{
                              fontSize: 9.5,
                              color: "var(--text3)",
                              marginBottom: 4,
                            }}
                          >
                            {item.label}
                          </div>
                          <input
                            type="number"
                            min="0"
                            step={item.key === "japfaKg" ? "0.1" : "1"}
                            value={pakanJadwalEdit?.[sesi]?.[item.key] ?? ""}
                            onChange={(e) =>
                              setPakanJadwalEdit((prev) => ({
                                ...prev,
                                [sesi]: {
                                  ...(prev?.[sesi] || {}),
                                  [item.key]: e.target.value,
                                },
                              }))
                            }
                            className="kyl-edit-input"
                            style={{ background: "var(--surface2)" }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleSimpanPakanJadwal}
                  className="kyl-btn kyl-btn-brown"
                  style={{ marginTop: 10 }}
                >
                  💾 Simpan Takaran
                </button>
              </div>

              {/* SESI PAGI */}
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: "var(--rsm)",
                  padding: "12px 14px",
                  marginBottom: 8,
                  border: ".5px solid var(--border)",
                  opacity: pagiDone ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 13,
                        color: "var(--gold)",
                      }}
                    >
                      🌅 Sesi Pagi (05.00 – 10.00)
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text2)",
                        marginTop: 3,
                        lineHeight: 1.6,
                      }}
                    >
                      {`Japfa PAR L1 Red −${formatTakaran(
                        pakanJadwal?.pagi?.japfaKg ??
                          INITIAL_PAKAN_JADWAL.pagi.japfaKg
                      )} kg`}
                      <br />
                      {`Flaxseed −${formatTakaran(
                        pakanJadwal?.pagi?.flaxGram ??
                          INITIAL_PAKAN_JADWAL.pagi.flaxGram
                      )} g · Minyak Ikan −${formatTakaran(
                        pakanJadwal?.pagi?.oilMl ??
                          INITIAL_PAKAN_JADWAL.pagi.oilMl
                      )} ml`}
                    </div>
                  </div>
                  {pagiDone ? (
                    <span
                      style={{
                        background: "rgba(52,212,104,.12)",
                        color: "var(--primary-l)",
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      ✅ Sudah
                    </span>
                  ) : confirmPakanSesi === "pagi" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleCatatPemberianSesi("pagi")}
                        style={{
                          background: "var(--primary)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "5px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Ya, Catat
                      </button>
                      <button
                        onClick={() => setConfirmPakanSesi(null)}
                        style={{
                          background: "var(--surface2)",
                          border: ".5px solid var(--border)",
                          borderRadius: 8,
                          padding: "5px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                          color: "var(--text2)",
                        }}
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmPakanSesi("pagi")}
                      className="kyl-selesai-btn"
                    >
                      Catat Pagi
                    </button>
                  )}
                </div>
                {pagiDone && (
                  <button
                    onClick={() => {
                      localStorage.removeItem("pakan-pagi-" + todayStr());
                      setPagiDone(false);
                      showToast("🔄 Sesi pagi direset");
                    }}
                    style={{
                      fontSize: 10,
                      color: "var(--text3)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Reset sesi pagi
                  </button>
                )}
              </div>

              {/* SESI SORE */}
              <div
                style={{
                  background: "var(--surface)",
                  borderRadius: "var(--rsm)",
                  padding: "12px 14px",
                  border: ".5px solid var(--border)",
                  opacity: soreDone ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 13,
                        color: "var(--indigo)",
                      }}
                    >
                      🌇 Sesi Sore (14.00 – 19.00)
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text2)",
                        marginTop: 3,
                        lineHeight: 1.6,
                      }}
                    >
                      {`Japfa PAR L1 Red −${formatTakaran(
                        pakanJadwal?.sore?.japfaKg ??
                          INITIAL_PAKAN_JADWAL.sore.japfaKg
                      )} kg`}
                      <br />
                      {`Flaxseed −${formatTakaran(
                        pakanJadwal?.sore?.flaxGram ??
                          INITIAL_PAKAN_JADWAL.sore.flaxGram
                      )} g · Minyak Ikan −${formatTakaran(
                        pakanJadwal?.sore?.oilMl ??
                          INITIAL_PAKAN_JADWAL.sore.oilMl
                      )} ml`}
                    </div>
                  </div>
                  {soreDone ? (
                    <span
                      style={{
                        background: "rgba(52,212,104,.12)",
                        color: "var(--primary-l)",
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      ✅ Sudah
                    </span>
                  ) : confirmPakanSesi === "sore" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleCatatPemberianSesi("sore")}
                        style={{
                          background: "var(--indigo)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "5px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Ya, Catat
                      </button>
                      <button
                        onClick={() => setConfirmPakanSesi(null)}
                        style={{
                          background: "var(--surface2)",
                          border: ".5px solid var(--border)",
                          borderRadius: 8,
                          padding: "5px 10px",
                          fontSize: 11,
                          cursor: "pointer",
                          color: "var(--text2)",
                        }}
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmPakanSesi("sore")}
                      className="kyl-selesai-btn"
                    >
                      Catat Sore
                    </button>
                  )}
                </div>
                {soreDone && (
                  <button
                    onClick={() => {
                      localStorage.removeItem("pakan-sore-" + todayStr());
                      setSoreDone(false);
                      showToast("🔄 Sesi sore direset");
                    }}
                    style={{
                      fontSize: 10,
                      color: "var(--text3)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Reset sesi sore
                  </button>
                )}
              </div>

              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  background: "rgba(0,0,0,.1)",
                  borderRadius: "var(--rsm)",
                  fontSize: 11,
                  color: "var(--text2)",
                  lineHeight: 1.6,
                }}
              >
                Total harian: <strong>6 kg</strong> Japfa ·{" "}
                <strong>60 g</strong> Flaxseed · <strong>30 ml</strong> Minyak
                Ikan
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ VIEW: MORE ═══════════════ */}
        {page === "more" && (
          <div className="kyl-page-view kyl-space">
            {/* ── TEMA TAMPILAN ── */}
            <div className="kyl-card">
              <span className="kyl-card-lbl">🎨 Tampilan Tema Aplikasi</span>
              <div
                className="kyl-flex-between"
                style={{ alignItems: "center" }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "var(--text)",
                      marginBottom: 3,
                    }}
                  >
                    {dark ? "Mode Gelap" : "Mode Terang"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)" }}>
                    {dark
                      ? "Nyaman untuk malam hari"
                      : "Nyaman untuk siang hari"}
                  </div>
                </div>
                <button
                  type="button"
                  className={`kyl-theme-toggle ${dark ? "is-dark" : "is-light"}`}
                  onClick={() => setDark(!dark)}
                  aria-label={
                    dark ? "Aktifkan mode terang" : "Aktifkan mode gelap"
                  }
                >
                  <span className="kyl-theme-toggle-knob">
                    <KylIcon name={dark ? "moon" : "sun"} />
                  </span>
                </button>
              </div>
            </div>

            <div className="kyl-card">
              <span className="kyl-card-lbl" style={{ color: "var(--indigo)" }}>
                📚 Modul Referensi
              </span>
              <div className="kyl-space-sm">
                <button
                  type="button"
                  onClick={() => setPage("omega")}
                  className="kyl-btn kyl-btn-indigo"
                >
                  Buka Panduan Omega-3
                </button>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text2)",
                    lineHeight: 1.6,
                  }}
                >
                  Panduan lengkap tetap tersedia, namun sekarang ditempatkan di
                  menu Lainnya agar navigasi utama lebih ringkas.
                </div>
              </div>
            </div>

            {/* ── MASTER PRODUK ── */}
            <div
              className="kyl-card"
              style={{ borderColor: "rgba(200,168,75,.2)" }}
            >
              <span className="kyl-card-lbl-gold">
                🧩 Master Produk &amp; Harga
              </span>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text2)",
                  lineHeight: 1.6,
                  marginBottom: 10,
                }}
              >
                Semua perubahan produk cukup diatur di sini. Log pesanan, nota,
                dan tampilan produk akan membaca data yang sama.
              </p>
              <div className="kyl-space" style={{ marginBottom: 12 }}>
                <div className="kyl-grid2">
                  <div>
                    <label className="kyl-form-lbl">Nama Produk</label>
                    <input
                      type="text"
                      value={produkNama}
                      onChange={(e) => setProdukNama(e.target.value)}
                      className="kyl-input"
                      placeholder="Contoh: Telur Ayam Koloni Isi 10 Butir"
                    />
                  </div>
                  <div>
                    <label className="kyl-form-lbl">Harga</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        produkHarga === "" ? "" : formatNominal(produkHarga)
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\./g, "")
                          .replace(/\D/g, "");
                        setProdukHarga(raw);
                      }}
                      className="kyl-input kyl-mono"
                      placeholder="30.000"
                    />
                  </div>
                </div>
                <div className="kyl-grid3">
                  <div>
                    <label className="kyl-form-lbl">Satuan</label>
                    <input
                      type="text"
                      value={produkType}
                      onChange={(e) => setProdukType(e.target.value)}
                      className="kyl-input"
                      placeholder="Pcs / Kg"
                    />
                  </div>
                  <div>
                    <label className="kyl-form-lbl">Isi Telur</label>
                    <input
                      type="number"
                      value={produkIsiTelur}
                      onChange={(e) => setProdukIsiTelur(e.target.value)}
                      className="kyl-input kyl-mono"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="kyl-form-lbl">Status</label>
                    <button
                      type="button"
                      onClick={() => setProdukAktif(!produkAktif)}
                      className="kyl-btn kyl-btn-secondary"
                      style={{ height: 42, width: "100%" }}
                    >
                      {produkAktif ? "Aktif" : "Nonaktif"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="kyl-form-lbl">Catatan Produk</label>
                  <input
                    type="text"
                    value={produkCatatan}
                    onChange={(e) => setProdukCatatan(e.target.value)}
                    className="kyl-input"
                    placeholder="Opsional: keterangan singkat"
                  />
                </div>
                <div className="kyl-grid2">
                  <button
                    onClick={handleSimpanProduk}
                    className="kyl-btn kyl-btn-gold"
                  >
                    {produkEditId ? "✏️ Simpan Perubahan" : "➕ Tambah Produk"}
                  </button>
                  <button
                    onClick={resetProdukForm}
                    className="kyl-btn kyl-btn-secondary"
                  >
                    ♻️ Reset Form
                  </button>
                </div>
              </div>

              <div className="kyl-space-sm">
                {masterProduk.length > 0 ? (
                  masterProduk.map((p) => (
                    <div
                      key={p.id}
                      className="kyl-log-item"
                      style={{
                        border:
                          p.active === false
                            ? ".5px solid rgba(255,59,48,.18)"
                            : ".5px solid var(--border)",
                        background:
                          p.active === false
                            ? "rgba(255,59,48,.03)"
                            : "var(--surface)",
                      }}
                    >
                      <div
                        className="kyl-flex-between"
                        style={{ gap: 10, alignItems: "flex-start" }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: "var(--text)",
                              marginBottom: 4,
                            }}
                          >
                            {p.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text2)",
                              lineHeight: 1.55,
                            }}
                          >
                            {p.type || "Pcs"} · {p.isiTelur || 0} butir ·{" "}
                            {formatRupiah(
                              getProdukHargaByNama(
                                p.name,
                                hargaProduk,
                                masterProduk
                              )
                            )}
                          </div>
                          {p.note ? (
                            <div
                              style={{
                                fontSize: 10.5,
                                color: "var(--text3)",
                                lineHeight: 1.5,
                                marginTop: 4,
                              }}
                            >
                              {p.note}
                            </div>
                          ) : null}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            alignItems: "flex-end",
                          }}
                        >
                          <span
                            className={
                              p.active === false
                                ? "kyl-badge-bad"
                                : "kyl-badge-good"
                            }
                          >
                            {p.active === false ? "Nonaktif" : "Aktif"}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              onClick={() => loadProdukKeForm(p)}
                              className="kyl-btn kyl-btn-ghost"
                              style={{ padding: "3px 6px", fontSize: 10 }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleToggleProdukAktif(p.id)}
                              className="kyl-btn kyl-btn-ghost"
                              style={{ padding: "3px 6px", fontSize: 10 }}
                            >
                              {p.active === false
                                ? "✅ Aktifkan"
                                : "🚫 Nonaktif"}
                            </button>
                            <button
                              onClick={() => {
                                const ok = window.confirm(
                                  `Hapus produk "${p.name}"? Data lama tetap aman, tapi produk ini akan hilang dari daftar aktif.`
                                );
                                if (ok) handleHapusProduk(p.id);
                              }}
                              className="kyl-btn kyl-btn-ghost"
                              style={{
                                padding: "3px 6px",
                                fontSize: 10,
                                color: "var(--red)",
                              }}
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="kyl-empty">Belum ada produk.</p>
                )}
              </div>
            </div>

            {/* ── LINK PEMBELIAN / VENDOR ── */}
            <div
              className="kyl-card"
              style={{ borderColor: "rgba(90,112,232,.18)" }}
            >
              <span className="kyl-card-lbl" style={{ color: "var(--indigo)" }}>
                🔗 Link Pembelian & Vendor
              </span>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text2)",
                  lineHeight: 1.6,
                  marginBottom: 10,
                }}
              >
                Simpan link pembelian pakan, vendor, kemasan, atau lokasi toko
                di satu tempat. Tombol buka akan langsung menuju browser atau
                aplikasi terkait.
              </p>
              <div className="kyl-space" style={{ marginBottom: 12 }}>
                <div className="kyl-grid2">
                  <div>
                    <label className="kyl-form-lbl">Nama</label>
                    <input
                      type="text"
                      value={vendorNama}
                      onChange={(e) => setVendorNama(e.target.value)}
                      className="kyl-input"
                      placeholder="Contoh: Japfa Official / WA Sales"
                    />
                  </div>
                  <div>
                    <label className="kyl-form-lbl">Kategori</label>
                    <select
                      value={vendorKategori}
                      onChange={(e) => setVendorKategori(e.target.value)}
                      className="kyl-select"
                    >
                      {["Pakan", "Vendor", "Kemasan", "Obat", "Lainnya"].map(
                        (k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="kyl-form-lbl">Link Tujuan</label>
                  <input
                    type="text"
                    inputMode="url"
                    value={vendorLink}
                    onChange={(e) => setVendorLink(e.target.value)}
                    className="kyl-input"
                    placeholder="https://..., wa.me/..., shopee.co.id/..."
                  />
                </div>
                <div>
                  <label className="kyl-form-lbl">Catatan</label>
                  <input
                    type="text"
                    value={vendorCatatan}
                    onChange={(e) => setVendorCatatan(e.target.value)}
                    className="kyl-input"
                    placeholder="Opsional: harga, kontak sales, dll"
                  />
                </div>
                <div className="kyl-grid2">
                  <button
                    type="button"
                    onClick={() => setVendorAktif(!vendorAktif)}
                    className="kyl-btn kyl-btn-secondary"
                    style={{ height: 42 }}
                  >
                    {vendorAktif ? "Aktif" : "Nonaktif"}
                  </button>
                  <button
                    onClick={handleSimpanVendorLink}
                    className="kyl-btn kyl-btn-indigo"
                  >
                    {vendorEditId ? "✏️ Simpan Perubahan" : "➕ Tambah Link"}
                  </button>
                </div>
                <button
                  onClick={resetVendorForm}
                  className="kyl-btn kyl-btn-secondary"
                >
                  ♻️ Reset Form
                </button>
              </div>

              <div className="kyl-space-sm">
                {vendorLinks.length > 0 ? (
                  vendorLinks.map((v) => (
                    <div
                      key={v.id}
                      className="kyl-log-item"
                      style={{
                        border:
                          v.aktif === false
                            ? ".5px solid rgba(255,59,48,.18)"
                            : ".5px solid var(--border)",
                        background:
                          v.aktif === false
                            ? "rgba(255,59,48,.03)"
                            : "var(--surface)",
                      }}
                    >
                      <div
                        className="kyl-flex-between"
                        style={{ gap: 10, alignItems: "flex-start" }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: "var(--text)",
                              marginBottom: 4,
                            }}
                          >
                            {v.nama}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text2)",
                              lineHeight: 1.55,
                            }}
                          >
                            {v.kategori || "Pakan"} · {v.link}
                          </div>
                          {v.catatan ? (
                            <div
                              style={{
                                fontSize: 10.5,
                                color: "var(--text3)",
                                lineHeight: 1.5,
                                marginTop: 4,
                              }}
                            >
                              {v.catatan}
                            </div>
                          ) : null}
                          <div
                            style={{
                              fontSize: 10,
                              color: "var(--text3)",
                              marginTop: 4,
                            }}
                          >
                            {v.updatedAt
                              ? `Terakhir diperbarui: ${v.updatedAt}`
                              : "Belum pernah diperbarui"}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            alignItems: "flex-end",
                          }}
                        >
                          <span
                            className={
                              v.aktif === false
                                ? "kyl-badge-bad"
                                : "kyl-badge-good"
                            }
                          >
                            {v.aktif === false ? "Nonaktif" : "Aktif"}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              onClick={() => openOutboundLink(v.link)}
                              className="kyl-btn kyl-btn-ghost"
                              style={{ padding: "3px 6px", fontSize: 10 }}
                            >
                              🔗 Buka
                            </button>
                            <button
                              onClick={() => loadVendorKeForm(v)}
                              className="kyl-btn kyl-btn-ghost"
                              style={{ padding: "3px 6px", fontSize: 10 }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleToggleVendorAktif(v.id)}
                              className="kyl-btn kyl-btn-ghost"
                              style={{ padding: "3px 6px", fontSize: 10 }}
                            >
                              {v.aktif === false
                                ? "✅ Aktifkan"
                                : "🚫 Nonaktif"}
                            </button>
                            <button
                              onClick={() => {
                                const ok = window.confirm(
                                  `Hapus link "${v.nama}"?`
                                );
                                if (ok) handleHapusVendorLink(v.id);
                              }}
                              className="kyl-btn kyl-btn-ghost"
                              style={{
                                padding: "3px 6px",
                                fontSize: 10,
                                color: "var(--red)",
                              }}
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="kyl-empty">
                    Belum ada link pembelian / vendor.
                  </p>
                )}
              </div>
            </div>

            {/* ── HARGA PRODUK CONFIG ── */}
            <div className="kyl-card">
              <span
                className="kyl-card-lbl"
                style={{ color: "var(--primary-l)" }}
              >
                💰 Konfigurasi Harga Jual Produk
              </span>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text2)",
                  marginBottom: 14,
                  lineHeight: 1.6,
                }}
              >
                Set harga jual per produk. Saat pesanan diselesaikan, nominal
                otomatis masuk ke Kas Keuangan.
              </p>
              <div className="kyl-space">
                {productMenu.map((p) => (
                  <div key={p.id}>
                    <label className="kyl-form-lbl">{p.name}</label>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text3)",
                          flexShrink: 0,
                        }}
                      >
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNominal(hargaEdit[p.name] || 0)}
                        onChange={(e) => {
                          const raw = e.target.value
                            .replace(/\./g, "")
                            .replace(/\D/g, "");
                          setHargaEdit((prev) => ({
                            ...prev,
                            [p.name]: parseInt(raw) || 0,
                          }));
                        }}
                        className="kyl-input kyl-mono"
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSaveHarga}
                  className="kyl-btn kyl-btn-primary"
                >
                  💾 Simpan Harga Produk
                </button>
              </div>
            </div>

            <div className="kyl-card">
              <span className="kyl-card-lbl-gold">
                📋 Konfigurasi Populasi Ayam
              </span>
              <div className="kyl-space">
                <div>
                  <label className="kyl-form-lbl">Tanggal Masuk Kandang</label>
                  <input
                    type="date"
                    value={flockData.tanggalMasuk}
                    onChange={(e) =>
                      setFlockData({
                        ...flockData,
                        tanggalMasuk: e.target.value,
                      })
                    }
                    className="kyl-input"
                  />
                </div>
                <div>
                  <label className="kyl-form-lbl">Strain / Ras Ayam</label>
                  <input
                    type="text"
                    value={flockData.jenisAyam}
                    onChange={(e) =>
                      setFlockData({ ...flockData, jenisAyam: e.target.value })
                    }
                    className="kyl-input"
                  />
                </div>
                <div>
                  <label className="kyl-form-lbl">
                    Umur Ayam Saat Masuk (Minggu)
                  </label>
                  <input
                    type="number"
                    placeholder="Contoh: 18"
                    value={flockData.umurAwalMinggu}
                    onChange={(e) =>
                      setFlockData({
                        ...flockData,
                        umurAwalMinggu: parseInt(e.target.value) || 13,
                      })
                    }
                    className="kyl-input"
                  />
                </div>
                <div>
                  <label className="kyl-form-lbl">
                    Target Umur Afkir (Minggu)
                  </label>
                  <input
                    type="number"
                    value={flockData.targetAfkirMinggu}
                    onChange={(e) =>
                      setFlockData({
                        ...flockData,
                        targetAfkirMinggu: parseInt(e.target.value) || 120,
                      })
                    }
                    className="kyl-input"
                  />
                </div>
                <div>
                  <label className="kyl-form-lbl">
                    Jumlah Populasi Aktif (Ekor)
                  </label>
                  <input
                    type="number"
                    value={flockData.totalAyam}
                    onChange={(e) =>
                      setFlockData({
                        ...flockData,
                        totalAyam: parseInt(e.target.value) || 0,
                      })
                    }
                    className="kyl-input"
                  />
                </div>
                <button
                  onClick={handleUpdateFlock}
                  className="kyl-btn kyl-btn-gold"
                >
                  Simpan Set SIKLUS
                </button>
              </div>
            </div>
            <div className="kyl-card">
              <span className="kyl-card-lbl-brown">
                🐔 Mutasi Populasi Ayam
              </span>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text2)",
                  lineHeight: 1.6,
                  marginBottom: 10,
                }}
              >
                Catat ayam masuk, mati, afkir, atau dijual. Populasi langsung
                ikut berubah dan riwayatnya tersimpan otomatis.
              </p>
              <div className="kyl-space">
                <div className="kyl-grid3">
                  <div>
                    <label className="kyl-form-lbl">Jenis Mutasi</label>
                    <select
                      value={mutasiJenis}
                      onChange={(e) => setMutasiJenis(e.target.value)}
                      className="kyl-select"
                    >
                      <option value="mati">Ayam Mati</option>
                      <option value="masuk">Ayam Masuk</option>
                      <option value="afkir">Ayam Afkir</option>
                      <option value="jual">Ayam Dijual</option>
                    </select>
                  </div>
                  <div>
                    <label className="kyl-form-lbl">Jumlah Ekor</label>
                    <input
                      type="number"
                      value={mutasiJumlah}
                      onChange={(e) => setMutasiJumlah(e.target.value)}
                      className="kyl-input kyl-mono"
                      placeholder="0"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="kyl-form-lbl">Catatan</label>
                    <input
                      type="text"
                      value={mutasiCatatan}
                      onChange={(e) => setMutasiCatatan(e.target.value)}
                      className="kyl-input"
                      placeholder="Opsional..."
                    />
                  </div>
                </div>
                <button
                  onClick={handleSimpanMutasiAyam}
                  className="kyl-btn kyl-btn-brown"
                >
                  💾 Simpan Mutasi
                </button>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text2)",
                    lineHeight: 1.6,
                    padding: "8px 12px",
                    background: "var(--surface2)",
                    borderRadius: "var(--rsm)",
                  }}
                >
                  Populasi saat ini:{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {flockData.totalAyam > 0 ? flockData.totalAyam : 0}
                  </strong>{" "}
                  ekor
                </div>
              </div>

              <div className="kyl-space-sm" style={{ marginTop: 12 }}>
                {flockMutations.length > 0 ? (
                  flockMutations.slice(0, 8).map((m) => (
                    <div key={m.id} className="kyl-activity-item">
                      <div
                        className="kyl-flex-between"
                        style={{ gap: 10, alignItems: "flex-start" }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{ fontWeight: 700, color: "var(--text)" }}
                          >
                            {m.jenis === "mati"
                              ? "☠️ Ayam Mati"
                              : m.jenis === "masuk"
                              ? "🐔 Ayam Masuk"
                              : m.jenis === "afkir"
                              ? "🧓 Ayam Afkir"
                              : "💸 Ayam Dijual"}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text2)",
                              lineHeight: 1.55,
                              marginTop: 3,
                            }}
                          >
                            {m.date} · {m.time} · {m.jumlah} ekor
                            {m.catatan ? ` · ${m.catatan}` : ""}
                          </div>
                        </div>
                        <span
                          className={
                            m.jenis === "masuk"
                              ? "kyl-badge-good"
                              : "kyl-badge-bad"
                          }
                        >
                          {m.totalSebelum} → {m.totalSesudah}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="kyl-empty">Belum ada riwayat mutasi ayam.</p>
                )}
              </div>
            </div>

            <div className="kyl-card">
              <span className="kyl-card-lbl">Catat Kondisi Lapangan</span>
              <div className="kyl-space">
                <input
                  type="text"
                  placeholder="Ketik isu lapangan, kendala, catatan..."
                  value={operasionalInput}
                  onChange={(e) => setOperasionalInput(e.target.value)}
                  className="kyl-input"
                />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    "Cek kondisi pakan",
                    "Air minum kotor",
                    "Ayam sakit",
                    "Lampu mati",
                    "Kandang bocor",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setOperasionalInput(q)}
                      className="kyl-chip"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() =>
                    handleFastInput("operasional", operasionalInput)
                  }
                  className="kyl-btn kyl-btn-primary"
                >
                  Simpan Log Operasional Kandang
                </button>
              </div>
            </div>
            <div>
              <span className="kyl-isu-lbl">⚠️ Isu Aktif Lapangan</span>
              <div className="kyl-space-sm">
                {operasional.length > 0 ? (
                  operasional.map((o) => (
                    <div key={o.id} className="kyl-isu-item">
                      <div
                        className="kyl-flex-between"
                        style={{ alignItems: "flex-start" }}
                      >
                        <div style={{ flex: 1, marginRight: 10 }}>
                          <div
                            className="kyl-bold kyl-small"
                            style={{ color: "var(--amber)" }}
                          >
                            {o.deskripsi}
                          </div>
                          <div
                            className="kyl-xsmall kyl-text2"
                            style={{ marginTop: 3 }}
                          >
                            {o.date} · {o.kategori}
                          </div>
                        </div>
                        <div className="kyl-flex-center" style={{ gap: 8 }}>
                          <button
                            onClick={() => handleCompleteOperasional(o.id)}
                            className="kyl-selesai-btn"
                          >
                            ✅ Selesai
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteItem("operasional", o.id)
                            }
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 16,
                              color: "var(--red)",
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="kyl-empty">
                    Tidak ada kendala operasional aktif.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ BOTTOM NAVBAR (6 TABS) ═══════════════ */}
        <nav className="kyl-navbar no-print">
          <div className={`kyl-navbar-pill ${dark ? "dark" : "light"}`}>
            {[
              { id: "home", label: "Beranda", icon: "home" },
              { id: "produksi", label: "Produksi", icon: "egg" },
              { id: "cashflow", label: "Keuangan", icon: "wallet" },
              { id: "delivery", label: "Pesanan", icon: "truck" },
              { id: "stok", label: "Stok", icon: "box" },
              { id: "more", label: "Lainnya", icon: "more" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setPage(tab.id);
                  setEggInputQty("");
                  setOperasionalInput("");
                  setCfName("");
                  setCfNominalDisplay("");
                  setCfNominalRaw("");
                  setEditId(null);
                  setEditVal4("");
                  setHdpResult(null);
                  setStokAdjId(null);
                  setStokJumlah("");
                  setTambahJapfa("");
                  setTambahFlax("");
                  setTambahOil("");
                  setSwiped({});
                  setSheet(null);
                  setSearchProd("");
                  setSearchKas("");
                  setSearchDelivery("");
                  setSearchPelanggan("");
                  setConfirmPakan(false);
                  setConfirmResetChecklist(false);
                }}
                className={`kyl-tab-btn ${page === tab.id ? "active" : ""}`}
                style={{ position: "relative" }}
              >
                <span className="kyl-tab-icon">
                  <KylIcon name={tab.icon} title={tab.label} />
                </span>
                <span className="kyl-tab-lbl">{tab.label}</span>
                {tab.id === "stok" && alertCount > 0 && (
                  <span className="kyl-nav-badge">
                    {alertCount > 9 ? "9+" : alertCount}
                  </span>
                )}
                {tab.id === "delivery" && pendingCount > 0 && (
                  <span
                    className="kyl-nav-badge"
                    style={{ background: "var(--amber)" }}
                  >
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
