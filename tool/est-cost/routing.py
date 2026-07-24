# -*- coding: utf-8 -*-
"""
routing.py v2 — โมเดล "เส้นทางมาตรฐาน (Standard Circuit)"
=========================================================
เปลี่ยนจาก v1: เลิกจัดทริปรายวันแบบ optimize (ได้ 48–103 variant อ่านไม่รู้เรื่อง)
มาใช้ "วงเดินทางมาตรฐาน" — 1 วง = ออกจาก AMR ประชาชื่น → เก็บสถานีตามลำดับ → กลับ
ตรงกับฟอร์แมตเอกสารประมูลของ AMR

ROUTE sheet ต้องมีคอลัมน์เพิ่ม: circuit, order

  build_circuits()  ประกอบวงจาก ROUTE
  plan_year()       จำนวนรอบ/เดือน ของแต่ละวง แยกกะ Day/Night
  render_svg()      วาดภาพเส้นทาง (ไอคอนอาคาร + สถานี + รถ) → .svg
"""

import math, os, html

HQ_NAME = "AMR Asia"
HQ_LAT, HQ_LNG = 13.84635, 100.5469165

DEFAULTS = {
    "avg_speed_kmh":     28,
    "avg_speed_night":   45,
    "road_factor":       1.35,
    "day_shift_hours":   8.0,
    "night_shift_hours": 4.0,
    "crew_size":         3,
    "workdays_month":    22,
}


