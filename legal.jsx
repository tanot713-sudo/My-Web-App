        const { useState, useEffect, useRef, useMemo } = React;
        const TEMPLATES = JSON.parse(document.getElementById('legal-templates').textContent);
        const TYPE_IDS = ['plaint', 'answer', 'petition', 'statement', 'counterclaim', 'prayer', 'police-report'];

        // ── ภาษา UI (ไทย/อังกฤษ) — ตัวบท/ร่างคำฟ้อง/แบบฟอร์มกฎหมายและชื่อแบบร่างที่ผู้ใช้ตั้งเป็นเนื้อหา → data-i18n-skip
        //    ภาษาไทยในพจนานุกรม th เหมือนข้อความเดิมทุกตัวอักษร · เอกสารที่ส่งออก (.doc/พิมพ์) เป็นไทยเสมอ
        const T = OME_I18N.scope('legal', {
            th: {
                title: 'งานกฎหมาย',
                subtitle: 'ร่างเอกสาร',
                pageTitle: 'งานกฎหมาย — ร่างเอกสาร | Tanot',
                openNav: 'เปิดเมนูแบบร่าง',
                closeNav: 'ปิดเมนู',
                drafts: 'แบบร่าง',
                newDrafts: 'แบบร่างใหม่',
                savedDrafts: 'แบบร่างที่บันทึกไว้',
                noDrafts: 'ยังไม่มีแบบร่างที่บันทึก',
                delDraft: 'ลบแบบร่าง',
                editingSaved: '(กำลังแก้ไขแบบร่างที่บันทึกไว้)',
                attach: 'แนบรูปภาพ',
                dlWord: 'ดาวน์โหลด Word',
                print: 'พิมพ์',
                saveDraft: 'บันทึกแบบร่าง',
                checklistFor: 'เอกสาร/สิ่งที่ควรเตรียมสำหรับ',
                nameTitle: 'ตั้งชื่อแบบร่าง',
                namePh: 'เช่น ฟ้องคดีสัญญาเช่า - คุณสมชาย',
                cancel: 'ยกเลิก',
                save: 'บันทึก',
                sync: 'ซิงก์',
                syncing: 'กำลังซิงก์...',
                syncConnecting: 'กำลังเชื่อมต่อ Google...',
                syncOk: 'ซิงก์สำเร็จ',
                back: 'กลับ Tanot',
                flashSaved: 'บันทึกแบบร่าง "{name}" แล้ว',
                flashDeleted: 'ลบแบบร่างแล้ว',
                flashImage: 'แนบรูปภาพเข้าในเอกสารแล้ว',
                confirmDelete: 'ลบแบบร่างนี้ถาวร?',
                eGis: 'โหลด Google Identity Services ไม่สำเร็จ ลองรีเฟรชหน้าใหม่',
                eFolderFind: 'ค้นหาโฟลเดอร์ไม่สำเร็จ (HTTP {c})',
                eFolderMake: 'สร้างโฟลเดอร์ไม่สำเร็จ (HTTP {c})',
                eFileFind: 'ค้นหาไฟล์ไม่สำเร็จ (HTTP {c})',
                eDownload: 'ดาวน์โหลดไม่สำเร็จ (HTTP {c})',
                eUpload: 'บันทึกขึ้น Drive ไม่สำเร็จ (HTTP {c})'
            },
            en: {
                title: 'Legal work',
                subtitle: 'Draft documents',
                pageTitle: 'Legal work — draft documents | Tanot',
                openNav: 'Open drafts menu',
                closeNav: 'Close menu',
                drafts: 'Drafts',
                newDrafts: 'New drafts',
                savedDrafts: 'Saved drafts',
                noDrafts: 'No saved drafts yet',
                delDraft: 'Delete draft',
                editingSaved: '(editing a saved draft)',
                attach: 'Attach image',
                dlWord: 'Download Word',
                print: 'Print',
                saveDraft: 'Save draft',
                checklistFor: 'Documents to prepare for ',
                nameTitle: 'Name this draft',
                namePh: 'e.g. Lease dispute - Mr. Somchai',
                cancel: 'Cancel',
                save: 'Save',
                sync: 'Sync',
                syncing: 'Syncing...',
                syncConnecting: 'Connecting to Google...',
                syncOk: 'Synced',
                back: 'Back to Tanot',
                flashSaved: 'Saved draft "{name}"',
                flashDeleted: 'Draft deleted',
                flashImage: 'Image attached to the document',
                confirmDelete: 'Delete this draft permanently?',
                eGis: 'Could not load Google Identity Services. Try reloading the page',
                eFolderFind: 'Could not search for the folder (HTTP {c})',
                eFolderMake: 'Could not create the folder (HTTP {c})',
                eFileFind: 'Could not search for the file (HTTP {c})',
                eDownload: 'Download failed (HTTP {c})',
                eUpload: 'Could not save to Drive (HTTP {c})'
            }
        });
        window.OME_PAGE_LIVE_LANG = true;
        // ข้อผิดพลาด/ข้อความแจ้งที่พกคีย์ — แปลสดตอนสลับภาษา (ไม่เก็บข้อความที่แปลแล้วไว้)
        const tErr = (key, vars) => Object.assign(new Error(T(key, vars)), { tkey: key, tvars: vars });
        const statusText = st => !st ? '' : st.tkey ? T(st.tkey, st.tvars) : (st.raw || '');

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

        function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

        function App() {
            const hashType = TYPE_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : null;
            const [activeType, setActiveType] = useState(hashType || 'plaint');
            const [content, setContent] = useState(TEMPLATES[hashType || 'plaint'].html);
            const [activeDraftId, setActiveDraftId] = useState(null);
            const [drafts, setDrafts] = useState(loadDrafts());
            const [checked, setChecked] = useState(loadChecked());
            const [notice, setNotice] = useState(null);
            const [nameModal, setNameModal] = useState(false);
            const [draftName, setDraftName] = useState('');
            const [mobileNavOpen, setMobileNavOpen] = useState(false);
            const [syncing, setSyncing] = useState(false);
            const [syncStatus, setSyncStatus] = useState(null);
            const [lang, setLang] = useState(OME_I18N.lang());
            useEffect(() => OME_LANG.onChange(l => setLang(l)), []);
            useEffect(() => { document.title = T('pageTitle'); }, [lang]);
            const nameDlgRef = useRef(null);
            useEffect(() => {
                const d = nameDlgRef.current;
                if (!d) return;
                if (nameModal && !d.open) d.showModal();
                if (!nameModal && d.open) d.close();
            }, [nameModal]);

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

            const flash = (tkey, tvars) => { setNotice({ tkey, tvars }); setTimeout(() => setNotice(null), 4000); };

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
                flash('flashSaved', { name: draftName.trim() || TEMPLATES[activeType].title });
            };

            const deleteDraft = async (id) => {
                if (!(await window.tanotConfirmDelete(null, { message: T('confirmDelete') }))) return;
                setDrafts(d => { const { [id]: _, ...rest } = d; return rest; });
                if (activeDraftId === id) loadTemplate(activeType);
                flash('flashDeleted');
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
                    flash('flashImage');
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
                setSyncStatus({ tkey: 'syncConnecting' });
                try {
                    await DriveSync.ensureAuth();
                    setSyncStatus({ tkey: 'syncing' });
                    const folderId = await DriveSync.ensureFolder();
                    const existing = await DriveSync.findFile(DRIVE_FILE_NAME, folderId);
                    const remote = existing ? await DriveSync.downloadFile(existing.id) : null;

                    const mergedDrafts = mergeDrafts(remote?.drafts, drafts);
                    const mergedChecked = mergeChecked(remote?.checked, checked);

                    setDrafts(mergedDrafts);
                    setChecked(mergedChecked);

                    await DriveSync.uploadFile(DRIVE_FILE_NAME, folderId, existing?.id,
                        { drafts: mergedDrafts, checked: mergedChecked, savedAt: new Date().toISOString() });
                    setSyncStatus({ tkey: 'syncOk' });
                } catch (e) {
                    setSyncStatus(e && e.tkey ? { tkey: e.tkey, tvars: e.tvars } : { raw: '' + (e.message || e) });
                } finally {
                    setSyncing(false);
                }
            };

            return (
                <div className="h-[calc(100vh-48px)] w-full flex flex-col bg-slate-50 font-sans">

                    <header className="min-h-[56px] bg-white border-b border-slate-200 flex items-center flex-wrap gap-x-3 gap-y-2 justify-between px-4 sm:px-6 py-2 shrink-0 z-10">
                        <div className="flex items-center gap-2 min-w-0">
                            <button data-k="menu" onClick={() => setMobileNavOpen(true)} className="btn ghost icon md:hidden -ml-2" aria-label={T('openNav')}>
                                <Menu />
                            </button>
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white"><Scale /></div>
                            <h1 className="text-lg font-bold text-slate-800">{T('title')} <span className="hidden sm:inline text-slate-500 font-normal">| {T('subtitle')}</span></h1>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button data-k="sync" onClick={syncNow} disabled={syncing} className="btn sm">
                                {syncing ? T('syncing') : <>{T('sync')}<span className="hidden sm:inline"> Google Drive</span></>}
                            </button>
                            {syncStatus && <span className="hidden sm:inline text-sm text-slate-500">{statusText(syncStatus)}</span>}
                            <a href="./index.html" className="btn ghost sm">&larr; {T('back')}</a>
                        </div>
                    </header>

                    <div className="flex flex-1 overflow-hidden relative">

                        {mobileNavOpen && (
                            <div className="fixed inset-x-0 bottom-0 top-12 bg-black/30 z-30 md:hidden" onClick={() => setMobileNavOpen(false)}></div>
                        )}

                        <aside className={`fixed md:static top-12 bottom-0 left-0 z-40 w-80 max-w-[88vw] bg-white border-r border-slate-200 overflow-y-auto flex flex-col shrink-0 p-3 transform transition-transform duration-200 md:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                            <div className="flex items-center justify-between mb-2 md:hidden">
                                <span className="text-base font-bold text-slate-800">{T('drafts')}</span>
                                <button data-k="closeNav" onClick={() => setMobileNavOpen(false)} className="btn ghost icon" aria-label={T('closeNav')}><CloseIcon /></button>
                            </div>

                            <div className="text-sm font-bold text-slate-500 mb-2 px-1">{T('newDrafts')}</div>
                            <div className="space-y-1 mb-6" data-i18n-skip>
                                {TYPE_IDS.map(id => {
                                    const active = !activeDraftId && activeType === id;
                                    return (
                                        <button
                                            key={id}
                                            data-k="template" data-tid={id}
                                            onClick={() => loadTemplate(id)}
                                            aria-current={active ? 'true' : undefined}
                                            className={`list-row !border-0 w-full text-left rounded-lg ${active ? 'bg-blue-50 text-slate-800 font-semibold' : ''}`}
                                        >
                                            <FileText className="shrink-0" />
                                            <span className="grow leading-tight">{TEMPLATES[id].title}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="text-sm font-bold text-slate-500 mb-2 px-1 flex items-center gap-1.5">
                                <FolderOpen /> {T('savedDrafts')} ({draftList.length})
                            </div>
                            {draftList.length === 0 ? (
                                <p className="text-sm text-slate-500 px-1">{T('noDrafts')}</p>
                            ) : (
                                <div className="space-y-1" data-i18n-skip>
                                    {draftList.map(d => (
                                        <div key={d.id} className="flex items-center gap-2">
                                            <button data-k="draft" data-did={d.id} onClick={() => openDraft(d.id)}
                                                aria-current={activeDraftId === d.id ? 'true' : undefined}
                                                className={`list-row !border-0 text-left rounded-lg flex-1 min-w-0 ${activeDraftId === d.id ? 'bg-blue-50 text-slate-800 font-semibold' : ''}`}>
                                                <span className="grow min-w-0">
                                                    <span className="block text-sm truncate">{d.name}</span>
                                                    <span className="block text-sm text-slate-500 truncate">{TEMPLATES[d.type]?.title} · {OME_I18N.date(d.updatedAt)}</span>
                                                </span>
                                            </button>
                                            <button data-k="delDraft" onClick={() => deleteDraft(d.id)} className="btn ghost icon sm shrink-0" aria-label={T('delDraft')}><Trash /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </aside>

                        <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center">
                            <div className="w-full max-w-3xl">

                                {notice && (
                                    <div className="callout ok mb-4" role="status">{T(notice.tkey, notice.tvars)}</div>
                                )}

                                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                                    <h2 className="text-lg font-bold text-slate-800">
                                        <span data-i18n-skip>{activeDraftId && drafts[activeDraftId] ? drafts[activeDraftId].name : TEMPLATES[activeType].title}</span>
                                        {activeDraftId && <span className="ml-2 text-sm font-normal text-slate-500">{T('editingSaved')}</span>}
                                    </h2>
                                    <div className="flex flex-wrap gap-2">
                                        <button data-k="attach" onClick={() => fileInputRef.current && fileInputRef.current.click()} className="btn sm">
                                            <Image /> {T('attach')}
                                        </button>
                                        <input ref={fileInputRef} type="file" accept="image/*" hidden
                                            onChange={e => { const f = e.target.files && e.target.files[0]; if (f) attachImage(f); e.target.value = ''; }} />
                                        <button data-k="download" onClick={downloadDoc} className="btn sm">
                                            <Download /> {T('dlWord')}
                                        </button>
                                        <button data-k="print" onClick={printDoc} className="btn sm">
                                            <Printer /> {T('print')}
                                        </button>
                                        <button data-k="saveDraft" onClick={startSave} className="btn primary sm">
                                            <Save /> {T('saveDraft')}
                                        </button>
                                    </div>
                                </div>

                                <div id="printArea" className="card mb-6 p-6 sm:p-8" data-doc-area data-i18n-skip>
                                    <div
                                        ref={editorRef}
                                        className="doc-editor text-slate-700"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onInput={e => setContent(e.currentTarget.innerHTML)}
                                    />
                                </div>

                                {TEMPLATES[activeType].checklist && TEMPLATES[activeType].checklist.length > 0 && (
                                    <div className="card p-6">
                                        <h3 className="text-base font-bold text-slate-800 mb-3">{T('checklistFor')}<span data-i18n-skip>{TEMPLATES[activeType].title}</span></h3>
                                        <div className="space-y-1" data-i18n-skip>
                                            {TEMPLATES[activeType].checklist.map((item, i) => (
                                                <button key={i} data-k="check" onClick={() => toggleCheck(i)} aria-pressed={!!checkedArr[i]}
                                                    className="list-row !border-0 w-full text-left rounded-lg items-start">
                                                    <span className={checkedArr[i] ? 'text-success shrink-0 mt-0.5' : 'text-slate-500 shrink-0 mt-0.5'}>
                                                        {checkedArr[i] ? <CheckSquare /> : <Square />}
                                                    </span>
                                                    <span className={`grow ${checkedArr[i] ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{item}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>

                    <dialog ref={nameDlgRef} className="dialog" onClose={() => setNameModal(false)} onClick={e => { if (e.target === nameDlgRef.current) setNameModal(false); }}>
                        <div className="dialog-head"><h3>{T('nameTitle')}</h3></div>
                        <div className="dialog-body">
                            <input
                                data-k="draftName"
                                type="text"
                                value={draftName}
                                onChange={e => setDraftName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && confirmSave()}
                                autoFocus
                                placeholder={T('namePh')}
                                aria-label={T('nameTitle')}
                                className="input w-full"
                            />
                        </div>
                        <div className="dialog-foot">
                            <button data-k="nameCancel" onClick={() => setNameModal(false)} className="btn">{T('cancel')}</button>
                            <button data-k="nameSave" onClick={confirmSave} className="btn primary">{T('save')}</button>
                        </div>
                    </dialog>
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
