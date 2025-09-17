import fs from 'fs';
import path from 'path';

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
const TABLE_STYLE = 'border-collapse:collapse;border:1px solid #8CFF98;background:linear-gradient(135deg,#0d0f11 60%,#1c1f25 100%);font-family:\'Fira Mono\',monospace;box-shadow:0 0 18px rgba(140,255,152,.2);border-radius:8px;overflow:hidden;';
const HEADER_STYLE = 'background:linear-gradient(90deg,#8CFF98 0%,#7ee787 100%);padding:8px 12px;text-align:center;font-weight:bold;color:#0d0f11;text-shadow:0 1px 2px rgba(0,0,0,0.3);';
const SUBHEADER_STYLE = 'background:rgba(28,31,37,0.8);';
const CELL_STYLE = 'padding:8px 20px;border:1px solid #8CFF98;'; // Increased padding
const BOLD_GREEN = 'color:#8CFF98;font-weight:bold;';
const BOLD_ORANGE = 'color:#ffb86c;font-weight:bold;';
const CENTER = 'text-align:center;';
const EVEN_ROW_BG = 'rgba(13,15,17,0.6)';
const ODD_ROW_BG = 'rgba(28,31,37,0.8)';
const NO_PROJECTS_MESSAGE = 'No projects updated in the last ${WINDOW_DAYS} days';
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
  css: 'CSS', scss: 'SCSS', sass: 'SASS', less: 'Less',
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
};
const ICON_MAP = {
  JavaScript: 'JavaScript', TypeScript: 'TypeScript', Python: 'Python', Java: 'Java', Go: 'GoLang',
  C: 'C', 'C++': 'CPP', 'C#': 'CS', Rust: 'Rust', Ruby: 'Ruby', PHP: 'PHP',
  Kotlin: 'Kotlin', Swift: 'Swift', Scala: 'Scala', Dart: 'Dart', Elixir: 'Elixir',
  Haskell: 'Haskell', Shell: 'Bash', PowerShell: 'Powershell', HTML: 'HTML',
  CSS: 'CSS', SCSS: 'SCSS', SASS: 'Sass', Less: 'Less',
  R: 'R', Lua: 'Lua', Perl: 'Perl', TeX: 'Latex',
  Makefile: 'CMake', Vue: 'VueJS', Angular: 'Angular', Svelte: 'Svelte', React: 'React',
  'Next.js': 'NextJS', Astro: 'Astro', Solid: 'SolidJS', 'Node.js': 'NodeJS',
  Express: 'ExpressJS', Dockerfile: 'Docker', Docker: 'Docker', Gradle: 'Gradle',
  GraphQL: 'GraphQL', SQL: 'PostgreSQL',
  PostgreSQL: 'PostgreSQL', MySQL: 'MySQL', SQLite: 'SQLite', MongoDB: 'MongoDB',
  Redis: 'Redis', Bash: 'Bash', Powershell: 'Powershell',
};
const SVG_WIDTH = 800;
const ICON_THEME = 'Light'; // or 'Light'
const ICONS_DIR = './icons';

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

