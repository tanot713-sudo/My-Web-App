        const { useState, useEffect, useMemo, useRef } = React;
        const COURSE = JSON.parse(document.getElementById('course-data').textContent);

        // ── ภาษา UI (ไทย/อังกฤษ) — เนื้อหาบทเรียน/ข้อสอบ/โน้ตของผู้ใช้เป็นเนื้อหา ไม่แปล (data-i18n-skip) ──
        const T = OME_I18N.scope('lbe-business', {
            th: {
                openNav: 'เปิดเมนูหัวข้อ',
                closeNav: 'ปิดเมนู',
                allTopics: 'หัวข้อทั้งหมด',
                sync: 'ซิงก์',
                syncing: 'กำลังซิงก์...',
                syncConnecting: 'กำลังเชื่อมต่อ Google...',
                syncOk: 'ซิงก์สำเร็จ',
                back: 'กลับ Tanot',
                tabStream: 'สตรีม',
                tabWork: 'งานเรียน',
                tabReview: 'ทบทวน',
                tabExam: 'สอบรวม',
                tabNotes: 'โน้ตทั้งหมด',
                classroom: 'ห้องเรียน',
                progressAll: 'ความคืบหน้ารวม',
                ofTopics: '{done}/{total} หัวข้อ',
                reviewToday: 'ทบทวนวันนี้',
                noDue: 'ยังไม่มีข้อครบกำหนด',
                dueN: 'ข้อครบกำหนดทบทวน',
                startReview: 'เริ่มทบทวน',
                lastExam: 'สอบรวมล่าสุด',
                neverExam: 'ยังไม่เคยสอบ',
                startExamAll: 'เริ่มสอบรวม',
                examAgain: 'สอบอีกครั้ง',
                todo: 'งานที่ยังไม่เสร็จ',
                allDone: 'ทำครบทุกหัวข้อแล้ว เยี่ยมมาก!',
                noDueReview: 'ยังไม่มีข้อครบกำหนดทบทวน',
                reviewDone: 'ทบทวนครบ {n} ข้อแล้ว!',
                backStream: 'กลับหน้าสตรีม',
                reviewOf: 'ทบทวน {i} / {n}',
                yourAnswer: 'คำตอบของคุณ...',
                reveal: 'ดูเฉลย',
                answerKey: 'เฉลย',
                recalled: 'จำได้ (+30 XP)',
                notYetTomorrow: 'ยังไม่ได้ (ถามใหม่พรุ่งนี้)',
                start10: 'เริ่มสอบ 10 ข้อ',
                start20: 'เริ่มสอบ 20 ข้อ',
                recent: 'ผลสอบล่าสุด',
                scoreIs: 'ได้ {s} / {n} คะแนน',
                timeUsed: 'ใช้เวลา {t} นาที',
                qOf: 'ข้อ {i} / {n}',
                typeAns: 'พิมพ์คำตอบของคุณ...',
                submit: 'ส่งคำตอบ',
                correct: 'ตอบถูก',
                wrong: 'ยังไม่ถูก',
                resultTime: '{score}/{total} ({m}:{s} นาที)',
                searchNotes: 'ค้นหาในโน้ตทุกหัวข้อ...',
                noMatch: 'ไม่พบโน้ตที่ตรงกับคำค้น',
                noNotes: 'ยังไม่มีโน้ต',
                tabSummary: 'สรุปเนื้อหา',
                tabQuiz: 'แบบฝึกเขียนตอบ',
                tabMyNotes: 'โน้ตของฉัน',
                edit: 'แก้ไข',
                preview: 'ดูตัวอย่าง',
                savedAt: 'บันทึกล่าสุด {d}',
                emptyPreview: 'ยังไม่มีเนื้อหา',
                notePh: 'จดสรุป คำจำกัดความ หรือประเด็นที่อยากจำไว้สำหรับหัวข้อนี้...',
                keyPoints: 'ประเด็นสำคัญ',
                noContent: 'ยังไม่มีเนื้อหา',
                qNofN: 'คำถามที่ {i} จาก {n}',
                typeHere: 'พิมพ์คำตอบของคุณที่นี่...',
                refAnswer: 'คำตอบอ้างอิง',
                correctXp: 'ตอบถูก (+100 XP)',
                markedCorrect: 'บันทึกว่าตอบถูกแล้ว',
                markedWrong: 'บันทึกว่ายังไม่ถูก',
                savedAns: 'บันทึกคำตอบแล้ว (+50 XP)',
                next: 'ข้อต่อไป',
                seeSummary: 'ดูสรุปผล',
                allWritten: 'เขียนตอบครบทุกข้อแล้ว!',
                topicLabel: 'หัวข้อ',
                nQuestions: '{n} ข้อ',
                retry: 'ทำแบบฝึกอีกครั้ง',
                reflect1: 'อธิบายหลักการสำคัญของ "{t}" ตามความเข้าใจของคุณ',
                reflect2: 'ยกตัวอย่างสถานการณ์จริงที่ต้องใช้ความรู้เรื่อง "{t}"',
                eGis: 'โหลด Google Identity Services ไม่สำเร็จ ลองรีเฟรชหน้าใหม่',
                eFolderFind: 'ค้นหาโฟลเดอร์ไม่สำเร็จ (HTTP {c})',
                eFolderMake: 'สร้างโฟลเดอร์ไม่สำเร็จ (HTTP {c})',
                eFileFind: 'ค้นหาไฟล์ไม่สำเร็จ (HTTP {c})',
                eDownload: 'ดาวน์โหลดไม่สำเร็จ (HTTP {c})',
                eUpload: 'บันทึกขึ้น Drive ไม่สำเร็จ (HTTP {c})',
                title: 'ห้องเรียนธุรกิจ',
                subj_business: 'ธุรกิจและการบริหาร'
            },
            en: {
                openNav: 'Open topics menu',
                closeNav: 'Close menu',
                allTopics: 'All topics',
                sync: 'Sync',
                syncing: 'Syncing...',
                syncConnecting: 'Connecting to Google...',
                syncOk: 'Sync complete',
                back: 'Back to Tanot',
                tabStream: 'Stream',
                tabWork: 'Coursework',
                tabReview: 'Review',
                tabExam: 'Exam',
                tabNotes: 'All notes',
                classroom: 'Classroom',
                progressAll: 'Overall progress',
                ofTopics: '{done}/{total} topics',
                reviewToday: 'Review today',
                noDue: 'Nothing due yet',
                dueN: 'items due for review',
                startReview: 'Start review',
                lastExam: 'Latest exams',
                neverExam: 'No exams yet',
                startExamAll: 'Start exam',
                examAgain: 'Take it again',
                todo: 'Unfinished topics',
                allDone: 'All topics done — great work!',
                noDueReview: 'No items due for review',
                reviewDone: 'Reviewed all {n} items!',
                backStream: 'Back to stream',
                reviewOf: 'Review {i} / {n}',
                yourAnswer: 'Your answer...',
                reveal: 'Show answer',
                answerKey: 'Answer',
                recalled: 'Got it (+30 XP)',
                notYetTomorrow: 'Not yet (ask again tomorrow)',
                start10: 'Start 10 questions',
                start20: 'Start 20 questions',
                recent: 'Recent results',
                scoreIs: 'Scored {s} / {n}',
                timeUsed: 'Time taken {t}',
                qOf: 'Question {i} / {n}',
                typeAns: 'Type your answer...',
                submit: 'Submit answer',
                correct: 'Correct',
                wrong: 'Not yet',
                resultTime: '{score}/{total} ({m}:{s})',
                searchNotes: 'Search notes across all topics...',
                noMatch: 'No notes match your search',
                noNotes: 'No notes yet',
                tabSummary: 'Summary',
                tabQuiz: 'Written practice',
                tabMyNotes: 'My notes',
                edit: 'Edit',
                preview: 'Preview',
                savedAt: 'Last saved {d}',
                emptyPreview: 'Nothing here yet',
                notePh: 'Write summaries, definitions or points to remember for this topic...',
                keyPoints: 'Key points',
                noContent: 'No content yet',
                qNofN: 'Question {i} of {n}',
                typeHere: 'Type your answer here...',
                refAnswer: 'Reference answer',
                correctXp: 'Correct (+100 XP)',
                markedCorrect: 'Marked as correct',
                markedWrong: 'Marked as not yet correct',
                savedAns: 'Answer saved (+50 XP)',
                next: 'Next question',
                seeSummary: 'See results',
                allWritten: 'You answered every question!',
                topicLabel: 'Topic',
                nQuestions: '{n} questions',
                retry: 'Practice again',
                reflect1: 'Explain the key principle of "{t}" in your own understanding',
                reflect2: 'Give a real situation where knowing "{t}" is needed',
                eGis: 'Could not load Google Identity Services — try refreshing the page',
                eFolderFind: 'Could not search folders (HTTP {c})',
                eFolderMake: 'Could not create folder (HTTP {c})',
                eFileFind: 'Could not search files (HTTP {c})',
                eDownload: 'Download failed (HTTP {c})',
                eUpload: 'Could not save to Drive (HTTP {c})',
                title: 'Business classroom',
                subj_business: 'Business & management'
            },
        });
        window.OME_PAGE_LIVE_LANG = true;
        // ข้อผิดพลาดที่พกคีย์ข้อความ — บรรทัดสถานะแปลสดตอนสลับภาษา (ไม่เก็บข้อความที่แปลแล้วไว้)
        const tErr = (key, vars) => Object.assign(new Error(T(key, vars)), { tkey: key, tvars: vars });
        const statusText = st => !st ? '' : st.tkey ? T(st.tkey, st.tvars) : (st.raw || '');
        const subjLabel = s => T('subj_' + (s.subjId || s.id));

        // ไอคอน lucide ต้องห่อใน span ที่ React เป็นเจ้าของ — ไม่งั้นตอน lucide แทนที่ <i> ด้วย <svg>
        // React จะ unmount ไม่ได้ (removeChild error) เวลาสลับหัวข้อ
        const icon = (name, cls) => () => (
            <span className="inline-flex" dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}" class="${cls}"></i>` }} />
        );
        const Play = icon('play-circle', 'w-5 h-5');
        const Check = icon('check-circle-2', 'w-5 h-5 text-success');
        const Clock = icon('clock', 'w-4 h-4');
        const Bookmark = icon('bookmark', 'w-4 h-4');
        const Trophy = icon('trophy', 'w-4 h-4 text-accent');
        const Target = icon('target', 'w-4 h-4');
        const Scale = icon('scale', 'w-4 h-4');
        const Briefcase = icon('briefcase', 'w-4 h-4');
        const Wrench = icon('wrench', 'w-4 h-4');
        const ChevronDown = icon('chevron-down', 'w-4 h-4');
        const PenLine = icon('pen-line', 'w-5 h-5');
        const Menu = icon('menu', 'w-5 h-5');
        const CloseIcon = icon('x', 'w-5 h-5');
        const NotebookIcon = icon('notebook-pen', 'w-5 h-5');
        const HeadIcon = icon('briefcase', 'w-5 h-5');

        // สร้างรายการบทเรียนทั้งหมดจากข้อมูลจริงของ Tanot (กฎหมาย 16 หัวข้อ, ธุรกิจ 12 หัวข้อ, วิศวกรรม 13 หัวข้อ)
        //
        // ★ วิธีเพิ่มเนื้อหาให้หัวข้อกฎหมาย/วิศวกรรม: แก้ JSON ใน <script id="course-data"> ด้านบน
        //   เปลี่ยนรายการจาก  {"id": "civil-law", "title": "กฎหมายแพ่ง"}
        //   เป็น              {"id": "civil-law", "title": "กฎหมายแพ่ง",
        //                      "overview": "สรุปภาพรวม...",
        //                      "keyConcepts": ["ประเด็นที่ 1", "ประเด็นที่ 2"],
        //                      "quiz": [{"q": "คำถาม?", "options": ["ก","ข","ค","ง"], "answer": 0}]}
        //   ใส่แค่บางส่วนก็ได้ — มี overview/keyConcepts จะขึ้นในแท็บ "สรุปเนื้อหา" ทันที
        //   ถ้ามี quiz หัวข้อนั้นจะกลายเป็นแบบฝึกมีเฉลย และเข้าระบบทบทวนเว้นช่วง + สอบรวมอัตโนมัติ
        const enrich = t => ({
            id: t.id, title: t.title,
            kind: (t.quiz && t.quiz.length) ? 'quiz' : 'reflection',
            data: t,
        });
        const hasSummary = t => !!(t.data && (t.data.overview || t.data.lesson || (t.data.keyConcepts || []).length));
        const SUBJECTS = [
            { id: 'business', label: 'ธุรกิจและการบริหาร', icon: Briefcase, topics: Object.entries(COURSE.business).map(([id, t]) => enrich({ ...t, id })) },
        ];

        function reflectionPrompts(title) {
            return [1, 2].map(n => ({
                q: T('reflect' + n, { t: title }),
                reflect: T('reflect' + n, { t: '\u0000' }).split('\u0000'),
            }));
        }

        function loadXp() {
            try { return JSON.parse(localStorage.getItem('lbe:business:xp') || '1250'); } catch { return 1250; }
        }
        function saveXp(v) { localStorage.setItem('lbe:business:xp', JSON.stringify(v)); }

        function loadWritten() {
            try { return JSON.parse(localStorage.getItem('lbe:business:written') || '{}'); } catch { return {}; }
        }
        function saveWritten(v) { localStorage.setItem('lbe:business:written', JSON.stringify(v)); }

        function loadCompleted() {
            try { return JSON.parse(localStorage.getItem('lbe:business:completed') || '{}'); } catch { return {}; }
        }
        function saveCompleted(v) { localStorage.setItem('lbe:business:completed', JSON.stringify(v)); }

        function loadNotes() {
            try { return JSON.parse(localStorage.getItem('lbe:business:notes') || '{}'); } catch { return {}; }
        }
        function saveNotes(v) { localStorage.setItem('lbe:business:notes', JSON.stringify(v)); }

        function mergeNotes(a, b) {
            const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
            const out = {};
            keys.forEach(k => {
                const na = a && a[k], nb = b && b[k];
                if (!na) { out[k] = nb; return; }
                if (!nb) { out[k] = na; return; }
                out[k] = (na.updatedAt || 0) >= (nb.updatedAt || 0) ? na : nb;
            });
            return out;
        }

        // ── คลังข้อสอบรวม (เฉพาะข้อที่มีเฉลย) ใช้ทั้งโหมดทบทวนและสอบรวม ─────────
        const QUESTION_BANK = [];
        SUBJECTS.forEach(s => s.topics.forEach(t => {
            if (t.kind !== 'quiz') return;
            t.data.quiz.forEach((q, i) => QUESTION_BANK.push({
                qKey: `${s.id}:${t.id}:${i}`, subjId: s.id, topicId: t.id, topicTitle: t.title,
                q: q.q, refAnswer: q.options[q.answer],
            }));
        }));
        const QUESTION_BY_KEY = Object.fromEntries(QUESTION_BANK.map(q => [q.qKey, q]));

        // ── Spaced repetition: ตอบถูกเลื่อนรอบ 1→3→7→14→30 วัน, ตอบผิดถอยกลับ 1 วัน ──
        const SRS_STEPS = [1, 3, 7, 14, 30];
        const DAY_MS = 86400000;
        function nextSrs(prev, correct) {
            let interval;
            if (!correct) interval = 1;
            else {
                const i = SRS_STEPS.indexOf(prev ? prev.interval : -1);
                interval = SRS_STEPS[Math.min(i + 1, SRS_STEPS.length - 1)];
            }
            return { interval, due: Date.now() + interval * DAY_MS };
        }

        function loadSrs() {
            try { return JSON.parse(localStorage.getItem('lbe:business:srs') || '{}'); } catch { return {}; }
        }
        function saveSrs(v) { localStorage.setItem('lbe:business:srs', JSON.stringify(v)); }
        function mergeSrs(a, b) {
            const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
            const out = {};
            keys.forEach(k => {
                const va = a && a[k], vb = b && b[k];
                out[k] = !va ? vb : !vb ? va : ((va.due || 0) >= (vb.due || 0) ? va : vb);
            });
            return out;
        }

        function loadExams() {
            try { return JSON.parse(localStorage.getItem('lbe:business:exams') || '[]'); } catch { return []; }
        }
        function saveExams(v) { localStorage.setItem('lbe:business:exams', JSON.stringify(v)); }
        function mergeExams(a, b) {
            const seen = {};
            [...(a || []), ...(b || [])].forEach(e => { if (e && e.date) seen[e.date] = e; });
            return Object.values(seen).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 50);
        }

        function shuffled(arr) {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        // ── Markdown-lite สำหรับโน้ต (escape ก่อนเสมอ กัน XSS) ─────────────────
        function escapeHtml(s) {
            return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }
        function mdToHtml(src) {
            const inline = t => t
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                .replace(/==([^=]+)==/g, '<mark>$1</mark>');
            let html = '', inUl = false, inOl = false;
            const closeLists = () => {
                if (inUl) { html += '</ul>'; inUl = false; }
                if (inOl) { html += '</ol>'; inOl = false; }
            };
            escapeHtml(src || '').split('\n').forEach(raw => {
                const l = raw.trimEnd();
                if (/^###\s/.test(l)) { closeLists(); html += '<h4>' + inline(l.slice(4)) + '</h4>'; }
                else if (/^##\s/.test(l)) { closeLists(); html += '<h3>' + inline(l.slice(3)) + '</h3>'; }
                else if (/^#\s/.test(l)) { closeLists(); html += '<h2>' + inline(l.slice(2)) + '</h2>'; }
                else if (/^[-*]\s/.test(l)) {
                    if (!inUl) { closeLists(); html += '<ul>'; inUl = true; }
                    html += '<li>' + inline(l.slice(2)) + '</li>';
                }
                else if (/^\d+\.\s/.test(l)) {
                    if (!inOl) { closeLists(); html += '<ol>'; inOl = true; }
                    html += '<li>' + inline(l.replace(/^\d+\.\s/, '')) + '</li>';
                }
                else if (l === '') closeLists();
                else { closeLists(); html += '<p>' + inline(l) + '</p>'; }
            });
            closeLists();
            return html;
        }

        // ── Google Drive sync (ไม่บังคับ) — ซิงก์ XP/ความคืบหน้าข้ามอุปกรณ์ ──────────
        const DRIVE_CLIENT_ID = '497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com';
        const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
        const DRIVE_FOLDER_NAME = 'OME_Progress';
        const DRIVE_FILE_NAME = 'lbe-business-progress.json';

        const DriveSync = {
            tokenClient: null,
            accessToken: null,
            folderId: null,
            ensureAuth() {
                return new Promise((resolve, reject) => {
                    if (!window.google || !google.accounts || !google.accounts.oauth2) {
                        reject(tErr('eGis'));
                        return;
                    }
                    if (!this.tokenClient) {
                        this.tokenClient = google.accounts.oauth2.initTokenClient({
                            client_id: DRIVE_CLIENT_ID,
                            scope: DRIVE_SCOPE,
                            callback: (resp) => {
                                if (resp.error) { reject(new Error(resp.error)); return; }
                                this.accessToken = resp.access_token;
                                resolve(this.accessToken);
                            },
                        });
                    }
                    this.tokenClient.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
                });
            },
            async ensureFolder() {
                if (this.folderId) return this.folderId;
                const q = encodeURIComponent(`name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
                const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
                    { headers: { Authorization: 'Bearer ' + this.accessToken } });
                if (!res.ok) throw tErr('eFolderFind', { c: res.status });
                const data = await res.json();
                if (data.files && data.files.length) { this.folderId = data.files[0].id; return this.folderId; }
                const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + this.accessToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
                });
                if (!createRes.ok) throw tErr('eFolderMake', { c: createRes.status });
                const createData = await createRes.json();
                this.folderId = createData.id;
                return this.folderId;
            },
            async findFile(name, folderId) {
                const q = encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`);
                const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
                    { headers: { Authorization: 'Bearer ' + this.accessToken } });
                if (!res.ok) throw tErr('eFileFind', { c: res.status });
                const data = await res.json();
                return (data.files && data.files[0]) || null;
            },
            async downloadFile(fileId) {
                const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                    { headers: { Authorization: 'Bearer ' + this.accessToken } });
                if (!res.ok) throw tErr('eDownload', { c: res.status });
                return res.json();
            },
            async uploadFile(name, folderId, existingId, obj) {
                const form = new FormData();
                const metadata = existingId ? {} : { name, parents: [folderId] };
                form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                form.append('file', new Blob([JSON.stringify(obj)], { type: 'application/json' }));
                const url = existingId
                    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
                    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
                const res = await fetch(url, { method: existingId ? 'PATCH' : 'POST',
                    headers: { Authorization: 'Bearer ' + this.accessToken }, body: form });
                if (!res.ok) throw tErr('eUpload', { c: res.status });
                return res.json();
            },
        };

        function App() {
            const initialSubject = 'business';
            const [view, setView] = useState('stream'); // 'stream' | 'classwork'
            const [activeSubject, setActiveSubject] = useState(initialSubject);
            const [activeTopicId, setActiveTopicId] = useState(SUBJECTS.find(s => s.id === initialSubject).topics[0].id);
            const [activeTab, setActiveTab] = useState('quiz');
            const [openGroups, setOpenGroups] = useState({ law: initialSubject === 'law', business: initialSubject === 'business', engineering: initialSubject === 'engineering' });
            const [qIndex, setQIndex] = useState(0);
            const [answerText, setAnswerText] = useState('');
            const [revealed, setRevealed] = useState(false);
            const [selfMark, setSelfMark] = useState(null); // 'correct' | 'wrong'
            const [xp, setXp] = useState(loadXp());
            const [written, setWritten] = useState(loadWritten());
            const [completed, setCompleted] = useState(loadCompleted());
            const [notes, setNotes] = useState(loadNotes());
            const [srs, setSrs] = useState(loadSrs());
            const [exams, setExams] = useState(loadExams());
            const [syncing, setSyncing] = useState(false);
            const [syncStatus, setSyncStatus] = useState(null);
            const [mobileNavOpen, setMobileNavOpen] = useState(false);
            const [lang, setLang] = useState(OME_I18N.lang());
            useEffect(() => OME_LANG.onChange(l => setLang(l)), []);
            useEffect(() => { document.title = T('title') + ' | Tanot'; }, [lang]);

            // เซสชันทบทวน (spaced repetition)
            const [revList, setRevList] = useState([]);       // qKey[]
            const [revIndex, setRevIndex] = useState(0);
            const [revAnswer, setRevAnswer] = useState('');
            const [revRevealed, setRevRevealed] = useState(false);

            // เซสชันสอบรวม
            const [examList, setExamList] = useState([]);     // question objects
            const [examIndex, setExamIndex] = useState(0);
            const [examAnswer, setExamAnswer] = useState('');
            const [examRevealed, setExamRevealed] = useState(false);
            const [examScore, setExamScore] = useState(0);
            const [examStart, setExamStart] = useState(null);

            // โน้ต: โหมดพรีวิว + ค้นหาในหน้ารวมโน้ต
            const [notePreview, setNotePreview] = useState(false);
            const [notesQuery, setNotesQuery] = useState('');

            useEffect(() => { lucide.createIcons(); });
            // XP กลาง (learn-core.js): ส่งเฉพาะส่วนที่เพิ่มจากการฝึกในหน้านี้ (ไม่นับตอนโหลดค่าเดิม/รวมค่าจาก Drive)
            // ต้องอยู่ก่อน effect ที่บันทึก xp — ให้ learn-core ถ่ายยอดเดิมก่อนคีย์เดิมรวม XP ก้อนนี้
            const xpPrevRef = useRef(xp);
            const xpFromDriveRef = useRef(false);
            useEffect(() => {
                const gained = xp - xpPrevRef.current;
                xpPrevRef.current = xp;
                if (xpFromDriveRef.current) { xpFromDriveRef.current = false; return; }
                if (gained > 0 && window.LearnCore) window.LearnCore.award('biz', gained);
            }, [xp]);
            useEffect(() => { saveXp(xp); }, [xp]);
            useEffect(() => { saveWritten(written); }, [written]);
            useEffect(() => { saveCompleted(completed); }, [completed]);
            useEffect(() => { saveNotes(notes); }, [notes]);
            useEffect(() => { saveSrs(srs); }, [srs]);
            useEffect(() => { saveExams(exams); }, [exams]);

            const dueKeys = Object.keys(srs).filter(k => QUESTION_BY_KEY[k] && srs[k].due <= Date.now());

            const startReview = () => {
                setRevList(shuffled(dueKeys));
                setRevIndex(0); setRevAnswer(''); setRevRevealed(false);
                setView('review');
            };
            const markReview = (correct) => {
                const key = revList[revIndex];
                setSrs(s => ({ ...s, [key]: nextSrs(s[key], correct) }));
                if (correct) setXp(x => x + 30);
                setRevIndex(i => i + 1); setRevAnswer(''); setRevRevealed(false);
            };

            const startExam = (n) => {
                setExamList(shuffled(QUESTION_BANK).slice(0, n));
                setExamIndex(0); setExamAnswer(''); setExamRevealed(false);
                setExamScore(0); setExamStart(Date.now());
                setView('exam');
            };
            const markExam = (correct) => {
                const q = examList[examIndex];
                setSrs(s => ({ ...s, [q.qKey]: nextSrs(s[q.qKey], correct) }));
                if (correct) { setExamScore(sc => sc + 1); setXp(x => x + 20); }
                const isLast = examIndex + 1 >= examList.length;
                if (isLast) {
                    const finalScore = examScore + (correct ? 1 : 0);
                    setExams(ex => mergeExams(ex, [{
                        date: new Date().toISOString(), score: finalScore,
                        total: examList.length, sec: Math.round((Date.now() - examStart) / 1000),
                    }]));
                }
                setExamIndex(i => i + 1); setExamAnswer(''); setExamRevealed(false);
            };

            const syncNow = async () => {
                setSyncing(true);
                setSyncStatus({ tkey: 'syncConnecting' });
                try {
                    await DriveSync.ensureAuth();
                    setSyncStatus({ tkey: 'syncing' });
                    const folderId = await DriveSync.ensureFolder();
                    const existing = await DriveSync.findFile(DRIVE_FILE_NAME, folderId);
                    const remote = existing ? await DriveSync.downloadFile(existing.id) : null;

                    const mergedXp = Math.max(xp, remote?.xp || 0);
                    const mergedCompleted = { ...(remote?.completed || {}), ...completed };
                    const mergedWritten = { ...(remote?.written || {}), ...written };
                    const mergedNotes = mergeNotes(remote?.notes, notes);
                    const mergedSrs = mergeSrs(remote?.srs, srs);
                    const mergedExams = mergeExams(remote?.exams, exams);

                    if (mergedXp !== xp) xpFromDriveRef.current = true;
                    setXp(mergedXp);
                    setCompleted(mergedCompleted);
                    setWritten(mergedWritten);
                    setNotes(mergedNotes);
                    setSrs(mergedSrs);
                    setExams(mergedExams);

                    await DriveSync.uploadFile(DRIVE_FILE_NAME, folderId, existing?.id,
                        { xp: mergedXp, completed: mergedCompleted, written: mergedWritten, notes: mergedNotes,
                          srs: mergedSrs, exams: mergedExams, savedAt: new Date().toISOString() });
                    setSyncStatus({ tkey: 'syncOk' });
                } catch (e) {
                    setSyncStatus(e && e.tkey ? { tkey: e.tkey, tvars: e.tvars } : { raw: '' + (e.message || e) });
                } finally {
                    setSyncing(false);
                }
            };

            const subject = SUBJECTS.find(s => s.id === activeSubject);
            const topic = subject.topics.find(t => t.id === activeTopicId) || subject.topics[0];

            const questions = useMemo(() => {
                if (topic.kind === 'quiz') {
                    return topic.data.quiz.map(q => ({ q: q.q, refAnswer: q.options[q.answer], hasKey: true }));
                }
                return reflectionPrompts(topic.title).map(p => ({ q: p.q, reflect: p.reflect, refAnswer: null, hasKey: false }));
            }, [topic, lang]);

            const level = Math.floor(xp / 250) + 1;

            const noteKey = `${activeSubject}:${topic.id}`;
            const noteText = (notes[noteKey] && notes[noteKey].text) || '';
            const updateNote = (text) => setNotes(n => ({ ...n, [noteKey]: { text, updatedAt: Date.now() } }));

            const allTopics = useMemo(() => SUBJECTS.flatMap(s => s.topics.map(t => ({ subjId: s.id, subjLabel: s.label, ...t }))), []);
            const topicByKey = useMemo(() => Object.fromEntries(allTopics.map(t => [`${t.subjId}:${t.id}`, t])), []);
            const totalTopics = allTopics.length;
            const completedCount = allTopics.filter(t => completed[`${t.subjId}:${t.id}`]).length;
            const todoTopics = allTopics.filter(t => !completed[`${t.subjId}:${t.id}`]);
            const subjectStats = SUBJECTS.map(s => ({
                ...s,
                done: s.topics.filter(t => completed[`${s.id}:${t.id}`]).length,
                total: s.topics.length,
            }));

            const selectTopic = (subjId, topicId) => {
                setActiveSubject(subjId);
                setActiveTopicId(topicId);
                setActiveTab('quiz');
                setQIndex(0);
                setAnswerText('');
                setRevealed(false);
                setSelfMark(null);
                setView('classwork');
                setMobileNavOpen(false);
            };

            const openSubject = (subjId) => {
                setActiveSubject(subjId);
                setOpenGroups(g => ({ ...g, [subjId]: true }));
                setView('classwork');
            };

            const submitAnswer = () => {
                if (!answerText.trim()) return;
                setRevealed(true);
                const key = `${topic.id}:${qIndex}`;
                setWritten(w => ({ ...w, [key]: answerText.trim() }));
                if (!questions[qIndex].hasKey) setXp(x => x + 50);
            };

            const markSelf = (correct) => {
                setSelfMark(correct ? 'correct' : 'wrong');
                if (correct) setXp(x => x + 100);
                // เข้าคิวทบทวนแบบเว้นช่วง (เฉพาะข้อที่มีเฉลย)
                if (topic.kind === 'quiz') {
                    const key = `${activeSubject}:${topic.id}:${qIndex}`;
                    setSrs(s => ({ ...s, [key]: nextSrs(s[key], correct) }));
                }
            };

            const nextQuestion = () => {
                setQIndex(i => i + 1);
                setAnswerText('');
                setRevealed(false);
                setSelfMark(null);
            };

            const restartTopic = () => {
                setQIndex(0);
                setAnswerText('');
                setRevealed(false);
                setSelfMark(null);
            };

            const isDone = qIndex >= questions.length;

            useEffect(() => {
                if (!isDone) return;
                const key = `${activeSubject}:${topic.id}`;
                if (!completed[key]) setCompleted(c => ({ ...c, [key]: true }));
            }, [isDone, activeSubject, topic.id]);

            return (
                <div className="lbe-app h-[calc(100vh-48px)] w-full flex flex-col bg-slate-50 font-sans">

                    <header className="bg-white border-b border-slate-200 flex items-center flex-wrap gap-x-3 gap-y-2 justify-between px-4 sm:px-6 py-2 shrink-0 z-10">
                        <div className="flex items-center gap-2 min-w-0">
                            <button data-k="menu" onClick={() => setMobileNavOpen(true)} className="btn ghost icon md:hidden -ml-2" aria-label={T('openNav')}>
                                <Menu />
                            </button>
                            <span className="lbe-headicon"><HeadIcon /></span>
                            <h1 className="text-lg font-bold">{T('title')} <span className="hidden sm:inline text-slate-400 font-normal">| Tanot</span></h1>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="badge warn"><Trophy /> <span>Level {level}</span> <span>({xp} XP)</span></span>
                            <button data-k="sync" onClick={syncNow} disabled={syncing} className="btn sm">
                                {syncing ? T('syncing') : <>{T('sync')}<span className="hidden sm:inline"> Google Drive</span></>}
                            </button>
                            {syncStatus && <span className="hidden sm:inline text-sm text-slate-500">{statusText(syncStatus)}</span>}
                            <a href="./index.html" className="btn ghost sm">&larr; {T('back')}</a>
                        </div>
                    </header>

                    <div className="tabs bg-white px-2 sm:px-4 shrink-0">
                        <button data-k="tab-stream" onClick={() => setView('stream')} aria-current={view === 'stream' ? 'page' : undefined} className={`tab${view === 'stream' ? ' on' : ''}`}>{T('tabStream')}</button>
                        <button data-k="tab-work" onClick={() => setView('classwork')} aria-current={view === 'classwork' ? 'page' : undefined} className={`tab${view === 'classwork' ? ' on' : ''}`}>{T('tabWork')}</button>
                        <button data-k="tab-review" onClick={startReview} aria-current={view === 'review' ? 'page' : undefined} className={`tab${view === 'review' ? ' on' : ''} inline-flex items-center gap-2`}>
                            {T('tabReview')}
                            {dueKeys.length > 0 && <span className="badge accent">{dueKeys.length}</span>}
                        </button>
                        <button data-k="tab-exam" onClick={() => { setExamList([]); setExamIndex(0); setView('exam'); }} aria-current={view === 'exam' ? 'page' : undefined} className={`tab${view === 'exam' ? ' on' : ''}`}>{T('tabExam')}</button>
                        <button data-k="tab-notes" onClick={() => setView('allnotes')} aria-current={view === 'allnotes' ? 'page' : undefined} className={`tab${view === 'allnotes' ? ' on' : ''}`}>{T('tabNotes')}</button>
                    </div>

                    {view === 'stream' ? (
                    <div className="flex-1 overflow-y-auto">
                        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
                            <section className="card">
                                <p className="text-sm text-slate-500 mb-1">{T('classroom')}</p>
                                <h2 className="text-xl font-bold mb-4">{subjectStats.length === 1 ? subjLabel(subjectStats[0]) : T('title')}</h2>
                                <div className="max-w-sm">
                                    <div className="flex justify-between text-sm text-slate-500 mb-1">
                                        <span>{T('progressAll')}</span><span>{completedCount}/{totalTopics}</span>
                                    </div>
                                    <div className="meter"><i style={{width: `${totalTopics ? (completedCount / totalTopics * 100) : 0}%`}}></i></div>
                                </div>
                            </section>

                            <div className={`grid grid-cols-1 gap-4 ${subjectStats.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                                {subjectStats.map(s => (
                                    <button key={s.id} data-k="subj" data-sid={s.id} onClick={() => openSubject(s.id)} className="stat-card">
                                        <div className="flex items-center gap-2 text-slate-500"><s.icon /><span className="text-sm font-bold">{subjLabel(s)}</span></div>
                                        <div className="text-lg font-bold text-slate-800">{T('ofTopics', { done: s.done, total: s.total })}</div>
                                        <div className="meter sm"><i style={{width: `${s.total ? (s.done / s.total * 100) : 0}%`}}></i></div>
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <section className="card">
                                    <h3 className="font-bold mb-3 flex items-center gap-2"><Clock /> {T('reviewToday')}</h3>
                                    {dueKeys.length === 0 ? (
                                        <p className="text-sm text-slate-500">{T('noDue')}</p>
                                    ) : (
                                        <>
                                            <p className="mb-4"><span className="text-3xl font-bold text-slate-800">{dueKeys.length}</span> <span className="text-sm text-slate-500">{T('dueN')}</span></p>
                                            <button data-k="startReview" onClick={startReview} className="btn primary">{T('startReview')}</button>
                                        </>
                                    )}
                                </section>
                                <section className="card">
                                    <h3 className="font-bold mb-3 flex items-center gap-2"><Trophy /> {T('lastExam')}</h3>
                                    {exams.length === 0 ? (
                                        <>
                                            <p className="text-sm text-slate-500 mb-4">{T('neverExam')}</p>
                                            <button onClick={() => { setExamList([]); setExamIndex(0); setView('exam'); }} className="btn primary">{T('startExamAll')}</button>
                                        </>
                                    ) : (
                                        <>
                                            {exams.slice(0, 3).map((e, i) => (
                                                <div key={i} className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                                                    <span className="text-slate-500">{OME_I18N.date(e.date)}</span>
                                                    <span className={`badge ${e.score / e.total >= 0.7 ? 'ok' : ''}`}>{e.score}/{e.total}</span>
                                                </div>
                                            ))}
                                            <button onClick={() => { setExamList([]); setExamIndex(0); setView('exam'); }} className="btn primary mt-3">{T('examAgain')}</button>
                                        </>
                                    )}
                                </section>
                            </div>

                            <section className="card">
                                <h3 className="font-bold mb-3 flex items-center gap-2"><Target /> {T('todo')}</h3>
                                {todoTopics.length === 0 ? (
                                    <p className="text-sm text-slate-500">{T('allDone')}</p>
                                ) : (
                                    <div className="-mx-2">
                                        {todoTopics.slice(0, 6).map(t => (
                                            <button key={`${t.subjId}:${t.id}`} data-k="todo" onClick={() => selectTopic(t.subjId, t.id)} className="list-row !border-0 w-full text-left">
                                                <span className="grow leading-tight" data-i18n-skip>{t.title}</span>
                                                <span className="text-xs font-bold text-slate-500 shrink-0 text-right max-w-[40%]">{subjLabel(t)}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                    ) : view === 'review' ? (
                    <div className="flex-1 overflow-y-auto">
                        <div className="max-w-2xl mx-auto p-4 sm:p-6">
                            {revIndex >= revList.length ? (
                                <section className="card text-center">
                                    {revList.length === 0 ? (
                                        <h2 className="text-xl font-bold mb-6">{T('noDueReview')}</h2>
                                    ) : (
                                        <>
                                            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trophy /></div>
                                            <h2 className="text-xl font-bold mb-6">{T('reviewDone', { n: revList.length })}</h2>
                                        </>
                                    )}
                                    <button onClick={() => setView('stream')} className="btn primary">{T('backStream')}</button>
                                </section>
                            ) : (() => {
                                const rq = QUESTION_BY_KEY[revList[revIndex]];
                                return (
                                <section className="card">
                                    <div className="flex justify-between items-center gap-2 flex-wrap mb-4">
                                        <span className="text-sm font-bold text-slate-500">{T('reviewOf', { i: revIndex + 1, n: revList.length })}</span>
                                        <span className="badge info wrap" data-i18n-skip>{rq.topicTitle}</span>
                                    </div>
                                    <h3 className="text-lg sm:text-xl font-bold mb-4 leading-snug" data-i18n-skip>{rq.q}</h3>
                                    <textarea
                                        value={revAnswer}
                                        onChange={e => setRevAnswer(e.target.value)}
                                        disabled={revRevealed}
                                        rows={4}
                                        placeholder={T('yourAnswer')}
                                        className="textarea"
                                    />
                                    <div className="mt-4">
                                        {!revRevealed ? (
                                            <button data-k="reveal" onClick={() => setRevRevealed(true)} className="btn primary lg w-full">{T('reveal')}</button>
                                        ) : (
                                            <div className="animate-fade-in-up">
                                                <div className="callout info mb-4">
                                                    <h4 className="font-bold mb-1 text-sm">{T('answerKey')}</h4>
                                                    <p className="text-base" data-i18n-skip>{rq.refAnswer}</p>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <button data-k="recalled" onClick={() => markReview(true)} className="btn primary lg sm:flex-1">{T('recalled')}</button>
                                                    <button data-k="notyet" onClick={() => markReview(false)} className="btn lg sm:flex-1">{T('notYetTomorrow')}</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                                );
                            })()}
                        </div>
                    </div>
                    ) : view === 'exam' ? (
                    <div className="flex-1 overflow-y-auto">
                        <div className="max-w-2xl mx-auto p-4 sm:p-6">
                            {examList.length === 0 ? (
                                <section className="card">
                                    <h2 className="text-xl font-bold mb-4">{T('tabExam')}</h2>
                                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                                        <button data-k="start10" onClick={() => startExam(10)} className="btn primary lg">{T('start10')}</button>
                                        <button data-k="start20" onClick={() => startExam(20)} className="btn lg">{T('start20')}</button>
                                    </div>
                                    {exams.length > 0 && (
                                        <div className="border-t border-slate-100 pt-4">
                                            <h4 className="text-sm font-bold text-slate-500 mb-3">{T('recent')}</h4>
                                            {exams.slice(0, 5).map((e, i) => (
                                                <div key={i} className="flex justify-between gap-2 text-sm py-1.5 border-b border-slate-100">
                                                    <span className="text-slate-500">{OME_I18N.date(e.date, { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                    <span className={`badge ${e.score / e.total >= 0.7 ? 'ok' : ''}`}>{T('resultTime', { score: e.score, total: e.total, m: Math.floor(e.sec / 60), s: String(e.sec % 60).padStart(2, '0') })}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            ) : examIndex >= examList.length ? (
                                <section className="card text-center">
                                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4"><Trophy /></div>
                                    <h2 className="text-xl font-bold mb-1">{T('scoreIs', { s: examScore, n: examList.length })}</h2>
                                    <p className="text-sm text-slate-500 mb-6">
                                        {T('timeUsed', { t: `${Math.floor((exams[0]?.sec || 0) / 60)}:${String((exams[0]?.sec || 0) % 60).padStart(2, '0')}` })}
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                        <button onClick={() => { setExamList([]); setExamIndex(0); }} className="btn primary lg">{T('examAgain')}</button>
                                        <button onClick={() => setView('stream')} className="btn lg">{T('backStream')}</button>
                                    </div>
                                </section>
                            ) : (
                                <section className="card">
                                    <div className="flex justify-between items-center gap-2 flex-wrap mb-4">
                                        <span className="text-sm font-bold text-slate-500">{T('qOf', { i: examIndex + 1, n: examList.length })}</span>
                                        <span className="badge info wrap" data-i18n-skip>{examList[examIndex].topicTitle}</span>
                                    </div>
                                    <h3 className="text-lg sm:text-xl font-bold mb-4 leading-snug" data-i18n-skip>{examList[examIndex].q}</h3>
                                    <textarea
                                        value={examAnswer}
                                        onChange={e => setExamAnswer(e.target.value)}
                                        disabled={examRevealed}
                                        rows={4}
                                        placeholder={T('typeAns')}
                                        className="textarea"
                                    />
                                    <div className="mt-4">
                                        {!examRevealed ? (
                                            <button data-k="esubmit" onClick={() => setExamRevealed(true)} disabled={!examAnswer.trim()} className="btn primary lg w-full">{T('submit')}</button>
                                        ) : (
                                            <div className="animate-fade-in-up">
                                                <div className="callout info mb-4">
                                                    <h4 className="font-bold mb-1 text-sm">{T('answerKey')}</h4>
                                                    <p className="text-base" data-i18n-skip>{examList[examIndex].refAnswer}</p>
                                                </div>
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <button data-k="ecorrect" onClick={() => markExam(true)} className="btn primary lg sm:flex-1">{T('correct')}</button>
                                                    <button data-k="ewrong" onClick={() => markExam(false)} className="btn lg sm:flex-1">{T('wrong')}</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>
                    ) : view === 'allnotes' ? (
                    <div className="flex-1 overflow-y-auto">
                        <div className="max-w-3xl mx-auto p-4 sm:p-6">
                            <section className="card">
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><NotebookIcon /> {T('tabNotes')}</h2>
                                <input
                                    type="text"
                                    value={notesQuery}
                                    onChange={e => setNotesQuery(e.target.value)}
                                    placeholder={T('searchNotes')}
                                    data-k="notesQuery" className="input mb-4"
                                />
                                {(() => {
                                    const q = notesQuery.trim().toLowerCase();
                                    const entries = Object.entries(notes)
                                        .filter(([k, v]) => v && v.text && v.text.trim())
                                        .map(([k, v]) => ({ key: k, note: v, topic: topicByKey[k] }))
                                        .filter(e => e.topic)
                                        .filter(e => !q || e.topic.title.toLowerCase().includes(q) || e.note.text.toLowerCase().includes(q))
                                        .sort((a, b) => (b.note.updatedAt || 0) - (a.note.updatedAt || 0));
                                    if (!entries.length) return (
                                        <p className="text-sm text-slate-500 text-center py-8">
                                            {q ? T('noMatch') : T('noNotes')}
                                        </p>
                                    );
                                    return entries.map(e => (
                                        <button key={e.key} data-k="noteRow"
                                            onClick={() => { selectTopic(e.topic.subjId, e.topic.id); setActiveTab('notes'); }}
                                            className="stat-card w-full mb-3">
                                            <div className="flex justify-between items-center gap-2 w-full">
                                                <span className="font-bold text-sm text-slate-800" data-i18n-skip>{e.topic.title}</span>
                                                <span className="text-xs text-slate-500 shrink-0">{OME_I18N.date(e.note.updatedAt)}</span>
                                            </div>
                                            <p className="text-sm text-slate-500 line-clamp-2" data-i18n-skip>{e.note.text.slice(0, 160)}</p>
                                        </button>
                                    ));
                                })()}
                            </section>
                        </div>
                    </div>
                    ) : (
                    <div className="flex flex-1 overflow-hidden relative">

                        {mobileNavOpen && (
                            <div className="fixed inset-x-0 bottom-0 top-12 bg-black/30 z-30 md:hidden" onClick={() => setMobileNavOpen(false)}></div>
                        )}

                        <aside className={`fixed md:static top-12 bottom-0 left-0 z-40 w-80 max-w-[88vw] bg-white border-r border-slate-200 overflow-y-auto flex flex-col shrink-0 p-3 transform transition-transform duration-200 md:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full max-md:invisible'}`}>
                            <div className="flex items-center justify-between mb-2 md:hidden">
                                <span className="text-base font-bold">{T('allTopics')}</span>
                                <button data-k="closeNav" onClick={() => setMobileNavOpen(false)} className="btn ghost icon" aria-label={T('closeNav')}><CloseIcon /></button>
                            </div>
                            {SUBJECTS.map(s => (
                                <div key={s.id} className="mb-2">
                                    <button
                                        data-k="group" onClick={() => setOpenGroups(g => ({ ...g, [s.id]: !g[s.id] }))}
                                        className="btn ghost w-full justify-between"
                                        aria-expanded={!!openGroups[s.id]}
                                    >
                                        <span className="flex items-center gap-2 font-bold"><s.icon /> {subjLabel(s)} <span className="text-slate-500 font-normal">({s.topics.length})</span></span>
                                        <span className={`transition-transform ${openGroups[s.id] ? 'rotate-180' : ''}`}><ChevronDown /></span>
                                    </button>
                                    {openGroups[s.id] && (
                                        <div className="mt-2">
                                            {s.topics.map(t => {
                                                const active = activeSubject === s.id && activeTopicId === t.id;
                                                return (
                                                    <button
                                                        key={t.id}
                                                        data-k="topic" data-tid={t.id}
                                                        onClick={() => selectTopic(s.id, t.id)}
                                                        aria-current={active ? 'true' : undefined}
                                                        className={`list-row !border-0 w-full text-left rounded-lg ${active ? 'bg-blue-50 text-slate-800 font-semibold' : ''}`}
                                                    >
                                                        {active ? <Play className="shrink-0" /> : (completed[`${s.id}:${t.id}`] ? <Check className="shrink-0" /> : <Clock className="shrink-0 text-slate-400" />)}
                                                        <span className="grow leading-tight" data-i18n-skip>{t.title}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </aside>

                        <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center">
                            <div className="w-full max-w-[72ch]">

                                <div className="tabs mb-4">
                                    <button data-k="tab-summary" onClick={() => setActiveTab('summary')} className={`tab${activeTab === 'summary' ? ' on' : ''}`}>{T('tabSummary')}</button>
                                    <button data-k="tab-quiz" onClick={() => setActiveTab('quiz')} className={`tab${activeTab === 'quiz' ? ' on' : ''} inline-flex items-center gap-2`}><span className="hidden sm:inline-flex"><Target /></span> {T('tabQuiz')}</button>
                                    <button data-k="tab-mynotes" onClick={() => setActiveTab('notes')} className={`tab${activeTab === 'notes' ? ' on' : ''} inline-flex items-center gap-2`}><span className="hidden sm:inline-flex"><NotebookIcon /></span> {T('tabMyNotes')} {noteText && <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>}</button>
                                </div>

                                {activeTab === 'notes' ? (
                                    <section className="card">
                                        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                                            <h3 className="text-lg font-bold flex items-center gap-2"><NotebookIcon /> {T('tabMyNotes')} — <span data-i18n-skip>{topic.title}</span></h3>
                                            <div className="segmented">
                                                <button data-k="note-edit" onClick={() => setNotePreview(false)} className={!notePreview ? 'on' : ''}>{T('edit')}</button>
                                                <button data-k="note-preview" onClick={() => setNotePreview(true)} className={notePreview ? 'on' : ''}>{T('preview')}</button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-500 mb-3 min-h-[1.25rem]">
                                            {notes[noteKey] ? T('savedAt', { d: OME_I18N.date(notes[noteKey].updatedAt, { dateStyle: 'medium', timeStyle: 'short' }) }) : ''}
                                        </p>
                                        {notePreview ? (
                                            <div className="md-preview border-2 border-slate-100 rounded-xl p-4 min-h-[200px]" data-i18n-skip
                                                dangerouslySetInnerHTML={{ __html: noteText.trim() ? mdToHtml(noteText) : `<p style="opacity:.6">${escapeHtml(T('emptyPreview'))}</p>` }} />
                                        ) : (
                                            <textarea
                                                value={noteText}
                                                onChange={e => updateNote(e.target.value)}
                                                rows={10}
                                                placeholder={T('notePh')}
                                                className="textarea"
                                            />
                                        )}
                                    </section>
                                ) : activeTab === 'summary' ? (
                                    <section className="card">
                                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Bookmark /> <span data-i18n-skip>{topic.title}</span></h3>
                                        {hasSummary(topic) ? (
                                            <div data-i18n-skip>
                                                {topic.data.overview && <p className="text-base text-slate-600 mb-4 leading-relaxed">{topic.data.overview}</p>}
                                                {(topic.data.keyConcepts || []).length > 0 && (
                                                    <>
                                                        <h4 className="text-sm font-bold text-slate-500 mb-2">{T('keyPoints')}</h4>
                                                        <ul className="space-y-2">
                                                            {topic.data.keyConcepts.map((k, i) => (
                                                                <li key={i} className="flex items-start gap-2 text-base text-slate-700 leading-relaxed">
                                                                    <span className="text-secondary">&bull;</span> {k}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </>
                                                )}
                                                {topic.data.lesson && (
                                                    <div className="md-preview lesson mt-6 pt-2 border-t border-slate-100 text-slate-700"
                                                        dangerouslySetInnerHTML={{ __html: mdToHtml(topic.data.lesson) }} />
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-slate-500">{T('noContent')}</p>
                                        )}
                                    </section>
                                ) : (
                                    <section className="card">

                                        {!isDone ? (
                                            <>
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="text-sm font-bold text-slate-500">{T('qNofN', { i: qIndex + 1, n: questions.length })}</span>
                                                </div>

                                                <h3 className="text-xl font-bold mb-4 leading-snug">
                                                    {questions[qIndex].hasKey
                                                        ? <span data-i18n-skip>{questions[qIndex].q}</span>
                                                        : <>{questions[qIndex].reflect[0]}<span data-i18n-skip>{topic.title}</span>{questions[qIndex].reflect[1]}</>}
                                                </h3>

                                                <textarea
                                                    value={answerText}
                                                    onChange={e => setAnswerText(e.target.value)}
                                                    disabled={revealed}
                                                    rows={5}
                                                    placeholder={T('typeHere')}
                                                    className="textarea"
                                                />

                                                <div className="mt-4">
                                                    {!revealed ? (
                                                        <button data-k="qsubmit" onClick={submitAnswer} disabled={!answerText.trim()} className="btn primary lg w-full">
                                                            {T('submit')}
                                                        </button>
                                                    ) : (
                                                        <div className="animate-fade-in-up">
                                                            {questions[qIndex].hasKey ? (
                                                                <div className="callout info mb-4">
                                                                    <h4 className="font-bold mb-1">{T('refAnswer')}</h4>
                                                                    <p className="text-base leading-relaxed mb-4" data-i18n-skip>{questions[qIndex].refAnswer}</p>
                                                                </div>
                                                            ) : (
                                                                <div className="callout ok mb-4">
                                                                    <h4 className="font-bold">{T('savedAns')}</h4>
                                                                </div>
                                                            )}
                                                            {questions[qIndex].hasKey && (selfMark === null ? (
                                                                <div className="flex flex-wrap gap-3 mb-4">
                                                                    <button data-k="qcorrect" onClick={() => markSelf(true)} className="btn primary">{T('correctXp')}</button>
                                                                    <button data-k="qwrong" onClick={() => markSelf(false)} className="btn">{T('wrong')}</button>
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm font-semibold mb-4">
                                                                    {selfMark === 'correct' ? T('markedCorrect') : T('markedWrong')}
                                                                </p>
                                                            ))}
                                                            {(questions[qIndex].hasKey ? selfMark !== null : true) && (
                                                                <button data-k="qnext" onClick={nextQuestion} className="btn primary lg w-full">
                                                                    {qIndex < questions.length - 1 ? T('next') : T('seeSummary')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-8">
                                                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Trophy className="w-12 h-12 text-accent" />
                                                </div>
                                                <h2 className="text-xl font-bold mb-2">{T('allWritten')}</h2>
                                                <p className="text-slate-500 mb-6">{T('topicLabel')} "<span data-i18n-skip>{topic.title}</span>" — {T('nQuestions', { n: questions.length })}</p>
                                                <button data-k="retry" onClick={restartTopic} className="btn lg">{T('retry')}</button>
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>
                        </main>
                    </div>
                    )}
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
