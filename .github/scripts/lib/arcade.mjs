// Retro arcade rendering of the contribution calendar (pure SVG + CSS/SMIL, no JS).
// A block-cursor "chomper" eats the year's contributions while bugs give chase,
// a snake patrols the board, a bug swarm marches overhead and a deploy rocket fires commits.
import { esc, kt, round } from './util.mjs';

const PITCH = 14;
const CELL = 11;
const GX = 52; // grid origin
const GY = 120;
const LAP = 42; // seconds for the chomper to clear the board
const BG = '#0d1117';
const GREEN = '#8CFF98';
const LEVEL_FILL = {
  FIRST_QUARTILE: '#0e4429',
  SECOND_QUARTILE: '#006d32',
  THIRD_QUARTILE: '#26a641',
  FOURTH_QUARTILE: GREEN,
};
const BUG_COLORS = ['#ff5f56', '#ff79c6', '#ffb86c', '#8be9fd'];

// Pixel sprites: '#' = filled. Bug faces up; legs alternate between two frames.
const BUG_BODY = [
  '..#...#..',
  '...#.#...',
  '..#####..',
  '..#.#.#..',
  '..#####..',
  '..#####..',
  '...###...',
];
const BUG_LEGS_A = ['.........', '.........', '.........', '#.......#', '.#.....#.', '#.......#', '.#.....#.'];
const BUG_LEGS_B = ['.........', '.........', '.........', '.#.....#.', '#.......#', '.#.....#.', '#.......#'];
const ROCKET = [
  '...#...',
  '..###..',
  '..#.#..',
  '..###..',
  '.#####.',
  '##.#.##',
  '#..#..#',
];

function pixels(rows, size, ox = 0, oy = 0) {
  let d = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '#') d += `M${round(ox + x * size)} ${round(oy + y * size)}h${size}v${size}h-${size}z`;
  }));
  return d;
}

function streakOf(days) {
  let i = days.length - 1;
  if (i >= 0 && days[i].contributionCount === 0) i--; // today may not have activity yet
  let n = 0;
  for (; i >= 0 && days[i].contributionCount > 0; i--) n++;
  return n;
}

