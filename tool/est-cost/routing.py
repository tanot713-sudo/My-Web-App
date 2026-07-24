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


def render_svg(cid, circuit, param, out_dir="."):
    stops = circuit["stops"]
    n = len(stops)
    node_w, gap = 190, 150
    W = 60 + (n + 1) * node_w + n * gap + 60
    H = 580
    icon_y, name_y = 155, 68
    xs = [60 + i * (node_w + gap) for i in range(n + 1)]

    p = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
         f'font-family="Tahoma, \'TH Sarabun New\', sans-serif">',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>']

    p.append(f'<text x="{xs[0]+node_w/2}" y="{name_y}" text-anchor="middle" font-size="30" '
             f'font-weight="bold" fill="#222">{html.escape(HQ_NAME)}</text>')
    p.append(_OFFICE.format(x=xs[0] + node_w / 2 - 45, y=icon_y - 5, s=1.6, c=NAVY))

    for i, s in enumerate(stops):
        x = xs[i + 1]
        label = s.replace("สถานี", "")
        p.append(f'<text x="{x+node_w/2}" y="{name_y}" text-anchor="middle" font-size="30" '
                 f'font-weight="bold" fill="#222">{html.escape(label)}</text>')
        p.append(_STATION.format(x=x + node_w / 2 - 45, y=icon_y - 5, s=1.6, c=GRAY))

    for i in range(n):
        x1, x2 = xs[i] + node_w - 5, xs[i + 1] + 5
        p.append(_chevrons(x1, x2, icon_y + 50, NAVY if i == 0 else TEAL))
        _, _, km, md, _ = circuit["legs"][i]
        cx = (x1 + x2) / 2
        p.append(f'<text x="{cx}" y="{icon_y+100}" text-anchor="middle" font-size="24" fill="#222">'
                 f'ระยะทาง : {km:.1f} km.</text>')
        p.append(f'<text x="{cx}" y="{icon_y+136}" text-anchor="middle" font-size="24" fill="#222">'
                 f'เวลา : {md:.0f} min</text>')

    _, _, bkm, bmd, _ = circuit["legs"][-1]
    y_b = 440
    x_last, x_home = xs[n] + node_w / 2, xs[0] + node_w / 2
    p.append(f'<path d="M{x_last} {icon_y+125} V{y_b} H{x_home} V{icon_y+128}" fill="none" '
             f'stroke="{GRAY}" stroke-width="6"/>')
    span = x_last - x_home
    for f in (0.18, 0.45, 0.72, 0.95):
        cx = x_last - span * f
        p.append(f'<path d="M{cx+12} {y_b-11} L{cx-1} {y_b} L{cx+12} {y_b+11}" fill="none" '
                 f'stroke="{GRAY}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>')
    p.append(f'<path d="M{x_home+13} {icon_y+142} L{x_home} {icon_y+126} L{x_home-13} {icon_y+142}" '
             f'fill="none" stroke="{GRAY}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>')

    cx = (x_last + x_home) / 2
    p.append(_CAR.format(x=cx - 32, y=y_b - 105, s=1.5, c=NAVY))
    p.append(f'<text x="{cx}" y="{y_b+52}" text-anchor="middle" font-size="24" fill="#222">'
             f'ระยะทาง : {bkm:.1f} km.</text>')
    p.append(f'<text x="{cx}" y="{y_b+88}" text-anchor="middle" font-size="24" fill="#222">'
             f'เวลา : {bmd:.0f} min</text>')

    th = circuit["min_day"] / 60
    p.append(f'<text x="40" y="{H-20}" font-size="22" fill="#555">'
             f'{html.escape(cid)}  •  รวม {circuit["km"]:.1f} km / {circuit["min_day"]:.0f} min '
             f'({th:.1f} ชม.)  •  กะ {param["day_shift_hours"]:.0f} ชม. → เหลือทำงานหน้างาน '
             f'{param["day_shift_hours"]-th:.1f} ชม.</text>')
    p.append("</svg>")

    os.makedirs(out_dir, exist_ok=True)
    safe = "".join(ch for ch in cid if ch not in '\\/:*?"<>|').strip()
    path = os.path.join(out_dir, f"route_{safe}.svg")
    open(path, "w", encoding="utf-8").write("\n".join(p))
    return path
