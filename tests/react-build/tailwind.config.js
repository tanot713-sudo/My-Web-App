/* Tailwind v3 (pin: tests/package.json) สำหรับหน้า React 4 หน้า — คอมไพล์ล่วงหน้าเป็น /react-pages.css
   ด้วย ./build-react.sh (แทน cdn.tailwindcss.com เดิม) สีหลักทั้งหมดผูกกับโทเคน --ome-* ของ theme.css
   จึงสลับสว่าง/มืด/สีเน้น/ฟอนต์ได้เองโดยไม่ต้องมีกฎ !important ทับใน theme.css */
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

/* สีจากโทเคน รองรับตัวปรับความโปร่ง (bg-brand/10) ด้วย color-mix */
/* opacityValue เป็นได้ทั้งตัวเลข (bg-brand/10 → 0.1) และ var(--tw-bg-opacity) ของคลาสปกติ → calc ใช้ได้ทั้งคู่ */
const tok = (expr) => ({ opacityValue }) =>
  opacityValue === undefined ? expr : 'color-mix(in srgb, ' + expr + ' calc(' + opacityValue + ' * 100%), transparent)';
const mix = (a, pa, b) => 'color-mix(in srgb, ' + a + ' ' + pa + '%, ' + b + ')';

const BRAND = 'var(--ome-brand)', BRAND_DK = 'var(--ome-brand-dk)', BRAND_SF = 'var(--ome-brand-sf)';
const INK = 'var(--ome-ink)', MUTED = 'var(--ome-muted)', LINE = 'var(--ome-line)';
const BG = 'var(--ome-bg)', CARD = 'var(--ome-card)';
const MID = mix(CARD, 50, BG);                 // slate/gray-100
const TXT2 = mix(INK, 65, MUTED);              // slate/gray-600/700
const edge = (c) => mix('var(--ome-' + c + ')', 24, CARD); // เส้นขอบของกล่อง ok/warn/err/info

const pick = (names, v) => Object.fromEntries(names.map((n) => [n, tok(v)]));
const greys = (map) => {
  const o = {};
  for (const [shade, v] of Object.entries(map)) { o['slate-' + shade] = tok(v); o['gray-' + shade] = tok(v); }
  return o;
};

module.exports = {
  content: [
    'languages.html', 'languages.jsx',
    'legal.html', 'legal.jsx',
    'classroom-business.html', 'classroom-business.jsx',
    'classroom-engineering.html', 'classroom-engineering.jsx',
  ].map((f) => path.join(ROOT, f)),
  theme: {
    extend: {
      fontFamily: { sans: ['var(--ome-f)'] },
      colors: {
        brand: tok(BRAND), brandLight: tok(BRAND_SF),
        primary: tok(BRAND_DK), secondary: tok(BRAND),
        accent: '#f59e0b', success: '#10b981', danger: '#ef4444',
      },
      /* พื้นปุ่ม/แถบที่มีตัวอักษรขาวทับ (bg-primary/secondary, from-/to-) — โหมดมืดใช้สีเข้มลง (ดู --rp-fill-* ใน input.css)
         ไม่งั้นยืม brand-dk ที่สว่างในโหมดมืดแล้วตัวขาวอ่านไม่ออก */
      gradientColorStops: { primary: tok('var(--rp-fill-1)'), secondary: tok('var(--rp-fill-2)') },
      backgroundColor: {
        primary: tok('var(--rp-fill-1)'), secondary: tok('var(--rp-fill-2)'),
        white: tok(CARD),
        ...greys({ 50: BG, 100: MID }),
        'blue-50': tok('var(--ome-info-soft)'), 'amber-50': tok('var(--ome-warn-soft)'),
        'emerald-50': tok('var(--ome-ok-soft)'), 'green-50': tok('var(--ome-ok-soft)'),
        'red-50': tok('var(--ome-err-soft)'),
      },
      textColor: greys({ 400: MUTED, 500: MUTED, 600: TXT2, 700: TXT2, 800: INK, 900: INK }),
      borderColor: {
        DEFAULT: tok(LINE),
        ...greys({ 100: LINE, 200: LINE }),
        'blue-50': tok(BRAND), 'blue-100': tok(edge('info')),
        'amber-100': tok(edge('warn')), 'amber-200': tok(edge('warn')),
        'green-100': tok(edge('ok')), 'emerald-200': tok(edge('ok')),
        'red-100': tok(edge('err')),
      },
      boxShadow: { sm: 'var(--ome-sh)', md: 'var(--ome-sh)', lg: 'var(--ome-sh)' },
    },
  },
};
