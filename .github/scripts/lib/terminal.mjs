// Animated tmux-style terminal: three AI agents working on real (codenamed) projects,
// with the Kagome ASCII animation flickering in the background. Pure SVG + CSS/SMIL.
import { esc, kt, pick, rng, round } from './util.mjs';

const W = 900;
const H = 470;
const TOP = 34; // below title bar
const STATUS = 26; // status bar height
const SPLIT_X = 520;
const SPLIT_Y = TOP + Math.round((H - TOP - STATUS) / 2);
const FONT = 13;
const CW = FONT * 0.6; // monospace advance
const LH = 19;
const LOOP = 20; // seconds per full session
const CLEAR = LOOP - 1.2; // panes clear just before the loop restarts
const TYPE_CPS = 30; // typing speed, chars/sec
const GREEN = '#8CFF98';

const COLORS = {
  prompt: GREEN, user: '#e6edf3', tool: '#79c0ff', out: '#8b949e', ok: '#3fb950',
  warn: '#ffcc80', claude: '#d97757', codex: '#e6edf3', gemini: '#8ab4f8', dim: '#6e7681',
};

const FILES = {
  TypeScript: ['src/server/router.ts', 'src/lib/cache.ts', 'src/app/session.tsx'],
  JavaScript: ['scripts/build.mjs', 'src/worker.js'],
  Go: ['internal/http/handler.go', 'internal/cache/lru.go'],
  Rust: ['src/engine/mod.rs', 'src/net/pool.rs'],
  Swift: ['Sources/App/SyncStore.swift', 'Sources/UI/FeedView.swift'],
  Kotlin: ['app/src/main/kotlin/SyncWorker.kt'],
  'C#': ['Services/SyncService.cs', 'Core/Inventory.cs'],
  Python: ['pipeline/train.py', 'api/routes.py'],
  C: ['src/ring_buffer.c'], 'C++': ['src/renderer.cpp'], Java: ['src/main/java/App.java'],
  Dart: ['lib/feed_page.dart'], Ruby: ['app/models/order.rb'], PHP: ['src/Controller/Api.php'],
  CSS: ['styles/theme.css'], HTML: ['public/index.html'], Bash: ['scripts/deploy.sh'],
  Dockerfile: ['Dockerfile'], Gradle: ['build.gradle.kts'],
};
const TESTS = {
  TypeScript: 'bun test', JavaScript: 'bun test', Go: 'go test ./...', Rust: 'cargo test',
  Swift: 'swift test', Kotlin: './gradlew test', 'C#': 'dotnet test', Python: 'pytest -q',
  Java: './gradlew test', Dart: 'flutter test', Ruby: 'bundle exec rspec', PHP: 'composer test',
};
const CLAUDE_TASKS = [
  ['add offline sync with retry backoff', 'sync queue retries with jittered backoff'],
  ['fix the race in session refresh', 'refresh is single-flight now, race gone'],
  ['cut cold start time in half', 'cold start 1.9s → 0.8s'],
  ['harden auth headers and CSP', 'strict CSP + HSTS in place'],
  ['stream responses to the client', 'responses stream chunk by chunk'],
  ['add e2e tests for checkout', '24 new e2e specs, all green'],
];
const CODEX_TASKS = [
  ['profile the render loop', 'frame time 16.4ms → 9.1ms'],
  ['dedupe the API calls', 'network requests −38%'],
  ['tighten types in the data layer', '0 `any` left'],
  ['batch the database writes', 'p95 210ms → 64ms'],
];
const GEMINI_TASKS = [
  ['review the open pull requests', ['2 suggestions · 0 blockers', 'approved ✓']],
  ['scan dependencies for CVEs', ['0 critical · 1 low', 'patched ✓']],
  ['summarize this week\'s commits', ['changelog drafted', 'posted to #release ✓']],
];

function fileFor(rand, lang) {
  return pick(rand, FILES[lang] ?? FILES.TypeScript);
}

// Lay out one pane's lines on a timeline. Each line: { text, color, typed?, cps?, pause? }.
function schedule(lines, startAt) {
  let t = startAt;
  return lines.map(line => {
    t += line.pause ?? 0.5;
    const start = t;
    const dur = line.typed ? line.text.length / (line.cps ?? TYPE_CPS) : 0;
    t += dur;
    return { ...line, start, dur };
  });
}

