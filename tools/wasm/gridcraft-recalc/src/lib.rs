//! คำนวณสูตรใน .xlsx ที่ไฟล์ไม่ได้เก็บค่าแคช (ไฟล์จาก openpyxl ฯลฯ) — เรียกจาก xlsx-recalc-worker.js เท่านั้น
//! read_xlsx → Calc::recalc_all → คืนค่าเฉพาะเซลล์ที่ขอ เป็นค่าดิบ (ตัวเลข/ข้อความ/บูลีน/error)
//! ไม่ใช้ข้อความที่จัดรูปจาก numfmt ของ GridCraft (ไม่รู้ปี พ.ศ./[$-th-TH]) — ส่งแค่รหัสรูปแบบ `z` ให้ฝั่ง JS ตัดสินเรื่องวันที่เอง

use gridcraft_calc::Calc;
use gridcraft_core::{CellRef, Value};
use wasm_bindgen::prelude::*;

const MAX_ROWS: u32 = 1_048_576;
const MAX_COLS: u32 = 16_384;

/// `sheets` = ชื่อชีต, `cells` = [ดัชนีใน sheets, แถว, คอลัมน์, …] (แถว/คอลัมน์เริ่ม 0)
/// คืน JSON `[{"sheet","r","c","t","v","z"?}]` เรียงตามที่ขอ — t: n ตัวเลข · s ข้อความ · b บูลีน · e error (v = "#DIV/0!" ฯลฯ) · z ว่าง
/// เซลล์ที่ชีตไม่มีหรืออยู่นอกตารางถูกข้าม
#[wasm_bindgen]
pub fn recalc(bytes: &[u8], sheets: Vec<String>, cells: &[u32]) -> Result<String, JsError> {
    let (mut wb, _) = gridcraft_xlsx::read_xlsx(bytes).map_err(|e| JsError::new(&e.to_string()))?;
    Calc::new().recalc_all(&mut wb);
    let idx: Vec<Option<usize>> = sheets.iter().map(|n| wb.sheet_index(n)).collect();
    let mut out = String::from("[");
    for q in cells.chunks_exact(3) {
        let (si, r, c) = (q[0] as usize, q[1], q[2]);
        let (Some(name), Some(Some(i))) = (sheets.get(si), idx.get(si)) else { continue };
        let Some(sh) = wb.sheet(*i) else { continue };
        if r >= MAX_ROWS || c >= MAX_COLS {
            continue;
        }
        let at = CellRef::new(r, c);
        let mut v = sh.value(at);
        if let Value::Array(a) = &v {
            v = a.get(0, 0).cloned().unwrap_or(Value::Empty);
        }
        if out.len() > 1 {
            out.push(',');
        }
        out.push_str("{\"sheet\":");
        json_str(&mut out, name);
        out.push_str(&format!(",\"r\":{r},\"c\":{c},"));
        match v {
            Value::Number(n) if n.is_finite() => {
                out.push_str(&format!("\"t\":\"n\",\"v\":{n}"));
                let z = wb.styles.get(sh.style_id(at)).num_fmt.as_str();
                if !z.eq_ignore_ascii_case("general") {
                    out.push_str(",\"z\":");
                    json_str(&mut out, z);
                }
            }
            Value::Number(_) => out.push_str("\"t\":\"e\",\"v\":\"#NUM!\""),
            Value::Text(s) => {
                out.push_str("\"t\":\"s\",\"v\":");
                json_str(&mut out, &s);
            }
            Value::Bool(b) => out.push_str(if b { "\"t\":\"b\",\"v\":true" } else { "\"t\":\"b\",\"v\":false" }),
            Value::Error(e) => {
                out.push_str("\"t\":\"e\",\"v\":");
                json_str(&mut out, e.as_str());
            }
            Value::Empty | Value::Array(_) => out.push_str("\"t\":\"z\",\"v\":null"),
        }
        out.push('}');
    }
    out.push(']');
    Ok(out)
}

fn json_str(out: &mut String, s: &str) {
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}
