(() => {
  const { useState, useEffect, useRef, useMemo } = React;
  const TEMPLATES = JSON.parse(document.getElementById("legal-templates").textContent);
  const TYPE_IDS = ["plaint", "answer", "petition", "statement", "counterclaim", "prayer", "police-report"];
  const T = OME_I18N.scope("legal", {
    th: {
      title: "\u0E07\u0E32\u0E19\u0E01\u0E0E\u0E2B\u0E21\u0E32\u0E22",
      subtitle: "\u0E23\u0E48\u0E32\u0E07\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23",
      pageTitle: "\u0E07\u0E32\u0E19\u0E01\u0E0E\u0E2B\u0E21\u0E32\u0E22 \u2014 \u0E23\u0E48\u0E32\u0E07\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23 | Tanot",
      openNav: "\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E19\u0E39\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07",
      closeNav: "\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E19\u0E39",
      drafts: "\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07",
      newDrafts: "\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07\u0E43\u0E2B\u0E21\u0E48",
      savedDrafts: "\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07\u0E17\u0E35\u0E48\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E27\u0E49",
      noDrafts: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07\u0E17\u0E35\u0E48\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01",
      delDraft: "\u0E25\u0E1A\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07",
      editingSaved: "(\u0E01\u0E33\u0E25\u0E31\u0E07\u0E41\u0E01\u0E49\u0E44\u0E02\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07\u0E17\u0E35\u0E48\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E27\u0E49)",
      attach: "\u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E",
      dlWord: "\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14 Word",
      print: "\u0E1E\u0E34\u0E21\u0E1E\u0E4C",
      saveDraft: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07",
      checklistFor: "\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23/\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E04\u0E27\u0E23\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A",
      nameTitle: "\u0E15\u0E31\u0E49\u0E07\u0E0A\u0E37\u0E48\u0E2D\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07",
      namePh: "\u0E40\u0E0A\u0E48\u0E19 \u0E1F\u0E49\u0E2D\u0E07\u0E04\u0E14\u0E35\u0E2A\u0E31\u0E0D\u0E0D\u0E32\u0E40\u0E0A\u0E48\u0E32 - \u0E04\u0E38\u0E13\u0E2A\u0E21\u0E0A\u0E32\u0E22",
      cancel: "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01",
      save: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01",
      sync: "\u0E0B\u0E34\u0E07\u0E01\u0E4C",
      syncing: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E0B\u0E34\u0E07\u0E01\u0E4C...",
      syncConnecting: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D Google...",
      syncOk: "\u0E0B\u0E34\u0E07\u0E01\u0E4C\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08",
      back: "\u0E01\u0E25\u0E31\u0E1A Tanot",
      flashSaved: '\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07 "{name}" \u0E41\u0E25\u0E49\u0E27',
      flashDeleted: "\u0E25\u0E1A\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07\u0E41\u0E25\u0E49\u0E27",
      flashImage: "\u0E41\u0E19\u0E1A\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E40\u0E02\u0E49\u0E32\u0E43\u0E19\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E41\u0E25\u0E49\u0E27",
      confirmDelete: "\u0E25\u0E1A\u0E41\u0E1A\u0E1A\u0E23\u0E48\u0E32\u0E07\u0E19\u0E35\u0E49\u0E16\u0E32\u0E27\u0E23?",
      eGis: "\u0E42\u0E2B\u0E25\u0E14 Google Identity Services \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E25\u0E2D\u0E07\u0E23\u0E35\u0E40\u0E1F\u0E23\u0E0A\u0E2B\u0E19\u0E49\u0E32\u0E43\u0E2B\u0E21\u0E48",
      eFolderFind: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP {c})",
      eFolderMake: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP {c})",
      eFileFind: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E44\u0E1F\u0E25\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP {c})",
      eDownload: "\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP {c})",
      eUpload: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E36\u0E49\u0E19 Drive \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP {c})"
    },
    en: {
      title: "Legal work",
      subtitle: "Draft documents",
      pageTitle: "Legal work \u2014 draft documents | Tanot",
      openNav: "Open drafts menu",
      closeNav: "Close menu",
      drafts: "Drafts",
      newDrafts: "New drafts",
      savedDrafts: "Saved drafts",
      noDrafts: "No saved drafts yet",
      delDraft: "Delete draft",
      editingSaved: "(editing a saved draft)",
      attach: "Attach image",
      dlWord: "Download Word",
      print: "Print",
      saveDraft: "Save draft",
      checklistFor: "Documents to prepare for ",
      nameTitle: "Name this draft",
      namePh: "e.g. Lease dispute - Mr. Somchai",
      cancel: "Cancel",
      save: "Save",
      sync: "Sync",
      syncing: "Syncing...",
      syncConnecting: "Connecting to Google...",
      syncOk: "Synced",
      back: "Back to Tanot",
      flashSaved: 'Saved draft "{name}"',
      flashDeleted: "Draft deleted",
      flashImage: "Image attached to the document",
      confirmDelete: "Delete this draft permanently?",
      eGis: "Could not load Google Identity Services. Try reloading the page",
      eFolderFind: "Could not search for the folder (HTTP {c})",
      eFolderMake: "Could not create the folder (HTTP {c})",
      eFileFind: "Could not search for the file (HTTP {c})",
      eDownload: "Download failed (HTTP {c})",
      eUpload: "Could not save to Drive (HTTP {c})"
    }
  });
  window.OME_PAGE_LIVE_LANG = true;
  const tErr = (key, vars) => Object.assign(new Error(T(key, vars)), { tkey: key, tvars: vars });
  const statusText = (st) => !st ? "" : st.tkey ? T(st.tkey, st.tvars) : st.raw || "";
  const icon = (name, cls) => () => /* @__PURE__ */ React.createElement("span", { className: "inline-flex", dangerouslySetInnerHTML: { __html: `<i data-lucide="${name}" class="${cls}"></i>` } });
  const FileText = icon("file-text", "w-5 h-5");
  const Image = icon("image", "w-4 h-4");
  const Download = icon("download", "w-4 h-4");
  const Printer = icon("printer", "w-4 h-4");
  const Save = icon("save", "w-4 h-4");
  const Trash = icon("trash-2", "w-4 h-4");
  const Menu = icon("menu", "w-5 h-5");
  const CloseIcon = icon("x", "w-5 h-5");
  const CheckSquare = icon("check-square", "w-4 h-4");
  const Square = icon("square", "w-4 h-4");
  const FolderOpen = icon("folder-open", "w-4 h-4");
  const Scale = icon("scale", "w-5 h-5");
  function loadDrafts() {
    try {
      return JSON.parse(localStorage.getItem("legal:drafts") || "{}");
    } catch {
      return {};
    }
  }
  function saveDrafts(v) {
    localStorage.setItem("legal:drafts", JSON.stringify(v));
  }
  function mergeDrafts(a, b) {
    const ids = /* @__PURE__ */ new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    const out = {};
    ids.forEach((id) => {
      const da = a && a[id], db = b && b[id];
      out[id] = !da ? db : !db ? da : (da.updatedAt || 0) >= (db.updatedAt || 0) ? da : db;
    });
    return out;
  }
  function loadChecked() {
    try {
      return JSON.parse(localStorage.getItem("legal:checked") || "{}");
    } catch {
      return {};
    }
  }
  function saveChecked(v) {
    localStorage.setItem("legal:checked", JSON.stringify(v));
  }
  function mergeChecked(a, b) {
    const keys = /* @__PURE__ */ new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    const out = {};
    keys.forEach((k) => {
      const la = a && a[k] || [], lb = b && b[k] || [];
      const len = Math.max(la.length, lb.length);
      const arr = [];
      for (let i = 0; i < len; i++) arr[i] = !!(la[i] || lb[i]);
      out[k] = arr;
    });
    return out;
  }
  const DRIVE_CLIENT_ID = "497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const DRIVE_FOLDER_NAME = "OME_Progress";
  const DRIVE_FILE_NAME = "legal-drafts.json";
  const DriveSync = {
    tokenClient: null,
    accessToken: null,
    folderId: null,
    ensureAuth() {
      return new Promise((resolve, reject) => {
        if (!window.google || !google.accounts || !google.accounts.oauth2) {
          reject(tErr("eGis"));
          return;
        }
        if (!this.tokenClient) {
          this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: DRIVE_CLIENT_ID,
            scope: DRIVE_SCOPE,
            callback: (resp) => {
              if (resp.error) {
                reject(new Error(resp.error));
                return;
              }
              this.accessToken = resp.access_token;
              resolve(this.accessToken);
            }
          });
        }
        this.tokenClient.requestAccessToken({ prompt: this.accessToken ? "" : "consent" });
      });
    },
    async ensureFolder() {
      if (this.folderId) return this.folderId;
      const q = encodeURIComponent(`name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
        { headers: { Authorization: "Bearer " + this.accessToken } }
      );
      if (!res.ok) throw tErr("eFolderFind", { c: res.status });
      const data = await res.json();
      if (data.files && data.files.length) {
        this.folderId = data.files[0].id;
        return this.folderId;
      }
      const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: { Authorization: "Bearer " + this.accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" })
      });
      if (!createRes.ok) throw tErr("eFolderMake", { c: createRes.status });
      const createData = await createRes.json();
      this.folderId = createData.id;
      return this.folderId;
    },
    async findFile(name, folderId) {
      const q = encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`);
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
        { headers: { Authorization: "Bearer " + this.accessToken } }
      );
      if (!res.ok) throw tErr("eFileFind", { c: res.status });
      const data = await res.json();
      return data.files && data.files[0] || null;
    },
    async downloadFile(fileId) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: "Bearer " + this.accessToken } }
      );
      if (!res.ok) throw tErr("eDownload", { c: res.status });
      return res.json();
    },
    async uploadFile(name, folderId, existingId, obj) {
      const form = new FormData();
      const metadata = existingId ? {} : { name, parents: [folderId] };
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", new Blob([JSON.stringify(obj)], { type: "application/json" }));
      const url = existingId ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart` : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
      const res = await fetch(url, {
        method: existingId ? "PATCH" : "POST",
        headers: { Authorization: "Bearer " + this.accessToken },
        body: form
      });
      if (!res.ok) throw tErr("eUpload", { c: res.status });
      return res.json();
    }
  };
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function App() {
    const hashType = TYPE_IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : null;
    const [activeType, setActiveType] = useState(hashType || "plaint");
    const [content, setContent] = useState(TEMPLATES[hashType || "plaint"].html);
    const [activeDraftId, setActiveDraftId] = useState(null);
    const [drafts, setDrafts] = useState(loadDrafts());
    const [checked, setChecked] = useState(loadChecked());
    const [notice, setNotice] = useState(null);
    const [nameModal, setNameModal] = useState(false);
    const [draftName, setDraftName] = useState("");
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState(null);
    const [lang, setLang] = useState(OME_I18N.lang());
    useEffect(() => OME_LANG.onChange((l) => setLang(l)), []);
    useEffect(() => {
      document.title = T("pageTitle");
    }, [lang]);
    const nameDlgRef = useRef(null);
    useEffect(() => {
      const d = nameDlgRef.current;
      if (!d) return;
      if (nameModal && !d.open) d.showModal();
      if (!nameModal && d.open) d.close();
    }, [nameModal]);
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);
    useEffect(() => {
      lucide.createIcons();
    });
    useEffect(() => {
      saveDrafts(drafts);
    }, [drafts]);
    useEffect(() => {
      saveChecked(checked);
    }, [checked]);
    useEffect(() => {
      if (editorRef.current) editorRef.current.innerHTML = content;
    }, [activeType, activeDraftId]);
    const draftList = useMemo(
      () => Object.entries(drafts).map(([id, d]) => ({ id, ...d })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
      [drafts]
    );
    const flash = (tkey, tvars) => {
      setNotice({ tkey, tvars });
      setTimeout(() => setNotice(null), 4e3);
    };
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
      setDrafts((d) => ({ ...d, [id]: { type: activeType, name: draftName.trim() || TEMPLATES[activeType].title, html, updatedAt: Date.now() } }));
      setActiveDraftId(id);
      setContent(html);
      setNameModal(false);
      flash("flashSaved", { name: draftName.trim() || TEMPLATES[activeType].title });
    };
    const deleteDraft = async (id) => {
      if (!await window.tanotConfirmDelete(null, { message: T("confirmDelete") })) return;
      setDrafts((d) => {
        const { [id]: _, ...rest } = d;
        return rest;
      });
      if (activeDraftId === id) loadTemplate(activeType);
      flash("flashDeleted");
    };
    const toggleCheck = (i) => {
      setChecked((c) => {
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
        document.execCommand("insertImage", false, reader.result);
        flash("flashImage");
      };
      reader.readAsDataURL(file);
    };
    const downloadDoc = () => {
      const html = editorRef.current ? editorRef.current.innerHTML : content;
      const full = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
      const blob = new Blob(["\uFEFF", full], { type: "application/msword" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (activeDraftId && drafts[activeDraftId] ? drafts[activeDraftId].name : TEMPLATES[activeType].title) + ".doc";
      a.click();
    };
    const printDoc = () => window.print();
    const syncNow = async () => {
      setSyncing(true);
      setSyncStatus({ tkey: "syncConnecting" });
      try {
        await DriveSync.ensureAuth();
        setSyncStatus({ tkey: "syncing" });
        const folderId = await DriveSync.ensureFolder();
        const existing = await DriveSync.findFile(DRIVE_FILE_NAME, folderId);
        const remote = existing ? await DriveSync.downloadFile(existing.id) : null;
        const mergedDrafts = mergeDrafts(remote == null ? void 0 : remote.drafts, drafts);
        const mergedChecked = mergeChecked(remote == null ? void 0 : remote.checked, checked);
        setDrafts(mergedDrafts);
        setChecked(mergedChecked);
        await DriveSync.uploadFile(
          DRIVE_FILE_NAME,
          folderId,
          existing == null ? void 0 : existing.id,
          { drafts: mergedDrafts, checked: mergedChecked, savedAt: (/* @__PURE__ */ new Date()).toISOString() }
        );
        setSyncStatus({ tkey: "syncOk" });
      } catch (e) {
        setSyncStatus(e && e.tkey ? { tkey: e.tkey, tvars: e.tvars } : { raw: "" + (e.message || e) });
      } finally {
        setSyncing(false);
      }
    };
    return /* @__PURE__ */ React.createElement("div", { className: "h-[calc(100vh-48px)] w-full flex flex-col bg-slate-50 font-sans" }, /* @__PURE__ */ React.createElement("header", { className: "min-h-[56px] bg-white border-b border-slate-200 flex items-center flex-wrap gap-x-3 gap-y-2 justify-between px-4 sm:px-6 py-2 shrink-0 z-10" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 min-w-0" }, /* @__PURE__ */ React.createElement("button", { "data-k": "menu", onClick: () => setMobileNavOpen(true), className: "btn ghost icon md:hidden -ml-2", "aria-label": T("openNav") }, /* @__PURE__ */ React.createElement(Menu, null)), /* @__PURE__ */ React.createElement("div", { className: "w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white" }, /* @__PURE__ */ React.createElement(Scale, null)), /* @__PURE__ */ React.createElement("h1", { className: "text-lg font-bold text-slate-800" }, T("title"), " ", /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline text-slate-500 font-normal" }, "| ", T("subtitle")))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("button", { "data-k": "sync", onClick: syncNow, disabled: syncing, className: "btn sm" }, syncing ? T("syncing") : /* @__PURE__ */ React.createElement(React.Fragment, null, T("sync"), /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline" }, " Google Drive"))), syncStatus && /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline text-sm text-slate-500" }, statusText(syncStatus)), /* @__PURE__ */ React.createElement("a", { href: "./index.html", className: "btn ghost sm" }, "\u2190 ", T("back")))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-1 overflow-hidden relative" }, mobileNavOpen && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-x-0 bottom-0 top-12 bg-black/30 z-30 md:hidden", onClick: () => setMobileNavOpen(false) }), /* @__PURE__ */ React.createElement("aside", { className: `fixed md:static top-12 bottom-0 left-0 z-40 w-80 max-w-[88vw] bg-white border-r border-slate-200 overflow-y-auto flex flex-col shrink-0 p-3 transform transition-transform duration-200 md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}` }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-2 md:hidden" }, /* @__PURE__ */ React.createElement("span", { className: "text-base font-bold text-slate-800" }, T("drafts")), /* @__PURE__ */ React.createElement("button", { "data-k": "closeNav", onClick: () => setMobileNavOpen(false), className: "btn ghost icon", "aria-label": T("closeNav") }, /* @__PURE__ */ React.createElement(CloseIcon, null))), /* @__PURE__ */ React.createElement("div", { className: "text-sm font-bold text-slate-500 mb-2 px-1" }, T("newDrafts")), /* @__PURE__ */ React.createElement("div", { className: "space-y-1 mb-6", "data-i18n-skip": true }, TYPE_IDS.map((id) => {
      const active = !activeDraftId && activeType === id;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: id,
          "data-k": "template",
          "data-tid": id,
          onClick: () => loadTemplate(id),
          "aria-current": active ? "true" : void 0,
          className: `list-row !border-0 w-full text-left rounded-lg ${active ? "bg-blue-50 text-slate-800 font-semibold" : ""}`
        },
        /* @__PURE__ */ React.createElement(FileText, { className: "shrink-0" }),
        /* @__PURE__ */ React.createElement("span", { className: "grow leading-tight" }, TEMPLATES[id].title)
      );
    })), /* @__PURE__ */ React.createElement("div", { className: "text-sm font-bold text-slate-500 mb-2 px-1 flex items-center gap-1.5" }, /* @__PURE__ */ React.createElement(FolderOpen, null), " ", T("savedDrafts"), " (", draftList.length, ")"), draftList.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 px-1" }, T("noDrafts")) : /* @__PURE__ */ React.createElement("div", { className: "space-y-1", "data-i18n-skip": true }, draftList.map((d) => {
      var _a;
      return /* @__PURE__ */ React.createElement("div", { key: d.id, className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          "data-k": "draft",
          "data-did": d.id,
          onClick: () => openDraft(d.id),
          "aria-current": activeDraftId === d.id ? "true" : void 0,
          className: `list-row !border-0 text-left rounded-lg flex-1 min-w-0 ${activeDraftId === d.id ? "bg-blue-50 text-slate-800 font-semibold" : ""}`
        },
        /* @__PURE__ */ React.createElement("span", { className: "grow min-w-0" }, /* @__PURE__ */ React.createElement("span", { className: "block text-sm truncate" }, d.name), /* @__PURE__ */ React.createElement("span", { className: "block text-sm text-slate-500 truncate" }, (_a = TEMPLATES[d.type]) == null ? void 0 : _a.title, " \xB7 ", OME_I18N.date(d.updatedAt)))
      ), /* @__PURE__ */ React.createElement("button", { "data-k": "delDraft", onClick: () => deleteDraft(d.id), className: "btn ghost icon sm shrink-0", "aria-label": T("delDraft") }, /* @__PURE__ */ React.createElement(Trash, null)));
    }))), /* @__PURE__ */ React.createElement("main", { className: "flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-3xl" }, notice && /* @__PURE__ */ React.createElement("div", { className: "callout ok mb-4", role: "status" }, T(notice.tkey, notice.tvars)), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 flex-wrap mb-4" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold text-slate-800" }, /* @__PURE__ */ React.createElement("span", { "data-i18n-skip": true }, activeDraftId && drafts[activeDraftId] ? drafts[activeDraftId].name : TEMPLATES[activeType].title), activeDraftId && /* @__PURE__ */ React.createElement("span", { className: "ml-2 text-sm font-normal text-slate-500" }, T("editingSaved"))), /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-2" }, /* @__PURE__ */ React.createElement("button", { "data-k": "attach", onClick: () => fileInputRef.current && fileInputRef.current.click(), className: "btn sm" }, /* @__PURE__ */ React.createElement(Image, null), " ", T("attach")), /* @__PURE__ */ React.createElement(
      "input",
      {
        ref: fileInputRef,
        type: "file",
        accept: "image/*",
        hidden: true,
        onChange: (e) => {
          const f = e.target.files && e.target.files[0];
          if (f) attachImage(f);
          e.target.value = "";
        }
      }
    ), /* @__PURE__ */ React.createElement("button", { "data-k": "download", onClick: downloadDoc, className: "btn sm" }, /* @__PURE__ */ React.createElement(Download, null), " ", T("dlWord")), /* @__PURE__ */ React.createElement("button", { "data-k": "print", onClick: printDoc, className: "btn sm" }, /* @__PURE__ */ React.createElement(Printer, null), " ", T("print")), /* @__PURE__ */ React.createElement("button", { "data-k": "saveDraft", onClick: startSave, className: "btn primary sm" }, /* @__PURE__ */ React.createElement(Save, null), " ", T("saveDraft")))), /* @__PURE__ */ React.createElement("div", { id: "printArea", className: "card mb-6 p-6 sm:p-8", "data-doc-area": true, "data-i18n-skip": true }, /* @__PURE__ */ React.createElement(
      "div",
      {
        ref: editorRef,
        className: "doc-editor text-slate-700",
        contentEditable: true,
        suppressContentEditableWarning: true,
        onInput: (e) => setContent(e.currentTarget.innerHTML)
      }
    )), TEMPLATES[activeType].checklist && TEMPLATES[activeType].checklist.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "card p-6" }, /* @__PURE__ */ React.createElement("h3", { className: "text-base font-bold text-slate-800 mb-3" }, T("checklistFor"), /* @__PURE__ */ React.createElement("span", { "data-i18n-skip": true }, TEMPLATES[activeType].title)), /* @__PURE__ */ React.createElement("div", { className: "space-y-1", "data-i18n-skip": true }, TEMPLATES[activeType].checklist.map((item, i) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: i,
        "data-k": "check",
        onClick: () => toggleCheck(i),
        "aria-pressed": !!checkedArr[i],
        className: "list-row !border-0 w-full text-left rounded-lg items-start"
      },
      /* @__PURE__ */ React.createElement("span", { className: checkedArr[i] ? "text-success shrink-0 mt-0.5" : "text-slate-500 shrink-0 mt-0.5" }, checkedArr[i] ? /* @__PURE__ */ React.createElement(CheckSquare, null) : /* @__PURE__ */ React.createElement(Square, null)),
      /* @__PURE__ */ React.createElement("span", { className: `grow ${checkedArr[i] ? "text-slate-500 line-through" : "text-slate-700"}` }, item)
    ))))))), /* @__PURE__ */ React.createElement("dialog", { ref: nameDlgRef, className: "dialog", onClose: () => setNameModal(false), onClick: (e) => {
      if (e.target === nameDlgRef.current) setNameModal(false);
    } }, /* @__PURE__ */ React.createElement("div", { className: "dialog-head" }, /* @__PURE__ */ React.createElement("h3", null, T("nameTitle"))), /* @__PURE__ */ React.createElement("div", { className: "dialog-body" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        "data-k": "draftName",
        type: "text",
        value: draftName,
        onChange: (e) => setDraftName(e.target.value),
        onKeyDown: (e) => e.key === "Enter" && confirmSave(),
        autoFocus: true,
        placeholder: T("namePh"),
        "aria-label": T("nameTitle"),
        className: "input w-full"
      }
    )), /* @__PURE__ */ React.createElement("div", { className: "dialog-foot" }, /* @__PURE__ */ React.createElement("button", { "data-k": "nameCancel", onClick: () => setNameModal(false), className: "btn" }, T("cancel")), /* @__PURE__ */ React.createElement("button", { "data-k": "nameSave", onClick: confirmSave, className: "btn primary" }, T("save")))));
  }
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(/* @__PURE__ */ React.createElement(App, null));
})();
