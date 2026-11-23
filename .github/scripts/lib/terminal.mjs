// Animated terminal: Claude and Codex panes on the left, an iOS Simulator on the right whose app
// hot-reloads as the agents land changes. Pure SVG + SMIL, so it animates inside a README <img>.
//
// Phone frame: measured iPhone 18 Pro geometry (case 71.85 × 150.01 mm, active display
// 66.57 × 144.73 mm = 402 × 874 pt, Dynamic Island 15.66 × 6.07 mm centred 7.99 mm from the top,
// published corner profile, button positions). The display corner radius and the app are
// approximations; no manufacturer marks are drawn.
import { esc, kt, round } from './util.mjs';

const W = 1000;
const H = 560;
const TOP = 34; // below the title bar
const STATUS = 26; // tmux status bar
const SPLIT_X = 560;
const SPLIT_Y = 334;
const FONT = 13;
const CW = FONT * 0.6;
const LH = 19;
const LOOP = 22; // seconds
const CLEAR = LOOP - 1.2;
const TYPE_CPS = 30;
const GREEN = '#8CFF98';
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const C = {
  prompt: GREEN, user: '#e6edf3', tool: '#79c0ff', out: '#8b949e', ok: '#3fb950',
  warn: '#ffcc80', claude: '#d97757', codex: '#e6edf3', dim: '#6e7681',
};
const ACCENT_A = '#0A84FF';
const ACCENT_B = '#30D158';

const at = s => kt(s / LOOP);
const anim = (attr, values, times, extra = '') =>
  `<animate attributeName="${attr}" values="${values.join(';')}" keyTimes="${times.map(at).join(';')}" dur="${LOOP}s" repeatCount="indefinite"${extra}/>`;

// ── terminal panes ────────────────────────────────────────────────────────────
// A line is revealed by growing the path its text sits on (textPath). Unlike animated clip
// rects this behaves identically in WebKit, Blink and Gecko.
let uid = 0;
function termLine({ text, color, start, dur }, x, y) {
  const n = [...text].length;
  const id = `l${uid++}`;
  const full = round(n * CW * 1.3 + 24); // generous: fallback fonts can be wider than 0.6em
  const d = len => `M${x} ${y}h${len}`;
  const values = [d(0)];
  const times = [0];
  if (dur > 0) {
    const steps = Math.max(1, Math.ceil(n / 2));
    for (let i = 1; i <= steps; i++) {
      values.push(d(i === steps ? full : round(i * 2 * CW * 1.04)));
      times.push(start + (dur * (i - 1)) / steps);
    }
  } else {
    values.push(d(full));
    times.push(start);
  }
  values.push(d(0));
  times.push(CLEAR);
  return `<path id="${id}" d="${d(0)}">${anim('d', values, times, ' calcMode="discrete"')}</path>`
    + `<text fill="${color}"><textPath href="#${id}">${esc(text)}</textPath></text>`;
}

function schedule(lines) {
  let t = 0;
  return lines.map(l => {
    t = l.at ?? t + (l.pause ?? 0.5);
    const dur = l.typed ? [...l.text].length / TYPE_CPS : 0;
    const out = { ...l, start: t, dur };
    t += dur;
    return out;
  });
}

function renderPane(lines, x, y) {
  const body = lines.map((l, i) => termLine(l, x, y + i * LH)).join('\n');
  const last = lines.at(-1);
  const cx = round(x + [...last.text].length * CW + 3);
  const cy = y + (lines.length - 1) * LH - FONT + 2;
  return `${body}\n<g class="blink"><rect x="${cx}" y="${cy}" width="${round(CW)}" height="${FONT + 2}" fill="${GREEN}" opacity="0">`
    + `${anim('opacity', [0, 1, 0], [0, last.start, CLEAR], ' calcMode="discrete"')}</rect></g>`;
}

// ── simulator animation helpers ──────────────────────────────────────────────
const show = (t1, t2 = CLEAR, fade = 0.25) =>
  anim('opacity', [0, 0, 1, 1, 0, 0], [0, t1, t1 + fade, t2, Math.min(t2 + fade, LOOP - 0.05), LOOP]);
