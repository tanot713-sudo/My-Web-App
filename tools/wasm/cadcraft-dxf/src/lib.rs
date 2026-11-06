//! อ่านไฟล์ DXF — เรียกจาก cad-dxf-worker.js เท่านั้น (ปุ่ม "นำเข้า DXF" ของ cad.html)
//! cadcraft-io อ่านไฟล์ (ASCII/binary, ข้อความตาม $DWGCODEPAGE เช่น ANSI_874 ภาษาไทย) → Drawing ของ cadcraft-doc
//! แล้วแปลงเฉพาะ model space เป็นชนิดที่ cad.js มีอยู่แล้ว: line / circle / arc / poly / text
//!   บล็อก (INSERT ซ้อนได้) ระเบิดตาม scale/rotation · มิติ = เส้น + ข้อความตามที่ CADCraft วาด · MTEXT = ข้อความล้วนรายบรรทัด
//!   ส่วนโค้งใน polyline (bulge) / ellipse / spline / helix = จุดตามความละเอียด TOL ของขนาดชิ้น
//! ชนิดที่ไม่แปลง (รูปภาพ, viewport, ตาราง ฯลฯ) นับไว้ใน `skipped` ให้หน้าบอกผู้ใช้
//! คืน JSON `{layers:[ชื่อ], entities:[{t,l,…}], skipped:{ชนิด:จำนวน}}` (l = ดัชนีใน layers)
//! error = ข้อความ `dxf:<รหัส>` ให้ฝั่ง JS แปลงเป็นข้อความไทย/อังกฤษเอง: damaged (อ่านไฟล์ไม่ได้) · empty (ไม่มีอะไรให้นำเข้า)

use std::collections::BTreeMap;

use cadcraft_doc::{Drawing, Entity, EntityKind};
use cadcraft_geom::{Mat3, Segment, Vec2};
use serde_json::{Value, json};
use wasm_bindgen::prelude::*;

/// ระยะเบี่ยงสูงสุดของจุดที่แทนเส้นโค้ง (สัดส่วนของรัศมี/ขนาด) และขั้นต่ำเป็นหน่วยแบบ
const TOL: f64 = 0.002;
const TOL_MIN: f64 = 1e-4;
/// บล็อกซ้อนลึกเกินนี้ = ไฟล์วนอ้างตัวเอง (ไม่ตามต่อ)
const MAX_DEPTH: u32 = 16;
/// เพดานจำนวนชิ้นที่ส่งกลับ (กันไฟล์ที่ระเบิดบล็อกแล้วใหญ่จนหน้าค้าง)
const MAX_ENTITIES: usize = 200_000;

struct Out {
    layers: Vec<String>,
    layer_ix: BTreeMap<String, usize>,
    entities: Vec<Value>,
    skipped: BTreeMap<String, u32>,
    truncated: bool,
}

impl Out {
    fn layer(&mut self, name: &str) -> usize {
        if let Some(i) = self.layer_ix.get(name) {
            return *i;
        }
        let i = self.layers.len();
        self.layers.push(name.to_string());
        self.layer_ix.insert(name.to_string(), i);
        i
    }
    fn push(&mut self, v: Value) {
        if self.entities.len() >= MAX_ENTITIES {
            self.truncated = true;
            return;
        }
        self.entities.push(v);
    }
    fn skip(&mut self, what: &str) {
        *self.skipped.entry(what.to_string()).or_insert(0) += 1;
    }
}

fn r(x: f64) -> f64 {
    // ตัดทศนิยมที่ 6 ตำแหน่ง (หน่วยแบบ = มม. ส่วนใหญ่) ให้ JSON สั้นลง
    (x * 1e6).round() / 1e6
}
fn pt(p: Vec2) -> Value {
    json!([r(p.x), r(p.y)])
}
fn finite(p: Vec2) -> bool {
    p.x.is_finite() && p.y.is_finite()
}
fn tol_for(size: f64) -> f64 {
    (size.abs() * TOL).max(TOL_MIN)
}

fn poly(o: &mut Out, l: usize, pts: Vec<Vec2>, closed: bool) {
    let pts: Vec<Vec2> = pts.into_iter().filter(|p| finite(*p)).collect();
    if pts.len() >= 2 {
        o.push(json!({"t": "poly", "l": l, "p": pts.into_iter().map(pt).collect::<Vec<_>>(), "c": closed}));
    }
}

fn text(o: &mut Out, l: usize, at: Vec2, value: &str, height: f64, rot: f64) {
    let s = value.trim_end();
    if s.trim().is_empty() || !finite(at) {
        return;
    }
    let h = if height.is_finite() && height > 0.0 { height } else { 2.5 };
    o.push(json!({"t": "text", "l": l, "p": pt(at), "s": s, "h": r(h), "r": r(if rot.is_finite() { rot } else { 0.0 })}));
}

