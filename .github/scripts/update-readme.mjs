// Renders README.md's dynamic blocks (stack row, project table, sync badge) and regenerates
// assets/terminal.svg + assets/arcade.svg from live GitHub data.
// Runs on Bun (or Node ≥ 20). Env: PROFILE_USER (required), GITHUB_TOKEN (read-only PAT; optional).
import fs from 'node:fs';
import { renderArcade } from './lib/arcade.mjs';
import { renderTerminal } from './lib/terminal.mjs';
import { esc as escapeHtml, hash } from './lib/util.mjs';

const username = process.env.PROFILE_USER ?? '';
const token = process.env.GITHUB_TOKEN;
if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(username)) {
  console.error('PROFILE_USER must be a valid GitHub username');
  process.exit(1);
}

const README = 'README.md';
const API = 'https://api.github.com';
const WINDOW_DAYS = 7;
const MAX_PROJECTS = 10;
const MAX_COMMITS_SCANNED = 20; // commit details fetched per repo for language detection
const BADGES_PER_ROW = 6;
const REQUEST_TIMEOUT_MS = 15_000;
const windowStart = new Date(Date.now() - WINDOW_DAYS * 864e5);
const since = encodeURIComponent(windowStart.toISOString());
const me = username.toLowerCase();

const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'readme-updater',
  ...(token && { Authorization: `Bearer ${token}` }),
};

// file extension → language
const LANGUAGE_MAP = {
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  py: 'Python', java: 'Java', go: 'Go',
  c: 'C', h: 'C', cc: 'C++', cpp: 'C++', cxx: 'C++', hpp: 'C++', hh: 'C++',
  cs: 'C#', rs: 'Rust', rb: 'Ruby', php: 'PHP', kt: 'Kotlin', kts: 'Kotlin',
  swift: 'Swift', scala: 'Scala', dart: 'Dart', ex: 'Elixir', exs: 'Elixir',
  hs: 'Haskell', elm: 'Elm', sh: 'Bash', bash: 'Bash', zsh: 'Bash', ps1: 'PowerShell',
  html: 'HTML', css: 'CSS', scss: 'Sass', sass: 'Sass', less: 'Less',
  r: 'R', lua: 'Lua', pl: 'Perl', tex: 'TeX', mk: 'Makefile',
  vue: 'Vue', svelte: 'Svelte', astro: 'Astro', graphql: 'GraphQL', sql: 'SQL',
  gradle: 'Gradle', cmake: 'CMake', coffee: 'CoffeeScript', clj: 'Clojure',
  cr: 'Crystal', ejs: 'EJS', erl: 'Erlang', fs: 'F#', f: 'Fortran', gleam: 'Gleam',
  hx: 'Haxe', json: 'JSON', mdx: 'MDX', nim: 'Nim', nix: 'Nix', ml: 'OCaml',
  odin: 'Odin', m: 'Objective-C', sol: 'Solidity', v: 'V', wasm: 'WebAssembly',
  xml: 'XML', yaml: 'YAML', yml: 'YAML', toml: 'TOML', zig: 'Zig',
};

// GitHub linguist names (repo-language fallback) → our names
const LINGUIST_ALIASES = { Shell: 'Bash', SCSS: 'Sass', 'Jupyter Notebook': 'Python', PLpgSQL: 'SQL', TSQL: 'SQL' };

