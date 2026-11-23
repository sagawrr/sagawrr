// Regenerates the profile from live GitHub data:
//   assets/terminal.svg  – Claude + Codex panes driving an iOS Simulator
//   assets/projects.svg  – active projects card
//   assets/contrib.svg   – contribution chart
//   README.md            – stack row, public repo links, sync badge
// Runs on Bun (or Node ≥ 20). Env: PROFILE_USER (required), GITHUB_TOKEN (read-only PAT; optional).
import fs from 'node:fs';
import { renderContrib, calendarStats } from './lib/contrib.mjs';
import { LANG_COLOR, renderProjects } from './lib/projects.mjs';
import { renderTerminal } from './lib/terminal.mjs';
import { esc, hash } from './lib/util.mjs';

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
const DATA_FORMATS = new Set(['JSON', 'YAML', 'XML', 'TOML', 'MDX']);

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

const ADJECTIVES = ['silent', 'neon', 'quantum', 'phantom', 'crimson', 'hollow', 'binary', 'lunar', 'rogue', 'velvet',
  'static', 'cobalt', 'feral', 'glass', 'iron', 'midnight', 'solar', 'echo', 'zero', 'arctic', 'violet', 'rapid'];
const NOUNS = ['falcon', 'cipher', 'lotus', 'kernel', 'nebula', 'orbit', 'raven', 'circuit', 'comet', 'monolith',
  'vector', 'prism', 'ember', 'harbor', 'signal', 'quartz', 'atlas', 'drift', 'spire', 'tundra', 'relay', 'golem'];

// ── GitHub API ──────────────────────────────────────────────────────────────

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

// Last year's contribution calendar (needs a token; private contributions count when the token is yours).
async function fetchCalendar() {
  if (!token) return null;
  const query = 'query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date weekday contributionCount contributionLevel}}}}}}';
  const res = await fetchJson('/graphql', { method: 'POST', body: { query, variables: { login: username } } });
  return res?.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? null;
}

function inferLanguage(filename) {
  const base = filename.toLowerCase().split('/').pop();
  if (base === 'dockerfile' || base.endsWith('.dockerfile')) return 'Dockerfile';
  if (base === 'makefile' || base === 'gnumakefile') return 'Makefile';
  const ext = base.match(/\.([a-z0-9]+)$/)?.[1];
  return (ext && LANGUAGE_MAP[ext]) || null;
}

// [[language, share 0..1], ...] from the files I touched (repo stats as fallback), data formats
// dropped unless they're all there is.
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
      if (LANG_COLOR[lang]) counts.set(lang, (counts.get(lang) ?? 0) + bytes);
    }
  }
  const code = [...counts].filter(([lang]) => !DATA_FORMATS.has(lang));
  const entries = code.length ? code : [...counts];
  const total = entries.reduce((a, [, n]) => a + n, 0) || 1;
  return entries.map(([lang, n]) => [lang, n / total]).sort((a, b) => b[1] - a[1]);
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

// Stable, non-reversible codename for a private repo.
function codename(repo) {
  const h = hash(`codename:${repo.id}`);
  return `${ADJECTIVES[h % ADJECTIVES.length]}-${NOUNS[(h >>> 8) % NOUNS.length]}`;
}

async function buildRow(repo) {
  const authored = await fetchJson(
    `/repos/${repo.full_name}/commits?author=${encodeURIComponent(username)}&since=${since}&per_page=100`,
  );
  if (!Array.isArray(authored) || authored.length === 0) return null;
  const [languages, rank] = await Promise.all([getAuthoredLanguages(repo, authored), getContributorRank(repo)]);
  return {
    name: repo.private ? codename(repo) : repo.name,
    private: repo.private,
    url: repo.html_url,
    description: repo.description,
    languages,
    rank,
    commits: authored.length,
    activity: dailyActivity(authored),
    lastCommit: authored[0].commit?.committer?.date ?? repo.pushed_at,
  };
}

// ── README blocks ───────────────────────────────────────────────────────────

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
  return `<img src="https://skillicons.dev/icons?i=${ids.join(',')}&theme=dark&perline=${Math.min(ids.length, 10)}" alt="Stack: ${esc(langs.join(', '))}"/>`;
}

const SAFE_GITHUB_REPO_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

// The card is an image, so public repos also get real links underneath it.
function renderProjectsBlock(rows) {
  const links = rows.filter(r => !r.private && SAFE_GITHUB_REPO_URL.test(r.url))
    .map(r => `<a href="${esc(r.url)}">${esc(r.name)}</a>`);
  const img = `<img src="assets/projects.svg" width="100%" alt="Active projects in the past ${WINDOW_DAYS} days"/>`;
  return links.length ? `${img}\n<br/><sub>Public: ${links.join(' · ')}</sub>` : img;
}

const replaceBlock = (text, tag, content) => {
  const re = new RegExp(`<!-- ${tag}_START -->[\\s\\S]*?<!-- ${tag}_END -->`);
  if (!re.test(text)) throw new Error(`README is missing the ${tag}_START/${tag}_END markers`);
  return text.replace(re, () => `<!-- ${tag}_START -->\n${content}\n<!-- ${tag}_END -->`);
};

// ── main ────────────────────────────────────────────────────────────────────

const [repos, calendar] = await Promise.all([fetchRepositories(), fetchCalendar()]);
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
const now = new Date();
const stats = calendar ? calendarStats(calendar) : null;
const week = stats ? stats.days.slice(-7).map(d => d.contributionCount) : rows.reduce(
  (acc, r) => acc.map((n, i) => n + r.activity[i]), Array(WINDOW_DAYS).fill(0));

fs.writeFileSync('assets/terminal.svg', renderTerminal({
  user: username,
  project: rows[0]?.name,
  commits: rows.reduce((n, r) => n + r.commits, 0),
  activeProjects: rows.length,
  streak: stats?.current ?? 0,
  week,
  date: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }),
  kagome: JSON.parse(fs.readFileSync('assets/kagome.json', 'utf8')),
}));
fs.writeFileSync('assets/projects.svg', renderProjects({ rows, windowDays: WINDOW_DAYS }));
const contrib = calendar && renderContrib({ weeks: calendar, user: username });
if (contrib) fs.writeFileSync('assets/contrib.svg', contrib);
else console.warn('⚠️  No contribution calendar (token missing?); keeping the previous contrib.svg');

const stamp = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
let readme = fs.readFileSync(README, 'utf8');
readme = replaceBlock(readme, 'STACK', renderStack(stack));
readme = replaceBlock(readme, 'PROJECT_CARD', renderProjectsBlock(rows));
readme = replaceBlock(readme, 'LAST_UPDATED',
  `<img src="https://img.shields.io/badge/last_sync-${encodeURIComponent(stamp.replace(/-/g, '--'))}-0d1117?style=flat-square&labelColor=8CFF98&color=0d1117" alt="Last sync: ${stamp}"/>`);
fs.writeFileSync(README, readme);
console.log(`✅ Updated README + SVGs with ${rows.length} project(s) via ${token ? 'authenticated' : 'public'} API`);