// Non-discrete SMIL animations are ignored unless the last keyTime is exactly 1.
const recolor = (attr, t) => anim(attr, [ACCENT_A, ACCENT_A, ACCENT_B, ACCENT_B, ACCENT_A, ACCENT_A], [0, t, t + 0.4, CLEAR, CLEAR + 0.4, LOOP]);
const flash = t => anim('opacity', [0, 0, 0.14, 0, 0], [0, t, t + 0.08, t + 0.4, LOOP]);
const slideDown = (dy, t) =>
  `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 ${dy};0 ${dy};0 0;0 0" keyTimes="${[0, t, t + 0.5, CLEAR, CLEAR + 0.4, LOOP].map(at).join(';')}" dur="${LOOP}s" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;.2 .8 .2 1;0 0 1 1;.4 0 .2 1;0 0 1 1"/>`;

// ── phone hardware ───────────────────────────────────────────────────────────
const K = 402 / 66.57; // points per mm
const CASE_W = 71.85 * K;
const CASE_H = 150.01 * K;
const INSET = ((71.85 - 66.57) / 2) * K;
// Outer-corner profile (mm offsets from the corner's top-left extreme), top edge → diagonal.
const PROFILE = [[19.43, 0], [13.9, 0.04], [8.46, 0.92], [3.8, 3.8]];