def haversine(lat1, lng1, lat2, lng2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


# ══════════════════════════════════════════════════════════════════════════════
#  1) ประกอบวงเดินทาง
# ══════════════════════════════════════════════════════════════════════════════
def build_circuits(route_rows, param):
    rf = param["road_factor"]
    groups = {}
    for r in route_rows:
        if not r.get("circuit"):
            continue
        groups.setdefault(str(r["circuit"]), []).append(r)

    circuits = {}
    for cid in sorted(groups):
        rows = sorted(groups[cid], key=lambda x: x.get("order") or 999)
        pts = [{"name": HQ_NAME, "lat": HQ_LAT, "lng": HQ_LNG}] + rows + \
              [{"name": HQ_NAME, "lat": HQ_LAT, "lng": HQ_LNG}]
        legs, tot = [], 0.0
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            km = haversine(a["lat"], a["lng"], b["lat"], b["lng"]) * rf
            ov = b.get("km_override")
            if ov:
                km = float(ov)
            legs.append((a["name"], b["name"], km,
                         km / param["avg_speed_kmh"] * 60,
                         km / param["avg_speed_night"] * 60))
            tot += km
        circuits[cid] = {
            "stops": [r["name"] for r in rows],
            "legs": legs, "km": tot,
            "min_day": tot / param["avg_speed_kmh"] * 60,
            "min_night": tot / param["avg_speed_night"] * 60,
        }
    return circuits


# ══════════════════════════════════════════════════════════════════════════════
#  2) จำนวนรอบ/เดือน
# ══════════════════════════════════════════════════════════════════════════════
DEFAULT_SHIFT_BY_FREQ = {"Daily": "Day", "Weekly": "Day", "M1": "Day",
                         "M3": "Night", "M6": "Night", "Annually": "Night"}

# sched เก็บ "ชม.ต่อรอบ"; งานถี่ต้องคูณจำนวนรอบ/เดือนเพื่อได้ชม.รวม
# (งานห่าง M3/M6/Annually: sched มีเฉพาะเดือนครบกำหนด = 1 รอบ → ตัวคูณ 1)
ROUNDS_PER_MONTH = {"Daily": 30.0, "Weekly": 4.333, "M1": 1.0,
                    "M3": 1.0, "M6": 1.0, "Annually": 1.0}


def _shift_of(eq, freq, cfg):
    """กะของงานชิ้นนี้: activity override > ระบบ > default ตามความถี่"""
    if cfg is not None:
        a = cfg["activity"].get(eq["code"], {}).get(freq)
        if a and a.get("shift"):
            return a["shift"]
        sysshift = cfg["shift_map"].get(eq["system"])
        if sysshift in ("Day", "Night"):
            return sysshift
    loc = str(eq["location"])
    if "Wayside" in loc or "Auto-Transformer" in loc:
        return "Night"
    return DEFAULT_SHIFT_BY_FREQ.get(freq, "Day")


def hours_by_location(rows, shift_map, month, cfg=None):
    """แยกชั่วโมงงานที่ครบกำหนดเดือนนั้น เป็น Day/Night ตามกะของแต่ละความถี่"""
    out = {"Day": {}, "Night": {}}
    for eq in rows:
        loc = str(eq["location"])
        for freq, sched in eq["sched"].items():
            h = sched.get(month, 0.0) * ROUNDS_PER_MONTH.get(freq, 1.0)
            if h <= 0:
                continue
            sh = _shift_of(eq, freq, cfg)
            out[sh][loc] = out[sh].get(loc, 0.0) + h
    return out


def plan_year(circuits, rows, shift_map, param, cfg=None):
    plan = {}
    summ = {"rounds": 0, "km": 0.0, "travel_h": 0.0, "work_h": 0.0}
    for m in range(1, 13):
        byloc = hours_by_location(rows, shift_map, m, cfg)
        mp = []
        for cid, c in circuits.items():
            for shift in ("Day", "Night"):
                work = sum(byloc[shift].get(s, 0.0) for s in c["stops"])
                if work <= 0.01:
                    continue
                travel = (c["min_day"] if shift == "Day" else c["min_night"]) / 60
                shift_h = param["day_shift_hours"] if shift == "Day" else param["night_shift_hours"]
                cap = shift_h - travel
                over = cap <= 0.25
                rounds = math.ceil(work / (cap if not over else 0.25))
                mp.append({"circuit": cid, "shift": shift, "work_h": round(work, 1),
                           "travel_h": round(travel, 2), "capacity": round(max(cap, 0), 2),
                           "rounds": rounds, "km": round(rounds * c["km"], 1),
                           "travel_total": round(rounds * travel, 1), "over": over})
                summ["rounds"] += rounds
                summ["km"] += rounds * c["km"]
                summ["travel_h"] += rounds * travel
                summ["work_h"] += work
        plan[m] = mp
    return plan, summ


# ══════════════════════════════════════════════════════════════════════════════
#  3) วาดภาพเส้นทาง — สไตล์เอกสาร AMR
# ══════════════════════════════════════════════════════════════════════════════
NAVY, TEAL, GRAY = "#1F3864", "#2E8B8B", "#7F7F7F"

_OFFICE = ('<g transform="translate({x},{y}) scale({s})" fill="{c}">'
           '<rect x="14" y="6" width="28" height="58"/><rect x="0" y="22" width="14" height="42"/>'
           '<rect x="42" y="22" width="14" height="42"/>'
           '<rect x="19" y="11" width="6" height="6" fill="#fff"/><rect x="31" y="11" width="6" height="6" fill="#fff"/>'
           '<rect x="19" y="21" width="6" height="6" fill="#fff"/><rect x="31" y="21" width="6" height="6" fill="#fff"/>'
           '<rect x="19" y="31" width="6" height="6" fill="#fff"/><rect x="31" y="31" width="6" height="6" fill="#fff"/>'
           '<rect x="19" y="41" width="6" height="6" fill="#fff"/><rect x="31" y="41" width="6" height="6" fill="#fff"/>'
           '<rect x="4" y="30" width="6" height="6" fill="#fff"/><rect x="46" y="30" width="6" height="6" fill="#fff"/>'
           '<rect x="4" y="42" width="6" height="6" fill="#fff"/><rect x="46" y="42" width="6" height="6" fill="#fff"/>'
           '<rect x="24" y="52" width="8" height="12" fill="#fff"/></g>')

_STATION = ('<g transform="translate({x},{y}) scale({s})" fill="{c}">'
            '<polygon points="28,0 56,18 0,18"/><rect x="4" y="18" width="48" height="44"/>'
            '<rect x="0" y="62" width="56" height="5"/>'
            '<circle cx="28" cy="9" r="5" fill="#fff"/>'
            '<rect x="27.2" y="5" width="1.6" height="5"/><rect x="28" y="8.4" width="4" height="1.6"/>'
            '<path d="M20 62 v-18 a8 8 0 0 1 16 0 v18 z" fill="#fff"/>'
            '<rect x="9" y="26" width="9" height="10" fill="#fff"/><rect x="38" y="26" width="9" height="10" fill="#fff"/>'
            '<rect x="9" y="42" width="9" height="10" fill="#fff"/><rect x="38" y="42" width="9" height="10" fill="#fff"/></g>')

_CAR = ('<g transform="translate({x},{y}) scale({s})" fill="{c}">'
        '<path d="M4 22 L10 10 a6 6 0 0 1 5-3 h30 a6 6 0 0 1 5 3 l6 12 h4 a3 3 0 0 1 3 3 v8 '
        'a3 3 0 0 1-3 3 H3 a3 3 0 0 1-3-3 v-8 a3 3 0 0 1 3-3 z"/>'
        '<path d="M15 20 L19 12 h9 v8 z" fill="#fff"/><path d="M32 12 h10 l4 8 h-14 z" fill="#fff"/>'
        '<circle cx="14" cy="36" r="6"/><circle cx="46" cy="36" r="6"/>'
        '<circle cx="14" cy="36" r="2.5" fill="#fff"/><circle cx="46" cy="36" r="2.5" fill="#fff"/></g>')


def _chevrons(x1, x2, y, color, w=5):
    out = f'<line x1="{x1}" y1="{y}" x2="{x2-12}" y2="{y}" stroke="{color}" stroke-width="{w}"/>'
    for f in (0.42, 0.72, 1.0):
        cx = x1 + (x2 - x1 - 12) * f
        out += (f'<path d="M{cx-11} {y-9} L{cx+1} {y} L{cx-11} {y+9}" fill="none" stroke="{color}" '
                f'stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')
    return out


def _text_w(s, size):
    """ประมาณความกว้างข้อความ (ไทยกว้างกว่าละติน)"""
    w = 0.0
    for ch in str(s):
        w += 0.95 if "\u0e00" <= ch <= "\u0e7f" else 0.55
    return w * size


def render_svg(cid, circuit, param, out_dir=".", caption=True, filename=None):
    """วาด 1 วง → .svg  (ความกว้างปรับตามความยาวชื่อสถานี จึงไม่มีตัวอักษรขาด)"""
    stops = circuit["stops"]
    labels = [HQ_NAME] + [s.replace("สถานี", "") for s in stops]
    n = len(stops)

    F_NAME, F_INFO = 30, 24
    gap = 165                                   # ช่องว่างสำหรับลูกศร + ป้ายระยะ
    # ความกว้างช่องของแต่ละโหนด = กว้างสุดระหว่างชื่อสถานี กับไอคอน
    node_w = [max(_text_w(t, F_NAME) + 24, 130) for t in labels]
    PAD = 50

    xs, x = [], PAD
    for wdt in node_w:
        xs.append(x)
        x += wdt + gap
    W = x - gap + PAD
    H = 600
    icon_y, name_y = 175, 74
    cx = lambda i: xs[i] + node_w[i] / 2        # จุดกึ่งกลางโหนด

    p = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H}" '
         f'viewBox="0 0 {W:.0f} {H}" font-family="Sarabun, Tahoma, sans-serif">',
         f'<rect width="{W:.0f}" height="{H}" fill="#ffffff"/>']

    for i, t in enumerate(labels):
        p.append(f'<text x="{cx(i):.0f}" y="{name_y}" text-anchor="middle" font-size="{F_NAME}" '
                 f'font-weight="700" fill="#222">{html.escape(t)}</text>')
        ico = _OFFICE if i == 0 else _STATION
        p.append(ico.format(x=cx(i) - 45, y=icon_y, s=1.6, c=NAVY if i == 0 else GRAY))

    # ลูกศรขาไป + ป้ายระยะ/เวลา
    for i in range(n):
        x1 = xs[i] + node_w[i] + 8
        x2 = xs[i + 1] - 8
        p.append(_chevrons(x1, x2, icon_y + 55, NAVY if i == 0 else TEAL))
        _, _, km, md, _ = circuit["legs"][i]
        mid = (x1 + x2) / 2
        p.append(f'<text x="{mid:.0f}" y="{icon_y+108}" text-anchor="middle" font-size="{F_INFO}" '
                 f'fill="#222">ระยะทาง : {km:.1f} km.</text>')
        p.append(f'<text x="{mid:.0f}" y="{icon_y+144}" text-anchor="middle" font-size="{F_INFO}" '
                 f'fill="#222">เวลา : {md:.0f} min</text>')

    # ขากลับ
    _, _, bkm, bmd, _ = circuit["legs"][-1]
    y_b = 452
    x_last, x_home = cx(n), cx(0)
    p.append(f'<path d="M{x_last:.0f} {icon_y+130} V{y_b} H{x_home:.0f} V{icon_y+134}" '
             f'fill="none" stroke="{GRAY}" stroke-width="6"/>')
    span = x_last - x_home
    for f in (0.16, 0.42, 0.68, 0.94):
        c = x_last - span * f
        p.append(f'<path d="M{c+12:.0f} {y_b-11} L{c-1:.0f} {y_b} L{c+12:.0f} {y_b+11}" fill="none" '
                 f'stroke="{GRAY}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>')
    p.append(f'<path d="M{x_home+13:.0f} {icon_y+148} L{x_home:.0f} {icon_y+132} '
             f'L{x_home-13:.0f} {icon_y+148}" fill="none" stroke="{GRAY}" stroke-width="6" '
             f'stroke-linecap="round" stroke-linejoin="round"/>')

    mid = (x_last + x_home) / 2
    p.append(_CAR.format(x=mid - 32, y=y_b - 108, s=1.5, c=NAVY))
    p.append(f'<text x="{mid:.0f}" y="{y_b+52}" text-anchor="middle" font-size="{F_INFO}" '
             f'fill="#222">ระยะทาง : {bkm:.1f} km.</text>')
    p.append(f'<text x="{mid:.0f}" y="{y_b+88}" text-anchor="middle" font-size="{F_INFO}" '
             f'fill="#222">เวลา : {bmd:.0f} min</text>')

    if caption:
        th = circuit["min_day"] / 60
        p.append(f'<text x="{PAD}" y="{H-22}" font-size="21" fill="#555">'
                 f'{html.escape(cid)}  •  รวม {circuit["km"]:.1f} km / {circuit["min_day"]:.0f} min '
                 f'({th:.1f} ชม.)  •  กะ {param["day_shift_hours"]:.0f} ชม. → '
                 f'เหลือทำงานหน้างาน {param["day_shift_hours"]-th:.1f} ชม.</text>')
    p.append("</svg>")

    os.makedirs(out_dir, exist_ok=True)
    safe = filename or ("route_" + "".join(c for c in cid if c not in '\\/:*?"<>|').strip())
    path = os.path.join(out_dir, safe + ".svg")
    open(path, "w", encoding="utf-8").write("\n".join(p))
    return path