// language → [badge colour, simple-icons slug]; slug defaults to lowercased name
const BADGE = {
  Astro: ['BC52EE'], Bash: ['4EAA25', 'gnubash'], C: ['A8B9CC'], 'C++': ['00599C', 'cplusplus'],
  'C#': ['512BD4', 'dotnet'], CMake: ['064F8C'], Clojure: ['5881D8'], CoffeeScript: ['2F2625'],
  Crystal: ['000000'], CSS: ['663399'], Dart: ['0175C2'], Dockerfile: ['2496ED', 'docker'],
  EJS: ['B4CA65'], Elixir: ['4B275F'], Elm: ['1293D8'], Erlang: ['A90533'], 'F#': ['378BBA', 'fsharp'],
  Fortran: ['734F96'], Gleam: ['FFAFF3'], Go: ['00ADD8'], Gradle: ['02303A'], GraphQL: ['E10098'],
  Haskell: ['5E5086'], Haxe: ['EA8220'], HTML: ['E34F26', 'html5'], Java: ['ED8B00', 'openjdk'],
  JavaScript: ['F7DF1E'], JSON: ['000000'], Kotlin: ['7F52FF'], Less: ['1D365D'], Lua: ['2C2D72'],
  Makefile: ['427819', 'gnu'], MDX: ['1B1F24'], Nim: ['FFE953'], Nix: ['5277C3', 'nixos'],
  'Objective-C': ['3A95E3', 'apple'], OCaml: ['EC6813'], Odin: ['1E5184'], Perl: ['39457E'],
  PHP: ['777BB4'], PowerShell: ['5391FE'], Python: ['3776AB'], R: ['276DC3'], Ruby: ['CC342D'],
  Rust: ['000000'], Sass: ['CC6699'], Scala: ['DC322F'], Solidity: ['363636'], SQL: ['336791', 'postgresql'],
  Svelte: ['FF3E00'], Swift: ['F05138'], TeX: ['008080', 'latex'], TOML: ['9C4121'],
  TypeScript: ['3178C6'], V: ['5D87BF', 'v'], Vue: ['4FC08D', 'vuedotjs'], WebAssembly: ['654FF0'],
  XML: ['767C52'], YAML: ['CB171E'], Zig: ['F7A41D'],
};

