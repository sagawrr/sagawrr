// "Active projects" card: one row per project with a language-share bar, 7-day activity bars,
// commit count and role. SVG instead of an HTML table because GitHub strips all table styling.
import { esc, round } from './util.mjs';

const W = 900;
const PAD = 28;
const ROW_H = 52;
const HEAD_H = 104;
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

// Readable-on-dark language colours (GitHub linguist palette, darkest ones lifted).
export const LANG_COLOR = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', 'C#': '#9b6bdf', Swift: '#F05138', Go: '#00ADD8',
  Kotlin: '#A97BFF', CSS: '#8f6bd8', HTML: '#e34c26', Rust: '#dea584', Python: '#3572A5',
  Bash: '#89e051', Gradle: '#5fa8a0', Dockerfile: '#2496ED', C: '#A8B9CC', 'C++': '#f34b7d',
  Java: '#b07219', Dart: '#00B4AB', Ruby: '#CC342D', PHP: '#777BB4', Vue: '#41b883',
  Svelte: '#ff3e00', Astro: '#ff5a03', SQL: '#e38c00', GraphQL: '#e10098', Lua: '#6b6bd6',
  Elixir: '#9b72c7', Haskell: '#8f7fd1', Scala: '#c22d40', Zig: '#ec915c', Nix: '#7e7eff',
  Sass: '#c6538c', Less: '#4a6ea8', PowerShell: '#5391FE', 'Objective-C': '#438eff', R: '#198CE7',
  Perl: '#6f8fc0', Makefile: '#427819', CMake: '#DA3434', TeX: '#3D6117', OCaml: '#ef7a08',
  Clojure: '#db5855', Erlang: '#B83998', Elm: '#60B5CC', 'F#': '#b845fc', Solidity: '#AA6746',
  WebAssembly: '#654FF0', Crystal: '#b3b3b3', Nim: '#ffc200', Gleam: '#ffaff3', V: '#5d87bf',
  Haxe: '#df7900', CoffeeScript: '#244776', EJS: '#a91e50', Fortran: '#4d41b1', Odin: '#60AFFE',
  JSON: '#6e7681', YAML: '#cb171e', XML: '#0060ac', TOML: '#9c4221', MDX: '#fcb32c',
};
const color = lang => LANG_COLOR[lang] ?? '#8b949e';
const pct = f => (f < 0.005 ? '&lt;1%' : `${Math.round(f * 100)}%`); // already escaped for SVG

const lockIcon = (x, y) =>
  `<path d="M${x + 2} ${y + 6}h9v7h-9z" fill="#7d8590"/><path d="M${x + 4} ${y + 6}v-2a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="#7d8590" stroke-width="1.5"/>`;
const globeIcon = (x, y) =>
  `<circle cx="${x + 6.5}" cy="${y + 8}" r="5.5" fill="none" stroke="#7d8590" stroke-width="1.4"/><path d="M${x + 1} ${y + 8}h11M${x + 6.5} ${y + 2.5}c-3 3.5-3 7.5 0 11M${x + 6.5} ${y + 2.5}c3 3.5 3 7.5 0 11" fill="none" stroke="#7d8590" stroke-width="1.1"/>`;

function roleChip(rank, x, y) {
  const { rank: r, total } = rank;
  const [label, fg, bg] = !total ? ['—', '#7d8590', '#161b22']
    : !r ? [`${total} active`, '#7d8590', '#161b22']
      : total === 1 ? ['Solo', '#8CFF98', '#0f2a17']
        : r === 1 ? [`Lead · 1/${total}`, '#ffcc80', '#2b2111'] : [`#${r} of ${total}`, '#79c0ff', '#0d2138'];
  const w = label.length * 7 + 20;
  return `<rect x="${x - w}" y="${y - 11}" width="${w}" height="22" rx="11" fill="${bg}"/><text x="${x - w / 2}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="600" fill="${fg}">${esc(label)}</text>`;
}

