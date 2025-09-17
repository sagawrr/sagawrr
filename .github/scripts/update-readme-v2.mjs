import fs from 'fs';
const username = process.env.USERNAME;
const token = process.env.GITHUB_TOKEN;
const WINDOW_DAYS = 7;
const windowStart = new Date();
windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);
const windowIso = windowStart.toISOString();
if (!username) {
  console.error('Missing required environment variable: USERNAME');
  process.exit(1);
}
// Constants for styles and HTML templates
const TABLE_STYLE = 'border-collapse:separate;border:2px solid #8CFF98;background:linear-gradient(135deg,#0d0f11 60%,#1c1f25 100%);font-family:\'Fira Mono\',monospace;box-shadow:0 0 18px rgba(140,255,152,.2);border-radius:8px;overflow:hidden;max-width:100%;overflow-x:auto;border-spacing:1px;';
const HEADER_STYLE = 'background:linear-gradient(90deg,#8CFF98 0%,#7ee787 100%);padding:8px 12px;text-align:center;font-weight:bold;color:#0d0f11;text-shadow:0 1px 2px rgba(0,0,0,0.3);';
const SUBHEADER_STYLE = 'background:rgba(28,31,37,0.8);';
const CELL_STYLE = 'padding:6px 12px;border:1px solid #8CFF98;text-align:center;';
const BOLD_GREEN = 'color:#8CFF98;font-weight:bold;';
const BOLD_ORANGE = 'color:#ffcc80;font-weight:bold;'; // Updated for better contrast
const CENTER = 'text-align:center;';
const EVEN_ROW_BG = 'rgba(13,15,17,0.6)';
const ODD_ROW_BG = 'rgba(28,31,37,0.8)';
const NO_PROJECTS_MESSAGE = 'No projects updated in the last ${WINDOW_DAYS} days';
// Updated LANGUAGE_MAP with new languages
const LANGUAGE_MAP = {
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript',
  py: 'Python',
  java: 'Java',
  go: 'Go',
  c: 'C', h: 'C',
  cc: 'C++', cpp: 'C++', cxx: 'C++', hpp: 'C++', hh: 'C++',
  cs: 'C#',
  rs: 'Rust',
  rb: 'Ruby',
  php: 'PHP',
  kt: 'Kotlin', kts: 'Kotlin',
  swift: 'Swift',
  scala: 'Scala',
  dart: 'Dart',
  ex: 'Elixir', exs: 'Elixir',
  hs: 'Haskell',
  sh: 'Bash', bash: 'Bash',
  ps1: 'PowerShell',
  html: 'HTML',
  css: 'CSS', scss: 'SCSS', less: 'Less',
  r: 'R',
  lua: 'Lua',
  pl: 'Perl',
  tex: 'TeX',
  mk: 'Makefile',
  vue: 'Vue', svelte: 'Svelte', astro: 'Astro',
  graphql: 'GraphQL',
  sql: 'SQL',
  gradle: 'Gradle',
  cmake: 'CMake',
  as: 'AssemblyScript',
  coffee: 'CoffeeScript',
  clj: 'Clojure',
  cr: 'Crystal',
  ejs: 'EJS',
  erl: 'Erlang',
  fs: 'F#',
  f: 'Fortran',
  gleam: 'Gleam',
  haxe: 'Haxe',
  htmx: 'HTMX',
  json: 'JSON',
  mdx: 'MDX',
  nim: 'Nim',
  nix: 'Nix',
  ml: 'OCaml',
  odin: 'Odin',
  m: 'Objective-C',
  sass: 'Sass',
  scratch: 'Scratch',
  sol: 'Solidity',
  v: 'V',
  wasm: 'WebAssembly',
  xml: 'XML',
  yaml: 'YAML',
  zig: 'Zig',
};
// Helper: Fetch JSON with retries and 202 handling
async function fetchJson(url, options = {}, retries = 3, delayMs = 1000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 202) {
      await new Promise(r => setTimeout(r, delayMs));
      continue;
    }
    if (res.ok) {
      try {
        return await res.json();
      } catch {
        return null;
      }
    }
    if (attempt < retries - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}