// Closed outline with continuous corners: the measured profile mirrored into each corner and
// smoothed with Catmull-Rom → cubic Béziers.
function continuousOutline(w, h, profile) {
  const half = profile.map(([x, y]) => [x * K, y * K]);
  const t = [...half, ...half.slice(0, -1).reverse().map(([x, y]) => [y, x])]; // top edge → left side
  const curve = seq => seq.slice(0, -1).map((p1, i) => {
    const p2 = seq[i + 1];
    const p0 = seq[i - 1] ?? [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
    const p3 = seq[i + 2] ?? [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return `C${[...c1, ...c2, ...p2].map(v => round(v)).join(' ')}`;
  }).join('');
  const tr = t.map(([x, y]) => [w - x, y]); // top edge → right side
  const br = t.map(([x, y]) => [w - y, h - x]); // right side → bottom edge
  const bl = t.map(([x, y]) => [x, h - y]); // bottom edge → left side
  const tl = t.map(([x, y]) => [y, x]); // left side → top edge
  const L = ([x, y]) => `L${round(x)} ${round(y)}`;
  return `M${round(tl.at(-1)[0])} 0${L(tr[0])}${curve(tr)}${L(br[0])}${curve(br)}${L(bl[0])}${curve(bl)}${L(tl[0])}${curve(tl)}Z`;
}

function phoneHardware() {
  const outline = continuousOutline(CASE_W, CASE_H, PROFILE);
  const bezel = 1.1 * K;
  const sx = round((CASE_W - 2 * bezel) / CASE_W, 4);
  const sy = round((CASE_H - 2 * bezel) / CASE_H, 4);
  const button = (side, centreMm, lenMm) => {
    const len = lenMm * K;
    const y = centreMm * K - len / 2;
    const x = side === 'left' ? -3.2 : CASE_W - 0.4;
    return `<rect x="${round(x)}" y="${round(y)}" width="3.6" height="${round(len)}" rx="1.6" fill="url(#metal)"/>`;
  };
  return {
    under: `${button('left', 34.28, 6.9)}${button('left', 48.43, 11.2)}${button('left', 62.63, 11.2)}${button('right', 55.53, 17.7)}
<path d="${outline}" fill="url(#metal)"/>
<path d="${outline}" fill="#050506" transform="translate(${round(bezel)} ${round(bezel)}) scale(${sx} ${sy})"/>`,
    over: `<rect x="${round(35.925 * K - (15.66 * K) / 2)}" y="${round(7.99 * K - (6.07 * K) / 2)}" width="${round(15.66 * K)}" height="${round(6.07 * K)}" rx="${round((6.07 * K) / 2)}" fill="#000"/>
<circle cx="${round(35.925 * K + 4.9 * K)}" cy="${round(7.99 * K)}" r="5" fill="#0b1626"/>
<path d="${outline}" fill="none" stroke="#5b5e63" stroke-width="1.2" stroke-opacity=".7"/>`,
  };
}

// ── the app on screen (402 × 874 pt) ─────────────────────────────────────────
function appScreen({ ev, streak, week, date }) {
  const accentFill = `fill="${ACCENT_A}"`;
  const accentAnim = recolor('fill', ev.accent);
  const max = Math.max(...week, 1);
  const bars = week.map((n, i) => {
    const h = round(8 + (n / max) * 62);
    return `<rect x="${246 + i * 17}" y="${round(276 - h)}" width="11" height="${h}" rx="3" fill="#fff" opacity="${i === week.length - 1 ? 0.95 : 0.5}"/>`;
  }).join('');

  const habits = [
    ['Ship a pull request', 'Due today', 'M-5 3l5-6 5 6'],
    ['Review agent diffs', '3 waiting', 'M-6 0h12M0-6v12'],
    ['Keep tests green', 'CI passing', 'M-3-7h6M-2-7v5l-5 8h14l-5-8v-5'],
    ['Write the changelog', '10 min', 'M-6-4h12M-6 0h12M-6 4h8'],
  ];
  const rows = habits.map(([title, sub, glyph], i) => {
    const y = 12 + i * 66;
    const checkAt = ev.checks + i * 0.35;
    const done = i === 0
      ? `<circle cx="360" cy="${y + 33}" r="13" ${accentFill}>${accentAnim}</circle>`
      : `<g opacity="0">${show(checkAt, CLEAR, 0.12)}<circle cx="360" cy="${y + 33}" r="13" ${accentFill}>${accentAnim}${anim('r', [9, 9, 15, 13, 13], [0, checkAt, checkAt + 0.15, checkAt + 0.3, LOOP])}</circle>`;
    const tick = `<path d="M354 ${y + 33}l4.5 4.5 8-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<circle cx="52" cy="${y + 33}" r="17" ${accentFill}>${accentAnim}</circle>
<path d="${glyph}" transform="translate(52 ${y + 33})" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<text x="82" y="${y + 29}" class="ios" font-size="16" font-weight="600" fill="#fff">${title}</text>
<text x="82" y="${y + 48}" class="ios" font-size="13" fill="#8e8e93">${sub}</text>
<circle cx="360" cy="${y + 33}" r="12" fill="none" stroke="#3a3a3c" stroke-width="2"/>
${done}${tick}${i === 0 ? '' : '</g>'}
${i < habits.length - 1 ? `<path d="M82 ${y + 66}H382" stroke="#2c2c2e"/>` : ''}`;
  }).join('\n');

  const tabs = [['Today', 'M-9-8h18v16h-18zM-9-3h18'], ['Insights', 'M-8 7v-6M0 7v-14M8 7v-9'], ['Projects', 'M-9-6h7l2 3h9v10h-18z'], ['Settings', 'M0-8a8 8 0 1 0 0.01 0M0-3a3 3 0 1 0 0.01 0']]
    .map(([label, icon], i) => {
      const x = 50 + i * 101;
      const color = i === 0 ? `stroke="${ACCENT_A}"` : 'stroke="#8e8e93"';
      const tcolor = i === 0 ? `fill="${ACCENT_A}"` : 'fill="#8e8e93"';
      return `<path d="${icon}" transform="translate(${x} 812)" fill="none" ${color} stroke-width="2" stroke-linejoin="round">${i === 0 ? recolor('stroke', ev.accent) : ''}</path>
<text x="${x}" y="842" text-anchor="middle" class="ios" font-size="10" font-weight="500" ${tcolor}>${label}${i === 0 ? recolor('fill', ev.accent) : ''}</text>`;
    }).join('\n');

  const pill = (t, label) => `<g opacity="0">${show(t, t + 1.3, 0.15)}
<rect x="121" y="62" width="160" height="30" rx="15" fill="#1c1c1e" stroke="#3a3a3c"/>
<text x="201" y="82" text-anchor="middle" class="ios" font-size="13" font-weight="600" fill="#fff">${label}</text></g>`;

  return iosFonts(`<rect width="402" height="874" fill="#000"/>
<text x="76" y="44" text-anchor="middle" class="ios" font-size="17" font-weight="600" fill="#fff">9:41</text>
<g fill="#fff"><rect x="296" y="36" width="3.5" height="5" rx="1"/><rect x="301.5" y="33.5" width="3.5" height="7.5" rx="1"/><rect x="307" y="31" width="3.5" height="10" rx="1"/><rect x="312.5" y="28.5" width="3.5" height="12.5" rx="1"/>
<rect x="324" y="28.5" width="27" height="13" rx="4" fill="none" stroke="#fff" stroke-opacity=".45"/><rect x="326" y="30.5" width="19" height="9" rx="2.2"/><rect x="352.5" y="32.5" width="2" height="5" rx="1" opacity=".45"/></g>

<text x="20" y="102" class="ios" font-size="13" font-weight="600" fill="#8e8e93" letter-spacing=".4">${esc(date.toUpperCase())}</text>
<text x="20" y="140" class="ios" font-size="34" font-weight="700" fill="#fff">Today</text>
<circle cx="362" cy="124" r="18" ${accentFill}>${accentAnim}</circle>
<text x="362" y="130" text-anchor="middle" class="ios" font-size="16" font-weight="700" fill="#fff">S</text>

<g opacity="0">${show(ev.card, CLEAR, 0.35)}
<g><animateTransform attributeName="transform" type="translate" values="0 -14;0 -14;0 0;0 0" keyTimes="${[0, ev.card, ev.card + 0.5, LOOP].map(at).join(';')}" dur="${LOOP}s" repeatCount="indefinite"/>
<rect x="20" y="162" width="362" height="138" rx="24" fill="url(#cardGrad)"/>
<text x="40" y="196" class="ios" font-size="15" font-weight="600" fill="#fff" opacity=".85">Current streak</text>
<text x="40" y="246" class="ios" font-size="40" font-weight="700" fill="#fff">${streak} ${streak === 1 ? 'day' : 'days'}</text>
<text x="40" y="276" class="ios" font-size="13" fill="#fff" opacity=".75">Keep the chain going</text>
${bars}
</g></g>

<g transform="translate(0 180)"><g>${slideDown(150, ev.card)}
<text x="20" y="0" class="ios" font-size="13" font-weight="600" fill="#8e8e93" letter-spacing=".4">HABITS</text>
<rect x="20" y="12" width="362" height="264" rx="18" fill="#1c1c1e"/>
${rows}
</g></g>

<rect y="782" width="402" height="92" fill="#0c0c0d"/><path d="M0 782.5H402" stroke="#2c2c2e"/>
${tabs}
<rect x="134" y="860" width="134" height="5" rx="2.5" fill="#fff"/>

${pill(ev.card, '↻ Reloaded · 0.3s')}
${pill(ev.accent, '↻ Reloaded · 0.2s')}
${pill(ev.checks, '↻ Reloaded · 0.3s')}
<g opacity="0">${show(ev.tests, ev.tests + 2.6, 0.2)}
<rect x="101" y="724" width="200" height="38" rx="19" fill="#0f2a17" stroke="${ACCENT_B}" stroke-opacity=".6"/>
<text x="201" y="748" text-anchor="middle" class="ios" font-size="14" font-weight="600" fill="${ACCENT_B}">✓ ${ev.testCount} tests passed</text></g>
<rect width="402" height="874" fill="#fff" opacity="0">${flash(ev.card)}</rect>
<rect width="402" height="874" fill="#fff" opacity="0">${flash(ev.accent)}</rect>
<rect width="402" height="874" fill="#fff" opacity="0">${flash(ev.checks)}</rect>`);
}

// The terminal's `text{font:…}` rule outranks presentation attributes, so app text carries its
// font as an inline style instead.
function iosFonts(markup) {
  return markup.replace(/<text([^>]*?) class="ios"([^>]*)>/g, (_, a, b) => {
    const attrs = a + b;
    const size = attrs.match(/font-size="([\d.]+)"/)?.[1] ?? 13;
    const weight = attrs.match(/font-weight="(\d+)"/)?.[1] ?? 400;
    const rest = attrs.replace(/ font-(?:size|weight)="[^"]*"/g, '');
    return `<text${rest} style="font:${weight} ${size}px ${SANS};white-space:normal">`;
  });
}

function kagomeLayer(frames) {
  if (!frames?.length) return { css: '', body: '' };
  const cols = Math.max(...frames.flat().map(l => l.length));
  const lh = (H - TOP - STATUS) / frames[0].length;
  const n = frames.length;
  const css = `.fr{visibility:hidden}@keyframes fr{0%{visibility:visible}${round(100 / n)}%{visibility:hidden}}`
    + frames.map((_, i) => `#k${i}{animation:fr .4s steps(1) infinite ${round((i * 0.4) / n)}s}`).join('');
  const body = frames.map((lines, i) => `<text class="fr kg" id="k${i}">${lines.map((l, j) =>
    `<tspan x="20" y="${round(TOP + 16 + j * lh)}" textLength="${W - 40}" lengthAdjust="spacingAndGlyphs">${esc(l.padEnd(cols, ' '))}</tspan>`).join('')}</text>`).join('\n');
  return { css, body };
}

export function renderTerminal({ user, project, commits, activeProjects, streak, week, date, kagome }) {
  uid = 0;
  const p = project || 'side-quest';

  const claude = schedule([
    { text: `~/${p} $ claude`, color: C.prompt, typed: true, at: 0.3 },
    { text: '> add a streak card + green accent to Today', color: C.user, typed: true, pause: 0.6 },
    { text: '* Thinking…', color: C.claude, pause: 0.7 },
    { text: '• Read(Sources/Today/TodayView.swift)', color: C.tool, pause: 1.0 },
    { text: '  └ 182 lines', color: C.out, pause: 0.3 },
    { text: '• Update(Sources/Today/TodayView.swift)', color: C.tool, pause: 0.9 },
    { text: '  └ +46 −3 · StreakCard added', color: C.out, pause: 0.3 },
    { text: '• Update(Sources/Theme/Palette.swift)', color: C.tool, pause: 1.4 },
    { text: '  └ +4 −4 · accent → green', color: C.out, pause: 0.3 },
    { text: '• Bash(xcodebuild test -scheme Today)', color: C.tool, pause: 1.3 },
    { text: '  └ ✓ 84 passed · 0 failed', color: C.ok, pause: 1.5 },
    { text: '• Done — live in the Simulator.', color: C.user, pause: 0.8 },
    { text: '>', color: C.prompt, pause: 0.6 },
  ]);
  const codex = schedule([
    { text: `~/${p} $ codex`, color: C.prompt, typed: true, at: 9.4 },
    { text: '› animate the habit checkmarks', color: C.user, typed: true, pause: 0.6 },
    { text: '▸ planning · 2 steps', color: C.dim, pause: 0.8 },
    { text: '▸ edit Sources/Today/HabitRow.swift', color: C.tool, pause: 1.0 },
    { text: '✓ spring check + haptic tick', color: C.ok, pause: 1.6 },
    { text: '›', color: C.prompt, pause: 0.6 },
  ]);
  const ev = {
    card: claude[6].start + 0.2,
    accent: claude[8].start + 0.2,
    tests: claude[10].start + 0.1,
    checks: codex[4].start + 0.2,
    testCount: 84,
  };

  const kg = kagomeLayer(kagome);
  const hw = phoneHardware();
  const scale = 0.49;
  const phoneX = round(SPLIT_X + (W - SPLIT_X) / 2 - (CASE_W * scale) / 2);
  const phoneY = 84;
  const status = `${activeProjects} active · ${commits} commits/7d · ${streak}d streak`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`Terminal: Claude and Codex editing an iOS app while the Simulator hot-reloads (${user})`)}">
<style>
text{font:${FONT}px ${MONO};white-space:pre}
.ios{font-family:${SANS};white-space:normal}
.kg{font-size:15px;fill:${GREEN}}
.lbl{font-size:12px;fill:#8b949e}
${kg.css}
@keyframes blink{50%{opacity:0}}
.blink{animation:blink 1s steps(1) infinite}
@keyframes live{50%{opacity:.25}}
.live{animation:live 1.6s ease-in-out infinite}
</style>
<defs>
<filter id="glow" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="drop" x="-30%" y="-10%" width="160%" height="125%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity=".55"/></filter>
<linearGradient id="metal" x1="0" x2="1"><stop offset="0" stop-color="#4a4d52"/><stop offset=".08" stop-color="#2a2c30"/><stop offset=".92" stop-color="#2a2c30"/><stop offset="1" stop-color="#4a4d52"/></linearGradient>
<linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ACCENT_A}">${recolor('stop-color', ev.accent)}</stop><stop offset="1" stop-color="#0050b3">${anim('stop-color', ['#0050b3', '#0050b3', '#1a7f37', '#1a7f37', '#0050b3', '#0050b3'], [0, ev.accent, ev.accent + 0.4, CLEAR, CLEAR + 0.4, LOOP])}</stop></linearGradient>
<radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${GREEN}" stop-opacity=".10"/><stop offset="1" stop-color="${GREEN}" stop-opacity="0"/></radialGradient>
<clipPath id="win"><rect width="${W}" height="${H}" rx="12"/></clipPath>
<clipPath id="screen"><rect width="402" height="874" rx="55"/></clipPath>
<pattern id="scan" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="1" fill="#000" opacity=".16"/></pattern>
</defs>
<g clip-path="url(#win)">
<rect width="${W}" height="${H}" fill="#0d1117"/>
<g opacity=".08" filter="url(#glow)">${kg.body}</g>

<rect width="${W}" height="${TOP - 4}" fill="#161b22"/>
<circle cx="18" cy="15" r="6" fill="#ff5f56"/><circle cx="38" cy="15" r="6" fill="#ffbd2e"/><circle cx="58" cy="15" r="6" fill="#27c93f"/>
<text x="${W / 2}" y="20" text-anchor="middle" class="lbl">${esc(user)}@matrix — claude · codex · simulator</text>

<path d="M${SPLIT_X} ${TOP}V${H - STATUS}M0 ${SPLIT_Y}H${SPLIT_X}" stroke="${GREEN}" stroke-opacity=".28"/>
<text x="18" y="${TOP + 18}" class="lbl"><tspan fill="${C.claude}">●</tspan> claude</text>
<text x="18" y="${SPLIT_Y + 20}" class="lbl"><tspan fill="${C.codex}">●</tspan> codex</text>
<g filter="url(#glow)">
${renderPane(claude, 18, TOP + 42)}
${renderPane(codex, 18, SPLIT_Y + 44)}
</g>

<rect x="${SPLIT_X + 1}" y="${TOP}" width="${W - SPLIT_X - 1}" height="${H - TOP - STATUS}" fill="#0a0d12" opacity=".6"/>
<ellipse cx="${SPLIT_X + (W - SPLIT_X) / 2}" cy="${phoneY + 220}" rx="200" ry="240" fill="url(#halo)"/>
<text x="${SPLIT_X + (W - SPLIT_X) / 2}" y="${TOP + 26}" text-anchor="middle" class="lbl"><tspan fill="${ACCENT_B}" class="live">●</tspan> Simulator — iPhone 18 Pro · live</text>
<g transform="translate(${phoneX} ${phoneY}) scale(${scale})" filter="url(#drop)">
${hw.under}
<g transform="translate(${round(INSET)} ${round(INSET)})" clip-path="url(#screen)">
${appScreen({ ev, streak, week, date })}
</g>
${hw.over}
</g>

<rect y="${H - STATUS}" width="${W}" height="${STATUS}" fill="${GREEN}"/>
<text x="12" y="${H - 8}" fill="#0d1117" font-weight="700">[agents] 0:claude* 1:codex 2:simulator</text>
<text x="${W - 12}" y="${H - 8}" fill="#0d1117" text-anchor="end">${esc(status)}</text>
<rect width="${W}" height="${H}" fill="url(#scan)" opacity=".6"/>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="${GREEN}" stroke-opacity=".35"/>
</svg>
`;
}