export function renderProjects({ rows, windowDays }) {
  const H = HEAD_H + Math.max(rows.length, 1) * ROW_H + 24;
  const totalCommits = rows.reduce((n, r) => n + r.commits, 0);
  const langCount = new Set(rows.flatMap(r => r.languages.map(([l]) => l))).size;

  const COL = { idx: PAD, name: PAD + 34, stack: 300, activity: 560, commits: 730, role: W - PAD };
  const STACK_W = 220;

  const body = rows.map((r, i) => {
    const y = HEAD_H + i * ROW_H;
    const mid = y + ROW_H / 2;
    const delay = round(0.15 + i * 0.07, 2);

    let x = COL.stack;
    const segs = r.languages.slice(0, 6);
    const shareSum = segs.reduce((s, [, v]) => s + v, 0) || 1;
    const bar = segs.map(([lang, share], j) => {
      const w = round((share / shareSum) * STACK_W);
      const seg = `<rect x="${round(x)}" y="${mid - 9}" width="${Math.max(w - (j < segs.length - 1 ? 2 : 0), 1)}" height="6" fill="${color(lang)}"><title>${esc(lang)} ${pct(share / shareSum)}</title></rect>`;
      x += w;
      return seg;
    }).join('');
    const legend = segs.slice(0, 3).map(([lang, share], j) =>
      `<tspan fill="${color(lang)}">●</tspan><tspan fill="#9198a1"> ${esc(lang)} ${pct(share / shareSum)}</tspan>${j < Math.min(segs.length, 3) - 1 ? '<tspan>   </tspan>' : ''}`).join('');

    const max = Math.max(...r.activity, 1);
    const spark = r.activity.map((n, j) => {
      const h = n === 0 ? 2 : round(4 + (n / max) * 22);
      return `<rect x="${COL.activity + j * 17}" y="${round(mid + 13 - h)}" width="11" height="${h}" rx="2.5" fill="${n === 0 ? '#21262d' : '#8CFF98'}" fill-opacity="${n === 0 ? 1 : round(0.35 + 0.65 * (n / max), 2)}" style="animation-delay:${round(delay + j * 0.04, 2)}s"><title>${n} commit${n === 1 ? '' : 's'}</title></rect>`;
    }).join('');

    const name = r.private
      ? `${lockIcon(COL.name, mid - 13)}<text x="${COL.name + 20}" y="${mid - 1}" class="mono" font-size="14" font-weight="600">${esc(r.name)}</text><text x="${COL.name + 20}" y="${mid + 16}" font-size="11" fill="#7d8590">private</text>`
      : `${globeIcon(COL.name, mid - 13)}<text x="${COL.name + 20}" y="${mid - 1}" font-size="14" font-weight="600">${esc(r.name)}</text><text x="${COL.name + 20}" y="${mid + 16}" font-size="11" fill="#7d8590">${esc((r.description || 'public').slice(0, 34))}</text>`;

    return `<g class="row" style="animation-delay:${delay}s">
${i > 0 ? `<path d="M${PAD} ${y}H${W - PAD}" stroke="#21262d"/>` : ''}
<text x="${COL.idx}" y="${mid + 4}" class="mono" font-size="12" fill="#484f58">${String(i + 1).padStart(2, '0')}</text>
${name}
<g class="bar" style="animation-delay:${delay}s"><rect x="${COL.stack}" y="${mid - 9}" width="${STACK_W}" height="6" rx="3" fill="#21262d"/>${bar}</g>
<text x="${COL.stack}" y="${mid + 14}" font-size="11">${legend}</text>
<g class="spark">${spark}</g>
<text x="${COL.commits + 60}" y="${mid + 5}" text-anchor="end" class="mono" font-size="15" font-weight="600">${r.commits >= 100 ? '100+' : r.commits}</text>
${roleChip(r.rank, COL.role, mid)}
</g>`;
  }).join('\n');

  const empty = rows.length ? '' : `<text x="${W / 2}" y="${HEAD_H + 30}" text-anchor="middle" fill="#7d8590" font-size="14">All quiet — no commits in the past ${windowDays} days.</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`Active projects in the past ${windowDays} days: ${rows.length} projects, ${totalCommits} commits`)}">
<style>
text{font-family:${SANS};fill:#e6edf3}
.mono{font-family:${MONO}}
.head{font-size:11px;font-weight:600;letter-spacing:.06em;fill:#7d8590}
.row{opacity:0;animation:fade .5s ease-out forwards}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.bar{transform-box:fill-box;transform-origin:left center;animation:grow .9s cubic-bezier(.2,.8,.2,1) both}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.spark rect{transform-box:fill-box;transform-origin:center bottom;animation:rise .6s cubic-bezier(.2,.8,.2,1) both}
@keyframes rise{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.row,.bar,.spark rect{animation:none;opacity:1}}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="#0d1117" stroke="#30363d"/>
<text x="${PAD}" y="44" font-size="20" font-weight="700">Active projects</text>
<text x="${PAD}" y="66" font-size="13" fill="#7d8590">Past ${windowDays} days · ${rows.length} project${rows.length === 1 ? '' : 's'} · ${totalCommits} commits · ${langCount} languages</text>
<text x="${COL.name}" y="${HEAD_H - 10}" class="head">PROJECT</text>
<text x="${COL.stack}" y="${HEAD_H - 10}" class="head">STACK</text>
<text x="${COL.activity}" y="${HEAD_H - 10}" class="head">ACTIVITY · ${windowDays}D</text>
<text x="${COL.commits + 60}" y="${HEAD_H - 10}" text-anchor="end" class="head">COMMITS</text>
<text x="${COL.role}" y="${HEAD_H - 10}" text-anchor="end" class="head">ROLE</text>
<path d="M${PAD} ${HEAD_H - 1}H${W - PAD}" stroke="#30363d"/>
${body}${empty}
</svg>
`;
}
