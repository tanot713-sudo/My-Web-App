(() => {
  const { useState, useEffect, useMemo, useRef } = React;
  const COURSE = JSON.parse(document.getElementById("course-data").textContent);
  const T = OME_I18N.scope("lbe-engineering", {
    th: {
      openNav: "\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E19\u0E39\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D",
      closeNav: "\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E19\u0E39",
      allTopics: "\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14",
      sync: "\u0E0B\u0E34\u0E07\u0E01\u0E4C",
      syncing: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E0B\u0E34\u0E07\u0E01\u0E4C...",
      syncConnecting: "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D Google...",
      syncOk: "\u0E0B\u0E34\u0E07\u0E01\u0E4C\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08",
      back: "\u0E01\u0E25\u0E31\u0E1A Tanot",
      tabStream: "\u0E2A\u0E15\u0E23\u0E35\u0E21",
      tabWork: "\u0E07\u0E32\u0E19\u0E40\u0E23\u0E35\u0E22\u0E19",
      tabReview: "\u0E17\u0E1A\u0E17\u0E27\u0E19",
      tabExam: "\u0E2A\u0E2D\u0E1A\u0E23\u0E27\u0E21",
      tabNotes: "\u0E42\u0E19\u0E49\u0E15\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14",
      classroom: "\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E23\u0E35\u0E22\u0E19",
      progressAll: "\u0E04\u0E27\u0E32\u0E21\u0E04\u0E37\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E23\u0E27\u0E21",
      ofTopics: "{done}/{total} \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D",
      reviewToday: "\u0E17\u0E1A\u0E17\u0E27\u0E19\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49",
      noDue: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14",
      dueN: "\u0E02\u0E49\u0E2D\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E17\u0E1A\u0E17\u0E27\u0E19",
      startReview: "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E17\u0E1A\u0E17\u0E27\u0E19",
      lastExam: "\u0E2A\u0E2D\u0E1A\u0E23\u0E27\u0E21\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14",
      neverExam: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E04\u0E22\u0E2A\u0E2D\u0E1A",
      startExamAll: "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E2D\u0E1A\u0E23\u0E27\u0E21",
      examAgain: "\u0E2A\u0E2D\u0E1A\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07",
      todo: "\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E2A\u0E23\u0E47\u0E08",
      allDone: "\u0E17\u0E33\u0E04\u0E23\u0E1A\u0E17\u0E38\u0E01\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E41\u0E25\u0E49\u0E27 \u0E40\u0E22\u0E35\u0E48\u0E22\u0E21\u0E21\u0E32\u0E01!",
      noDueReview: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E04\u0E23\u0E1A\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E17\u0E1A\u0E17\u0E27\u0E19",
      reviewDone: "\u0E17\u0E1A\u0E17\u0E27\u0E19\u0E04\u0E23\u0E1A {n} \u0E02\u0E49\u0E2D\u0E41\u0E25\u0E49\u0E27!",
      backStream: "\u0E01\u0E25\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E2A\u0E15\u0E23\u0E35\u0E21",
      reviewOf: "\u0E17\u0E1A\u0E17\u0E27\u0E19 {i} / {n}",
      yourAnswer: "\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13...",
      reveal: "\u0E14\u0E39\u0E40\u0E09\u0E25\u0E22",
      answerKey: "\u0E40\u0E09\u0E25\u0E22",
      recalled: "\u0E08\u0E33\u0E44\u0E14\u0E49 (+30 XP)",
      notYetTomorrow: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49 (\u0E16\u0E32\u0E21\u0E43\u0E2B\u0E21\u0E48\u0E1E\u0E23\u0E38\u0E48\u0E07\u0E19\u0E35\u0E49)",
      start10: "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E2D\u0E1A 10 \u0E02\u0E49\u0E2D",
      start20: "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E2D\u0E1A 20 \u0E02\u0E49\u0E2D",
      recent: "\u0E1C\u0E25\u0E2A\u0E2D\u0E1A\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14",
      scoreIs: "\u0E44\u0E14\u0E49 {s} / {n} \u0E04\u0E30\u0E41\u0E19\u0E19",
      timeUsed: "\u0E43\u0E0A\u0E49\u0E40\u0E27\u0E25\u0E32 {t} \u0E19\u0E32\u0E17\u0E35",
      qOf: "\u0E02\u0E49\u0E2D {i} / {n}",
      typeAns: "\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13...",
      submit: "\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E15\u0E2D\u0E1A",
      correct: "\u0E15\u0E2D\u0E1A\u0E16\u0E39\u0E01",
      wrong: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01",
      resultTime: "{score}/{total} ({m}:{s} \u0E19\u0E32\u0E17\u0E35)",
      searchNotes: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E43\u0E19\u0E42\u0E19\u0E49\u0E15\u0E17\u0E38\u0E01\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D...",
      noMatch: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E42\u0E19\u0E49\u0E15\u0E17\u0E35\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E04\u0E33\u0E04\u0E49\u0E19",
      noNotes: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E42\u0E19\u0E49\u0E15",
      tabSummary: "\u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32",
      tabQuiz: "\u0E41\u0E1A\u0E1A\u0E1D\u0E36\u0E01\u0E40\u0E02\u0E35\u0E22\u0E19\u0E15\u0E2D\u0E1A",
      tabMyNotes: "\u0E42\u0E19\u0E49\u0E15\u0E02\u0E2D\u0E07\u0E09\u0E31\u0E19",
      edit: "\u0E41\u0E01\u0E49\u0E44\u0E02",
      preview: "\u0E14\u0E39\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07",
      savedAt: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14 {d}",
      emptyPreview: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32",
      notePh: "\u0E08\u0E14\u0E2A\u0E23\u0E38\u0E1B \u0E04\u0E33\u0E08\u0E33\u0E01\u0E31\u0E14\u0E04\u0E27\u0E32\u0E21 \u0E2B\u0E23\u0E37\u0E2D\u0E1B\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E32\u0E01\u0E08\u0E33\u0E44\u0E27\u0E49\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E19\u0E35\u0E49...",
      keyPoints: "\u0E1B\u0E23\u0E30\u0E40\u0E14\u0E47\u0E19\u0E2A\u0E33\u0E04\u0E31\u0E0D",
      noContent: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32",
      qNofN: "\u0E04\u0E33\u0E16\u0E32\u0E21\u0E17\u0E35\u0E48 {i} \u0E08\u0E32\u0E01 {n}",
      typeHere: "\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48...",
      refAnswer: "\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
      correctXp: "\u0E15\u0E2D\u0E1A\u0E16\u0E39\u0E01 (+100 XP)",
      markedCorrect: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E27\u0E48\u0E32\u0E15\u0E2D\u0E1A\u0E16\u0E39\u0E01\u0E41\u0E25\u0E49\u0E27",
      markedWrong: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E27\u0E48\u0E32\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01",
      savedAns: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E41\u0E25\u0E49\u0E27 (+50 XP)",
      next: "\u0E02\u0E49\u0E2D\u0E15\u0E48\u0E2D\u0E44\u0E1B",
      seeSummary: "\u0E14\u0E39\u0E2A\u0E23\u0E38\u0E1B\u0E1C\u0E25",
      allWritten: "\u0E40\u0E02\u0E35\u0E22\u0E19\u0E15\u0E2D\u0E1A\u0E04\u0E23\u0E1A\u0E17\u0E38\u0E01\u0E02\u0E49\u0E2D\u0E41\u0E25\u0E49\u0E27!",
      topicLabel: "\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D",
      nQuestions: "{n} \u0E02\u0E49\u0E2D",
      retry: "\u0E17\u0E33\u0E41\u0E1A\u0E1A\u0E1D\u0E36\u0E01\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07",
      reflect1: '\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E2B\u0E25\u0E31\u0E01\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E02\u0E2D\u0E07 "{t}" \u0E15\u0E32\u0E21\u0E04\u0E27\u0E32\u0E21\u0E40\u0E02\u0E49\u0E32\u0E43\u0E08\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13',
      reflect2: '\u0E22\u0E01\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E08\u0E23\u0E34\u0E07\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E04\u0E27\u0E32\u0E21\u0E23\u0E39\u0E49\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07 "{t}"',
      eGis: "\u0E42\u0E2B\u0E25\u0E14 Google Identity Services \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E25\u0E2D\u0E07\u0E23\u0E35\u0E40\u0E1F\u0E23\u0E0A\u0E2B\u0E19\u0E49\u0E32\u0E43\u0E2B\u0E21\u0E48",
      eFolderFind: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP {c})",
      eFolderMake: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP {c})",
      eFileFind: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E44\u0E1F\u0E25\u0E4C\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP {c})",
      eDownload: "\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP {c})",
      eUpload: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E36\u0E49\u0E19 Drive \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (HTTP {c})",
      title: "\u0E2B\u0E49\u0E2D\u0E07\u0E40\u0E23\u0E35\u0E22\u0E19\u0E27\u0E34\u0E28\u0E27\u0E01\u0E23\u0E23\u0E21",
      subj_engineering: "\u0E27\u0E34\u0E28\u0E27\u0E01\u0E23\u0E23\u0E21",
      "subj_elec-maint": "\u0E1A\u0E33\u0E23\u0E38\u0E07\u0E23\u0E31\u0E01\u0E29\u0E32\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E1F\u0E1F\u0E49\u0E32"
    },
    en: {
      openNav: "Open topics menu",
      closeNav: "Close menu",
      allTopics: "All topics",
      sync: "Sync",
      syncing: "Syncing...",
      syncConnecting: "Connecting to Google...",
      syncOk: "Sync complete",
      back: "Back to Tanot",
      tabStream: "Stream",
      tabWork: "Coursework",
      tabReview: "Review",
      tabExam: "Exam",
      tabNotes: "All notes",
      classroom: "Classroom",
      progressAll: "Overall progress",
      ofTopics: "{done}/{total} topics",
      reviewToday: "Review today",
      noDue: "Nothing due yet",
      dueN: "items due for review",
      startReview: "Start review",
      lastExam: "Latest exams",
      neverExam: "No exams yet",
      startExamAll: "Start exam",
      examAgain: "Take it again",
      todo: "Unfinished topics",
      allDone: "All topics done \u2014 great work!",
      noDueReview: "No items due for review",
      reviewDone: "Reviewed all {n} items!",
      backStream: "Back to stream",
      reviewOf: "Review {i} / {n}",
      yourAnswer: "Your answer...",
      reveal: "Show answer",
      answerKey: "Answer",
      recalled: "Got it (+30 XP)",
      notYetTomorrow: "Not yet (ask again tomorrow)",
      start10: "Start 10 questions",
      start20: "Start 20 questions",
      recent: "Recent results",
      scoreIs: "Scored {s} / {n}",
      timeUsed: "Time taken {t}",
      qOf: "Question {i} / {n}",
      typeAns: "Type your answer...",
      submit: "Submit answer",
      correct: "Correct",
      wrong: "Not yet",
      resultTime: "{score}/{total} ({m}:{s})",
      searchNotes: "Search notes across all topics...",
      noMatch: "No notes match your search",
      noNotes: "No notes yet",
      tabSummary: "Summary",
      tabQuiz: "Written practice",
      tabMyNotes: "My notes",
      edit: "Edit",
      preview: "Preview",
      savedAt: "Last saved {d}",
      emptyPreview: "Nothing here yet",
      notePh: "Write summaries, definitions or points to remember for this topic...",
      keyPoints: "Key points",
      noContent: "No content yet",
      qNofN: "Question {i} of {n}",
      typeHere: "Type your answer here...",
      refAnswer: "Reference answer",
      correctXp: "Correct (+100 XP)",
      markedCorrect: "Marked as correct",
      markedWrong: "Marked as not yet correct",
      savedAns: "Answer saved (+50 XP)",
      next: "Next question",
      seeSummary: "See results",
      allWritten: "You answered every question!",
      topicLabel: "Topic",
      nQuestions: "{n} questions",
      retry: "Practice again",
      reflect1: 'Explain the key principle of "{t}" in your own understanding',
      reflect2: 'Give a real situation where knowing "{t}" is needed',
      eGis: "Could not load Google Identity Services \u2014 try refreshing the page",
      eFolderFind: "Could not search folders (HTTP {c})",
      eFolderMake: "Could not create folder (HTTP {c})",
      eFileFind: "Could not search files (HTTP {c})",
      eDownload: "Download failed (HTTP {c})",
      eUpload: "Could not save to Drive (HTTP {c})",
      title: "Engineering classroom",
      subj_engineering: "Engineering",
      "subj_elec-maint": "Electrical maintenance"
    }
  });
  window.OME_PAGE_LIVE_LANG = true;
  const tErr = (key, vars) => Object.assign(new Error(T(key, vars)), { tkey: key, tvars: vars });
  const statusText = (st) => !st ? "" : st.tkey ? T(st.tkey, st.tvars) : st.raw || "";
  const subjLabel = (s) => T("subj_" + (s.subjId || s.id));
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
  const HeadIcon = icon("wrench", "w-5 h-5");
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
    return [1, 2].map((n) => ({
      q: T("reflect" + n, { t: title }),
      reflect: T("reflect" + n, { t: "\0" }).split("\0")
    }));
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
    const [syncStatus, setSyncStatus] = useState(null);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [lang, setLang] = useState(OME_I18N.lang());
    useEffect(() => OME_LANG.onChange((l) => setLang(l)), []);
    useEffect(() => {
      document.title = T("title") + " | Tanot";
    }, [lang]);
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
      setSyncStatus({ tkey: "syncConnecting" });
      try {
        await DriveSync.ensureAuth();
        setSyncStatus({ tkey: "syncing" });
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
        setSyncStatus({ tkey: "syncOk" });
      } catch (e) {
        setSyncStatus(e && e.tkey ? { tkey: e.tkey, tvars: e.tvars } : { raw: "" + (e.message || e) });
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
      return reflectionPrompts(topic.title).map((p) => ({ q: p.q, reflect: p.reflect, refAnswer: null, hasKey: false }));
    }, [topic, lang]);
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
    return /* @__PURE__ */ React.createElement("div", { className: "lbe-app h-[calc(100vh-48px)] w-full flex flex-col bg-slate-50 font-sans" }, /* @__PURE__ */ React.createElement("header", { className: "bg-white border-b border-slate-200 flex items-center flex-wrap gap-x-3 gap-y-2 justify-between px-4 sm:px-6 py-2 shrink-0 z-10" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 min-w-0" }, /* @__PURE__ */ React.createElement("button", { "data-k": "menu", onClick: () => setMobileNavOpen(true), className: "btn ghost icon md:hidden -ml-2", "aria-label": T("openNav") }, /* @__PURE__ */ React.createElement(Menu, null)), /* @__PURE__ */ React.createElement("span", { className: "lbe-headicon" }, /* @__PURE__ */ React.createElement(HeadIcon, null)), /* @__PURE__ */ React.createElement("h1", { className: "text-lg font-bold" }, T("title"), " ", /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline text-slate-400 font-normal" }, "| Tanot"))), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("span", { className: "badge warn" }, /* @__PURE__ */ React.createElement(Trophy, null), " ", /* @__PURE__ */ React.createElement("span", null, "Level ", level), " ", /* @__PURE__ */ React.createElement("span", null, "(", xp, " XP)")), /* @__PURE__ */ React.createElement("button", { "data-k": "sync", onClick: syncNow, disabled: syncing, className: "btn sm" }, syncing ? T("syncing") : /* @__PURE__ */ React.createElement(React.Fragment, null, T("sync"), /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline" }, " Google Drive"))), syncStatus && /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline text-sm text-slate-500" }, statusText(syncStatus)), /* @__PURE__ */ React.createElement("a", { href: "./index.html", className: "btn ghost sm" }, "\u2190 ", T("back")))), /* @__PURE__ */ React.createElement("div", { className: "tabs bg-white px-2 sm:px-4 shrink-0" }, /* @__PURE__ */ React.createElement("button", { "data-k": "tab-stream", onClick: () => setView("stream"), "aria-current": view === "stream" ? "page" : void 0, className: `tab${view === "stream" ? " on" : ""}` }, T("tabStream")), /* @__PURE__ */ React.createElement("button", { "data-k": "tab-work", onClick: () => setView("classwork"), "aria-current": view === "classwork" ? "page" : void 0, className: `tab${view === "classwork" ? " on" : ""}` }, T("tabWork")), /* @__PURE__ */ React.createElement("button", { "data-k": "tab-review", onClick: startReview, "aria-current": view === "review" ? "page" : void 0, className: `tab${view === "review" ? " on" : ""} inline-flex items-center gap-2` }, T("tabReview"), dueKeys.length > 0 && /* @__PURE__ */ React.createElement("span", { className: "badge accent" }, dueKeys.length)), /* @__PURE__ */ React.createElement("button", { "data-k": "tab-exam", onClick: () => {
      setExamList([]);
      setExamIndex(0);
      setView("exam");
    }, "aria-current": view === "exam" ? "page" : void 0, className: `tab${view === "exam" ? " on" : ""}` }, T("tabExam")), /* @__PURE__ */ React.createElement("button", { "data-k": "tab-notes", onClick: () => setView("allnotes"), "aria-current": view === "allnotes" ? "page" : void 0, className: `tab${view === "allnotes" ? " on" : ""}` }, T("tabNotes"))), view === "stream" ? /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-4xl mx-auto p-4 sm:p-6 space-y-4" }, /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 mb-1" }, T("classroom")), /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold mb-4" }, subjectStats.length === 1 ? subjLabel(subjectStats[0]) : T("title")), /* @__PURE__ */ React.createElement("div", { className: "max-w-sm" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between text-sm text-slate-500 mb-1" }, /* @__PURE__ */ React.createElement("span", null, T("progressAll")), /* @__PURE__ */ React.createElement("span", null, completedCount, "/", totalTopics)), /* @__PURE__ */ React.createElement("div", { className: "meter" }, /* @__PURE__ */ React.createElement("i", { style: { width: `${totalTopics ? completedCount / totalTopics * 100 : 0}%` } })))), /* @__PURE__ */ React.createElement("div", { className: `grid grid-cols-1 gap-4 ${subjectStats.length > 1 ? "sm:grid-cols-2" : ""}` }, subjectStats.map((s) => /* @__PURE__ */ React.createElement("button", { key: s.id, "data-k": "subj", "data-sid": s.id, onClick: () => openSubject(s.id), className: "stat-card" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 text-slate-500" }, /* @__PURE__ */ React.createElement(s.icon, null), /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold" }, subjLabel(s))), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-bold text-slate-800" }, T("ofTopics", { done: s.done, total: s.total })), /* @__PURE__ */ React.createElement("div", { className: "meter sm" }, /* @__PURE__ */ React.createElement("i", { style: { width: `${s.total ? s.done / s.total * 100 : 0}%` } }))))), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" }, /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold mb-3 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Clock, null), " ", T("reviewToday")), dueKeys.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500" }, T("noDue")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { className: "mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-3xl font-bold text-slate-800" }, dueKeys.length), " ", /* @__PURE__ */ React.createElement("span", { className: "text-sm text-slate-500" }, T("dueN"))), /* @__PURE__ */ React.createElement("button", { "data-k": "startReview", onClick: startReview, className: "btn primary" }, T("startReview")))), /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold mb-3 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Trophy, null), " ", T("lastExam")), exams.length === 0 ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 mb-4" }, T("neverExam")), /* @__PURE__ */ React.createElement("button", { onClick: () => {
      setExamList([]);
      setExamIndex(0);
      setView("exam");
    }, className: "btn primary" }, T("startExamAll"))) : /* @__PURE__ */ React.createElement(React.Fragment, null, exams.slice(0, 3).map((e, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "flex justify-between text-sm py-1.5 border-b border-slate-100" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, OME_I18N.date(e.date)), /* @__PURE__ */ React.createElement("span", { className: `badge ${e.score / e.total >= 0.7 ? "ok" : ""}` }, e.score, "/", e.total))), /* @__PURE__ */ React.createElement("button", { onClick: () => {
      setExamList([]);
      setExamIndex(0);
      setView("exam");
    }, className: "btn primary mt-3" }, T("examAgain"))))), /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("h3", { className: "font-bold mb-3 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Target, null), " ", T("todo")), todoTopics.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500" }, T("allDone")) : /* @__PURE__ */ React.createElement("div", { className: "-mx-2" }, todoTopics.slice(0, 6).map((t) => /* @__PURE__ */ React.createElement("button", { key: `${t.subjId}:${t.id}`, "data-k": "todo", onClick: () => selectTopic(t.subjId, t.id), className: "list-row !border-0 w-full text-left" }, /* @__PURE__ */ React.createElement("span", { className: "grow leading-tight", "data-i18n-skip": true }, t.title), /* @__PURE__ */ React.createElement("span", { className: "text-xs font-bold text-slate-500 shrink-0 text-right max-w-[40%]" }, subjLabel(t)))))))) : view === "review" ? /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-2xl mx-auto p-4 sm:p-6" }, revIndex >= revList.length ? /* @__PURE__ */ React.createElement("section", { className: "card text-center" }, revList.length === 0 ? /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold mb-6" }, T("noDueReview")) : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4" }, /* @__PURE__ */ React.createElement(Trophy, null)), /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold mb-6" }, T("reviewDone", { n: revList.length }))), /* @__PURE__ */ React.createElement("button", { onClick: () => setView("stream"), className: "btn primary" }, T("backStream"))) : (() => {
      const rq = QUESTION_BY_KEY[revList[revIndex]];
      return /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center gap-2 flex-wrap mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold text-slate-500" }, T("reviewOf", { i: revIndex + 1, n: revList.length })), /* @__PURE__ */ React.createElement("span", { className: "badge info wrap", "data-i18n-skip": true }, rq.topicTitle)), /* @__PURE__ */ React.createElement("h3", { className: "text-lg sm:text-xl font-bold mb-4 leading-snug", "data-i18n-skip": true }, rq.q), /* @__PURE__ */ React.createElement(
        "textarea",
        {
          value: revAnswer,
          onChange: (e) => setRevAnswer(e.target.value),
          disabled: revRevealed,
          rows: 4,
          placeholder: T("yourAnswer"),
          className: "textarea"
        }
      ), /* @__PURE__ */ React.createElement("div", { className: "mt-4" }, !revRevealed ? /* @__PURE__ */ React.createElement("button", { "data-k": "reveal", onClick: () => setRevRevealed(true), className: "btn primary lg w-full" }, T("reveal")) : /* @__PURE__ */ React.createElement("div", { className: "animate-fade-in-up" }, /* @__PURE__ */ React.createElement("div", { className: "callout info mb-4" }, /* @__PURE__ */ React.createElement("h4", { className: "font-bold mb-1 text-sm" }, T("answerKey")), /* @__PURE__ */ React.createElement("p", { className: "text-base", "data-i18n-skip": true }, rq.refAnswer)), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row gap-3" }, /* @__PURE__ */ React.createElement("button", { "data-k": "recalled", onClick: () => markReview(true), className: "btn primary lg sm:flex-1" }, T("recalled")), /* @__PURE__ */ React.createElement("button", { "data-k": "notyet", onClick: () => markReview(false), className: "btn lg sm:flex-1" }, T("notYetTomorrow"))))));
    })())) : view === "exam" ? /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-2xl mx-auto p-4 sm:p-6" }, examList.length === 0 ? /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold mb-4" }, T("tabExam")), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row gap-3 mb-6" }, /* @__PURE__ */ React.createElement("button", { "data-k": "start10", onClick: () => startExam(10), className: "btn primary lg" }, T("start10")), /* @__PURE__ */ React.createElement("button", { "data-k": "start20", onClick: () => startExam(20), className: "btn lg" }, T("start20"))), exams.length > 0 && /* @__PURE__ */ React.createElement("div", { className: "border-t border-slate-100 pt-4" }, /* @__PURE__ */ React.createElement("h4", { className: "text-sm font-bold text-slate-500 mb-3" }, T("recent")), exams.slice(0, 5).map((e, i) => /* @__PURE__ */ React.createElement("div", { key: i, className: "flex justify-between gap-2 text-sm py-1.5 border-b border-slate-100" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, OME_I18N.date(e.date, { dateStyle: "short", timeStyle: "short" })), /* @__PURE__ */ React.createElement("span", { className: `badge ${e.score / e.total >= 0.7 ? "ok" : ""}` }, T("resultTime", { score: e.score, total: e.total, m: Math.floor(e.sec / 60), s: String(e.sec % 60).padStart(2, "0") })))))) : examIndex >= examList.length ? /* @__PURE__ */ React.createElement("section", { className: "card text-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4" }, /* @__PURE__ */ React.createElement(Trophy, null)), /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold mb-1" }, T("scoreIs", { s: examScore, n: examList.length })), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 mb-6" }, T("timeUsed", { t: `${Math.floor((((_a = exams[0]) == null ? void 0 : _a.sec) || 0) / 60)}:${String((((_b = exams[0]) == null ? void 0 : _b.sec) || 0) % 60).padStart(2, "0")}` })), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row gap-3 justify-center" }, /* @__PURE__ */ React.createElement("button", { onClick: () => {
      setExamList([]);
      setExamIndex(0);
    }, className: "btn primary lg" }, T("examAgain")), /* @__PURE__ */ React.createElement("button", { onClick: () => setView("stream"), className: "btn lg" }, T("backStream")))) : /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center gap-2 flex-wrap mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold text-slate-500" }, T("qOf", { i: examIndex + 1, n: examList.length })), /* @__PURE__ */ React.createElement("span", { className: "badge info wrap", "data-i18n-skip": true }, examList[examIndex].topicTitle)), /* @__PURE__ */ React.createElement("h3", { className: "text-lg sm:text-xl font-bold mb-4 leading-snug", "data-i18n-skip": true }, examList[examIndex].q), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: examAnswer,
        onChange: (e) => setExamAnswer(e.target.value),
        disabled: examRevealed,
        rows: 4,
        placeholder: T("typeAns"),
        className: "textarea"
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "mt-4" }, !examRevealed ? /* @__PURE__ */ React.createElement("button", { "data-k": "esubmit", onClick: () => setExamRevealed(true), disabled: !examAnswer.trim(), className: "btn primary lg w-full" }, T("submit")) : /* @__PURE__ */ React.createElement("div", { className: "animate-fade-in-up" }, /* @__PURE__ */ React.createElement("div", { className: "callout info mb-4" }, /* @__PURE__ */ React.createElement("h4", { className: "font-bold mb-1 text-sm" }, T("answerKey")), /* @__PURE__ */ React.createElement("p", { className: "text-base", "data-i18n-skip": true }, examList[examIndex].refAnswer)), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col sm:flex-row gap-3" }, /* @__PURE__ */ React.createElement("button", { "data-k": "ecorrect", onClick: () => markExam(true), className: "btn primary lg sm:flex-1" }, T("correct")), /* @__PURE__ */ React.createElement("button", { "data-k": "ewrong", onClick: () => markExam(false), className: "btn lg sm:flex-1" }, T("wrong")))))))) : view === "allnotes" ? /* @__PURE__ */ React.createElement("div", { className: "flex-1 overflow-y-auto" }, /* @__PURE__ */ React.createElement("div", { className: "max-w-3xl mx-auto p-4 sm:p-6" }, /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("h2", { className: "text-lg font-bold mb-4 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(NotebookIcon, null), " ", T("tabNotes")), /* @__PURE__ */ React.createElement(
      "input",
      {
        type: "text",
        value: notesQuery,
        onChange: (e) => setNotesQuery(e.target.value),
        placeholder: T("searchNotes"),
        "data-k": "notesQuery",
        className: "input mb-4"
      }
    ), (() => {
      const q = notesQuery.trim().toLowerCase();
      const entries = Object.entries(notes).filter(([k, v]) => v && v.text && v.text.trim()).map(([k, v]) => ({ key: k, note: v, topic: topicByKey[k] })).filter((e) => e.topic).filter((e) => !q || e.topic.title.toLowerCase().includes(q) || e.note.text.toLowerCase().includes(q)).sort((a, b) => (b.note.updatedAt || 0) - (a.note.updatedAt || 0));
      if (!entries.length) return /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 text-center py-8" }, q ? T("noMatch") : T("noNotes"));
      return entries.map((e) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: e.key,
          "data-k": "noteRow",
          onClick: () => {
            selectTopic(e.topic.subjId, e.topic.id);
            setActiveTab("notes");
          },
          className: "stat-card w-full mb-3"
        },
        /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center gap-2 w-full" }, /* @__PURE__ */ React.createElement("span", { className: "font-bold text-sm text-slate-800", "data-i18n-skip": true }, e.topic.title), /* @__PURE__ */ React.createElement("span", { className: "text-xs text-slate-500 shrink-0" }, OME_I18N.date(e.note.updatedAt))),
        /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 line-clamp-2", "data-i18n-skip": true }, e.note.text.slice(0, 160))
      ));
    })()))) : /* @__PURE__ */ React.createElement("div", { className: "flex flex-1 overflow-hidden relative" }, mobileNavOpen && /* @__PURE__ */ React.createElement("div", { className: "fixed inset-x-0 bottom-0 top-12 bg-black/30 z-30 md:hidden", onClick: () => setMobileNavOpen(false) }), /* @__PURE__ */ React.createElement("aside", { className: `fixed md:static top-12 bottom-0 left-0 z-40 w-80 max-w-[88vw] bg-white border-r border-slate-200 overflow-y-auto flex flex-col shrink-0 p-3 transform transition-transform duration-200 md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full max-md:invisible"}` }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between mb-2 md:hidden" }, /* @__PURE__ */ React.createElement("span", { className: "text-base font-bold" }, T("allTopics")), /* @__PURE__ */ React.createElement("button", { "data-k": "closeNav", onClick: () => setMobileNavOpen(false), className: "btn ghost icon", "aria-label": T("closeNav") }, /* @__PURE__ */ React.createElement(CloseIcon, null))), SUBJECTS.map((s) => /* @__PURE__ */ React.createElement("div", { key: s.id, className: "mb-2" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        "data-k": "group",
        onClick: () => setOpenGroups((g) => ({ ...g, [s.id]: !g[s.id] })),
        className: "btn ghost w-full justify-between",
        "aria-expanded": !!openGroups[s.id]
      },
      /* @__PURE__ */ React.createElement("span", { className: "flex items-center gap-2 font-bold" }, /* @__PURE__ */ React.createElement(s.icon, null), " ", subjLabel(s), " ", /* @__PURE__ */ React.createElement("span", { className: "text-slate-500 font-normal" }, "(", s.topics.length, ")")),
      /* @__PURE__ */ React.createElement("span", { className: `transition-transform ${openGroups[s.id] ? "rotate-180" : ""}` }, /* @__PURE__ */ React.createElement(ChevronDown, null))
    ), openGroups[s.id] && /* @__PURE__ */ React.createElement("div", { className: "mt-2" }, s.topics.map((t) => {
      const active = activeSubject === s.id && activeTopicId === t.id;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: t.id,
          "data-k": "topic",
          "data-tid": t.id,
          onClick: () => selectTopic(s.id, t.id),
          "aria-current": active ? "true" : void 0,
          className: `list-row !border-0 w-full text-left rounded-lg ${active ? "bg-blue-50 text-slate-800 font-semibold" : ""}`
        },
        active ? /* @__PURE__ */ React.createElement(Play, { className: "shrink-0" }) : completed[`${s.id}:${t.id}`] ? /* @__PURE__ */ React.createElement(Check, { className: "shrink-0" }) : /* @__PURE__ */ React.createElement(Clock, { className: "shrink-0 text-slate-400" }),
        /* @__PURE__ */ React.createElement("span", { className: "grow leading-tight", "data-i18n-skip": true }, t.title)
      );
    }))))), /* @__PURE__ */ React.createElement("main", { className: "flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-full max-w-[72ch]" }, /* @__PURE__ */ React.createElement("div", { className: "tabs mb-4" }, /* @__PURE__ */ React.createElement("button", { "data-k": "tab-summary", onClick: () => setActiveTab("summary"), className: `tab${activeTab === "summary" ? " on" : ""}` }, T("tabSummary")), /* @__PURE__ */ React.createElement("button", { "data-k": "tab-quiz", onClick: () => setActiveTab("quiz"), className: `tab${activeTab === "quiz" ? " on" : ""} inline-flex items-center gap-2` }, /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline-flex" }, /* @__PURE__ */ React.createElement(Target, null)), " ", T("tabQuiz")), /* @__PURE__ */ React.createElement("button", { "data-k": "tab-mynotes", onClick: () => setActiveTab("notes"), className: `tab${activeTab === "notes" ? " on" : ""} inline-flex items-center gap-2` }, /* @__PURE__ */ React.createElement("span", { className: "hidden sm:inline-flex" }, /* @__PURE__ */ React.createElement(NotebookIcon, null)), " ", T("tabMyNotes"), " ", noteText && /* @__PURE__ */ React.createElement("span", { className: "w-1.5 h-1.5 rounded-full bg-secondary" }))), activeTab === "notes" ? /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between gap-3 flex-wrap mb-1" }, /* @__PURE__ */ React.createElement("h3", { className: "text-lg font-bold flex items-center gap-2" }, /* @__PURE__ */ React.createElement(NotebookIcon, null), " ", T("tabMyNotes"), " \u2014 ", /* @__PURE__ */ React.createElement("span", { "data-i18n-skip": true }, topic.title)), /* @__PURE__ */ React.createElement("div", { className: "segmented" }, /* @__PURE__ */ React.createElement("button", { "data-k": "note-edit", onClick: () => setNotePreview(false), className: !notePreview ? "on" : "" }, T("edit")), /* @__PURE__ */ React.createElement("button", { "data-k": "note-preview", onClick: () => setNotePreview(true), className: notePreview ? "on" : "" }, T("preview")))), /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-500 mb-3 min-h-[1.25rem]" }, notes[noteKey] ? T("savedAt", { d: OME_I18N.date(notes[noteKey].updatedAt, { dateStyle: "medium", timeStyle: "short" }) }) : ""), notePreview ? /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "md-preview border-2 border-slate-100 rounded-xl p-4 min-h-[200px]",
        "data-i18n-skip": true,
        dangerouslySetInnerHTML: { __html: noteText.trim() ? mdToHtml(noteText) : `<p style="opacity:.6">${escapeHtml(T("emptyPreview"))}</p>` }
      }
    ) : /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: noteText,
        onChange: (e) => updateNote(e.target.value),
        rows: 10,
        placeholder: T("notePh"),
        className: "textarea"
      }
    )) : activeTab === "summary" ? /* @__PURE__ */ React.createElement("section", { className: "card" }, /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-bold mb-4 flex items-center gap-2" }, /* @__PURE__ */ React.createElement(Bookmark, null), " ", /* @__PURE__ */ React.createElement("span", { "data-i18n-skip": true }, topic.title)), hasSummary(topic) ? /* @__PURE__ */ React.createElement("div", { "data-i18n-skip": true }, topic.data.overview && /* @__PURE__ */ React.createElement("p", { className: "text-base text-slate-600 mb-4 leading-relaxed" }, topic.data.overview), (topic.data.keyConcepts || []).length > 0 && /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("h4", { className: "text-sm font-bold text-slate-500 mb-2" }, T("keyPoints")), /* @__PURE__ */ React.createElement("ul", { className: "space-y-2" }, topic.data.keyConcepts.map((k, i) => /* @__PURE__ */ React.createElement("li", { key: i, className: "flex items-start gap-2 text-base text-slate-700 leading-relaxed" }, /* @__PURE__ */ React.createElement("span", { className: "text-secondary" }, "\u2022"), " ", k)))), topic.data.lesson && /* @__PURE__ */ React.createElement(
      "div",
      {
        className: "md-preview lesson mt-6 pt-2 border-t border-slate-100 text-slate-700",
        dangerouslySetInnerHTML: { __html: mdToHtml(topic.data.lesson) }
      }
    )) : /* @__PURE__ */ React.createElement("p", { className: "text-slate-500" }, T("noContent"))) : /* @__PURE__ */ React.createElement("section", { className: "card" }, !isDone ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "flex justify-between items-center mb-4" }, /* @__PURE__ */ React.createElement("span", { className: "text-sm font-bold text-slate-500" }, T("qNofN", { i: qIndex + 1, n: questions.length }))), /* @__PURE__ */ React.createElement("h3", { className: "text-xl font-bold mb-4 leading-snug" }, questions[qIndex].hasKey ? /* @__PURE__ */ React.createElement("span", { "data-i18n-skip": true }, questions[qIndex].q) : /* @__PURE__ */ React.createElement(React.Fragment, null, questions[qIndex].reflect[0], /* @__PURE__ */ React.createElement("span", { "data-i18n-skip": true }, topic.title), questions[qIndex].reflect[1])), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        value: answerText,
        onChange: (e) => setAnswerText(e.target.value),
        disabled: revealed,
        rows: 5,
        placeholder: T("typeHere"),
        className: "textarea"
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "mt-4" }, !revealed ? /* @__PURE__ */ React.createElement("button", { "data-k": "qsubmit", onClick: submitAnswer, disabled: !answerText.trim(), className: "btn primary lg w-full" }, T("submit")) : /* @__PURE__ */ React.createElement("div", { className: "animate-fade-in-up" }, questions[qIndex].hasKey ? /* @__PURE__ */ React.createElement("div", { className: "callout info mb-4" }, /* @__PURE__ */ React.createElement("h4", { className: "font-bold mb-1" }, T("refAnswer")), /* @__PURE__ */ React.createElement("p", { className: "text-base leading-relaxed mb-4", "data-i18n-skip": true }, questions[qIndex].refAnswer)) : /* @__PURE__ */ React.createElement("div", { className: "callout ok mb-4" }, /* @__PURE__ */ React.createElement("h4", { className: "font-bold" }, T("savedAns"))), questions[qIndex].hasKey && (selfMark === null ? /* @__PURE__ */ React.createElement("div", { className: "flex flex-wrap gap-3 mb-4" }, /* @__PURE__ */ React.createElement("button", { "data-k": "qcorrect", onClick: () => markSelf(true), className: "btn primary" }, T("correctXp")), /* @__PURE__ */ React.createElement("button", { "data-k": "qwrong", onClick: () => markSelf(false), className: "btn" }, T("wrong"))) : /* @__PURE__ */ React.createElement("p", { className: "text-sm font-semibold mb-4" }, selfMark === "correct" ? T("markedCorrect") : T("markedWrong"))), (questions[qIndex].hasKey ? selfMark !== null : true) && /* @__PURE__ */ React.createElement("button", { "data-k": "qnext", onClick: nextQuestion, className: "btn primary lg w-full" }, qIndex < questions.length - 1 ? T("next") : T("seeSummary"))))) : /* @__PURE__ */ React.createElement("div", { className: "text-center py-8" }, /* @__PURE__ */ React.createElement("div", { className: "w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4" }, /* @__PURE__ */ React.createElement(Trophy, { className: "w-12 h-12 text-accent" })), /* @__PURE__ */ React.createElement("h2", { className: "text-xl font-bold mb-2" }, T("allWritten")), /* @__PURE__ */ React.createElement("p", { className: "text-slate-500 mb-6" }, T("topicLabel"), ' "', /* @__PURE__ */ React.createElement("span", { "data-i18n-skip": true }, topic.title), '" \u2014 ', T("nQuestions", { n: questions.length })), /* @__PURE__ */ React.createElement("button", { "data-k": "retry", onClick: restartTopic, className: "btn lg" }, T("retry"))))))));
  }
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(/* @__PURE__ */ React.createElement(App, null));
})();