export function renderArcade({ weeks, user }) {
  const days = weeks.flatMap((w, c) => w.contributionDays.map(d => ({ ...d, c, r: d.weekday })));
  if (days.length === 0) return null;

  const cols = weeks.length;
  const gridW = cols * PITCH - (PITCH - CELL);
  const gridH = 7 * PITCH - (PITCH - CELL);
  const W = GX * 2 + gridW;
  const H = GY + gridH + 96;
  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  const best = days.reduce((a, d) => (d.contributionCount > a.contributionCount ? d : a), days[0]);
  const streak = streakOf(days);

  // ── chomper path: serpentine through the 7 rows, exits right and re-enters left (tunnel)
  const rowY = r => GY + r * PITCH + CELL / 2;
  const xl = GX - 9;
  const xr = GX + gridW + 9;
  const tunnel = 30;
  let path = `M${xl - tunnel} ${rowY(0)}H${xr}`;
  for (let r = 1; r < 7; r++) path += `V${rowY(r)}H${r % 2 ? xl : xr}`;
  path += `H${xr + tunnel}`;
  const rowLen = xr - xl;
  const pathLen = tunnel * 2 + 7 * rowLen + 6 * PITCH;
  const distOf = (c, r) => {
    const cx = GX + c * PITCH + CELL / 2;
    return tunnel + r * (rowLen + PITCH) + (r % 2 ? xr - cx : cx - xl);
  };
  const eatAt = (c, r) => kt((distOf(c, r) - 5) / pathLen);

  // ── board cells (each disappears when the chomper reaches it, all respawn each lap)
  const cells = days.map(d => {
    const x = GX + d.c * PITCH;
    const y = GY + d.r * PITCH;
    const eat = `<animate attributeName="opacity" values="1;0" keyTimes="0;${eatAt(d.c, d.r)}" dur="${LAP}s" calcMode="discrete" repeatCount="indefinite"/>`;
    if (d === best && best.contributionCount > 0) {
      return `<g class="power" transform="translate(${x + CELL / 2} ${y + CELL / 2})"><rect x="-6" y="-6" width="12" height="12" rx="2" fill="#fff"/>${eat}</g>`;
    }
    const fill = LEVEL_FILL[d.contributionLevel];
    return fill
      ? `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${fill}">${eat}</rect>`
      : `<rect x="${x + 4}" y="${y + 4}" width="3" height="3" fill="#2d4a36">${eat}</rect>`;
  }).join('');

  // ── power-up: bugs turn blue ("patched") for a few seconds after the best day is eaten
  const p = best.contributionCount > 0 ? eatAt(best.c, best.r) : null;
  const scared = color => {
    if (p === null) return '';
    const s = LAP;
    const times = [0, p, p + 3.6 / s, p + 4.0 / s, p + 4.4 / s, p + 4.8 / s, p + 5.2 / s].map(kt);
    return `<animate attributeName="fill" values="${color};#4c6ef5;#e6edf3;#4c6ef5;#e6edf3;#4c6ef5;${color}" keyTimes="${times.join(';')}" dur="${s}s" calcMode="discrete" repeatCount="indefinite"/>`;
  };

  // ── chasers: same path, trailing the chomper by a few seconds
  const bugs = BUG_COLORS.map((color, i) => {
    const lag = (1.6 + i * 1.1) / LAP;
    const start = kt(1 - lag);
    return `<g fill="${color}">${scared(color)}
<animateMotion path="${path}" dur="${LAP}s" repeatCount="indefinite" rotate="auto" calcMode="linear" keyPoints="${start};1;0;${start}" keyTimes="0;${kt(lag)};${kt(lag)};1"/>
<g transform="rotate(90) translate(-6.3 -4.9)"><use href="#bug" width="12.6" height="9.8"/></g></g>`;
  }).join('\n');

  // ── snake patrolling the board's border
  const bx = GX - 22;
  const by = GY - 22;
  const bw = gridW + 44;
  const bh = gridH + 44;
  const perim = 2 * (bw + bh);
  const seg = 7;
  const gap = 2;
  const segs = 10;
  const bodyLen = segs * (seg + gap);
  const snakeDash = Array.from({ length: segs }, (_, i) => `${seg} ${i < segs - 1 ? gap : perim - bodyLen + gap}`).join(' ');
  const snakeRect = `M${bx} ${by}h${bw}v${bh}h-${bw}z`;

  // ── swarm, rocket and satellite lanes
  const swarm = Array.from({ length: 11 }, (_, i) =>
    `<g fill="${BUG_COLORS[i % BUG_COLORS.length]}" transform="translate(${i * 40} 0)"><use href="#bug" width="16.2" height="12.6"/></g>`).join('');
  const shipY = GY + gridH + 40;

  const year = days.at(-1).date.slice(0, 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`${user}'s contributions as a retro arcade: ${total} contributions in the last year`)}">
