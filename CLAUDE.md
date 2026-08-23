# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Tanot" (แบรนด์เดิม OME) — a single static site (no build step at deploy time, no backend, no `package.json`) deployed two ways from the same source: **GitHub Pages** (`tanot713-sudo.github.io/my-web-app`, via `.github/workflows/deploy-pages.yml` on every push to `main`) and **Cloudflare Pages** (`my-web-app-5w2.pages.dev`, auto-deploys from the same repo). It's a personal toolbox: study tools (law/business/engineering classrooms), document tools (Word/Excel/PDF split, doc-check), an investment-education hub (12 sub-pages), a text-to-speech/speech-to-text page, a budget tracker, a 3D object sim, etc. Everything is vanilla ES5-leaning JS, no framework, no bundler — files are served as-is. The one exception is `languages.html`'s React app, which has a **local-only, pre-commit** build step — see "The `languages.html` React app" below — nothing about the deploy pipeline itself changes.

## Commands

There is no CI/deploy-time build/lint/test command — this is plain HTML/CSS/JS served directly. A `check` CI job runs `node --check` on every first-party `.js` file before `deploy` (see `.github/workflows/deploy-pages.yml`) — that's a syntax gate, not a build.

- **Syntax-check a JS file before committing**: `node --check path/to/file.js`
- **Local server for manual/Playwright testing**: `python3 -m http.server <port>` from the repo root, then open `http://localhost:<port>/<page>.html`
- **Bypass the password gate when testing**: set `localStorage['tanot:auth'] = '1'` before loading a page (see Auth Gate below) — there is no real login flow to drive.
- **Testing is done ad hoc with Playwright** (browser automation), not an installed test suite — write a throwaway script under a scratch dir, seed `localStorage` with synthetic data for anything that would otherwise hit the network (most pages have a "demo data" fallback specifically to make this possible without real network access), screenshot at a few widths (~390/760/1100px) in both themes, and check for zero console/page errors.
- **Deploy verification**: after pushing to `main`, check the `deploy-pages.yml` workflow run for that commit's SHA via GitHub Actions (list workflow runs filtered to `event: workflow_dispatch` or `push`). The concurrency group is `pages` with `cancel-in-progress: false` — a stuck/`waiting` run (e.g. blocked on an environment protection rule) will silently queue-block every subsequent deploy until it's cancelled.

## Architecture

### Shared shell (every page wires these three, in this order)
1. `auth-gate.js` — client-side-only password gate (SHA-256 hash check against `localStorage['tanot:auth']`). Explicitly **not real security**: anyone can bypass it via DevTools. It exists to keep casual/accidental visitors out, nothing more.
2. `shell.js` — defines the *entire site's* navigation menu once (the `MENU` array, including the investment sub-nav that used to live in a separate `invest-nav.js`), renders the hamburger/drawer nav, and handles dark/light theme (`localStorage['ome:theme']`, `data-theme` attribute on `<html>`). All pages import this the same way: `<script src="shell.js" defer></script>`.
3. `theme.css` — the single shared design-system stylesheet (CSS custom properties for colors, `.card`/`.btn`/`.field`/`.frow` component classes reused verbatim across every tool page). New pages copy an existing page's `<style>` block rather than inventing new component classes.

Pages that are PWA-installable also register `sw.js` (see below) via `shell.js`.

### Service worker / cache versioning (`sw.js`)
Network-first for HTML, cache-first for other same-origin assets. `PRECACHE` lists every file that should work offline. **Whenever you add or change a JS/HTML file that's cache-first, you must bump the `CACHE` const version string** (`ome-vNNN`) or returning users keep serving stale code indefinitely — this is the single most common way a "fix" silently fails to ship. Heavy vendored libraries (`vendor/transformers/*`, `vendor/firebase/*`) are intentionally left out of `PRECACHE` and instead lazy-cached on first real use, so visitors who never touch those tools don't pay for a multi-MB download.

### Per-tool pages
Each tool is a `<name>.html` + `<name>.js` pair (occasionally split further, e.g. `doc-check.html` / `doc-check-file.html`). There's no router or shared app shell beyond the nav — navigation between tools is a plain page load. Investment tools (`invest-*.html/js`) are the largest family (12 pages) and were built by cloning the most similar existing page and adapting it (e.g. `invest-global-stock.*` is a clone of `invest-thai-stock.*` with `.BK` suffix removed; `invest-baac-lottery.*` is a near-byte-identical clone of `invest-gsb-lottery.*`) — when adding a new tool in an existing family, find the closest sibling and diff against it rather than designing from scratch.