// Lines are revealed by growing the path their text sits on (textPath): characters past the
// end of the path aren't drawn. Unlike animated clip rects, this behaves the same in WebKit,
// Blink and Gecko (a zero-width clip rect disables clipping in WebKit).
let pathId = 0;
function renderLine({ text, color, start, dur }, x, y) {
  const n = [...text].length;
  if (n === 0) return '';
  const id = `p${pathId++}`;
  const full = round(n * CW * 1.3 + 24); // generous: fallback fonts can be wider than 0.6em
  const d = len => `M${x} ${y}h${len}`;
  const values = [d(0)];
  const times = [0];
  if (dur > 0) {
    const steps = Math.max(1, Math.ceil(n / 2));
    for (let i = 1; i <= steps; i++) {
      values.push(d(i === steps ? full : round(i * 2 * CW * 1.04)));
      times.push(kt((start + (dur * (i - 1)) / steps) / LOOP));
    }
  } else {
    values.push(d(full));
    times.push(kt(start / LOOP));
  }
  values.push(d(0));
  times.push(kt(CLEAR / LOOP));
  return `<path id="${id}" d="${d(0)}"><animate attributeName="d" values="${values.join(';')}" keyTimes="${times.join(';')}" dur="${LOOP}s" calcMode="discrete" repeatCount="indefinite"/></path>`
    + `<text fill="${color}"><textPath href="#${id}">${esc(text)}</textPath></text>`;
}

function renderPane(lines, x, y, maxRows) {
  return lines.slice(0, maxRows).map((line, i) => renderLine(line, x, y + i * LH)).join('\n');
}

function cursorAfter(lines, x, y, maxRows) {
  const last = lines[Math.min(lines.length, maxRows) - 1];
  const row = Math.min(lines.length, maxRows) - 1;
  const cx = round(x + [...last.text].length * CW + 2);
  const on = kt((last.start + last.dur) / LOOP);
  return `<g class="blink"><rect x="${cx}" y="${y + row * LH - FONT + 2}" width="${round(CW)}" height="${FONT + 2}" fill="${GREEN}" opacity="0">`
    + `<animate attributeName="opacity" values="0;1;0" keyTimes="0;${on};${kt(CLEAR / LOOP)}" dur="${LOOP}s" calcMode="discrete" repeatCount="indefinite"/></rect></g>`;
}

function kagomeLayer(frames) {
  if (!frames?.length) return '';
  const cols = Math.max(...frames.flat().map(l => l.length));
  const areaH = H - TOP - STATUS;
  const lh = areaH / frames[0].length;
  const tl = round(W - 40);
  const n = frames.length;
  const step = round(100 / n);
  const css = `.fr{visibility:hidden}@keyframes fr{0%{visibility:visible}${step}%{visibility:hidden}}`
    + frames.map((_, i) => `#k${i}{animation:fr .4s steps(1) infinite ${round((i * 0.4) / n)}s}`).join('');
  const body = frames.map((lines, i) => `<text class="fr kg" id="k${i}">${lines.map((l, j) =>
    `<tspan x="20" y="${round(TOP + 14 + j * lh)}" textLength="${tl}" lengthAdjust="spacingAndGlyphs">${esc(l.padEnd(cols, ' '))}</tspan>`).join('')}</text>`).join('\n');
  return { css, body };
}