<style>
text{font:700 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:${GREEN}}
.dim{fill:#8b949e;font-weight:500}
.amber{fill:#ffcc80}
.legA{animation:legs .5s steps(1) infinite}
.legB{animation:legs .5s steps(1) infinite -.25s}
@keyframes legs{50%{opacity:0}}
.power rect{animation:pulse .6s ease-in-out infinite alternate}
@keyframes pulse{to{transform:scale(.55);fill:${GREEN}}}
#swarm{animation:march 6s steps(10) infinite alternate}
@keyframes march{to{transform:translateX(${W - GX * 2 - 10 * 40 - 20}px)}}
#snake,#head{animation:slither 16s linear infinite}
#head{animation-name:slitherHead}
@keyframes slither{from{stroke-dashoffset:0}to{stroke-dashoffset:-${perim}}}
@keyframes slitherHead{from{stroke-dashoffset:-${bodyLen - gap - seg}}to{stroke-dashoffset:-${bodyLen - gap - seg + perim}}}
#ship{animation:patrol 9s ease-in-out infinite alternate}
@keyframes patrol{0%{transform:translateX(${GX}px)}30%{transform:translateX(${GX + gridW * 0.45}px)}55%{transform:translateX(${GX + gridW * 0.2}px)}100%{transform:translateX(${GX + gridW - 12}px)}}
.shot{animation:fire 1.8s linear infinite;opacity:0}
@keyframes fire{0%{transform:translateY(0);opacity:1}35%{transform:translateY(-${shipY - 52}px);opacity:1}36%,100%{opacity:0}}
.flame{animation:flame .15s steps(1) infinite alternate}
@keyframes flame{to{fill:#ff5f56}}
#sat{animation:orbit 18s linear infinite}
@keyframes orbit{from{transform:translate(-40px,22px)}to{transform:translate(${W + 40}px,14px)}}
.blink{animation:blink 1.2s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
</style>
<defs>
<symbol id="bug" viewBox="0 0 9 7" overflow="visible"><path d="${pixels(BUG_BODY, 1)}"/><path class="legA" d="${pixels(BUG_LEGS_A, 1)}"/><path class="legB" d="${pixels(BUG_LEGS_B, 1)}"/><path fill="${BG}" d="M3 3h1v1h-1zM5 3h1v1h-1z"/></symbol>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#fff" opacity=".035"/></pattern>
<clipPath id="screen"><rect width="${W}" height="${H}" rx="14"/></clipPath>
</defs>
<g clip-path="url(#screen)">
<rect width="${W}" height="${H}" fill="${BG}"/>

<text x="${GX}" y="30"><tspan class="dim">SCORE </tspan>${String(total).padStart(6, '0')}</text>
<text x="${W / 2}" y="30" text-anchor="middle"><tspan class="dim">BEST DAY </tspan>${best.contributionCount}</text>
<text x="${W - GX}" y="30" text-anchor="end"><tspan class="dim">STREAK </tspan>${streak}d</text>

<g id="sat"><rect x="-9" y="-3" width="6" height="6" fill="#58a6ff"/><rect x="3" y="-3" width="6" height="6" fill="#58a6ff"/><rect x="-3" y="-4" width="6" height="8" fill="#c9d1d9"/><rect x="-1" y="-7" width="2" height="3" fill="#ff5f56" class="blink"/></g>

<g transform="translate(${GX} 52)"><g id="swarm">${swarm}</g></g>

<path d="${snakeRect}" fill="none" stroke="#30363d" stroke-dasharray="2 6"/>
<path id="snake" d="${snakeRect}" fill="none" stroke="#3fb950" stroke-width="7" stroke-dasharray="${snakeDash}"/>
<path id="head" d="${snakeRect}" fill="none" stroke="#d2ffd8" stroke-width="9" stroke-dasharray="${seg + 2} ${perim - seg - 2}"/>

${cells}

${bugs}

<g filter="url(#glow)">
<animateMotion path="${path}" dur="${LAP}s" repeatCount="indefinite" rotate="auto"/>
<rect x="-6.5" y="-6.5" width="13" height="13" rx="2" fill="${GREEN}"/>
<rect x="0" y="-.5" width="7" height="1" fill="${BG}"><animate attributeName="y" values="-.5;-3.5;-.5" dur=".3s" repeatCount="indefinite"/><animate attributeName="height" values="1;7;1" dur=".3s" repeatCount="indefinite"/></rect>
<rect x="-4" y="-4.5" width="2" height="9" fill="${BG}" opacity=".35"/>
</g>

<g id="ship" transform="translate(${GX} 0)">
<g transform="translate(0 ${shipY})">
<rect class="shot" x="5" y="-6" width="2" height="6" fill="${GREEN}"/>
<rect class="shot" x="5" y="-6" width="2" height="6" fill="${GREEN}" style="animation-delay:.6s"/>
<rect class="shot" x="5" y="-6" width="2" height="6" fill="#ffcc80" style="animation-delay:1.2s"/>
<path d="${pixels(ROCKET, 1.75)}" fill="#c9d1d9"/>
<rect class="flame" x="4.4" y="12.5" width="3.5" height="3" fill="#ffb86c"/>
</g>
</g>

<text x="${GX}" y="${H - 16}" class="amber blink">INSERT COIN</text>
<text x="${W - GX}" y="${H - 16}" text-anchor="end" class="dim">${total} contributions · ${year} · ${esc(user)}</text>

<rect width="${W}" height="${H}" fill="url(#scan)"/>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${GREEN}" stroke-opacity=".3"/>
</svg>
`;
}