// language → skillicons.dev id (only ids verified to exist)
const SKILL_ICON = {
  Astro: 'astro', Bash: 'bash', C: 'c', 'C++': 'cpp', 'C#': 'cs', CMake: 'cmake', Clojure: 'clojure',
  CoffeeScript: 'coffeescript', Crystal: 'crystal', CSS: 'css', Dart: 'dart', Dockerfile: 'docker',
  Elixir: 'elixir', Fortran: 'fortran', Go: 'go', Gradle: 'gradle', GraphQL: 'graphql', Haskell: 'haskell',
  Haxe: 'haxe', HTML: 'html', Java: 'java', JavaScript: 'js', Kotlin: 'kotlin', Less: 'less', Lua: 'lua',
  Nim: 'nim', Nix: 'nix', OCaml: 'ocaml', Perl: 'perl', PHP: 'php', PowerShell: 'powershell', Python: 'py',
  R: 'r', Ruby: 'ruby', Rust: 'rust', Sass: 'sass', Scala: 'scala', Solidity: 'solidity', SQL: 'postgres',
  Svelte: 'svelte', Swift: 'swift', TeX: 'latex', TypeScript: 'ts', V: 'v', Vue: 'vue',
  WebAssembly: 'wasm', Zig: 'zig',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchJson(path, { method = 'GET', body, retries = 3 } = {}) {
  const url = new URL(path, API);
  if (url.origin !== API) throw new Error(`Refusing to call non-GitHub URL: ${url}`);
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { method, body: body && JSON.stringify(body), headers: HEADERS, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (err) {
      if (attempt >= retries) throw new Error(`Network error for ${url.pathname}: ${err.message}`);
      await sleep(1000 * attempt);
      continue;
    }
    if (res.ok) return res.status === 204 ? null : res.json().catch(() => null);
    if (res.status === 401) throw new Error('GitHub API rejected the token (401)');
    if (res.status === 409) return null; // empty repository
    const retryable = [202, 403, 429].includes(res.status) || res.status >= 500;
    if (!retryable || attempt >= retries) {
      if (res.status >= 500 || res.status === 429) throw new Error(`GitHub API error ${res.status} for ${url.pathname}`);
      console.warn(`⚠️  ${res.status} for ${url.pathname}, skipping`);
      return null;
    }
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(retryAfter > 0 ? Math.min(retryAfter, 60) * 1000 : res.status === 202 ? 1500 : 5000);
  }
}

async function fetchRepositories() {
  const repos = [];
  const base = token
    ? '/user/repos?affiliation=owner,collaborator,organization_member'
    : `/users/${username}/repos?type=owner`;
  for (let page = 1; page <= 10; page++) {
    const batch = await fetchJson(`${base}&sort=pushed&direction=desc&per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    repos.push(...batch);
    if (batch.length < 100 || new Date(batch.at(-1).pushed_at) < windowStart) break;
  }
  // A commit inside the window must have been pushed after the window opened.
  const profileRepo = `${me}/${me}`; // this README's own repo isn't a project
  return repos.filter(r => !r.fork && !r.archived && r.full_name.toLowerCase() !== profileRepo
    && new Date(r.pushed_at) >= windowStart);
}

function inferLanguage(filename) {
  const base = filename.toLowerCase().split('/').pop();
  if (base === 'dockerfile' || base.endsWith('.dockerfile')) return 'Dockerfile';
  if (base === 'makefile' || base === 'gnumakefile') return 'Makefile';
  const ext = base.match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && LANGUAGE_MAP[ext]) || null;
}

// Returns [[language, share 0..1], ...] sorted by share, from the files I touched (repo stats as fallback).
async function getAuthoredLanguages(repo, commits) {
  const counts = new Map();
  const details = await Promise.all(
    commits.slice(0, MAX_COMMITS_SCANNED).map(c => fetchJson(`/repos/${repo.full_name}/commits/${c.sha}`)),
  );
  for (const file of details.flatMap(d => d?.files ?? [])) {
    const lang = inferLanguage(file.filename);
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + (file.changes || 1));
  }
  if (counts.size === 0) {
    const repoLangs = await fetchJson(`/repos/${repo.full_name}/languages`);
    for (const [name, bytes] of Object.entries(repoLangs ?? {})) {
      const lang = LINGUIST_ALIASES[name] ?? name;
      if (BADGE[lang]) counts.set(lang, (counts.get(lang) ?? 0) + bytes);
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  return [...counts].map(([lang, n]) => [lang, n / total]).sort((a, b) => b[1] - a[1]);
}

async function getContributorRank(repo) {
  const commits = await fetchJson(`/repos/${repo.full_name}/commits?since=${since}&per_page=100`);
  const counts = new Map();
  for (const c of Array.isArray(commits) ? commits : []) {
    const login = String(c?.author?.login || c?.commit?.author?.name || '').toLowerCase();
    if (!login || login.includes('[bot]')) continue;
    counts.set(login, (counts.get(login) ?? 0) + 1);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const idx = sorted.findIndex(([login]) => login === me);
  return { rank: idx === -1 ? null : idx + 1, total: sorted.length };
}

// Last year's contribution calendar (needs a token; private contributions count when the token is yours).
async function fetchCalendar() {
  if (!token) return null;
  const query = 'query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date weekday contributionCount contributionLevel}}}}}}';
  const res = await fetchJson('/graphql', { method: 'POST', body: { query, variables: { login: username } } });
  return res?.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? null;
}

// Commits per day over the window, oldest → today.
function dailyActivity(commits) {
  const days = Array(WINDOW_DAYS).fill(0);
  const now = Date.now();
  for (const c of commits) {
    const age = Math.floor((now - new Date(c.commit?.author?.date ?? now)) / 864e5);
    if (age >= 0 && age < WINDOW_DAYS) days[WINDOW_DAYS - 1 - age]++;
  }
  return days;
}

async function buildRow(repo) {
  const authored = await fetchJson(
    `/repos/${repo.full_name}/commits?author=${encodeURIComponent(username)}&since=${since}&per_page=100`,
  );
  if (!Array.isArray(authored) || authored.length === 0) return null;
  const [languages, rank] = await Promise.all([getAuthoredLanguages(repo, authored), getContributorRank(repo)]);
  return {
    repo, languages, rank,
    commits: authored.length,
    activity: dailyActivity(authored),
    lastCommit: authored[0].commit?.committer?.date ?? repo.pushed_at,
  };
}

// ── rendering ───────────────────────────────────────────────────────────────

const ADJECTIVES = ['silent', 'neon', 'quantum', 'phantom', 'crimson', 'hollow', 'binary', 'lunar', 'rogue', 'velvet',
  'static', 'cobalt', 'feral', 'glass', 'iron', 'midnight', 'solar', 'echo', 'zero', 'arctic', 'violet', 'rapid'];
const NOUNS = ['falcon', 'cipher', 'lotus', 'kernel', 'nebula', 'orbit', 'raven', 'circuit', 'comet', 'monolith',
  'vector', 'prism', 'ember', 'harbor', 'signal', 'quartz', 'atlas', 'drift', 'spire', 'tundra', 'relay', 'golem'];

// Stable, non-reversible codename for a private repo.
function codename(repo) {
  const h = hash(`codename:${repo.id}`);
  return `${ADJECTIVES[h % ADJECTIVES.length]}-${NOUNS[(h >>> 8) % NOUNS.length]}`;
}

const SAFE_GITHUB_REPO_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

function formatProject(repo) {
  if (repo.private) return `🔒 <code>${codename(repo)}</code><br/><sub>classified</sub>`;
  const name = `<b>${escapeHtml(repo.name)}</b>`;
  const desc = repo.description ? `<br/><sub>${escapeHtml(repo.description.slice(0, 60))}${repo.description.length > 60 ? '…' : ''}</sub>` : '';
  if (!SAFE_GITHUB_REPO_URL.test(repo.html_url)) return `🌐 ${name}${desc}`;
  return `🌐 <a href="${escapeHtml(repo.html_url)}">${name}</a>${desc}`;
}

const BARS = '▁▂▃▄▅▆▇█';
function formatActivity(activity, commits) {
  const max = Math.max(...activity, 1);
  const spark = activity.map(n => (n === 0 ? '·' : BARS[Math.min(7, Math.ceil((n / max) * 7))])).join('');
  return `<code>${spark}</code><br/><sub>${commits >= 100 ? '100+' : commits} commit${commits === 1 ? '' : 's'}</sub>`;
}

function badge(lang) {
  const [color, slug = lang.toLowerCase()] = BADGE[lang];
  const [r, g, b] = [0, 2, 4].map(i => parseInt(color.slice(i, i + 2), 16));
  const logoColor = 0.299 * r + 0.587 * g + 0.114 * b > 160 ? 'black' : 'white';
  const label = encodeURIComponent(lang.replace(/-/g, '--').replace(/_/g, '__'));
  const src = `https://img.shields.io/badge/${label}-${color}?style=flat-square&logo=${encodeURIComponent(slug)}&logoColor=${logoColor}`;
  return `<img src="${src}" alt="${escapeHtml(lang)}" title="${escapeHtml(lang)}" height="20"/>`;
}

function formatRank({ rank, total }) {
  if (!total) return '—';
  if (!rank) return `<sub>${total} active</sub>`;
  if (total === 1) return '🏆 <b>Solo</b>';
  return `${['', '🥇', '🥈', '🥉'][rank] || '🏅'} <b>#${rank}</b><br/><sub>of ${total}</sub>`;
}

const DATA_FORMATS = new Set(['JSON', 'YAML', 'XML', 'TOML', 'MDX']);
// Drop data formats unless they're all a project touched.
function codeLanguages(languages) {
  const names = languages.map(([lang]) => lang);
  const code = names.filter(lang => !DATA_FORMATS.has(lang));
  return code.length ? code : names;
}

function renderCard(rows) {
  const title = `<h3>⚡ Active Projects — Past ${WINDOW_DAYS} Days</h3>`;
  if (rows.length === 0) return `${title}\n<p><i>All quiet — no commits in the past ${WINDOW_DAYS} days.</i></p>`;
  const body = rows.map(({ repo, languages, rank, activity, commits }, i) => `
    <tr>
      <td align="center"><code>${String(i + 1).padStart(2, '0')}</code></td>
      <td>${formatProject(repo)}</td>
      <td>${codeLanguages(languages).slice(0, BADGES_PER_ROW).map(lang => badge(lang)).join(' ')}</td>
      <td align="center">${formatActivity(activity, commits)}</td>
      <td align="center">${formatRank(rank)}</td>
    </tr>`).join('');
  return `${title}
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Project</th>
      <th>Stack</th>
      <th>Activity <sub>(7d)</sub></th>
      <th>Rank</th>
    </tr>
  </thead>
  <tbody>${body}
  </tbody>
</table>`;
}

// Union of every project's stack, weighted by each language's share within its project.
function combinedStack(rows) {
  const score = new Map();
  for (const { languages } of rows) {
    for (const [lang, share] of languages) score.set(lang, (score.get(lang) ?? 0) + share);
  }
  return [...score].sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
}

function renderStack(stack) {
  const langs = stack.filter(lang => SKILL_ICON[lang]);
  if (langs.length === 0) return '';
  const ids = langs.map(lang => SKILL_ICON[lang]);
  const perline = Math.min(ids.length, 10);
  return `<img src="https://skillicons.dev/icons?i=${ids.join(',')}&theme=dark&perline=${perline}" alt="Stack: ${escapeHtml(langs.join(', '))}"/>`;
}

const replaceBlock = (text, tag, content) => {
  const re = new RegExp(`<!-- ${tag}_START -->[\\s\\S]*?<!-- ${tag}_END -->`);
  if (!re.test(text)) throw new Error(`README is missing the ${tag}_START/${tag}_END markers`);
  return text.replace(re, () => `<!-- ${tag}_START -->\n${content}\n<!-- ${tag}_END -->`);
};

// ── main ────────────────────────────────────────────────────────────────────

const repos = await fetchRepositories();
console.log(`🔎 ${repos.length} repo(s) pushed in the past ${WINDOW_DAYS} days`);

const rows = [];
// Repos arrive newest-push first; process in small parallel chunks until we have enough.
for (let i = 0; i < repos.length && rows.length < MAX_PROJECTS; i += 4) {
  const chunk = await Promise.all(repos.slice(i, i + 4).map(buildRow));
  rows.push(...chunk.filter(Boolean));
}
rows.splice(MAX_PROJECTS);
rows.sort((a, b) => new Date(b.lastCommit) - new Date(a.lastCommit));

const stack = combinedStack(rows);
const now = new Date().toISOString();

const terminal = renderTerminal({
  user: username,
  projects: rows.map(({ repo }) => ({ codename: repo.private ? codename(repo) : repo.name })),
  stack: stack.filter(lang => !DATA_FORMATS.has(lang)),
  commits: rows.reduce((n, r) => n + r.commits, 0),
  date: now.slice(0, 10),
  kagome: JSON.parse(fs.readFileSync('assets/kagome.json', 'utf8')),
});
fs.writeFileSync('assets/terminal.svg', terminal);

const calendar = await fetchCalendar();
const arcade = calendar && renderArcade({ weeks: calendar, user: username });
if (arcade) fs.writeFileSync('assets/arcade.svg', arcade);
else console.warn('⚠️  No contribution calendar (token missing?); keeping the previous arcade.svg');

const stamp = now.replace('T', ' ').slice(0, 16) + ' UTC';
let readme = fs.readFileSync(README, 'utf8');
readme = replaceBlock(readme, 'STACK', renderStack(stack));
readme = replaceBlock(readme, 'PROJECT_CARD', renderCard(rows));
readme = replaceBlock(readme, 'LAST_UPDATED',
  `<img src="https://img.shields.io/badge/last_sync-${encodeURIComponent(stamp.replace(/-/g, '--'))}-0d1117?style=flat-square&labelColor=8CFF98&color=0d1117" alt="Last sync: ${stamp}"/>`);
fs.writeFileSync(README, readme);
console.log(`✅ README updated with ${rows.length} project(s) via ${token ? 'authenticated' : 'public'} API`);
