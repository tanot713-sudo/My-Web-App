(() => {
  const { useState, useEffect, useMemo, useRef } = React;
  const COURSE = JSON.parse(document.getElementById("course-data").textContent);
  const icon = (name, cls) => () => /* @__PURE__ */ React.createElement("span", { className: "inline-flex", dangerouslySetInnerHTML: { __html: `<i data-lucide="${name}" class="${cls}"></i>` } });
  const Play = icon("play-circle", "w-5 h-5");
  const Check = icon("check-circle-2", "w-5 h-5 text-success");
  const Clock = icon("clock", "w-4 h-4");
  const Bookmark = icon("bookmark", "w-4 h-4");
  const Trophy = icon("trophy", "w-4 h-4 text-accent");
  const Target = icon("target", "w-4 h-4");
  const Scale = icon("scale", "w-4 h-4");
  const Briefcase = icon("briefcase", "w-4 h-4");
  const Wrench = icon("wrench", "w-4 h-4");
  const Zap = icon("zap", "w-4 h-4");
  const ChevronDown = icon("chevron-down", "w-4 h-4");
  const PenLine = icon("pen-line", "w-5 h-5");
  const Menu = icon("menu", "w-5 h-5");
  const CloseIcon = icon("x", "w-5 h-5");
  const NotebookIcon = icon("notebook-pen", "w-5 h-5");
  const enrich = (t) => ({
    id: t.id,
    title: t.title,
    kind: t.quiz && t.quiz.length ? "quiz" : "reflection",
    data: t
  });
  const hasSummary = (t) => !!(t.data && (t.data.overview || t.data.lesson || (t.data.keyConcepts || []).length));
  const SUBJECTS = [
    { id: "engineering", label: "\u0E27\u0E34\u0E28\u0E27\u0E01\u0E23\u0E23\u0E21", icon: Wrench, topics: COURSE.engineering.map(enrich) },
    { id: "elec-maint", label: "\u0E1A\u0E33\u0E23\u0E38\u0E07\u0E23\u0E31\u0E01\u0E29\u0E32\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E1F\u0E1F\u0E49\u0E32", icon: Zap, topics: (COURSE["elec-maint"] || []).map(enrich) }
  ];
  function reflectionPrompts(title) {
    return [
      `\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E2B\u0E25\u0E31\u0E01\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E02\u0E2D\u0E07 "${title}" \u0E15\u0E32\u0E21\u0E04\u0E27\u0E32\u0E21\u0E40\u0E02\u0E49\u0E32\u0E43\u0E08\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13`,
      `\u0E22\u0E01\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E08\u0E23\u0E34\u0E07\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E04\u0E27\u0E32\u0E21\u0E23\u0E39\u0E49\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07 "${title}"`
    ];
  }
  function loadXp() {
    try {
      return JSON.parse(localStorage.getItem("lbe:engineering:xp") || "1250");
    } catch {
      return 1250;
    }
  }
  function saveXp(v) {
    localStorage.setItem("lbe:engineering:xp", JSON.stringify(v));
  }
  function loadWritten() {
    try {
      return JSON.parse(localStorage.getItem("lbe:engineering:written") || "{}");
    } catch {
      return {};
    }
  }
  function saveWritten(v) {
    localStorage.setItem("lbe:engineering:written", JSON.stringify(v));
  }
  function loadCompleted() {
    try {
      return JSON.parse(localStorage.getItem("lbe:engineering:completed") || "{}");
    } catch {
      return {};
    }
  }
  function saveCompleted(v) {
    localStorage.setItem("lbe:engineering:completed", JSON.stringify(v));
  }
  function loadNotes() {
    try {
      return JSON.parse(localStorage.getItem("lbe:engineering:notes") || "{}");
    } catch {
      return {};
    }
  }
  function saveNotes(v) {
    localStorage.setItem("lbe:engineering:notes", JSON.stringify(v));
  }
  function mergeNotes(a, b) {
    const keys = /* @__PURE__ */ new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    const out = {};
    keys.forEach((k) => {
      const na = a && a[k], nb = b && b[k];
      if (!na) {
        out[k] = nb;
        return;
      }
      if (!nb) {
        out[k] = na;
        return;
      }
      out[k] = (na.updatedAt || 0) >= (nb.updatedAt || 0) ? na : nb;
    });
    return out;
  }
  const QUESTION_BANK = [];
  SUBJECTS.forEach((s) => s.topics.forEach((t) => {
    if (t.kind !== "quiz") return;
    t.data.quiz.forEach((q, i) => QUESTION_BANK.push({
      qKey: `${s.id}:${t.id}:${i}`,
      subjId: s.id,
      topicId: t.id,
      topicTitle: t.title,
      q: q.q,
      refAnswer: q.options[q.answer]
    }));
  }));
  const QUESTION_BY_KEY = Object.fromEntries(QUESTION_BANK.map((q) => [q.qKey, q]));
  const SRS_STEPS = [1, 3, 7, 14, 30];
  const DAY_MS = 864e5;
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
    try {
      return JSON.parse(localStorage.getItem("lbe:engineering:srs") || "{}");
    } catch {
      return {};
    }
  }
  function saveSrs(v) {
    localStorage.setItem("lbe:engineering:srs", JSON.stringify(v));
  }
  function mergeSrs(a, b) {
    const keys = /* @__PURE__ */ new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    const out = {};
    keys.forEach((k) => {
      const va = a && a[k], vb = b && b[k];
      out[k] = !va ? vb : !vb ? va : (va.due || 0) >= (vb.due || 0) ? va : vb;
    });
    return out;
  }
  function loadExams() {
    try {
      return JSON.parse(localStorage.getItem("lbe:engineering:exams") || "[]");
    } catch {
      return [];
    }
  }
  function saveExams(v) {
    localStorage.setItem("lbe:engineering:exams", JSON.stringify(v));
  }
  function mergeExams(a, b) {
    const seen = {};
    [...a || [], ...b || []].forEach((e) => {
      if (e && e.date) seen[e.date] = e;
    });
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
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function mdToHtml(src) {
    const inline = (t) => t.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/==([^=]+)==/g, "<mark>$1</mark>");
    let html = "", inUl = false, inOl = false;
    const closeLists = () => {
      if (inUl) {
        html += "</ul>";
        inUl = false;
      }
      if (inOl) {
        html += "</ol>";
        inOl = false;
      }
    };
    escapeHtml(src || "").split("\n").forEach((raw) => {
      const l = raw.trimEnd();
      if (/^###\s/.test(l)) {
        closeLists();
        html += "<h4>" + inline(l.slice(4)) + "</h4>";
      } else if (/^##\s/.test(l)) {
        closeLists();
        html += "<h3>" + inline(l.slice(3)) + "</h3>";
      } else if (/^#\s/.test(l)) {
        closeLists();
        html += "<h2>" + inline(l.slice(2)) + "</h2>";
      } else if (/^[-*]\s/.test(l)) {
        if (!inUl) {
          closeLists();
          html += "<ul>";
          inUl = true;
        }
        html += "<li>" + inline(l.slice(2)) + "</li>";
      } else if (/^\d+\.\s/.test(l)) {
        if (!inOl) {
          closeLists();
          html += "<ol>";
          inOl = true;
        }
        html += "<li>" + inline(l.replace(/^\d+\.\s/, "")) + "</li>";
      } else if (l === "") closeLists();
      else {
        closeLists();
        html += "<p>" + inline(l) + "</p>";
      }
    });
    closeLists();
    return html;
  }
  const DRIVE_CLIENT_ID = "497048581273-akpavakt6m34lhqbjf1irg3m8vl6u27u.apps.googleusercontent.com";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
  const DRIVE_FOLDER_NAME = "OME_Progress";
  const DRIVE_FILE_NAME = "lbe-engineering-progress.json";
  const DriveSync = {
    tokenClient: null,
    accessToken: null,
    folderId: null,
    ensureAuth() {
      return new Promise((resolve, reject) => {
        if (!window.google || !google.accounts || !google.accounts.oauth2) {
          reject(new Error("\u0E42\u0E2B\u0E25\u0E14 Google Identity Services \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E25\u0E2D\u0E07\u0E23\u0E35\u0E40\u0E1F\u0E23\u0E0A\u0E2B\u0E19\u0E49\u0E32\u0E43\u0E2B\u0E21\u0E48"));
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
      if (!res.ok) throw new Error("\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP " + res.status + ")");
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
      if (!createRes.ok) throw new Error("\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP " + createRes.status + ")");
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
      if (!res.ok) throw new Error("\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E44\u0E1F\u0E25\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP " + res.status + ")");
      const data = await res.json();
      return data.files && data.files[0] || null;
    },
    async downloadFile(fileId) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: "Bearer " + this.accessToken } }
      );
      if (!res.ok) throw new Error("\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP " + res.status + ")");
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
      if (!res.ok) throw new Error("\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E36\u0E49\u0E19 Drive \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP " + res.status + ")");
      return res.json();
    }
  };
  function App() {
    var _a, _b;
    const initialSubject = "engineering";
    const [view, setView] = useState("stream");
    const [activeSubject, setActiveSubject] = useState(initialSubject);
    const [activeTopicId, setActiveTopicId] = useState(SUBJECTS.find((s) => s.id === initialSubject).topics[0].id);
    const [activeTab, setActiveTab] = useState(hasSummary(SUBJECTS.find((s) => s.id === initialSubject).topics[0]) ? "summary" : "quiz");
    const [openGroups, setOpenGroups] = useState(Object.fromEntries(SUBJECTS.map((s) => [s.id, s.id === initialSubject])));
    const [qIndex, setQIndex] = useState(0);
    const [answerText, setAnswerText] = useState("");
    const [revealed, setRevealed] = useState(false);
    const [selfMark, setSelfMark] = useState(null);
    const [xp, setXp] = useState(loadXp());
    const [written, setWritten] = useState(loadWritten());
    const [completed, setCompleted] = useState(loadCompleted());
    const [notes, setNotes] = useState(loadNotes());
    const [srs, setSrs] = useState(loadSrs());
    const [exams, setExams] = useState(loadExams());
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState("");
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [revList, setRevList] = useState([]);
    const [revIndex, setRevIndex] = useState(0);
    const [revAnswer, setRevAnswer] = useState("");
    const [revRevealed, setRevRevealed] = useState(false);
    const [examList, setExamList] = useState([]);
    const [examIndex, setExamIndex] = useState(0);
    const [examAnswer, setExamAnswer] = useState("");
    const [examRevealed, setExamRevealed] = useState(false);
    const [examScore, setExamScore] = useState(0);
    const [examStart, setExamStart] = useState(null);
    const [notePreview, setNotePreview] = useState(false);
    const [notesQuery, setNotesQuery] = useState("");
    useEffect(() => {
      if (window.lucide) lucide.createIcons();
    });
    const xpPrevRef = useRef(xp);
    const xpFromDriveRef = useRef(false);
    useEffect(() => {
      const gained = xp - xpPrevRef.current;
      xpPrevRef.current = xp;
      if (xpFromDriveRef.current) {
        xpFromDriveRef.current = false;
        return;
      }
      if (gained > 0 && window.LearnCore) window.LearnCore.award("eng", gained);
    }, [xp]);
    useEffect(() => {
      saveXp(xp);
    }, [xp]);
    useEffect(() => {
      saveWritten(written);
    }, [written]);
    useEffect(() => {
      saveCompleted(completed);
    }, [completed]);
    useEffect(() => {
      saveNotes(notes);
    }, [notes]);
    useEffect(() => {
      saveSrs(srs);
    }, [srs]);
    useEffect(() => {
      saveExams(exams);
    }, [exams]);
    const dueKeys = Object.keys(srs).filter((k) => QUESTION_BY_KEY[k] && srs[k].due <= Date.now());
    const startReview = () => {
      setRevList(shuffled(dueKeys));
      setRevIndex(0);
      setRevAnswer("");
      setRevRevealed(false);
      setView("review");
    };
    const markReview = (correct) => {
      const key = revList[revIndex];
      setSrs((s) => ({ ...s, [key]: nextSrs(s[key], correct) }));
      if (correct) setXp((x) => x + 30);
      setRevIndex((i) => i + 1);
      setRevAnswer("");
      setRevRevealed(false);
    };
    const startExam = (n) => {
      setExamList(shuffled(QUESTION_BANK).slice(0, n));
      setExamIndex(0);
      setExamAnswer("");
      setExamRevealed(false);
      setExamScore(0);
      setExamStart(Date.now());
      setView("exam");
    };
    const markExam = (correct) => {
      const q = examList[examIndex];
      setSrs((s) => ({ ...s, [q.qKey]: nextSrs(s[q.qKey], correct) }));
      if (correct) {
        setExamScore((sc) => sc + 1);
        setXp((x) => x + 20);
      }
      const isLast = examIndex + 1 >= examList.length;
      if (isLast) {
        const finalScore = examScore + (correct ? 1 : 0);
        setExams((ex) => mergeExams(ex, [{
          date: (/* @__PURE__ */ new Date()).toISOString(),
          score: finalScore,
          total: examList.length,
          sec: Math.round((Date.now() - examStart) / 1e3)
        }]));
      }
      setExamIndex((i) => i + 1);
      setExamAnswer("");
      setExamRevealed(false);
    };
    const syncNow = async () => {
      setSyncing(true);
      setSyncStatus("\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D Google...");
      try {
        await DriveSync.ensureAuth();
        setSyncStatus("\u0E01\u0E33\u0E25\u0E31\u0E07\u0E0B\u0E34\u0E07\u0E01\u0E4C...");
        const folderId = await DriveSync.ensureFolder();
        const existing = await DriveSync.findFile(DRIVE_FILE_NAME, folderId);
        const remote = existing ? await DriveSync.downloadFile(existing.id) : null;
        const mergedXp = Math.max(xp, (remote == null ? void 0 : remote.xp) || 0);
        const mergedCompleted = { ...(remote == null ? void 0 : remote.completed) || {}, ...completed };
        const mergedWritten = { ...(remote == null ? void 0 : remote.written) || {}, ...written };
        const mergedNotes = mergeNotes(remote == null ? void 0 : remote.notes, notes);
        const mergedSrs = mergeSrs(remote == null ? void 0 : remote.srs, srs);
        const mergedExams = mergeExams(remote == null ? void 0 : remote.exams, exams);
        if (mergedXp !== xp) xpFromDriveRef.current = true;
        setXp(mergedXp);
        setCompleted(mergedCompleted);
        setWritten(mergedWritten);
        setNotes(mergedNotes);
        setSrs(mergedSrs);
        setExams(mergedExams);
        await DriveSync.uploadFile(
          DRIVE_FILE_NAME,
          folderId,
          existing == null ? void 0 : existing.id,
          {
            xp: mergedXp,
            completed: mergedCompleted,
            written: mergedWritten,
            notes: mergedNotes,
            srs: mergedSrs,
            exams: mergedExams,
            savedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        );
        setSyncStatus("\u0E0B\u0E34\u0E07\u0E01\u0E4C\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08");
      } catch (e) {
        setSyncStatus("" + (e.message || e));
      } finally {
        setSyncing(false);
      }
    };
    const subject = SUBJECTS.find((s) => s.id === activeSubject);
    const topic = subject.topics.find((t) => t.id === activeTopicId) || subject.topics[0];
    const questions = useMemo(() => {
      if (topic.kind === "quiz") {
        return topic.data.quiz.map((q) => ({ q: q.q, refAnswer: q.options[q.answer], hasKey: true }));
      }
      return reflectionPrompts(topic.title).map((q) => ({ q, refAnswer: null, hasKey: false }));
    }, [topic]);
    const level = Math.floor(xp / 250) + 1;
    const noteKey = `${activeSubject}:${topic.id}`;
    const noteText = notes[noteKey] && notes[noteKey].text || "";
    const updateNote = (text) => setNotes((n) => ({ ...n, [noteKey]: { text, updatedAt: Date.now() } }));
    const allTopics = useMemo(() => SUBJECTS.flatMap((s) => s.topics.map((t) => ({ subjId: s.id, subjLabel: s.label, ...t }))), []);
    const topicByKey = useMemo(() => Object.fromEntries(allTopics.map((t) => [`${t.subjId}:${t.id}`, t])), []);
    const totalTopics = allTopics.length;
    const completedCount = allTopics.filter((t) => completed[`${t.subjId}:${t.id}`]).length;
    const todoTopics = allTopics.filter((t) => !completed[`${t.subjId}:${t.id}`]);
    const subjectStats = SUBJECTS.map((s) => ({
      ...s,
      done: s.topics.filter((t) => completed[`${s.id}:${t.id}`]).length,
      total: s.topics.length
    }));
    const selectTopic = (subjId, topicId) => {
      const t = SUBJECTS.find((s) => s.id === subjId).topics.find((x) => x.id === topicId);
      setActiveSubject(subjId);
      setActiveTopicId(topicId);
      setActiveTab(t && hasSummary(t) ? "summary" : "quiz");
      setQIndex(0);
      setAnswerText("");
      setRevealed(false);
      setSelfMark(null);
      setView("classwork");
      setMobileNavOpen(false);
    };
    const openSubject = (subjId) => {
      setOpenGroups((g) => ({ ...g, [subjId]: true }));
      if (subjId !== activeSubject) selectTopic(subjId, SUBJECTS.find((s) => s.id === subjId).topics[0].id);
      else setView("classwork");
    };
    const submitAnswer = () => {
      if (!answerText.trim()) return;
      setRevealed(true);
      const key = `${topic.id}:${qIndex}`;
      setWritten((w) => ({ ...w, [key]: answerText.trim() }));
      if (!questions[qIndex].hasKey) setXp((x) => x + 50);
    };
    const markSelf = (correct) => {
      setSelfMark(correct ? "correct" : "wrong");
      if (correct) setXp((x) => x + 100);
      if (topic.kind === "quiz") {
        const key = `${activeSubject}:${topic.id}:${qIndex}`;
        setSrs((s) => ({ ...s, [key]: nextSrs(s[key], correct) }));
      }
    };
    const nextQuestion = () => {
      setQIndex((i) => i + 1);
      setAnswerText("");
      setRevealed(false);
      setSelfMark(null);
    };
    const restartTopic = () => {
      setQIndex(0);
      setAnswerText("");
      setRevealed(false);
      setSelfMark(null);
    };
    const isDone = qIndex >= questions.length;
    useEffect(() => {
      if (!isDone) return;
      const key = `${activeSubject}:${topic.id}`;
      if (!completed[key]) setCompleted((c) => ({ ...c, [key]: true }));
    }, [isDone, activeSubject, topic.id]);
    return /* @__PURE__ */ React.createElement("div", { className: "h-[calc(100vh-48px)] w-full flex flex-col bg-slate-50 font-sans" }, /* @__PURE__ */ React.createElement("header", { className: "min-h-[64px] bg-white border-b border-slate-200 flex items-center flex-wrap gap-y-2 justify-between px-4 sm:px-6 py-2 shrink-0 z-10" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement("button", { onClick: () => setMobileNavOpen(true), className: "md:hidden -ml-1 p-1.5 text-slate-500 hover:text-slate-800", "aria-label": "\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E19\u0E39\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D" }, /* @__PURE__ */ React.createElement(Menu, null)), /* @__PURE__ */ React.createElement("div", { className: "w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold shrink-0" }, "\u0E27"), /* @__PURE__ */ React.createElement("h1", { className: "text-base sm:text-lg font-bold text-slate-800" }, "\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E23\u0E35\u0E22\u0E19\u0E27\u0E34\u0E28\u0E27\u0E01\u0E23\u0E23\u0E21 ", /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline text-slate-400 font-normal" }, "| Tanot"))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 sm:gap-4 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200" }, /* @__PURE__ */ React.createElement(Trophy, null), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold text-amber-600" }, "Level ", level), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-amber-500 font-medium" }, "(", xp, " XP)")), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: syncNow,
        disabled: syncing,
        className: "text-xs font-semibold text-slate-500 hover:text-secondary border border-slate-200 hover:border-secondary rounded-full px-3 py-1.5 disabled:opacity-50 transition-colors"
      },
      syncing ? "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E0B\u0E34\u0E07\u0E01\u0E4C..." : /* @__PURE__ */ React.createElement(React.Fragment, null, "\u0E0B\u0E34\u0E07\u0E01\u0E4C", /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline" }, " Google Drive"))
    ), syncStatus && /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline text-xs text-slate-400" }, syncStatus), /* @__PURE__ */ React.createElement("a", { href: "./index.html", className: "text-xs font-semibold text-slate-400 hover:text-slate-700" }, "\u2190 \u0E01\u0E25\u0E31\u0E1A Tanot"))), /* @__PURE__ */ React.createElement("div", { className: "h-11 bg-white border-b border-slate-200 flex items-center gap-4 sm:gap-6 px-4 sm:px-6 shrink-0 z-10 overflow-x-auto whitespace-nowrap" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setView("stream"),
        className: `h-full text-sm font-semibold border-b-2 transition-colors shrink-0 ${view === "stream" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"}`
      },
      "\u0E2A\u0E15\u0E23\u0E35\u0E21"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setView("classwork"),
        className: `h-full text-sm font-semibold border-b-2 transition-colors shrink-0 ${view === "classwork" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"}`
      },
      "\u0E07\u0E32\u0E19\u0E40\u0E23\u0E35\u0E22\u0E19"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: startReview,
        className: `h-full text-sm font-semibold border-b-2 transition-colors shrink-0 flex items-center gap-1.5 ${view === "review" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"}`
      },
      "\u0E17\u0E1A\u0E17\u0E27\u0E19",
      dueKeys.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full" }, dueKeys.length)
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => {
          setExamList([]);
          setExamIndex(0);
          setView("exam");
        },
        className: `h-full text-sm font-semibold border-b-2 transition-colors shrink-0 ${view === "exam" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"}`
      },
      "\u0E2A\u0E2D\u0E1A\u0E23\u0E27\u0E21"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setView("allnotes"),
        className: `h-full text-sm font-semibold border-b-2 transition-colors shrink-0 ${view === "allnotes" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"}`
      },
      "\u0E42\u0E19\u0E49\u0E15\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14"
    )), view === "stream" ? /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-4xl mx-auto p-4 sm:p-6 space-y-6" }, /* @__PURE__ */ React.createElement("div", { className: "rounded-2xl bg-gradient-to-br from-primary to-secondary p-6 sm:p-8 text-white shadow-lg" }, /* @__PURE__ */ React.createElement("p", { className: "text-xs uppercase tracking-widest text-slate-300 mb-2" }, "\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E23\u0E35\u0E22\u0E19"), /* @__PURE__ */ React.createElement("h2", { className: "text-2xl font-bold mb-2" }, "\u0E27\u0E34\u0E28\u0E27\u0E01\u0E23\u0E23\u0E21"), /* @__PURE__ */ React.createElement("div", { className: "mt-6 flex items-center gap-4 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-[200px] max-w-xs" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-xs text-slate-300 mb-1" }, /* @__PURE__ */ React.createElement("span", null, "\u0E04\u0E27\u0E32\u0E21\u0E04\u0E37\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E23\u0E27\u0E21"), /* @__PURE__ */ React.createElement("span", null, completedCount, "/", totalTopics)), /* @__PURE__ */ React.createElement("div", { className: "h-2 bg-white/20 rounded-full overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "h-full bg-accent rounded-full transition-all", style: { width: `${totalTopics ? completedCount / totalTopics * 100 : 0}%` } }))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full" }, /* @__PURE__ */ React.createElement(Trophy, null), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold" }, "Level ", level)))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4" }, subjectStats.map((s) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: s.id,
        onClick: () => openSubject(s.id),
        className: "text-left bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
      },
      /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 mb-3 text-slate-500" }, /* @__PURE__ */ React.createElement(s.icon, null), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold uppercase tracking-wide" }, s.label)),
      /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold text-slate-800 mb-2" }, s.done, "/", s.total, " \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D"),
      /* @__PURE__ */ React.createElement("div", { className: "h-1.5 bg-slate-100 rounded-full overflow-hidden" }, /* @__PURE__ */ React.createElement("div", { className: "h-full bg-secondary rounded-full", style: { width: `${s.total ? s.done / s.total * 100 : 0}%` } }))
    ))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-xl border border-slate-200 p-5" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-slate-800 mb-3 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Clock, null), " \u0E17\u0E1A\u0E17\u0E27\u0E19\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49"), dueKeys.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { className: "mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-3xl font-bold text-slate-800" }, dueKeys.length), " ", /* @__PURE__ */ React.createElement("span", { className: "text-sm text-slate-500" }, "\u0E02\u0E49\u0E2D\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E17\u0E1A\u0E17\u0E27\u0E19")), /* @__PURE__ */ React.createElement("button", { onClick: startReview, className: "px-5 py-2.5 bg-secondary text-white text-sm font-bold rounded-xl" }, "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E17\u0E1A\u0E17\u0E27\u0E19"))), /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-xl border border-slate-200 p-5" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-slate-800 mb-3 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Trophy, null), " \u0E2A\u0E2D\u0E1A\u0E23\u0E27\u0E21\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14"), exams.length === 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400 mb-4" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E2A\u0E2D\u0E1A"), /* @__PURE__ */ React.createElement("button", { onClick: () => {
      setExamList([]);
      setExamIndex(0);
      setView("exam");
    }, className: "px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl" }, "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E2D\u0E1A\u0E23\u0E27\u0E21")) : /* @__PURE__ */ React.createElement(React.Fragment, null, exams.slice(0, 3).map((e, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "flex justify-between text-sm py-1.5 border-b border-slate-50" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, new Date(e.date).toLocaleDateString("th-TH")), /* @__PURE__ */ React.createElement("span", { className: `font-bold ${e.score / e.total >= 0.7 ? "text-success" : "text-slate-700"}` }, e.score, "/", e.total))), /* @__PURE__ */ React.createElement("button", { onClick: () => {
      setExamList([]);
      setExamIndex(0);
      setView("exam");
    }, className: "mt-3 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl" }, "\u0E2A\u0E2D\u0E1A\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07")))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-xl border border-slate-200 p-5" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold text-slate-800 mb-4 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Target, null), " \u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E2A\u0E23\u0E47\u0E08"), todoTopics.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400" }, "\u0E17\u0E33\u0E04\u0E23\u0E1A\u0E17\u0E38\u0E01\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E41\u0E25\u0E49\u0E27 \u0E40\u0E22\u0E35\u0E48\u0E22\u0E21\u0E21\u0E32\u0E01!") : /* @__PURE__ */ React.createElement("div", { className: "space-y-1" }, todoTopics.slice(0, 6).map((t) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: `${t.subjId}:${t.id}`,
        onClick: () => selectTopic(t.subjId, t.id),
        className: "w-full flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-slate-50 text-left"
      },
      /* @__PURE__ */ React.createElement("span", { className: "text-sm text-slate-700 leading-tight" }, t.title),
      /* @__PURE__ */ React.createElement("span", { className: "text-[10px] font-bold text-slate-400 uppercase shrink-0" }, t.subjLabel)
    ))))))) : view === "review" ? /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-2xl mx-auto p-4 sm:p-6" }, revIndex >= revList.length ? /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-slate-200 p-10 text-center" }, revList.length === 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold text-slate-800 mb-8" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E17\u0E1A\u0E17\u0E27\u0E19")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5" }, /* @__PURE__ */ React.createElement(Trophy, null)), /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold text-slate-800 mb-8" }, "\u0E17\u0E1A\u0E17\u0E27\u0E19\u0E04\u0E23\u0E1A ", revList.length, " \u0E02\u0E49\u0E2D\u0E41\u0E25\u0E49\u0E27!")), /* @__PURE__ */ React.createElement("button", { onClick: () => setView("stream"), className: "px-6 py-3 bg-secondary text-white font-bold rounded-xl text-sm" }, "\u0E01\u0E25\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E2A\u0E15\u0E23\u0E35\u0E21")) : (() => {
      const rq = QUESTION_BY_KEY[revList[revIndex]];
      return /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-slate-200 p-6 sm:p-8" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center mb-5" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest" }, "\u0E17\u0E1A\u0E17\u0E27\u0E19 ", revIndex + 1, " / ", revList.length), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold bg-blue-50 text-secondary px-3 py-1 rounded-full" }, rq.topicTitle)), /* @__PURE__ */ React.createElement("h3", { className: "text-lg sm:text-xl font-bold text-slate-800 mb-5 leading-snug" }, rq.q), /* @__PURE__ */ React.createElement(
        "textarea",
        {
          value: revAnswer,
          onChange: (e) => setRevAnswer(e.target.value),
          disabled: revRevealed,
          rows: 4,
          placeholder: "\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13...",
          className: "w-full border-2 border-slate-200 focus:border-secondary outline-none rounded-xl p-4 text-sm text-slate-700 resize-none disabled:bg-slate-50"
        }
      ), /* @__PURE__ */ React.createElement("div", { className: "mt-5" }, !revRevealed ? /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: () => setRevRevealed(true),
          className: "w-full py-3 bg-primary text-white rounded-xl font-bold text-sm"
        },
        "\u0E14\u0E39\u0E40\u0E09\u0E25\u0E22"
      ) : /* @__PURE__ */ React.createElement("div", { className: "animate-fade-in-up" }, /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl mb-4 border bg-blue-50 border-blue-100" }, /* @__PURE__ */ React.createElement("h4", { className: "font-bold mb-1 text-secondary text-sm" }, "\u0E40\u0E09\u0E25\u0E22"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-700" }, rq.refAnswer)), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => markReview(true), className: "flex-1 py-3 rounded-xl bg-success text-white text-sm font-bold" }, "\u0E08\u0E33\u0E44\u0E14\u0E49 (+30 XP)"), /* @__PURE__ */ React.createElement("button", { onClick: () => markReview(false), className: "flex-1 py-3 rounded-xl bg-slate-200 text-slate-600 text-sm font-bold" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49 (\u0E16\u0E32\u0E21\u0E43\u0E2B\u0E21\u0E48\u0E1E\u0E23\u0E38\u0E48\u0E07\u0E19\u0E35\u0E49)")))));
    })())) : view === "exam" ? /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-2xl mx-auto p-4 sm:p-6" }, examList.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-slate-200 p-8 text-center" }, /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold text-slate-800 mb-8" }, "\u0E2A\u0E2D\u0E1A\u0E23\u0E27\u0E21"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 justify-center mb-8" }, /* @__PURE__ */ React.createElement("button", { onClick: () => startExam(10), className: "px-6 py-3 bg-secondary text-white font-bold rounded-xl text-sm" }, "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E2D\u0E1A 10 \u0E02\u0E49\u0E2D"), /* @__PURE__ */ React.createElement("button", { onClick: () => startExam(20), className: "px-6 py-3 bg-primary text-white font-bold rounded-xl text-sm" }, "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E2D\u0E1A 20 \u0E02\u0E49\u0E2D")), exams.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "text-left border-t border-slate-100 pt-5" }, /* @__PURE__ */ React.createElement("h4", { className: "text-xs font-bold text-slate-400 uppercase tracking-wider mb-3" }, "\u0E1C\u0E25\u0E2A\u0E2D\u0E1A\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14"), exams.slice(0, 5).map((e, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "flex justify-between text-sm py-1.5 border-b border-slate-50" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, new Date(e.date).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })), /* @__PURE__ */ React.createElement("span", { className: `font-bold ${e.score / e.total >= 0.7 ? "text-success" : "text-slate-700"}` }, e.score, "/", e.total, " (", Math.floor(e.sec / 60), ":", String(e.sec % 60).padStart(2, "0"), " \u0E19\u0E32\u0E17\u0E35)"))))) : examIndex >= examList.length ? /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-slate-200 p-10 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6" }, /* @__PURE__ */ React.createElement(Trophy, null)), /* @__PURE__ */ React.createElement("h2", { className: "text-2xl font-bold text-slate-800 mb-1" }, "\u0E44\u0E14\u0E49 ", examScore, " / ", examList.length, " \u0E04\u0E30\u0E41\u0E19\u0E19"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 mb-8" }, "\u0E43\u0E0A\u0E49\u0E40\u0E27\u0E25\u0E32 ", Math.floor((((_a = exams[0]) == null ? void 0 : _a.sec) || 0) / 60), ":", String((((_b = exams[0]) == null ? void 0 : _b.sec) || 0) % 60).padStart(2, "0"), " \u0E19\u0E32\u0E17\u0E35"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3 justify-center" }, /* @__PURE__ */ React.createElement("button", { onClick: () => {
      setExamList([]);
      setExamIndex(0);
    }, className: "px-6 py-3 bg-secondary text-white font-bold rounded-xl text-sm" }, "\u0E2A\u0E2D\u0E1A\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07"), /* @__PURE__ */ React.createElement("button", { onClick: () => setView("stream"), className: "px-6 py-3 border-2 border-slate-200 text-slate-700 font-bold rounded-xl text-sm" }, "\u0E01\u0E25\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E2A\u0E15\u0E23\u0E35\u0E21"))) : /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-slate-200 p-6 sm:p-8" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center mb-5" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest" }, "\u0E02\u0E49\u0E2D ", examIndex + 1, " / ", examList.length), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-semibold bg-blue-50 text-secondary px-3 py-1 rounded-full" }, examList[examIndex].topicTitle)), /* @__PURE__ */ React.createElement("h3", { className: "text-lg sm:text-xl font-bold text-slate-800 mb-5 leading-snug" }, examList[examIndex].q), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: examAnswer,
        onChange: (e) => setExamAnswer(e.target.value),
        disabled: examRevealed,
        rows: 4,
        placeholder: "\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13...",
        className: "w-full border-2 border-slate-200 focus:border-secondary outline-none rounded-xl p-4 text-sm text-slate-700 resize-none disabled:bg-slate-50"
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "mt-5" }, !examRevealed ? /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setExamRevealed(true),
        disabled: !examAnswer.trim(),
        className: `w-full py-3 rounded-xl font-bold text-sm ${examAnswer.trim() ? "bg-primary text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`
      },
      "\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E15\u0E2D\u0E1A"
    ) : /* @__PURE__ */ React.createElement("div", { className: "animate-fade-in-up" }, /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl mb-4 border bg-blue-50 border-blue-100" }, /* @__PURE__ */ React.createElement("h4", { className: "font-bold mb-1 text-secondary text-sm" }, "\u0E40\u0E09\u0E25\u0E22"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-700" }, examList[examIndex].refAnswer)), /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => markExam(true), className: "flex-1 py-3 rounded-xl bg-success text-white text-sm font-bold" }, "\u0E15\u0E2D\u0E1A\u0E16\u0E39\u0E01"), /* @__PURE__ */ React.createElement("button", { onClick: () => markExam(false), className: "flex-1 py-3 rounded-xl bg-slate-200 text-slate-600 text-sm font-bold" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01"))))))) : view === "allnotes" ? /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-3xl mx-auto p-4 sm:p-6" }, /* @__PURE__ */ React.createElement("div", { className: "bg-white rounded-2xl border border-slate-200 p-6" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold text-slate-800 mb-4 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(NotebookIcon, null), " \u0E42\u0E19\u0E49\u0E15\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14"), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: notesQuery,
        onChange: (e) => setNotesQuery(e.target.value),
        placeholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E43\u0E19\u0E42\u0E19\u0E49\u0E15\u0E17\u0E38\u0E01\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D...",
        className: "w-full border-2 border-slate-200 focus:border-secondary outline-none rounded-xl px-4 py-2.5 text-sm mb-5"
      }
    ), (() => {
      const q = notesQuery.trim().toLowerCase();
      const entries = Object.entries(notes).filter(([k, v]) => v && v.text && v.text.trim()).map(([k, v]) => ({ key: k, note: v, topic: topicByKey[k] })).filter((e) => e.topic).filter((e) => !q || e.topic.title.toLowerCase().includes(q) || e.note.text.toLowerCase().includes(q)).sort((a, b) => (b.note.updatedAt || 0) - (a.note.updatedAt || 0));
      if (!entries.length) return /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-400 text-center py-8" }, q ? "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E42\u0E19\u0E49\u0E15\u0E17\u0E35\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E04\u0E33\u0E04\u0E49\u0E19" : "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E42\u0E19\u0E49\u0E15");
      return entries.map((e) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: e.key,
          onClick: () => {
            selectTopic(e.topic.subjId, e.topic.id);
            setActiveTab("notes");
          },
          className: "w-full text-left p-4 rounded-xl border border-slate-100 hover:border-secondary mb-3 transition-colors"
        },
        /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center mb-1" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold text-sm text-slate-800" }, e.topic.title), /* @__PURE__ */ React.createElement("span", { className: "text-[10px] text-slate-400" }, new Date(e.note.updatedAt).toLocaleDateString("th-TH"))),
        /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-500 line-clamp-2" }, e.note.text.slice(0, 160))
      ));
    })()))) : /* @__PURE__ */ React.createElement("div", { className: "flex flex-1 overflow-hidden relative" }, mobileNavOpen && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 bg-black/30 z-30 md:hidden", onClick: () => setMobileNavOpen(false) }), /* @__PURE__ */ React.createElement("aside", { className: `fixed md:static inset-y-0 left-0 z-40 w-80 bg-white border-r border-slate-200 overflow-y-auto flex flex-col shrink-0 p-4 transform transition-transform duration-200 md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}` }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-3 md:hidden" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold text-slate-700" }, "\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14"), /* @__PURE__ */ React.createElement("button", { onClick: () => setMobileNavOpen(false), className: "p-1 text-slate-400 hover:text-slate-700", "aria-label": "\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E19\u0E39" }, /* @__PURE__ */ React.createElement(CloseIcon, null))), SUBJECTS.map((s) => /* @__PURE__ */ React.createElement("div", { key: s.id, className: "mb-2" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setOpenGroups((g) => ({ ...g, [s.id]: !g[s.id] })),
        className: "w-full flex items-center justify-between px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-slate-700"
      },
      /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-2" }, /* @__PURE__ */ React.createElement(s.icon, null), " ", s.label, " ", /* @__PURE__ */ React.createElement("span", { className: "text-slate-300 font-normal normal-case" }, "(", s.topics.length, ")")),
      /* @__PURE__ */ React.createElement("span", { className: `transition-transform ${openGroups[s.id] ? "rotate-180" : ""}` }, /* @__PURE__ */ React.createElement(ChevronDown, null))
    ), openGroups[s.id] && /* @__PURE__ */ React.createElement("div", { className: "space-y-1 mt-1" }, s.topics.map((t) => {
      const active = activeSubject === s.id && activeTopicId === t.id;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: t.id,
          onClick: () => selectTopic(s.id, t.id),
          className: `w-full text-left p-2.5 rounded-xl border flex gap-2 text-sm ${active ? "bg-blue-50 border-blue-100 text-secondary font-semibold shadow-sm" : "border-transparent text-slate-600 hover:bg-slate-50"}`
        },
        active ? /* @__PURE__ */ React.createElement(Play, { className: "shrink-0 mt-0.5" }) : completed[`${s.id}:${t.id}`] ? /* @__PURE__ */ React.createElement(Check, { className: "shrink-0 mt-0.5" }) : /* @__PURE__ */ React.createElement(Clock, { className: "shrink-0 mt-1 text-slate-300" }),
        /* @__PURE__ */ React.createElement("span", { className: "leading-tight" }, t.title)
      );
    }))))), /* @__PURE__ */ React.createElement("main", { className: "flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-3xl" }, /* @__PURE__ */ React.createElement("div", { className: "flex gap-4 border-b border-slate-200 mb-6" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setActiveTab("summary"),
        className: `pb-3 px-2 text-sm font-semibold transition-colors ${activeTab === "summary" ? "text-secondary border-b-2 border-secondary" : "text-slate-400 hover:text-slate-700"}`
      },
      "\u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setActiveTab("quiz"),
        className: `pb-3 px-2 text-sm font-semibold flex items-center gap-2 transition-colors ${activeTab === "quiz" ? "text-secondary border-b-2 border-secondary" : "text-slate-400 hover:text-slate-700"}`
      },
      /* @__PURE__ */ React.createElement(Target, null),
      " \u0E41\u0E1A\u0E1A\u0E1D\u0E36\u0E01\u0E40\u0E02\u0E35\u0E22\u0E19\u0E15\u0E2D\u0E1A"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setActiveTab("notes"),
        className: `pb-3 px-2 text-sm font-semibold flex items-center gap-2 transition-colors ${activeTab === "notes" ? "text-secondary border-b-2 border-secondary" : "text-slate-400 hover:text-slate-700"}`
      },
      /* @__PURE__ */ React.createElement(NotebookIcon, null),
      " \u0E42\u0E19\u0E49\u0E15\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19 ",
      noteText && /* @__PURE__ */ React.createElement("span", { className: "w-1.5 h-1.5 rounded-full bg-secondary" })
    )), activeTab === "notes" ? /* @__PURE__ */ React.createElement("div", { className: "bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 flex-wrap mb-1" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-bold text-slate-800 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(NotebookIcon, null), " \u0E42\u0E19\u0E49\u0E15\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19 \u2014 ", topic.title), /* @__PURE__ */ React.createElement("div", { className: "flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setNotePreview(false),
        className: `px-3 py-1.5 ${!notePreview ? "bg-secondary text-white" : "text-slate-500 hover:bg-slate-50"}`
      },
      "\u0E41\u0E01\u0E49\u0E44\u0E02"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setNotePreview(true),
        className: `px-3 py-1.5 ${notePreview ? "bg-secondary text-white" : "text-slate-500 hover:bg-slate-50"}`
      },
      "\u0E14\u0E39\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07"
    ))), /* @__PURE__ */ React.createElement("p", { className: "text-xs text-slate-400 mb-4 min-h-[1rem]" }, notes[noteKey] ? `\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14 ${new Date(notes[noteKey].updatedAt).toLocaleString("th-TH")}` : ""), notePreview ? /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "md-preview border-2 border-slate-100 rounded-xl p-4 min-h-[200px] text-slate-700",
        dangerouslySetInnerHTML: { __html: noteText.trim() ? mdToHtml(noteText) : '<p style="opacity:.4">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32</p>' }
      }
    ) : /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: noteText,
        onChange: (e) => updateNote(e.target.value),
        rows: 10,
        placeholder: "\u0E42\u0E19\u0E49\u0E15\u0E02\u0E2D\u0E07\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E19\u0E35\u0E49...",
        className: "w-full border-2 border-slate-200 focus:border-secondary outline-none rounded-xl p-4 text-sm text-slate-700 resize-y font-sans leading-relaxed"
      }
    )) : activeTab === "summary" ? /* @__PURE__ */ React.createElement("div", { className: "bg-white p-8 rounded-2xl shadow-sm border border-slate-100" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-bold text-slate-800 mb-4 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Bookmark, null), " ", topic.title), hasSummary(topic) ? /* @__PURE__ */ React.createElement(React.Fragment, null, topic.data.overview && /* @__PURE__ */ React.createElement("p", { className: "text-slate-600 mb-4" }, topic.data.overview), (topic.data.keyConcepts || []).length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h4", { className: "text-sm font-bold text-slate-400 uppercase tracking-wider mb-2" }, "\u0E1B\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E2A\u0E33\u0E04\u0E31\u0E0D"), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2" }, topic.data.keyConcepts.map((k, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "flex items-start gap-2 text-sm text-slate-700" }, /* @__PURE__ */ React.createElement("span", { className: "text-secondary mt-1" }, "\u2022"), " ", k)))), topic.data.lesson && /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "md-preview lesson mt-6 pt-2 border-t border-slate-100 text-slate-700",
        dangerouslySetInnerHTML: { __html: mdToHtml(topic.data.lesson) }
      }
    )) : /* @__PURE__ */ React.createElement("p", { className: "text-slate-400" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32")) : /* @__PURE__ */ React.createElement("div", { className: "bg-white p-8 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden" }, !isDone ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center mb-6" }, /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest" }, "\u0E04\u0E33\u0E16\u0E32\u0E21\u0E17\u0E35\u0E48 ", qIndex + 1, " \u0E08\u0E32\u0E01 ", questions.length)), /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-bold text-slate-800 mb-6 leading-tight" }, questions[qIndex].q), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: answerText,
        onChange: (e) => setAnswerText(e.target.value),
        disabled: revealed,
        rows: 5,
        placeholder: "\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48...",
        className: "w-full border-2 border-slate-200 focus:border-secondary outline-none rounded-xl p-4 text-sm text-slate-700 resize-none disabled:bg-slate-50"
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "mt-6" }, !revealed ? /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: submitAnswer,
        disabled: !answerText.trim(),
        className: `w-full py-3 rounded-xl font-bold text-sm transition-all ${answerText.trim() ? "bg-primary text-white hover:bg-slate-800 shadow-md" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`
      },
      "\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E15\u0E2D\u0E1A"
    ) : /* @__PURE__ */ React.createElement("div", { className: "animate-fade-in-up" }, questions[qIndex].hasKey ? /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl mb-4 border bg-blue-50 border-blue-100" }, /* @__PURE__ */ React.createElement("h4", { className: "font-bold mb-1 text-secondary" }, "\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07"), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-700 leading-relaxed mb-4" }, questions[qIndex].refAnswer), selfMark === null ? /* @__PURE__ */ React.createElement("div", { className: "flex gap-3" }, /* @__PURE__ */ React.createElement("button", { onClick: () => markSelf(true), className: "px-4 py-2 rounded-lg bg-success text-white text-xs font-bold" }, "\u0E15\u0E2D\u0E1A\u0E16\u0E39\u0E01 (+100 XP)"), /* @__PURE__ */ React.createElement("button", { onClick: () => markSelf(false), className: "px-4 py-2 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold" }, "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01")) : /* @__PURE__ */ React.createElement("p", { className: `text-sm font-semibold ${selfMark === "correct" ? "text-success" : "text-slate-500"}` }, selfMark === "correct" ? "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E27\u0E48\u0E32\u0E15\u0E2D\u0E1A\u0E16\u0E39\u0E01\u0E41\u0E25\u0E49\u0E27" : "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E27\u0E48\u0E32\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01")) : /* @__PURE__ */ React.createElement("div", { className: "p-4 rounded-xl mb-4 border bg-emerald-50 border-emerald-200" }, /* @__PURE__ */ React.createElement("h4", { className: "font-bold text-emerald-700" }, "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E41\u0E25\u0E49\u0E27 (+50 XP)")), (questions[qIndex].hasKey ? selfMark !== null : true) && /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: nextQuestion,
        className: "w-full py-3 bg-secondary text-white rounded-xl font-bold text-sm hover:bg-blue-600 shadow-md transition-all"
      },
      qIndex < questions.length - 1 ? "\u0E02\u0E49\u0E2D\u0E15\u0E48\u0E2D\u0E44\u0E1B" : "\u0E14\u0E39\u0E2A\u0E23\u0E38\u0E1B\u0E1C\u0E25"
    )))) : /* @__PURE__ */ React.createElement("div", { className: "text-center py-12" }, /* @__PURE__ */ React.createElement("div", { className: "w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6" }, /* @__PURE__ */ React.createElement(Trophy, { className: "w-12 h-12 text-accent" })), /* @__PURE__ */ React.createElement("h2", { className: "text-2xl font-bold text-slate-800 mb-2" }, "\u0E40\u0E02\u0E35\u0E22\u0E19\u0E15\u0E2D\u0E1A\u0E04\u0E23\u0E1A\u0E17\u0E38\u0E01\u0E02\u0E49\u0E2D\u0E41\u0E25\u0E49\u0E27!"), /* @__PURE__ */ React.createElement("p", { className: "text-slate-500 mb-8" }, '\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D "', topic.title, '" \u2014 ', questions.length, " \u0E02\u0E49\u0E2D"), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: restartTopic,
        className: "px-6 py-3 border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
      },
      "\u0E17\u0E33\u0E41\u0E1A\u0E1A\u0E1D\u0E36\u0E01\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07"
    )))))));
  }
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(/* @__PURE__ */ React.createElement(App, null));
})();