/// ส่วนของเส้น (ตรง/โค้ง) จาก polyline ที่มี bulge หรือขอบของแรเงา → poly เดียว
fn segments_poly(o: &mut Out, l: usize, segs: &[Segment], closed: bool) {
    let mut pts: Vec<Vec2> = Vec::new();
    for s in segs {
        let mut part = Vec::new();
        let size = match s {
            Segment::Line(_) => 1.0,
            Segment::Arc { arc, .. } => arc.radius,
        };
        s.tessellate(tol_for(size), &mut part);
        if let (Some(last), Some(first)) = (pts.last(), part.first())
            && (*last - *first).len() < 1e-9
        {
            part.remove(0);
        }
        pts.extend(part);
    }
    // จุดท้ายซ้ำจุดแรก (ขอบแรเงา ฯลฯ) = รูปปิด
    let closed = closed || (pts.len() > 3 && (pts[0] - pts[pts.len() - 1]).len() < 1e-9);
    if closed && pts.len() > 2 && (pts[0] - pts[pts.len() - 1]).len() < 1e-9 {
        pts.pop();
    }
    poly(o, l, pts, closed);
}

fn emit(o: &mut Out, d: &Drawing, e: &Entity, layer: &str, m: Option<&Mat3>, depth: u32) {
    // บล็อก: entity ที่อยู่เลเยอร์ "0" ใช้เลเยอร์ของ INSERT (กฎเดียวกับ explode ของ CADCraft)
    let lname = if e.common.layer == "0" { layer } else { e.common.layer.as_str() };
    let l = o.layer(lname);
    // แปลงพิกัดด้วยเมทริกซ์ของบล็อก (ถ้าไม่ใช่การย่อขยายเท่ากันทุกทิศ วงกลม/ส่วนโค้งจะกลายเป็นจุดต่อกันแทน)
    let mut kind = e.kind.clone();
    let stretched = m.is_some_and(|m| m.similarity_scale().is_none());
    if let Some(m) = m
        && !stretched
    {
        kind.transform(m);
    }
    let map = |p: Vec2| -> Vec2 { if stretched { m.map_or(p, |m| m.apply(p)) } else { p } };
    match &kind {
        EntityKind::Line(x) => {
            let (a, b) = (map(x.a.xy()), map(x.b.xy()));
            if finite(a) && finite(b) {
                o.push(json!({"t": "line", "l": l, "a": pt(a), "b": pt(b)}));
            }
        }
        EntityKind::Circle(c) if !stretched => {
            if c.radius > 0.0 && finite(c.center.xy()) {
                o.push(json!({"t": "circle", "l": l, "c": pt(c.center.xy()), "r": r(c.radius)}));
            }
        }
        EntityKind::Arc(a) if !stretched => {
            if a.radius > 0.0 && finite(a.center.xy()) {
                o.push(json!({"t": "arc", "l": l, "c": pt(a.center.xy()), "r": r(a.radius), "a0": r(a.start), "a1": r(a.end)}));
            }
        }
        EntityKind::Text(t) => {
            // จุด 10 = มุมซ้ายล่างของข้อความเสมอ (แม้จัดกลาง/ขวา โปรแกรมที่เขียนไฟล์คำนวณไว้ให้) — cad.js วาดชิดซ้ายจากจุดนี้
            text(o, l, map(t.insert.xy()), &t.value, t.height, t.rotation);
        }
        EntityKind::MText(t) => {
            let plain = cadcraft_fonts::plain_mtext(&t.contents);
            for (i, line) in plain.split('\n').enumerate() {
                // บรรทัดถัดไปลงล่างตามมุมของข้อความ (ระยะบรรทัด 5/3 ของความสูง แบบ explode ของ CADCraft)
                let at = t.insert.xy() + Vec2::from_angle(t.rotation - std::f64::consts::FRAC_PI_2) * (t.height * (1.0 + 5.0 / 3.0 * i as f64));
                text(o, l, map(at), line, t.height, t.rotation);
            }
        }
        EntityKind::Insert(ins) => {
            if depth >= MAX_DEPTH {
                o.skip("INSERT");
                return;
            }
            let Some(blk) = d.block(&ins.block) else {
                o.skip("INSERT");
                return;
            };
            if ins.cols > 1 || ins.rows > 1 {
                o.skip("MINSERT");
            }
            // เมทริกซ์ของ INSERT จากค่าเดิมในไฟล์ (`kind` ถูกแปลงด้วย m ไปแล้ว — ใช้ตัวนั้นจะคูณ m ซ้ำ)
            let EntityKind::Insert(orig) = &e.kind else { return };
            let local = orig.transform(blk.base.xy());
            let total = match m {
                Some(m) => m.then_before(local),
                None => local,
            };
            for be in blk.entities.iter() {
                emit(o, d, be, lname, Some(&total), depth + 1);
            }
            for a in &ins.attribs {
                text(o, l, map(a.text.insert.xy()), &a.text.value, a.text.height, a.text.rotation);
            }
        }
        EntityKind::Dimension(dm) => {
            let g = cadcraft_render::dimension_in(d, dm);
            for line in &g.lines {
                poly(o, l, line.iter().map(|p| map(*p)).collect(), false);
            }
            for f in &g.fills {
                poly(o, l, f.iter().map(|p| map(*p)).collect(), true);
            }
            if !g.value.is_empty() {
                // text_pos = กึ่งกลางข้อความ แต่ cad.js วาดจากมุมซ้ายล่าง → ถอยครึ่งความกว้างโดยประมาณ (0.6 × สูง ต่อตัวอักษร) และครึ่งความสูง
                let s = cadcraft_fonts::plain_mtext(&g.mtext_contents());
                let w = s.chars().count() as f64 * g.text_height * 0.6;
                let at = g.text_pos - Vec2::from_angle(g.text_angle) * (w / 2.0) - Vec2::from_angle(g.text_angle + std::f64::consts::FRAC_PI_2) * (g.text_height / 2.0);
                text(o, l, map(at), &s, g.text_height, g.text_angle);
            }
        }
        EntityKind::AttDef(_) => {} // นิยามแอตทริบิวต์ในบล็อก (ค่าจริงอยู่ใน INSERT)
        EntityKind::Image(_) => o.skip("IMAGE"),
        EntityKind::Viewport(_) => {}
        EntityKind::Unknown(u) => o.skip(&u.dxf_type),
        other => {
            // ที่เหลือ: ใช้ primitive ของ CADCraft (ellipse/spline/polyline/hatch boundary/solid ฯลฯ)
            let prims = other.prims();
            if prims.is_empty() {
                o.skip(other.type_name());
                return;
            }
            let closed_poly = matches!(other, EntityKind::LwPolyline(p) if p.closed);
            let mut segs: Vec<Segment> = Vec::new();
            for p in prims {
                match p {
                    cadcraft_doc::Prim::Seg(s) => segs.push(s),
                    cadcraft_doc::Prim::Circle(c) => {
                        let mut v = Vec::new();
                        cadcraft_geom::Arc::new(c.center, c.radius, 0.0, std::f64::consts::TAU).tessellate(tol_for(c.radius), &mut v);
                        poly(o, l, v.into_iter().map(map).collect(), true);
                    }
                    cadcraft_doc::Prim::Ellipse(el) => {
                        let mut v = Vec::new();
                        el.tessellate(tol_for(el.major.len()), &mut v);
                        // วงรีเต็มวง = รูปปิด (ตัดจุดท้ายที่ซ้ำจุดแรก)
                        let full = v.len() > 2 && (v[0] - v[v.len() - 1]).len() < 1e-9;
                        if full {
                            v.pop();
                        }
                        poly(o, l, v.into_iter().map(map).collect(), full);
                    }
                    cadcraft_doc::Prim::Spline(sp) => {
                        let len: f64 = sp.control.windows(2).map(|w| (w[1] - w[0]).len()).sum();
                        let v = sp.tessellate(tol_for(len));
                        poly(o, l, v.into_iter().map(map).collect(), false);
                    }
                    cadcraft_doc::Prim::Fill(pts) => poly(o, l, pts.into_iter().map(map).collect(), true),
                    cadcraft_doc::Prim::Point(_) | cadcraft_doc::Prim::Infinite { .. } => o.skip(other.type_name()),
                }
            }
            if !segs.is_empty() {
                if stretched {
                    let mut pts = Vec::new();
                    for s in &segs {
                        let size = match s {
                            Segment::Line(_) => 1.0,
                            Segment::Arc { arc, .. } => arc.radius,
                        };
                        s.tessellate(tol_for(size), &mut pts);
                    }
                    poly(o, l, pts.into_iter().map(map).collect(), closed_poly);
                } else {
                    segments_poly(o, l, &segs, closed_poly);
                }
            }
        }
    }
}

