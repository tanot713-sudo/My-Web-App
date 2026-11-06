//! อ่านไฟล์ .pptx เป็นโครงเรื่อง — เรียกจาก slides-pptx-worker.js เท่านั้น (ปุ่ม "นำเข้าไฟล์" ของ slides.html)
//! deckcraft-pptx อ่านแพ็กเกจ (ลำดับสไลด์ตาม sldIdLst, rels, placeholder, ตาราง, โน้ต, SmartArt) → Presentation
//! แล้วดึงเฉพาะข้อความ: หัวข้อ (placeholder title/ctrTitle), ย่อหน้า + ระดับ bullet, ตาราง, โน้ต, สไลด์ซ่อน
//! ไม่วาดอะไรเลย (ไม่มี render/fonts) — แปลงเป็นโครงเรื่องที่ slides-calc.js `pptxToOutline`
//! คืน JSON `{slides:[{title, paras:[[ระดับ, ข้อความ, มีจุดหัวข้อ 0|1]], tables:[[[เซลล์]]], notes:[บรรทัด], hidden}], skipped}`
//! error = `pptx:<รหัส>`: encrypted (ตั้งรหัสผ่าน) · damaged (ไม่ใช่ pptx/อ่านไม่ได้) · empty (ไม่มีสไลด์)

use deckcraft_model::text::{Bullet, RunKind, TextBody};
use deckcraft_model::{PhType, Shape, ShapeKind};
use serde_json::{Value, json};
use wasm_bindgen::prelude::*;

fn para_text(runs: &[deckcraft_model::text::Run]) -> String {
    let mut s = String::new();
    for r in runs {
        match r.kind {
            RunKind::Break => s.push(' '),
            _ => s.push_str(&r.text),
        }
    }
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn body_lines(t: &TextBody) -> Vec<(u8, String)> {
    t.paragraphs.iter().map(|p| (p.level, para_text(&p.runs))).filter(|(_, s)| !s.is_empty()).collect()
}

/// ย่อหน้า + ระดับ + มีจุดหัวข้อไหม: ตั้งไว้ในย่อหน้าเอง = ตามนั้น · ไม่ได้ตั้ง (สืบทอด) = กล่องเนื้อหา (body/obj) มีจุด, กล่องข้อความทั่วไปไม่มี
fn body_items(t: &TextBody, inherit_bullet: bool) -> Vec<(u8, String, bool)> {
    t.paragraphs
        .iter()
        .map(|p| {
            let b = match &p.props.bullet {
                Some(Bullet::None) => false,
                Some(_) => true,
                None => inherit_bullet,
            };
            (p.level, para_text(&p.runs), b)
        })
        .filter(|(_, s, _)| !s.is_empty())
        .collect()
}

#[derive(Default)]
struct Out {
    title: String,
    ph_title: bool,
    paras: Vec<Value>,
    tables: Vec<Value>,
}

fn walk(o: &mut Out, shapes: &[Shape], skipped: &mut u32) {
    for sh in shapes {
        if sh.hidden {
            continue;
        }
        match &sh.kind {
            ShapeKind::Group { children, .. } => walk(o, children, skipped),
            ShapeKind::Table(t) => {
                let rows: Vec<Value> = t
                    .rows
                    .iter()
                    .map(|r| Value::from(r.cells.iter().map(|c| body_lines(&c.text).into_iter().map(|(_, s)| s).collect::<Vec<_>>().join(" ")).collect::<Vec<_>>()))
                    .collect();
                if !rows.is_empty() {
                    o.tables.push(Value::from(rows));
                }
            }
            ShapeKind::Chart(_) | ShapeKind::Media(_) => *skipped += 1,
            _ => {
                if let Some(d) = &sh.diagram {
                    for n in &d.nodes {
                        let s = n.text.split_whitespace().collect::<Vec<_>>().join(" ");
                        if !s.is_empty() {
                            o.paras.push(json!([n.level, s, 1]));
                        }
                    }
                    continue;
                }
                let kind = sh.ph.as_ref().map(|p| p.kind);
                // ส่วนหัว/ท้าย/วันที่/เลขหน้า ไม่ใช่เนื้อหา
                if matches!(kind, Some(PhType::Date | PhType::Footer | PhType::SlideNum | PhType::Header)) {
                    continue;
                }
                let Some(t) = &sh.text else { continue };
                if matches!(kind, Some(PhType::Title | PhType::CtrTitle)) && o.title.is_empty() {
                    o.title = body_lines(t).iter().map(|(_, s)| s.as_str()).collect::<Vec<_>>().join(" ");
                    o.ph_title = true;
                    continue;
                }
                for (lv, s, b) in body_items(t, matches!(kind, Some(PhType::Body | PhType::Obj))) {
                    o.paras.push(json!([lv, s, b as u8]));
                }
            }
        }
    }
}

/// .pptx (หรือ .ppsx/.potx) → JSON ของโครงเรื่อง
#[wasm_bindgen]
pub fn read_pptx(bytes: &[u8]) -> Result<String, JsError> {
    if deckcraft_pptx::is_encrypted(bytes) {
        return Err(JsError::new("pptx:encrypted password-protected"));
    }
    let (p, _bad) = deckcraft_pptx::import_checked(bytes).map_err(|e| JsError::new(&format!("pptx:damaged {e}")))?;
    if p.slides.is_empty() {
        return Err(JsError::new("pptx:empty no slides"));
    }
    let mut skipped = 0u32;
    let slides: Vec<Value> = p
        .slides
        .iter()
        .map(|s| {
            let mut o = Out::default();
            walk(&mut o, &s.shapes, &mut skipped);
            // ไม่มีกล่องหัวข้อ (ไฟล์ที่สร้างด้วยกล่องข้อความล้วน เช่น PptxGenJS) = บรรทัดแรกที่ไม่มีจุดหัวข้อเป็นหัวข้อ
            if !o.ph_title && o.title.is_empty() && o.paras.first().is_some_and(|p| p[2] == 0) {
                o.title = o.paras.remove(0)[1].as_str().unwrap_or("").to_string();
            }
            let notes: Vec<String> = body_lines(&s.notes).into_iter().map(|(_, t)| t).collect();
            json!({"title": o.title, "paras": o.paras, "tables": o.tables, "notes": notes, "hidden": s.hidden})
        })
        .collect();
    Ok(json!({"slides": slides, "skipped": skipped}).to_string())
}