// Get icon ID
function getIconId(language) {
  return ICON_MAP[language] || null;
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

// Load local SVG icon content
function loadIconSvg(id) {
  const capitalizedId = id.charAt(0).toUpperCase() + id.slice(1);
  
  // Try with theme first
  let filename = `${capitalizedId}-${ICON_THEME}.svg`;
  let filePath = path.join(ICONS_DIR, filename);
  if (fs.existsSync(filePath)) {
    let svg = fs.readFileSync(filePath, 'utf8');
    svg = svg.replace(/<svg([^>]*)/gi, (match, attrs) => {
      let newAttrs = attrs.replace(/width\s*=\s*["'][^"']*["']/gi, '');
      newAttrs = newAttrs.replace(/height\s*=\s*["'][^"']*["']/gi, '');
      return `<svg${newAttrs} width="20" height="20" style="margin:0 4px;"`;
    });
    return svg;
  }
  
  // Fallback to plain
  filename = `${capitalizedId}.svg`;
  filePath = path.join(ICONS_DIR, filename);
  if (fs.existsSync(filePath)) {
    let svg = fs.readFileSync(filePath, 'utf8');
    svg = svg.replace(/<svg([^>]*)/gi, (match, attrs) => {
      let newAttrs = attrs.replace(/width\s*=\s*["'][^"']*["']/gi, '');
      newAttrs = newAttrs.replace(/height\s*=\s*["'][^"']*["']/gi, '');
      return `<svg${newAttrs} width="20" height="20" style="margin:0 4px;"`;
    });
    return svg;
  }
  
  console.error(`Icon not found for ${id}`);
  return '';
}

// Build stack icons HTML with inline SVGs
function buildStackIconsHtml(languages) {
  const seenIds = new Set();
  const iconSvgs = [];
  for (const lang of languages) {
    const id = getIconId(lang);
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      const svgContent = loadIconSvg(id);
      if (svgContent) {
        iconSvgs.push(svgContent);
      }
    }
  }

  if (iconSvgs.length === 0) {
    return '';
  }

  return `<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-start;align-items:center;max-width:220px;margin:0 auto;">${iconSvgs.join('')}</div>`;
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
  const stackIconsHtml = buildStackIconsHtml(languages);

  const changesHtml = await getChanges(repo.owner.login, repo.name, options);

  const { rank, total } = await getContributorRank(repo.owner.login, repo.name, options);
  let rankHtml = '—';
  const medalIcons = [null, '🥇', '🥈', '🥉'];
  const medal = medalIcons[rank] || '🏅';
  if (rank && total) {
    if (total === 1) {
      rankHtml = '<span style="font-weight:800;color:#8CFF98;">🏆 Solo</span>';
    } else {
      rankHtml = `<span style="margin-right:6px;">${medal}</span><span style="font-weight:800;color:#ffb86c;">${rank}/${total}</span>`;
    }
  } else if (total) {
    rankHtml = `<span style="opacity:.85;color:#8CFF98;">${total} active</span>`;
  }

  const projectName = repo.private
    ? '🔒 <span style="color:#ffb86c;">Classified</span>'
    : `<a href="${repo.html_url}" style="color:#ffb86c;text-decoration:none;transition:color 0.3s ease;" title="${escapeHtml(repo.description) || 'No description available'}">${repo.name}</a>`;

  const rowBg = index % 2 === 0 ? EVEN_ROW_BG : ODD_ROW_BG;

  return `
  <tr style="background:${rowBg};">
    <td style="${CELL_STYLE}${BOLD_ORANGE}${CENTER}">${index + 1}</td>
    <td style="${CELL_STYLE}">${projectName}</td>
    <td style="${CELL_STYLE}${CENTER}">${stackIconsHtml}</td>
    <td style="${CELL_STYLE}${BOLD_GREEN}${CENTER}">${changesHtml}</td>
    <td style="${CELL_STYLE}${CENTER}">${rankHtml}</td>
  </tr>`;
}

// Generate table HTML
async function generateTableHtml(recentProjects, options) {
  if (recentProjects.length === 0) {
    return `
<table align="center" style="${TABLE_STYLE}">
  <tr>
    <td colspan="5" style="${HEADER_STYLE}">
      🚀 RECENT PROJECTS (Last ${WINDOW_DAYS} Days)
    </td>
  </tr>
  <tr>
    <td colspan="5" style="${CELL_STYLE}${CENTER}color:#ffb86c;font-style:italic;">
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
    <td style="${CELL_STYLE}${BOLD_GREEN}${CENTER}">SN</td>
    <td style="${CELL_STYLE}${BOLD_GREEN}">Project</td>
    <td style="${CELL_STYLE}${BOLD_GREEN}${CENTER}">Authored Stack</td>
    <td style="${CELL_STYLE}${BOLD_GREEN}${CENTER}">Changes</td>
    <td style="${CELL_STYLE}${BOLD_GREEN}${CENTER}">Contributor Rank</td>
  </tr>
  ${tableRows.join('')}
</table>`;
}

// Generate SVG content
function generateSvg(tableHtml, recentProjects) {
  const rowCount = recentProjects.length === 0 ? 2 : recentProjects.length + 2;
  const svgHeight = 60 + 40 * rowCount; // Reduced height to minimize gap

  return `<svg fill="none" viewBox="0 0 ${SVG_WIDTH} ${svgHeight}" width="${SVG_WIDTH}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>
        /* Additional global styles if needed */
        a:hover {
          color: #7ee787;
        }
      </style>
      ${tableHtml}
    </div>
  </foreignObject>
</svg>`;
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
  const tableHtml = await generateTableHtml(recentProjects, options);
  const svgContent = generateSvg(tableHtml, recentProjects);

  try {
    fs.writeFileSync('recent-projects.svg', svgContent);

    let readme = fs.readFileSync('README.md', 'utf8');
    const imgHtml = '<img src="recent-projects.svg" alt="Recent Projects" style="width:100%; display:block; margin:0 auto;">';
    readme = readme.replace(
      /<!-- PROJECT_CARD_START -->[\s\S]*<!-- PROJECT_CARD_END -->/,
      `<!-- PROJECT_CARD_START -->\n${imgHtml}\n<!-- PROJECT_CARD_END -->`
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