/// DXF (ASCII หรือ binary) → JSON ของชิ้นที่นำเข้าได้
#[wasm_bindgen]
pub fn read_dxf(bytes: &[u8]) -> Result<String, JsError> {
    let d = cadcraft_io::read_dxf(bytes).map_err(|e| JsError::new(&format!("dxf:damaged {e}")))?;
    let mut o = Out { layers: Vec::new(), layer_ix: BTreeMap::new(), entities: Vec::new(), skipped: BTreeMap::new(), truncated: false };
    for e in d.model.iter() {
        emit(&mut o, &d, e, "0", None, 0);
    }
    if o.entities.is_empty() {
        return Err(JsError::new("dxf:empty no entities to import"));
    }
    // เลเยอร์ที่ใช้จริง + สีจากตารางเลเยอร์ (ACI 7 ขาว/ดำ หรือไม่มีในตาราง = null ให้หน้าใช้สีตามธีม)
    let layers: Vec<Value> = o
        .layers
        .iter()
        .map(|n| {
            let c = d.layer(n).and_then(|ly| match ly.color {
                cadcraft_doc::color::Color::Index(7) => None,
                cadcraft_doc::color::Color::Index(i) => Some(cadcraft_doc::color::aci_rgb(i)),
                cadcraft_doc::color::Color::True(rgb) => Some(rgb),
                _ => None,
            });
            json!({"n": n, "c": c.map(|c| format!("#{:06x}", c.to_u32()))})
        })
        .collect();
    let out = json!({"layers": layers, "entities": o.entities, "skipped": o.skipped, "truncated": o.truncated});
    Ok(out.to_string())
}
