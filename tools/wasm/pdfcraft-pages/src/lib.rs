//! แยกหน้า PDF — เรียกจาก pdf-pages-worker.js เท่านั้น (ปุ่ม "แยกหน้า PDF" ของ extract-text.html)
//! อ่านด้วย pdfcraft-cos (ซ่อม xref ที่เสียเอง, PDF ที่เข้ารหัสด้วยรหัสว่างเปิดได้) → pdfcraft-organize::split
//! (ต่อช่วงหน้า: คัดเฉพาะ object ที่หน้าใช้ + bookmark ในช่วง + ข้อมูลเอกสาร) → write_full
//! error = ข้อความ `pdf:<รหัส>` ให้ฝั่ง JS แปลงเป็นข้อความไทย/อังกฤษเอง:
//!   encrypted (ต้องใช้รหัสผ่าน/ระบบป้องกันที่ไม่รองรับ) · damaged (ไม่ใช่ PDF/อ่านโครงสร้างไม่ได้) · empty (ไม่มีหน้า) · other

use std::sync::Arc;

use pdfcraft_cos::{CosError, Document, SaveOptions, write_full};
use pdfcraft_organize::{OrganizeError, SplitBy};
use wasm_bindgen::prelude::*;

/// ไฟล์ที่ได้ต้องเหมือนเดิมทุกครั้งที่แยกไฟล์เดิม (ไม่ผสมค่าสุ่มจากเบราว์เซอร์ลงในรหัสไฟล์ /ID)
const ID_ENTROPY: [u8; 16] = *b"tanot-pdf-pages\0";

fn code_of(e: &OrganizeError) -> &'static str {
    match e {
        OrganizeError::Cos(CosError::NeedsPassword | CosError::WrongPassword | CosError::Security(_)) => "encrypted",
        OrganizeError::Cos(CosError::Poisoned | CosError::ReadOnlyLimit) => "other",
        OrganizeError::Cos(_) | OrganizeError::NoPageTree | OrganizeError::NoSuchPage(_) => "damaged",
        _ => "other",
    }
}

fn fail(e: OrganizeError) -> JsError {
    JsError::new(&format!("pdf:{} {e}", code_of(&e)))
}

/// เปิดไฟล์ + หาหน้า: page tree หาย/ชี้ไปที่ว่าง = รวบรวมหน้าจาก object /Type /Page ในไฟล์ใหม่
fn open(bytes: &[u8]) -> Result<(Document, usize), JsError> {
    let mut doc = Document::open(Arc::new(bytes.to_vec())).map_err(|e| fail(e.into()))?;
    let n = match pdfcraft_organize::page_count(&doc) {
        Ok(n) if n > 0 => n,
        _ => {
            pdfcraft_organize::recover_page_tree(&mut doc).map_err(fail)?;
            pdfcraft_organize::page_count(&doc).unwrap_or(0)
        }
    };
    if n == 0 {
        return Err(JsError::new("pdf:empty the document has no pages"));
    }
    Ok((doc, n))
}

/// จำนวนหน้า
#[wasm_bindgen]
pub fn page_count(bytes: &[u8]) -> Result<u32, JsError> {
    open(bytes).map(|(_, n)| n as u32)
}

/// แยกเป็นไฟล์ละ `every` หน้า (0 = 1) → Array ของ Uint8Array ตามลำดับหน้า
#[wasm_bindgen]
pub fn split(bytes: &[u8], every: u32) -> Result<js_sys::Array, JsError> {
    let (doc, _) = open(bytes)?;
    let parts = pdfcraft_organize::split(&doc, &SplitBy::PageCount(every.max(1) as usize)).map_err(fail)?;
    let opts = SaveOptions { id_entropy: Some(ID_ENTROPY), ..SaveOptions::default() };
    let out = js_sys::Array::new();
    for part in &parts {
        let b = write_full(part, &opts).map_err(|e| fail(e.into()))?;
        out.push(&js_sys::Uint8Array::from(b.as_slice()));
    }
    Ok(out)
}