def render_png(svg_path, scale=2.0):
    """แปลง .svg → .png สำหรับฝังใน Excel (คืน None ถ้าไม่มี cairosvg)"""
    try:
        import cairosvg
    except ImportError:
        return None
    png = os.path.splitext(svg_path)[0] + ".png"
    cairosvg.svg2png(url=svg_path, write_to=png, scale=scale, background_color="white")
    return png


# ══════════════════════════════════════════════════════════════════════════════
#  4) วาดภาพเป็น PNG ด้วย Pillow — ใช้ได้ทั้ง Colab และ Pyodide (เว็บ)
#     (cairosvg ใช้ใน Pyodide ไม่ได้ เพราะต้องพึ่ง library ภาษา C)
# ══════════════════════════════════════════════════════════════════════════════
FONT_FILES = ("Sarabun-Regular.ttf", "Sarabun-Bold.ttf")


def _find_font(name, size, search_dirs):
    from PIL import ImageFont
    for d in search_dirs:
        p = os.path.join(d, name)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    for p in ("/usr/share/fonts/truetype/tlwg/Loma.ttf",
              "/usr/share/fonts/truetype/tlwg/Loma-Bold.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _office(d, x, y, s, c):
    """ไอคอนอาคารสำนักงาน"""
    W = lambda v: x + v * s
    H = lambda v: y + v * s
    d.rectangle([W(14), H(6), W(42), H(64)], fill=c)
    d.rectangle([W(0), H(22), W(14), H(64)], fill=c)
    d.rectangle([W(42), H(22), W(56), H(64)], fill=c)
    for ry in (11, 21, 31, 41):
        for rx in (19, 31):
            d.rectangle([W(rx), H(ry), W(rx + 6), H(ry + 6)], fill="white")
    for ry in (30, 42):
        for rx in (4, 46):
            d.rectangle([W(rx), H(ry), W(rx + 6), H(ry + 6)], fill="white")
    d.rectangle([W(24), H(52), W(32), H(64)], fill="white")


def _station(d, x, y, s, c):
    """ไอคอนสถานี (หลังคาจั่ว + นาฬิกา + ประตูโค้ง)"""
    W = lambda v: x + v * s
    H = lambda v: y + v * s
    d.polygon([(W(28), H(0)), (W(56), H(18)), (W(0), H(18))], fill=c)
    d.rectangle([W(4), H(18), W(52), H(62)], fill=c)
    d.rectangle([W(0), H(62), W(56), H(67)], fill=c)
    d.ellipse([W(23), H(4), W(33), H(14)], fill="white")
    d.line([W(28), H(6), W(28), H(9.4)], fill=c, width=max(1, int(1.6 * s)))
    d.line([W(28), H(9.2), W(31), H(9.2)], fill=c, width=max(1, int(1.6 * s)))
    d.rectangle([W(20), H(48), W(36), H(62)], fill="white")
    d.pieslice([W(20), H(36), W(36), H(52)], 180, 360, fill="white")
    for ry in (26, 42):
        for rx in (9, 38):
            d.rectangle([W(rx), H(ry), W(rx + 9), H(ry + 10)], fill="white")


def _car(d, x, y, s, c):
    """ไอคอนรถยนต์"""
    W = lambda v: x + v * s
    H = lambda v: y + v * s
    d.rounded_rectangle([W(0), H(22), W(62), H(36)], radius=int(4 * s), fill=c)
    d.polygon([(W(10), H(22)), (W(16), H(8)), (W(46), H(8)), (W(52), H(22))], fill=c)
    d.polygon([(W(16), H(20)), (W(20), H(12)), (W(29), H(12)), (W(29), H(20))], fill="white")
    d.polygon([(W(33), H(12)), (W(43), H(12)), (W(47), H(20)), (W(33), H(20))], fill="white")
    for wx in (14, 46):
        d.ellipse([W(wx - 6), H(30), W(wx + 6), H(42)], fill=c)
        d.ellipse([W(wx - 2.5), H(33.5), W(wx + 2.5), H(38.5)], fill="white")


def _chev(d, x1, x2, y, c, w=5):
    """ลูกศรแบบเชฟรอน 3 หัว"""
    d.line([x1, y, x2 - 12, y], fill=c, width=w)
    for f in (0.42, 0.72, 1.0):
        cx = x1 + (x2 - x1 - 12) * f
        d.line([cx - 11, y - 9, cx + 1, y], fill=c, width=w, joint="curve")
        d.line([cx + 1, y, cx - 11, y + 9], fill=c, width=w, joint="curve")


def render_png_pil(cid, circuit, param, out_dir=".", font_dirs=None, filename=None, scale=1.0):
    """วาดแผนผังเส้นทางเป็น PNG ด้วย Pillow — คืน path (None ถ้าไม่มี Pillow)"""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return None

    fd = list(font_dirs or []) + [os.path.dirname(os.path.abspath(__file__)), ".", "fonts"]
    F_NAME = _find_font("Sarabun-Bold.ttf", int(30 * scale), fd)
    F_INFO = _find_font("Sarabun-Regular.ttf", int(24 * scale), fd)

    stops = circuit["stops"]
    labels = [HQ_NAME] + [s.replace("สถานี", "") for s in stops]
    n = len(stops)
    navy, teal, gray = _rgb(NAVY), _rgb(TEAL), _rgb(GRAY)
    ink = (34, 34, 34)

    tmp = Image.new("RGB", (10, 10), "white")
    td = ImageDraw.Draw(tmp)
    tw = lambda t, f: td.textbbox((0, 0), t, font=f)[2]

    S = scale
    gap = int(165 * S)
    node_w = [max(tw(t, F_NAME) + int(24 * S), int(130 * S)) for t in labels]
    PAD = int(50 * S)
    xs, x = [], PAD
    for w_ in node_w:
        xs.append(x)
        x += w_ + gap
    W = x - gap + PAD
    H = int(600 * S)
    icon_y, name_y = int(175 * S), int(74 * S)
    cx = lambda i: xs[i] + node_w[i] / 2

    img = Image.new("RGB", (int(W), H), "white")
    d = ImageDraw.Draw(img)

    for i, t in enumerate(labels):
        d.text((cx(i), name_y), t, font=F_NAME, fill=ink, anchor="ms")
        (_office if i == 0 else _station)(d, cx(i) - 45 * S, icon_y, 1.6 * S,
                                          navy if i == 0 else gray)

    for i in range(n):
        x1 = xs[i] + node_w[i] + int(8 * S)
        x2 = xs[i + 1] - int(8 * S)
        _chev(d, x1, x2, icon_y + int(55 * S), navy if i == 0 else teal, max(1, int(5 * S)))
        _, _, km, md, _ = circuit["legs"][i]
        mid = (x1 + x2) / 2
        d.text((mid, icon_y + 108 * S), f"ระยะทาง : {km:.1f} km.", font=F_INFO, fill=ink, anchor="ms")
        d.text((mid, icon_y + 144 * S), f"เวลา : {md:.0f} min", font=F_INFO, fill=ink, anchor="ms")

    _, _, bkm, bmd, _ = circuit["legs"][-1]
    y_b = int(452 * S)
    x_last, x_home = cx(n), cx(0)
    lw = max(1, int(6 * S))
    d.line([x_last, icon_y + 130 * S, x_last, y_b], fill=gray, width=lw)
    d.line([x_last, y_b, x_home, y_b], fill=gray, width=lw)
    d.line([x_home, y_b, x_home, icon_y + 134 * S], fill=gray, width=lw)
    span = x_last - x_home
    for f in (0.16, 0.42, 0.68, 0.94):
        c0 = x_last - span * f
        d.line([c0 + 12 * S, y_b - 11 * S, c0 - 1, y_b], fill=gray, width=lw)
        d.line([c0 - 1, y_b, c0 + 12 * S, y_b + 11 * S], fill=gray, width=lw)
    d.line([x_home + 13 * S, icon_y + 148 * S, x_home, icon_y + 132 * S], fill=gray, width=lw)
    d.line([x_home, icon_y + 132 * S, x_home - 13 * S, icon_y + 148 * S], fill=gray, width=lw)

    mid = (x_last + x_home) / 2
    _car(d, mid - 32 * S, y_b - 108 * S, 1.5 * S, navy)
    d.text((mid, y_b + 52 * S), f"ระยะทาง : {bkm:.1f} km.", font=F_INFO, fill=ink, anchor="ms")
    d.text((mid, y_b + 88 * S), f"เวลา : {bmd:.0f} min", font=F_INFO, fill=ink, anchor="ms")

    os.makedirs(out_dir, exist_ok=True)
    safe = filename or ("route_" + "".join(c for c in cid if c not in '\\/:*?"<>|').strip())
    path = os.path.join(out_dir, safe + ".png")
    img.save(path, "PNG")
    return path