export function renderTerminal({ user, projects, stack, commits, date, kagome }) {
  pathId = 0;
  const rand = rng(`${user}:${date}`);
  const langs = stack.length ? stack : ['TypeScript'];
  const [l1, l2 = l1, l3 = l2] = langs;
  const proj = projects.length ? projects : [{ codename: 'side-quest' }];
  const p1 = proj[0].codename;
  const p2 = (proj[1] ?? proj[0]).codename;
  const p3 = (proj[2] ?? proj[0]).codename;

  const [cTask, cDone] = pick(rand, CLAUDE_TASKS);
  const f1 = fileFor(rand, l1);
  const f1b = fileFor(rand, l1 === 'TypeScript' ? 'TypeScript' : l1);
  const claude = schedule([
    { text: `~/${p1} $ claude`, color: COLORS.prompt, typed: true, pause: 0.6 },
    { text: `> ${cTask}`, color: COLORS.user, typed: true, pause: 1.0 },
    { text: '* Thinking…', color: COLORS.claude, pause: 0.8 },
    { text: `• Read(${f1})`, color: COLORS.tool, pause: 1.4 },
    { text: `  └ ${120 + Math.floor(rand() * 300)} lines`, color: COLORS.out, pause: 0.3 },
    { text: `• Update(${f1})`, color: COLORS.tool, pause: 1.0 },
    { text: `  └ +${20 + Math.floor(rand() * 90)} −${3 + Math.floor(rand() * 30)}`, color: COLORS.out, pause: 0.3 },
    { text: `• Update(${f1b === f1 ? fileFor(rand, l2) : f1b})`, color: COLORS.tool, pause: 0.9 },
    { text: `  └ +${8 + Math.floor(rand() * 40)} −${1 + Math.floor(rand() * 12)}`, color: COLORS.out, pause: 0.3 },
    { text: `• Bash(${TESTS[l1] ?? 'make test'})`, color: COLORS.tool, pause: 1.0 },
    { text: `  └ ✓ ${60 + Math.floor(rand() * 200)} passed · 0 failed`, color: COLORS.ok, pause: 1.6 },
    { text: `• Done — ${cDone}.`, color: COLORS.user, pause: 0.8 },
    { text: '>', color: COLORS.prompt, pause: 0.6 },
  ], 0.2);

  const [xTask, xDone] = pick(rand, CODEX_TASKS);
  const codex = schedule([
    { text: `~/${p2} $ codex`, color: COLORS.prompt, typed: true, pause: 2.2 },
    { text: `› ${xTask}`, color: COLORS.user, typed: true, pause: 0.6 },
    { text: '▸ planning · 3 steps', color: COLORS.dim, pause: 1.0 },
    { text: `▸ edit ${fileFor(rand, l2)}`, color: COLORS.tool, pause: 1.6 },
    { text: '▸ bench ████████████████████', color: COLORS.warn, typed: true, cps: 8, pause: 1.2 },
    { text: `✓ ${xDone}`, color: COLORS.ok, pause: 0.5 },
    { text: '›', color: COLORS.prompt, pause: 0.8 },
  ], 0);

  const [gTask, [g1, g2]] = pick(rand, GEMINI_TASKS);
  const gemini = schedule([
    { text: `~/${p3} $ gemini`, color: COLORS.prompt, typed: true, pause: 5.5 },
    { text: `> ${gTask}`, color: COLORS.user, typed: true, pause: 0.6 },
    { text: `◆ scanning ${12 + Math.floor(rand() * 60)} files (${l3})`, color: COLORS.gemini, pause: 1.2 },
    { text: `◆ ${g1}`, color: COLORS.gemini, pause: 2.4 },
    { text: `◆ ${g2}`, color: COLORS.ok, pause: 1.8 },
    { text: '>', color: COLORS.prompt, pause: 0.8 },
  ], 0);

  const leftX = 18;
  const rightX = SPLIT_X + 16;
  const paneTop = TOP + 34;
  const rowsLeft = Math.floor((H - STATUS - paneTop) / LH);
  const rowsRight = Math.floor((SPLIT_Y - paneTop) / LH);
  const kg = kagomeLayer(kagome);

  const paneLabel = (x, y, name, color) =>
    `<text x="${x}" y="${y}" class="lbl"><tspan fill="${color}">●</tspan> ${name}</text>`;
  const status = `${projects.length} active · ${commits} commits/7d · ${langs.slice(0, 3).join(' · ')}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`Terminal with AI agents working on ${user}'s projects`)}">
<style>
text{font:${FONT}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre}
.kg{font-size:15px;fill:${GREEN}}
.lbl{font-size:12px;fill:#8b949e}
${kg.css ?? ''}
@keyframes blink{50%{opacity:0}}
.blink{animation:blink 1s steps(1) infinite}
</style>
<defs>
<filter id="glow" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="win"><rect width="${W}" height="${H}" rx="12"/></clipPath>
<pattern id="scan" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="1" fill="#000" opacity=".18"/></pattern>
</defs>
<g clip-path="url(#win)">
<rect width="${W}" height="${H}" fill="#0d1117"/>
<g opacity=".13" filter="url(#glow)">${kg.body ?? ''}</g>

<rect width="${W}" height="${TOP - 4}" fill="#161b22"/>
<circle cx="18" cy="15" r="6" fill="#ff5f56"/><circle cx="38" cy="15" r="6" fill="#ffbd2e"/><circle cx="58" cy="15" r="6" fill="#27c93f"/>
<text x="${W / 2}" y="20" text-anchor="middle" class="lbl">${esc(user)}@matrix — tmux — agents</text>

<path d="M${SPLIT_X} ${TOP}V${H - STATUS}M${SPLIT_X} ${SPLIT_Y}H${W}" stroke="${GREEN}" stroke-opacity=".3"/>
${paneLabel(leftX, TOP + 16, 'claude', COLORS.claude)}
${paneLabel(rightX, TOP + 16, 'codex', COLORS.codex)}
${paneLabel(rightX, SPLIT_Y + 18, 'gemini', COLORS.gemini)}

<g filter="url(#glow)">
${renderPane(claude, leftX, paneTop, rowsLeft)}
${cursorAfter(claude, leftX, paneTop, rowsLeft)}
${renderPane(codex, rightX, paneTop, rowsRight)}
${cursorAfter(codex, rightX, paneTop, rowsRight)}
${renderPane(gemini, rightX, SPLIT_Y + 36, rowsRight)}
${cursorAfter(gemini, rightX, SPLIT_Y + 36, rowsRight)}
</g>

<rect y="${H - STATUS}" width="${W}" height="${STATUS}" fill="${GREEN}"/>
<text x="12" y="${H - 8}" fill="#0d1117" font-weight="700">[agents] 0:claude* 1:codex 2:gemini</text>
<text x="${W - 12}" y="${H - 8}" fill="#0d1117" text-anchor="end">${esc(status)}</text>
<rect width="${W}" height="${H}" fill="url(#scan)"/>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="${GREEN}" stroke-opacity=".35"/>
</svg>
`;
}
