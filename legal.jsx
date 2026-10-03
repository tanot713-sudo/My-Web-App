        const { useState, useEffect, useRef, useMemo } = React;
        const TEMPLATES = JSON.parse(document.getElementById('legal-templates').textContent);
        const TYPE_IDS = ['plaint', 'answer', 'petition', 'statement', 'counterclaim', 'prayer', 'police-report'];

        // ไอคอน lucide ต้องห่อใน span ที่ React เป็นเจ้าของ — ไม่งั้นตอน lucide แทนที่ <i> ด้วย <svg>
        // React จะ unmount ไม่ได้ (removeChild error) เวลาสลับแบบร่าง/มุมมอง
        const icon = (name, cls) => () => (
            <span className="inline-flex" dangerouslySetInnerHTML={{ __html: `<i data-lucide="${name}" class="${cls}"></i>` }} />
        );
        const FileText = icon('file-text', 'w-5 h-5');
        const Image = icon('image', 'w-4 h-4');
        const Download = icon('download', 'w-4 h-4');
        const Printer = icon('printer', 'w-4 h-4');
        const Save = icon('save', 'w-4 h-4');
        const Trash = icon('trash-2', 'w-4 h-4');
        const Menu = icon('menu', 'w-5 h-5');
        const CloseIcon = icon('x', 'w-5 h-5');
        const CheckSquare = icon('check-square', 'w-4 h-4');
        const Square = icon('square', 'w-4 h-4');
        const FolderOpen = icon('folder-open', 'w-4 h-4');
        const Scale = icon('scale', 'w-5 h-5');

        function loadDrafts() {
            try { return JSON.parse(localStorage.getItem('legal:drafts') || '{}'); } catch { return {}; }
        }
        function saveDrafts(v) { localStorage.setItem('legal:drafts', JSON.stringify(v)); }
        function mergeDrafts(a, b) {
            const ids = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
            const out = {};
            ids.forEach(id => {
                const da = a && a[id], db = b && b[id];
                out[id] = !da ? db : !db ? da : ((da.updatedAt || 0) >= (db.updatedAt || 0) ? da : db);
            });
            return out;
        }

        function loadChecked() {
            try { return JSON.parse(localStorage.getItem('legal:checked') || '{}'); } catch { return {}; }
        }
        function saveChecked(v) { localStorage.setItem('legal:checked', JSON.stringify(v)); }
        function mergeChecked(a, b) {
            const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
            const out = {};
            keys.forEach(k => {
                const la = (a && a[k]) || [], lb = (b && b[k]) || [];
                const len = Math.max(la.length, lb.length);
                const arr = [];
                for (let i = 0; i < len; i++) arr[i] = !!(la[i] || lb[i]);
                out[k] = arr;
            });
            return out;
        }

        // ── Google Drive sync (ไม่บังคับ) — ซิงก์แบบร่าง/checklist ข้ามอุปกรณ์ ────
        const DRIVE_CLIENT_ID = '497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com';
        const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
        const DRIVE_FOLDER_NAME = 'OME_Progress';
        const DRIVE_FILE_NAME = 'legal-drafts.json';

        const DriveSync = {
            tokenClient: null,
            accessToken: null,
            folderId: null,
            ensureAuth() {
                return new Promise((resolve, reject) => {
                    if (!window.google || !google.accounts || !google.accounts.oauth2) {
                        reject(new Error('โหลด Google Identity Services ไม่สำเร็จ ลองรีเฟรชหน้าใหม่'));
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
                if (!res.ok) throw new Error('ค้นหาโฟลเดอร์ไม่สำเร็จ (HTTP ' + res.status + ')');
                const data = await res.json();
                if (data.files && data.files.length) { this.folderId = data.files[0].id; return this.folderId; }
                const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + this.accessToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
                });
                if (!createRes.ok) throw new Error('สร้างโฟลเดอร์ไม่สำเร็จ (HTTP ' + createRes.status + ')');
                const createData = await createRes.json();
                this.folderId = createData.id;
                return this.folderId;
            },
            async findFile(name, folderId) {
                const q = encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`);
                const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
                    { headers: { Authorization: 'Bearer ' + this.accessToken } });
                if (!res.ok) throw new Error('ค้นหาไฟล์ไม่สำเร็จ (HTTP ' + res.status + ')');
                const data = await res.json();
                return (data.files && data.files[0]) || null;
            },
            async downloadFile(fileId) {
                const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                    { headers: { Authorization: 'Bearer ' + this.accessToken } });
                if (!res.ok) throw new Error('ดาวน์โหลดไม่สำเร็จ (HTTP ' + res.status + ')');
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
                if (!res.ok) throw new Error('บันทึกขึ้น Drive ไม่สำเร็จ (HTTP ' + res.status + ')');
                return res.json();
            },
        };

        function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

        function App() {
            const hashType = TYPE_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : null;
            const [activeType, setActiveType] = useState(hashType || 'plaint');
            const [content, setContent] = useState(TEMPLATES[hashType || 'plaint'].html);
            const [activeDraftId, setActiveDraftId] = useState(null);
            const [drafts, setDrafts] = useState(loadDrafts());
            const [checked, setChecked] = useState(loadChecked());
            const [notice, setNotice] = useState('');
            const [nameModal, setNameModal] = useState(false);
            const [draftName, setDraftName] = useState('');
            const [mobileNavOpen, setMobileNavOpen] = useState(false);
            const [syncing, setSyncing] = useState(false);
            const [syncStatus, setSyncStatus] = useState('');

            const editorRef = useRef(null);
            const fileInputRef = useRef(null);

            useEffect(() => { lucide.createIcons(); });
            useEffect(() => { saveDrafts(drafts); }, [drafts]);
            useEffect(() => { saveChecked(checked); }, [checked]);
            useEffect(() => {
                if (editorRef.current) editorRef.current.innerHTML = content;
            }, [activeType, activeDraftId]);

            const draftList = useMemo(() =>
                Object.entries(drafts)
                    .map(([id, d]) => ({ id, ...d }))
                    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
                [drafts]);

            const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 4000); };

            const loadTemplate = (type) => {
                setActiveType(type);
                setContent(TEMPLATES[type].html);
                setActiveDraftId(null);
                setMobileNavOpen(false);
            };

            const openDraft = (id) => {
                const d = drafts[id];
                if (!d) return;
                setActiveType(d.type);
                setContent(d.html);
                setActiveDraftId(id);
                setMobileNavOpen(false);
            };

            const startSave = () => {
                setDraftName(activeDraftId && drafts[activeDraftId] ? drafts[activeDraftId].name : TEMPLATES[activeType].title);
                setNameModal(true);
            };

            const confirmSave = () => {
                const html = editorRef.current ? editorRef.current.innerHTML : content;
                const id = activeDraftId || uid();
                setDrafts(d => ({ ...d, [id]: { type: activeType, name: draftName.trim() || TEMPLATES[activeType].title, html, updatedAt: Date.now() } }));
                setActiveDraftId(id);
                setContent(html);
                setNameModal(false);
                flash('บันทึกแบบร่าง "' + (draftName.trim() || TEMPLATES[activeType].title) + '" แล้ว');
            };

            const deleteDraft = (id) => {
                if (!confirm('ลบแบบร่างนี้ถาวร?')) return;
                setDrafts(d => { const { [id]: _, ...rest } = d; return rest; });
                if (activeDraftId === id) loadTemplate(activeType);
                flash('ลบแบบร่างแล้ว');
            };

            const toggleCheck = (i) => {
                setChecked(c => {
                    const arr = (c[activeType] || []).slice();
                    arr[i] = !arr[i];
                    return { ...c, [activeType]: arr };
                });
            };
            const checkedArr = checked[activeType] || [];

            const attachImage = (file) => {
                const reader = new FileReader();
                reader.onload = () => {
                    editorRef.current && editorRef.current.focus();
                    document.execCommand('insertImage', false, reader.result);
                    flash('แนบรูปภาพเข้าในเอกสารแล้ว');
                };
                reader.readAsDataURL(file);
            };

            const downloadDoc = () => {
                const html = editorRef.current ? editorRef.current.innerHTML : content;
                const full = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
                const blob = new Blob(['﻿', full], { type: 'application/msword' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = (activeDraftId && drafts[activeDraftId] ? drafts[activeDraftId].name : TEMPLATES[activeType].title) + '.doc';
                a.click();
            };

            const printDoc = () => window.print();

            const syncNow = async () => {
                setSyncing(true);
                setSyncStatus('กำลังเชื่อมต่อ Google...');
                try {
                    await DriveSync.ensureAuth();
                    setSyncStatus('กำลังซิงก์...');
                    const folderId = await DriveSync.ensureFolder();
                    const existing = await DriveSync.findFile(DRIVE_FILE_NAME, folderId);
                    const remote = existing ? await DriveSync.downloadFile(existing.id) : null;

                    const mergedDrafts = mergeDrafts(remote?.drafts, drafts);
                    const mergedChecked = mergeChecked(remote?.checked, checked);

                    setDrafts(mergedDrafts);
                    setChecked(mergedChecked);

                    await DriveSync.uploadFile(DRIVE_FILE_NAME, folderId, existing?.id,
                        { drafts: mergedDrafts, checked: mergedChecked, savedAt: new Date().toISOString() });
                    setSyncStatus('ซิงก์สำเร็จ');
                } catch (e) {
                    setSyncStatus('' + (e.message || e));
                } finally {
                    setSyncing(false);
                }
            };

            return (
                <div className="h-[calc(100vh-48px)] w-full flex flex-col bg-slate-50 font-sans">

                    <header className="min-h-[64px] bg-white border-b border-slate-200 flex items-center flex-wrap gap-y-2 justify-between px-4 sm:px-6 py-2 shrink-0 z-10">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setMobileNavOpen(true)} className="md:hidden -ml-1 p-1.5 text-slate-500 hover:text-slate-800" aria-label="เปิดเมนูแบบร่าง">
                                <Menu />
                            </button>
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white"><Scale /></div>
                            <h1 className="text-base sm:text-lg font-bold text-slate-800">งานกฎหมาย <span className="hidden sm:inline text-slate-400 font-normal">| ร่างเอกสาร</span></h1>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                            <button
                                onClick={syncNow}
                                disabled={syncing}
                                className="text-xs font-semibold text-slate-500 hover:text-secondary border border-slate-200 hover:border-secondary rounded-full px-3 py-1.5 disabled:opacity-50 transition-colors"
                            >
                                {syncing ? 'กำลังซิงก์...' : <>ซิงก์<span className="hidden sm:inline"> Google Drive</span></>}
                            </button>
                            {syncStatus && <span className="hidden sm:inline text-xs text-slate-400">{syncStatus}</span>}
                            <a href="./index.html" className="text-xs font-semibold text-slate-400 hover:text-slate-700">&larr; กลับ Tanot</a>
                        </div>
                    </header>

                    <div className="flex flex-1 overflow-hidden relative">

                        {mobileNavOpen && (
                            <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setMobileNavOpen(false)}></div>
                        )}

                        <aside className={`fixed md:static inset-y-0 left-0 z-40 w-80 bg-white border-r border-slate-200 overflow-y-auto flex flex-col shrink-0 p-4 transform transition-transform duration-200 md:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                            <div className="flex items-center justify-between mb-3 md:hidden">
                                <span className="text-sm font-bold text-slate-700">แบบร่าง</span>
                                <button onClick={() => setMobileNavOpen(false)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="ปิดเมนู"><CloseIcon /></button>
                            </div>

                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">แบบร่างใหม่</div>
                            <div className="space-y-1 mb-6">
                                {TYPE_IDS.map(id => {
                                    const active = !activeDraftId && activeType === id;
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => loadTemplate(id)}
                                            className={`w-full text-left p-2.5 rounded-xl border flex gap-2 text-sm ${active ? 'bg-blue-50 border-blue-100 text-secondary font-semibold shadow-sm' : 'border-transparent text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <FileText className="shrink-0" />
                                            <span className="leading-tight">{TEMPLATES[id].title}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                                <FolderOpen /> แบบร่างที่บันทึกไว้ ({draftList.length})
                            </div>
                            {draftList.length === 0 ? (
                                <p className="text-xs text-slate-400 px-1">ยังไม่มีแบบร่างที่บันทึก</p>
                            ) : (
                                <div className="space-y-1">
                                    {draftList.map(d => (
                                        <div key={d.id}
                                            className={`group flex items-center gap-1 rounded-xl border ${activeDraftId === d.id ? 'bg-blue-50 border-blue-100' : 'border-transparent hover:bg-slate-50'}`}>
                                            <button onClick={() => openDraft(d.id)} className="flex-1 text-left p-2.5 min-w-0">
                                                <div className={`text-sm truncate ${activeDraftId === d.id ? 'text-secondary font-semibold' : 'text-slate-600'}`}>{d.name}</div>
                                                <div className="text-[10px] text-slate-400">{TEMPLATES[d.type]?.title} · {new Date(d.updatedAt).toLocaleDateString('th-TH')}</div>
                                            </button>
                                            <button onClick={() => deleteDraft(d.id)} className="p-2 text-slate-300 hover:text-danger shrink-0" aria-label="ลบแบบร่าง"><Trash /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </aside>

                        <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center">
                            <div className="w-full max-w-3xl">

                                {notice && (
                                    <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm animate-fade-in-up">{notice}</div>
                                )}

                                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                                    <h2 className="text-lg font-bold text-slate-800">
                                        {activeDraftId && drafts[activeDraftId] ? drafts[activeDraftId].name : TEMPLATES[activeType].title}
                                        {activeDraftId && <span className="ml-2 text-xs font-normal text-slate-400">(กำลังแก้ไขแบบร่างที่บันทึกไว้)</span>}
                                    </h2>
                                    <div className="flex flex-wrap gap-2">
                                        <button onClick={() => fileInputRef.current && fileInputRef.current.click()}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-secondary hover:text-secondary">
                                            <Image /> แนบรูปภาพ
                                        </button>
                                        <input ref={fileInputRef} type="file" accept="image/*" hidden
                                            onChange={e => { const f = e.target.files && e.target.files[0]; if (f) attachImage(f); e.target.value = ''; }} />
                                        <button onClick={downloadDoc}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-secondary hover:text-secondary">
                                            <Download /> ดาวน์โหลด Word
                                        </button>
                                        <button onClick={printDoc}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-secondary hover:text-secondary">
                                            <Printer /> พิมพ์
                                        </button>
                                        <button onClick={startSave}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-slate-800">
                                            <Save /> บันทึกแบบร่าง
                                        </button>
                                    </div>
                                </div>

                                <div id="printArea" className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 mb-6">
                                    <div
                                        ref={editorRef}
                                        className="doc-editor text-slate-700"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onInput={e => setContent(e.currentTarget.innerHTML)}
                                    />
                                </div>

                                {TEMPLATES[activeType].checklist && TEMPLATES[activeType].checklist.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                                        <h3 className="text-sm font-bold text-slate-800 mb-3">เอกสาร/สิ่งที่ควรเตรียมสำหรับ{TEMPLATES[activeType].title}</h3>
                                        <div className="space-y-2">
                                            {TEMPLATES[activeType].checklist.map((item, i) => (
                                                <button key={i} onClick={() => toggleCheck(i)}
                                                    className="w-full flex items-start gap-2.5 text-left text-sm p-1.5 rounded-lg hover:bg-slate-50">
                                                    <span className={checkedArr[i] ? 'text-success shrink-0 mt-0.5' : 'text-slate-300 shrink-0 mt-0.5'}>
                                                        {checkedArr[i] ? <CheckSquare /> : <Square />}
                                                    </span>
                                                    <span className={checkedArr[i] ? 'text-slate-400 line-through' : 'text-slate-600'}>{item}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>

                    {nameModal && (
                        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setNameModal(false)}>
                            <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                                <h3 className="font-bold text-slate-800 mb-3">ตั้งชื่อแบบร่าง</h3>
                                <input
                                    type="text"
                                    value={draftName}
                                    onChange={e => setDraftName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && confirmSave()}
                                    autoFocus
                                    placeholder="เช่น ฟ้องคดีสัญญาเช่า - คุณสมชาย"
                                    className="w-full border-2 border-slate-200 focus:border-secondary outline-none rounded-xl px-4 py-2.5 text-sm mb-4"
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => setNameModal(false)} className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-bold">ยกเลิก</button>
                                    <button onClick={confirmSave} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold">บันทึก</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