// Fetch repositories
async function fetchRepositories() {
  const headers = token ? { Authorization: `token ${token}` } : {};
  const options = { headers };
  if (token) {
    console.log('🔐 Attempting authenticated API call...');
    const allRepos = [];
    for (let page = 1; page <= 10; page++) {
      const url = `https://api.github.com/user/repos?visibility=all&sort=updated&direction=desc&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`;
      const batch = await fetchJson(url, options);
      if (!Array.isArray(batch) || batch.length === 0) break;
      allRepos.push(...batch);
      const lastPushed = new Date(batch[batch.length - 1].pushed_at);
      if (lastPushed < windowStart) break;
    }
    if (allRepos.length > 0) {
      console.log('✅ Authenticated API call successful');
      return allRepos;
    }
  }
  console.log('🌐 Falling back to public API...');
  const url = `https://api.github.com/users/${username}/repos?sort=updated&direction=desc&per_page=100&type=owner`;
  const data = await fetchJson(url, options);
  if (Array.isArray(data)) {
    console.log('✅ Public API call successful');
    return data;
  }
  return null;
}
// Check for recent authored commits
async function hasRecentAuthoredCommits(repo, options) {
  const url = `https://api.github.com/repos/${repo.owner.login}/${repo.name}/commits?author=${encodeURIComponent(username)}&since=${encodeURIComponent(windowIso)}&per_page=1`;
  const commits = await fetchJson(url, options);
  return Array.isArray(commits) && commits.length > 0;
}
// Filter recent projects
async function filterRecentProjects(repos, options) {
  const recent = [];
  for (const repo of repos) {
    if (await hasRecentAuthoredCommits(repo, options)) {
      recent.push(repo);
      if (recent.length >= 10) break;
    }
  }
  return recent;
}
// Infer language
function inferLanguage(filename) {
  if (!filename) return null;
  const lower = filename.toLowerCase();
  if (lower.endsWith('dockerfile')) return 'Dockerfile';
  if (lower.endsWith('makefile')) return 'Makefile';
  const extMatch = lower.match(/\.([a-z0-9+]+)$/);
  const ext = extMatch ? extMatch[1] : null;
  return ext ? LANGUAGE_MAP[ext] : null;
}
// Get authored languages
async function getAuthoredLanguages(owner, repo, options) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?author=${encodeURIComponent(username)}&since=${encodeURIComponent(windowIso)}&per_page=100`;
  const commits = await fetchJson(url, options);
  if (!Array.isArray(commits) || commits.length === 0) return [];
  const counts = new Map();
  const targets = commits.slice(0, 20);
  for (const commit of targets) {
    const data = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/commits/${commit.sha}`, options);
    const files = Array.isArray(data?.files) ? data.files : [];
    for (const file of files) {
      const lang = inferLanguage(file.filename);
      if (lang) counts.set(lang, (counts.get(lang) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name);
}
// Get repo languages (fallback)
async function getRepoLanguages(owner, repo, options) {
  const data = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/languages`, options);
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data).sort((a, b) => b[1] - a[1]).map(([name]) => name);
}
// Build stack badges HTML
function buildStackBadgesHtml(languages) {
  const seen = new Set();
  const badges = languages.reduce((acc, lang) => {
    if (lang && !seen.has(lang)) {
      seen.add(lang);
      acc.push(lang);
    }
    return acc;
  }, []);
  if (badges.length === 0) {
    return '';
  }
  return `<div style="display:flex;flex-wrap:wrap;justify-content:center;">${badges.map(lang =>
    `<a href="#" style="display:block;margin:2px 4px;"><img src="https://img.shields.io/badge/${encodeURIComponent(lang)}-${getColor(lang)}?logo=${encodeURIComponent(lang.toLowerCase())}&logoColor=fff" alt="${encodeURIComponent(lang)} badge" title="${encodeURIComponent(lang)}" style="height:20px;vertical-align:middle;"/></a>`
  ).join('')}</div>`;
}
// Get color for language badge
function getColor(lang) {
  const colors = {
    'AssemblyScript': '007AAC',
    'Bash': '4EAA25',
    'C': '00599C',
    'C++': '00599C',
    'C#': '239120',
    'CoffeeScript': '2F2625',
    'Clojure': '5881D8',
    'Crystal': '000',
    'CSS': '639',
    'Dart': '0175C2',
    'Elixir': '4B275F',
    'Elm': '1293D8',
    'EJS': 'B4CA65',
    'Erlang': 'A90533',
    'F#': '378BBA',
    'Flutter': '02569B',
    'Fortran': '734F96',
    'Gleam': 'FFAFF3',
    'Go': '00ADD8',
    'Haskell': '5e5086',
    'Haxe': 'EA8220',
    'HTML': 'E34F26',
    'HTMX': '36C',
    'Java': 'ED8B00',
    'JavaScript': 'F7DF1E',
    'JSON': '000',
    'Kotlin': '7F52FF',
    'Lua': '2C2D72',
    'Markdown': '000000',
    'MDX': '1B1F24',
    'Nim': 'FFE953',
    'Nix': '5277C3',
    'OCaml': 'EC6813',
    'Odin': '1E5184',
    'Objective-C': '3A95E3',
    'Perl': '39457E',
    'PHP': '777BB4',
    'Python': '3776AB',
    'R': '276DC3',
    'Ruby': 'CC342D',
    'Rust': '000000',
    'Sass': 'C69',
    'Scratch': '4D97FF',
    'Scala': 'DC322F',
    'Solidity': '363636',
    'Swift': 'F54A2A',
    'TypeScript': '3178C6',
    'V': '5D87BF',
    'WebAssembly': '654FF0',
    'XML': '767C52',
    'YAML': 'CB171E',
    'Zig': 'F7A41D',
  };
  return colors[lang] || '8CFF98';
}
// Get changes HTML
async function getChanges(owner, repo, options) {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/commits?author=${encodeURIComponent(username)}&since=${encodeURIComponent(windowIso)}&per_page=100`;
  let commitCount = 0;
  let page = 1;
  let firstPageCommits = [];
  while (true) {
    const url = `${baseUrl}&page=${page}`;
    const batch = await fetchJson(url, options);
    if (!Array.isArray(batch) || batch.length === 0) break;
    commitCount += batch.length;
    if (page === 1) firstPageCommits = batch;
    if (batch.length < 100) break;
    page++;
  }
  let additions = 0;
  let deletions = 0;
  const targets = firstPageCommits.slice(0, 10);
  for (const commit of targets) {
    const data = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/commits/${commit.sha}`, options);
    const stats = data?.stats;
    if (stats) {
      additions += stats.additions || 0;
      deletions += stats.deletions || 0;
    }
  }
  if (commitCount === 0 && additions === 0 && deletions === 0) return '—';
  return `<span style="color:#7ee787;">+${additions.toLocaleString()}</span> <span style="color:#ff6b6b;">−${deletions.toLocaleString()}</span> <span style="color:#61dafb;">• ${commitCount} commits</span>`;
}
// Get contributor rank
async function getContributorRank(owner, repo, options) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?since=${encodeURIComponent(windowIso)}&per_page=100`;
  const commits = await fetchJson(url, options);
  if (!Array.isArray(commits) || commits.length === 0) return { rank: null, total: 0 };
  const counts = new Map();
  for (const commit of commits) {
    const login = commit?.author?.login || commit?.commit?.author?.name;
    if (!login || String(login).toLowerCase().includes('[bot]')) continue;
    const normalized = String(login).toLowerCase();
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const total = sorted.length;
  const selfIdx = sorted.findIndex(([login]) => login === username.toLowerCase());
  return { rank: selfIdx === -1 ? null : selfIdx + 1, total };
}
// Escape HTML
function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Generate table row
async function generateTableRow(index, repo, options) {
  let languages = await getAuthoredLanguages(repo.owner.login, repo.name, options);
  if (languages.length === 0) {
    languages = await getRepoLanguages(repo.owner.login, repo.name, options);
  }
  const stackBadgesHtml = buildStackBadgesHtml(languages);
  const changesHtml = await getChanges(repo.owner.login, repo.name, options);
  const { rank, total } = await getContributorRank(repo.owner.login, repo.name, options);
  let rankHtml = '—';
  const medalIcons = [null, '🥇', '🥈', '🥉'];
  const medal = medalIcons[rank] || '🏅';
  if (rank && total) {
    if (total === 1) {
      rankHtml = '<span style="font-weight:800;color:#ffcc80;">🏆 Solo</span>'; // Updated for better contrast
    } else {
      rankHtml = `<span style="margin-right:6px;">${medal}</span><span style="font-weight:800;color:#ffcc80;">${rank}/${total}</span>`; // Updated for better contrast
    }
  } else if (total) {
    rankHtml = `<span style="opacity:.85;color:#8CFF98;">${total} active</span>`;
  }
  const projectName = repo.private
    ? '🔒 Classified'
    : `<a href="${repo.html_url}" style="color:#ffcc80;text-decoration:none;transition:color 0.3s ease;" onmouseover="this.style.color='#ffcc80'" onmouseout="this.style.color='#ffcc80'" title="${escapeHtml(repo.description) || 'No description available'}">${repo.name}</a>`; // Simplified hover effect for Markdown
  const rowBg = index % 2 === 0 ? EVEN_ROW_BG : ODD_ROW_BG;
  return `
  <tr style="background:${rowBg};">
    <td style="${CELL_STYLE}${BOLD_ORANGE}">${index + 1}</td>
    <td style="${CELL_STYLE}">${projectName}</td>
    <td style="${CELL_STYLE}${CENTER}">${stackBadgesHtml}</td>
    <td style="${CELL_STYLE}${BOLD_GREEN}">${changesHtml}</td>
    <td style="${CELL_STYLE}${CENTER}">${rankHtml}</td>
  </tr>`;
}
// Generate card HTML
async function generateCardHtml(recentProjects, options) {
  if (recentProjects.length === 0) {
    return `
<table align="center" style="${TABLE_STYLE}">
  <tr>
    <td colspan="5" style="${HEADER_STYLE}">
      🚀 RECENT PROJECTS (Last ${WINDOW_DAYS} Days)
    </td>
  </tr>
  <tr>
    <td colspan="5" style="${CELL_STYLE}${CENTER}color:#ffcc80;font-style:italic;">
      ${NO_PROJECTS_MESSAGE.replace('${WINDOW_DAYS}', WINDOW_DAYS)}
    </td>
  </tr>
</table>`;
  }
  const tableRows = await Promise.all(recentProjects.map((repo, i) => generateTableRow(i, repo, options)));
  return `
<table align="center" style="${TABLE_STYLE}">
  <tr>
    <td colspan="5" style="${HEADER_STYLE}">
      🚀 RECENT PROJECTS (Last ${WINDOW_DAYS} Days)
    </td>
  </tr>
  <tr style="${SUBHEADER_STYLE}">
    <td style="${CELL_STYLE}${BOLD_GREEN}">SN</td>
    <td style="${CELL_STYLE}${BOLD_GREEN}">Project</td>
    <td style="${CELL_STYLE}${BOLD_GREEN}${CENTER}">Authored Stack</td>
    <td style="${CELL_STYLE}${BOLD_GREEN}">Changes</td>
    <td style="${CELL_STYLE}${BOLD_GREEN}${CENTER}">Contributor Rank</td>
  </tr>
  ${tableRows.join('')}
</table>`;
}
// Main
(async () => {
  const repos = await fetchRepositories();
  if (!repos) {
    console.error('❌ Could not fetch repositories');
    process.exit(1);
  }
  const options = token ? { headers: { Authorization: `token ${token}` } } : {};
  const recentProjects = await filterRecentProjects(repos, options);
  const cardHtml = await generateCardHtml(recentProjects, options);
  try {
    let readme = fs.readFileSync('README.md', 'utf8');
    readme = readme.replace(
      /<!-- PROJECT_CARD_START -->[\s\S]*<!-- PROJECT_CARD_END -->/,
      `<!-- PROJECT_CARD_START -->\n${cardHtml}\n<!-- PROJECT_CARD_END -->`
    );
    const nowUtc = new Date().toUTCString();
    readme = readme.replace(
      /<!-- LAST_UPDATED -->[\s\S]*?<!-- \/LAST_UPDATED -->/,
      `<!-- LAST_UPDATED -->${nowUtc}<!-- /LAST_UPDATED -->`
    );
    readme = readme.replace(/<!-- COMMITS_FOOTER_START -->[\s\S]*<!-- COMMITS_FOOTER_END -->/, '');
    fs.writeFileSync('README.md', readme);
    const apiMethod = token ? 'authenticated' : 'public';
    const projectCount = recentProjects.length;
    console.log(`✅ Updated README with ${projectCount} recent project${projectCount !== 1 ? 's' : ''} (last ${WINDOW_DAYS} days) via ${apiMethod} API`);
  } catch (error) {
    console.error('Error updating README.md:', error.message);
    process.exit(1);
  }
})();