Common conventions across tool pages:
- **localStorage namespacing**: everything is prefixed `tanot:<feature>:<key>` (e.g. `tanot:invest:thstock`, `tanot:tts:gcloudkey`). Check for existing keys before picking a new one — collisions between two tools sharing a prefix have caused real bugs before.
- **Client-side-only, no backend**: any "fetch a live value" feature (stock/crypto/gold prices, FX rates, news) has to route around CORS via public CORS-proxy chains (`allorigins`, `corsproxy.io`, `codetabs`, `thingproxy`, tried in sequence with a direct-fetch fallback) since there's no server to proxy through. These proxies are unreliable — every such fetch has a `localStorage` cache-with-timestamp fallback and a "paste/type it in yourself" manual fallback, and must never render a hard error state; degrade to stale-cache or manual-entry instead.
- **Google Drive sync** (`DriveSync` pattern, repeated per-tool with a different `DRIVE_FILE_NAME`) is opt-in, best-effort backup of a tool's local data to the user's own Drive — not a sync-of-record.
- **Firebase Realtime Database sync** (`firebase-sync.js`, currently only used by `budget.html` via `FirebaseSync.connect('budget', ...)`) requires Google sign-in and scopes every user's data under `<basePath>/<uid>/...`. The enforced Security Rules live in the Firebase Console (project `tanot-budget`), **not** in this repo's deploy pipeline — there is no Firebase CLI/CI wired up here, so `database.rules.json` at the repo root is a **manually-synced mirror for review/history only**. If you change the rules, you must paste the same JSON into Firebase Console → Realtime Database → Rules → Publish yourself; editing `database.rules.json` alone does nothing live. Keep the two in sync by hand whenever either changes.
- **Risk/finance tools carry real disclaimers** — these are educational calculators, not financial advice, and the copy says so explicitly. Preserve that framing when extending them.

### The `languages.html` React app (`languages.jsx` / `languages.compiled.js` / `build-languages.sh`)
Unlike every other page, `languages.html` is a React 18 app (React/ReactDOM still loaded as UMD globals from `unpkg.com`, unchanged). It used to run `@babel/standalone` in the browser on every page load to transpile a ~18,000-line inline `<script type="text/babel">` block — measurably slow, especially on phones. That inline block has been extracted to **`languages.jsx`** (the JSX source you actually edit) and is pre-compiled locally with esbuild into **`languages.compiled.js`** (plain ES2019, classic `React.createElement` runtime, committed to the repo like any other static file). `languages.html` just does `<script src="languages.compiled.js"></script>` — no Babel, no runtime JSX transform, nothing in the deploy pipeline changed.

**You must run `./build-languages.sh` and commit the resulting `languages.compiled.js` together with any edit to `languages.jsx`.** Editing `languages.jsx` alone does nothing live — the browser never loads that file, only `languages.compiled.js`. This is the same failure class as forgetting to bump `sw.js`'s `CACHE` version: an easy-to-forget manual step where the fix silently doesn't ship. The script requires Node (`npx esbuild ...`, no install/lockfile needed) and ends with `node --check` on its own output as a sanity gate.

Everything else about `languages.html` is unchanged: the `<script id="*-data" type="application/json">` blocks (vocab/phrases/script-writing data per language) still live directly in the HTML and are read via `document.getElementById(...).textContent` — only the JSX component code moved out.

### Heavy client-side ML (`text-to-speech.html` / `text-to-speech.js` / `tts-worker.js`)
Text→speech uses `facebook/mms-tts-*` via `vendor/transformers/` (Transformers.js + onnxruntime-web, self-hosted, not CDN-loaded — a prior CDN-based bare-specifier resolution bug inside a Worker is why the vendored bundle's imports were rewritten to relative paths). The onnxruntime-web runtime files (`ort-wasm-simd-threaded*.mjs/.wasm`, `ort.webgpu.bundle.min.mjs`, `onnxruntime-common/*`) are **pinned to 1.24.3** on purpose — 1.25+ has a confirmed upstream bug (`TransposeDQWeightsForMatMulNBits`, microsoft/onnxruntime#28306) that breaks session creation for some quantized models including Whisper. Don't bump these without first confirming that issue is fixed in the target version. Synthesis runs in a **pool of persistent Web Workers** (`tts-worker.js`, spawned via `getTtsWorkerPool()`), not the main thread, because single-thread WASM synthesis is fully synchronous and would otherwise freeze the page. Key things that look like they'd be free performance wins but were tried and reverted after real-world measurement: WebGPU backend (slower — immature quantized-op kernels), multi-threaded WASM via COOP/COEP cross-origin isolation (slower/same — thread oversubscription across the worker pool). The one that *did* help: staggering worker dispatch so only the first worker downloads the model initially (`pipeline-ready` message), avoiding N workers redundantly re-downloading the same multi-MB model on a cold cache. Speech→text uses Whisper, also via Transformers.js.

### Document tooling (`doc-check.js`)
Client-side file text-extraction already exists here and is the template to reuse for any other "read a file into text" feature: `.txt` via `file.text()`, `.docx` via `mammoth.js`, `.pdf` (with a text layer) via `pdf.js`, images via `Tesseract.js` OCR (`eng+tha`). Grammar/spell-check goes through the public LanguageTool API — note that LanguageTool has **no Thai support** (`ltCode: null` for `th`), so that feature is English-only; Thai text only gets light normalization, not real proofreading. Scanned (image-only) PDF pages are currently detected but not yet OCR'd — doing so would mean rendering each page to a canvas via `pdf.js` and feeding that canvas to Tesseract.js.

### 3D tooling (`sim-objects.js`)
Self-hosted Three.js (`vendor/three/`, including a `jsm/` mirror of the addons ESM modules) + GSAP + `three-mesh-bvh`/`three-bvh-csg` (vendored UMD builds) for boolean mesh operations. Personal model library persists to IndexedDB, not localStorage (binary model data).

## Licensing / attribution

`credits.html` is the canonical list of every third-party library/API used and its license. **Any time a new external library or free/no-key API is added, add an entry there** — this has been done consistently for every addition so far (Lightweight Charts, thai-gold-api, Alternative.me Fear & Greed, LanguageTool, etc.) and reviewers rely on it being complete.
