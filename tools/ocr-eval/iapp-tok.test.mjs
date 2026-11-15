// node iapp-tok.test.mjs <iapp-vocab.json> <ids.json: {"cases":[[id,...],...],"expect":["ข้อความ",...]}> — ข้อความคาดหวังมาจาก tokenizers (Python)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const Tok = createRequire(import.meta.url)('./iapp-tok.js');
const v = JSON.parse(readFileSync(process.argv[2], 'utf8')), c = JSON.parse(readFileSync(process.argv[3], 'utf8'));
let bad = 0;
c.cases.forEach((ids, i) => { const got = Tok.decode(v.tokens, ids); if (got !== c.expect[i]) { bad++; console.log('ต่างที่เคส', i, JSON.stringify(got.slice(0, 80)), 'vs', JSON.stringify(c.expect[i].slice(0, 80))); } });
console.log(bad ? `❌ ผิด ${bad}/${c.cases.length}` : `✅ ตรงทุกเคส (${c.cases.length})`);
process.exit(bad ? 1 : 0);
