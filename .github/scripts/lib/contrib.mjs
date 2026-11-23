// Polished contribution chart: a year of activity with month/weekday labels, headline stats,
// a Less→More legend and a one-time left-to-right reveal on load.
import { esc, round } from './util.mjs';

const CELL = 12;
const PITCH = 15;
const PAD = 28;
const LABEL_W = 30;
const GRID_Y = 116;
const LEVELS = {
  NONE: '#161b22',
  FIRST_QUARTILE: '#0e4429',
  SECOND_QUARTILE: '#006d32',
  THIRD_QUARTILE: '#26a641',
  FOURTH_QUARTILE: '#8CFF98',
};
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function calendarStats(weeks) {
  const days = weeks.flatMap(w => w.contributionDays);
  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  const best = days.reduce((a, d) => (d.contributionCount > a.contributionCount ? d : a), days[0]);
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let i = days.length - 1;
  if (i >= 0 && days[i].contributionCount === 0) i--; // today may still be empty
  let current = 0;
  for (; i >= 0 && days[i].contributionCount > 0; i--) current++;
  const byMonth = new Map();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + d.contributionCount);
  }
  const [busiestKey, busiestCount] = [...byMonth].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
  return { days, total, best, longest, current, busiest: { key: busiestKey, count: busiestCount } };
}

const fmtDate = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

export function renderContrib({ weeks, user }) {
  const s = calendarStats(weeks);
  if (!s.days.length) return null;
  const cols = weeks.length;
  const gx = PAD + LABEL_W;
  const W = gx + cols * PITCH - (PITCH - CELL) + PAD;
  const H = GRID_Y + 7 * PITCH + 62;

  const cells = weeks.flatMap((w, c) => w.contributionDays.map(d => {
    const x = gx + c * PITCH;
    const y = GRID_Y + d.weekday * PITCH;
    const title = `${d.contributionCount} contribution${d.contributionCount === 1 ? '' : 's'} on ${fmtDate(d.date)}`;
    return `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3" fill="${LEVELS[d.contributionLevel] ?? LEVELS.NONE}" style="animation-delay:${round(c * 0.018, 3)}s"><title>${title}</title></rect>`;
  })).join('');

  // Month labels at the first column whose first day starts a new month.
  let lastMonth = -1;
  const months = weeks.map((w, c) => {
    const m = Number(w.contributionDays[0].date.slice(5, 7)) - 1;
    if (m === lastMonth || c > cols - 2) return '';
    lastMonth = m;
    return c === 0 && Number(w.contributionDays[0].date.slice(8)) > 21
      ? '' // skip a stub month at the very start
      : `<text x="${gx + c * PITCH}" y="${GRID_Y - 10}" class="axis">${MONTHS[m]}</text>`;
  }).join('');

  const today = weeks.at(-1).contributionDays.at(-1);
  const tx = gx + (cols - 1) * PITCH;
  const ty = GRID_Y + today.weekday * PITCH;

  const stat = (x, label, value, sub = '') => `<text x="${x}" y="44" text-anchor="end" class="label">${label}</text>
<text x="${x}" y="70" text-anchor="end" class="value">${value}${sub ? `<tspan class="unit"> ${sub}</tspan>` : ''}</text>`;
  const busiest = s.busiest.key ? `${MONTHS[Number(s.busiest.key.slice(5, 7)) - 1]} ${s.busiest.key.slice(0, 4)}` : '—';
  const legendX = W - PAD - 5 * PITCH - 34;
  const legendY = GRID_Y + 7 * PITCH + 22;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`${user}: ${s.total} contributions in the last year; best day ${s.best.contributionCount}, longest streak ${s.longest} days`)}">
<style>
text{font-family:${SANS};fill:#e6edf3}
.axis{font-size:11px;fill:#7d8590}
.label{font-size:11px;font-weight:600;letter-spacing:.06em;fill:#7d8590}
.value{font-size:20px;font-weight:700}
.unit{font-size:12px;font-weight:500;fill:#7d8590}
.grid rect{opacity:0;transform-box:fill-box;transform-origin:center;animation:pop .5s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
.today{animation:ring 2s ease-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes ring{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(2.2)}}
@media (prefers-reduced-motion:reduce){.grid rect{animation:none;opacity:1}.today{animation:none}}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="#0d1117" stroke="#30363d"/>

<text x="${PAD}" y="46" font-size="28" font-weight="700">${s.total.toLocaleString('en-US')}</text>
<text x="${PAD}" y="70" font-size="13" fill="#7d8590">contributions in the last year</text>
${stat(W - PAD - 440, 'BEST DAY', s.best.contributionCount)}
${stat(W - PAD - 300, 'CURRENT STREAK', s.current, s.current === 1 ? 'day' : 'days')}
${stat(W - PAD - 150, 'LONGEST STREAK', s.longest, s.longest === 1 ? 'day' : 'days')}
${stat(W - PAD, 'BUSIEST', busiest.split(' ')[0], busiest.split(' ')[1] ?? '')}

${months}
<text x="${PAD}" y="${GRID_Y + PITCH + 10}" class="axis">Mon</text>
<text x="${PAD}" y="${GRID_Y + 3 * PITCH + 10}" class="axis">Wed</text>
<text x="${PAD}" y="${GRID_Y + 5 * PITCH + 10}" class="axis">Fri</text>
<g class="grid">${cells}</g>
<rect class="today" x="${tx - 1}" y="${ty - 1}" width="${CELL + 2}" height="${CELL + 2}" rx="4" fill="none" stroke="#8CFF98" stroke-width="1.5"/>

<text x="${PAD}" y="${legendY + 10}" class="axis">${fmtDate(s.days[0].date)} – ${fmtDate(s.days.at(-1).date)}</text>
<text x="${legendX - 8}" y="${legendY + 10}" text-anchor="end" class="axis">Less</text>
${Object.values(LEVELS).map((fill, i) => `<rect x="${legendX + i * PITCH}" y="${legendY}" width="${CELL}" height="${CELL}" rx="3" fill="${fill}"/>`).join('')}
<text x="${legendX + 5 * PITCH + 4}" y="${legendY + 10}" class="axis">More</text>
</svg>
`;
}
