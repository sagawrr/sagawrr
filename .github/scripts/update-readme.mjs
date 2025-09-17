import fs from "fs";

const username = process.env.USERNAME;
const token = process.env.GITHUB_TOKEN;
// Window size in days for "recent" activity
const WINDOW_DAYS = 7;
const windowStart = new Date();
windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

if (!username) {
  console.error('Missing required environment variable: USERNAME');
  process.exit(1);
}

let repos = null;
let apiError = null;

// Try authenticated API first (if token is available)
if (token) {
  console.log('🔐 Attempting authenticated API call...');
  try {
const headers = { Authorization: `token ${token}` };
    async function fetchPagedRepos() {
      const all = [];
      for (let page = 1; page <= 10; page++) {
        const url = `https://api.github.com/user/repos?visibility=all&sort=updated&direction=desc&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`;
        const res = await fetch(url, { headers });
        if (!res.ok) {
          const errTxt = await res.text().catch(() => '');
          throw new Error(`${res.status} ${res.statusText} ${errTxt}`.trim());
        }
        const batch = await res.json();
        if (!Array.isArray(batch) || batch.length === 0) break;
        all.push(...batch);
        // Stop early if the last repo on this page is older than our window
        const last = batch[batch.length - 1];
        const lastPushed = new Date(last.pushed_at);
        if (lastPushed < windowStart) break;
      }
      return all;
    }
    const data = await fetchPagedRepos();
    if (Array.isArray(data)) {
      repos = data;
      console.log('✅ Authenticated API call successful');
    }
  } catch (error) {
    apiError = error.message;
    console.log(`⚠️  Authenticated API error: ${apiError}`);
  }
}

// Fallback to public API if authenticated call failed or no token
if (!repos) {
  console.log('🌐 Falling back to public API...');
  try {
    const api = `https://api.github.com/users/${username}/repos?sort=updated&direction=desc&per_page=100&type=owner`;
    const res = await fetch(api);
const data = await res.json();

    if (res.ok && Array.isArray(data)) {
      repos = data;
      console.log('✅ Public API call successful');
    } else {
      console.error(`Public API error: ${res.status} ${res.statusText}`);
  console.error(data);
    }
  } catch (error) {
    console.error('Public API error:', error.message);
  }
}

// Helper functions

// Get changes display (placeholder until real stats wired)
function getChangesDisplay(repo) { return '—'; }

function getTechStackIcons(language) {
  const iconMap = {
    'JavaScript': 'js',
    'TypeScript': 'ts',
    'Python': 'python',
    'Java': 'java',
    'React': 'react',
    'Node.js': 'nodejs',
    'Vue': 'vue',
    'Angular': 'angular',
    'Next.js': 'nextjs',
    'Express': 'express',
    'FastAPI': 'fastapi',
    'Django': 'django',
    'Flask': 'flask',
    'MongoDB': 'mongodb',
    'PostgreSQL': 'postgresql',
    'MySQL': 'mysql',
    'Redis': 'redis',
    'Docker': 'docker',
    'Kubernetes': 'kubernetes',
    'AWS': 'aws',
    'Azure': 'azure',
    'GCP': 'gcp',
    'Git': 'git',
    'GitHub': 'github',
    'GitLab': 'gitlab',
    'Linux': 'linux',
    'Ubuntu': 'ubuntu',
    'Windows': 'windows',
    'macOS': 'macos',
    'HTML': 'html',
    'CSS': 'css',
    'SASS': 'sass',
    'SCSS': 'scss',
    'Less': 'less',
    'Bootstrap': 'bootstrap',
    'Tailwind': 'tailwind',
    'Material-UI': 'mui',
    'Chakra UI': 'chakraui',
    'Ant Design': 'antdesign',
    'Figma': 'figma',
    'Sketch': 'sketch',
    'Adobe XD': 'adobexd',
    'Photoshop': 'photoshop',
    'Illustrator': 'illustrator',
    'InDesign': 'indesign',
    'Premiere Pro': 'premierepro',
    'After Effects': 'aftereffects',
    'Blender': 'blender',
    'Cinema 4D': 'cinema4d',
    'Maya': 'maya',
    '3ds Max': '3dsmax',
    'Unity': 'unity',
    'Unreal Engine': 'unrealengine',
    'Godot': 'godot',
    'GameMaker Studio': 'gamemakerstudio',
    'Construct 3': 'construct3',
    'Twine': 'twine',
    'RPG Maker': 'rpgmaker',
    'Scratch': 'scratch',
    'Blockly': 'blockly',
    'App Inventor': 'appinventor',
    'Thunkable': 'thunkable',
    'Glide': 'glide',
    'Bubble': 'bubble',
    'Webflow': 'webflow',
    'Framer': 'framer',
    'Principle': 'principle',
    'Origami Studio': 'origamistudio',
    'Flinto': 'flinto',
    'Marvel': 'marvel',
    'InVision': 'invision',
    'Zeplin': 'zeplin',
    'Abstract': 'abstract',
    'Avocode': 'avocode',
    'Sympli': 'sympli',
    'Handoff': 'handoff'
  };
  
  // Better fallbacks for empty/unknown stacks
  if (!language || language === 'Unknown' || language === '') {
    return `https://skillicons.dev/icons?i=github,git,markdown&theme=dark`;
  }
  
  const primaryIcon = iconMap[language] || 'code';
  return `https://skillicons.dev/icons?i=${primaryIcon}`;
}

// Fetch all languages per repo sorted by bytes (desc)
async function fetchTopLanguages(owner, repo) {
  const headers = token ? { Authorization: `token ${token}` } : undefined;
  const opts = headers ? { headers } : undefined;
  const data = await fetchJsonWithRetry(`https://api.github.com/repos/${owner}/${repo}/languages`, opts);
  if (!data || typeof data !== 'object') return [];
  const entries = Object.entries(data);
  entries.sort((a, b) => b[1] - a[1]);
  return entries.map(([name]) => name);
}

// Map a list of language names to skillicons ids
function mapLanguagesToIconIds(languages) {
  if (!Array.isArray(languages) || languages.length === 0) return ['github','git','markdown'];
  const map = {
    'JavaScript': 'js', 'TypeScript': 'ts', 'Python': 'python', 'Java': 'java', 'Go': 'go',
    'C': 'c', 'C++': 'cpp', 'C#': 'cs', 'Rust': 'rust', 'Ruby': 'ruby', 'PHP': 'php',
    'Kotlin': 'kotlin', 'Swift': 'swift', 'Scala': 'scala', 'Dart': 'dart', 'Elixir': 'elixir',
    'Haskell': 'haskell', 'Shell': 'bash', 'PowerShell': 'powershell', 'HTML': 'html', 'CSS': 'css',
    'SCSS': 'scss', 'SASS': 'sass', 'Less': 'less', 'Objective-C': 'objectivec', 'R': 'r',
    'Lua': 'lua', 'Perl': 'perl', 'TeX': 'latex', 'Jupyter Notebook': 'jupyter', 'Makefile': 'cmake',
    'Vue': 'vue', 'Angular': 'angular', 'Svelte': 'svelte', 'React': 'react', 'Next.js': 'nextjs',
    'Astro': 'astro', 'Solid': 'solidjs', 'Node.js': 'nodejs', 'Express': 'express',
    'Dockerfile': 'docker', 'Docker': 'docker', 'Kotlin (Android)': 'kotlin', 'Gradle': 'gradle',
    'YAML': 'yaml', 'JSON': 'json', 'GraphQL': 'graphql', 'SQL': 'postgresql',
    'PostgreSQL': 'postgresql', 'MySQL': 'mysql', 'SQLite': 'sqlite', 'MongoDB': 'mongodb',
    'Redis': 'redis', 'Bash': 'bash', 'Powershell': 'powershell', 'Objective-C++': 'objectivec'
  };
  // Deduplicate and keep order; exclude unmapped languages entirely
  const ids = [];
  for (const name of languages) {
    const id = map[name];
    if (!id) continue;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

// Filter projects strictly by USERNAME-authored commits within the window
let recentProjects = [];
if (repos && Array.isArray(repos)) {
  const windowStartLocal = new Date();
  windowStartLocal.setDate(windowStartLocal.getDate() - WINDOW_DAYS);
  const headers = token ? { Authorization: `token ${token}` } : undefined;
  const opts = headers ? { headers } : undefined;
  const windowIso = windowStartLocal.toISOString();
  const authored = [];
  for (const r of repos) {
    const url = `https://api.github.com/repos/${r.owner.login}/${r.name}/commits?author=${encodeURIComponent(username)}&since=${encodeURIComponent(windowIso)}&per_page=1`;
    const res = await fetch(url, opts);
    if (!res.ok) continue;
    const commits = await res.json();
    if (Array.isArray(commits) && commits.length > 0) {
      authored.push(r);
    }
    if (authored.length >= 10) break; // cap to avoid excessive API use
  }
  recentProjects = authored;
}

let cardHtml = "";

// Helper: fetch JSON with optional auth and simple retries
async function fetchJsonWithRetry(url, options = {}, retries = 3, delayMs = 1000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 202) {
      // Stats endpoints may be generating; wait and retry
      await new Promise(r => setTimeout(r, delayMs));
      continue;
    }
    if (res.ok) {
      try { return await res.json(); } catch { return null; }
    }
    if (attempt < retries - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}

// Fetch contributors for a repo (users only), return up to 5
async function fetchContributors(owner, repo) {
  const headers = token ? { Authorization: `token ${token}` } : undefined;
  const opts = headers ? { headers } : undefined;
  const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10&anon=false`;
  const data = await fetchJsonWithRetry(url, opts);
  if (!Array.isArray(data)) return [];
  // Filter to real users (type User), prefer excluding bots
  return data
    .filter(c => (c?.type === 'User') && !(c?.login || '').toLowerCase().includes('[bot]'))
    .slice(0, 5);
}

function buildStackedAvatars(contributors) {
  if (!Array.isArray(contributors) || contributors.length === 0) return '';
  const maxShown = 3;
  const shown = contributors.slice(0, maxShown);
  const extra = contributors.length - shown.length;
  const items = shown.map((c, idx) => {
    const left = idx === 0 ? 0 : -8;
    return `<img src="${c.avatar_url}&s=44" alt="${c.login}" title="${c.login}" style="width:22px;height:22px;border-radius:50%;border:1px solid #8CFF98;display:inline-block;vertical-align:middle;margin-left:${left}px;background:#0d0f11;"/>`;
  }).join('');
  const extraBadge = extra > 0
    ? `<span title="+${extra} more" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;border:1px solid #8CFF98;color:#8CFF98;font-size:10px;margin-left:-8px;background:#0d0f11;">+${extra}</span>`
    : '';
  return `<div style="display:inline-flex;align-items:center;">${items}${extraBadge}</div>`;
}

// Build real changes string using USERNAME-authored commits within the window
async function buildChangesForRepo(owner, repo) {
  const headers = token ? { Authorization: `token ${token}` } : undefined;
  const opts = headers ? { headers } : undefined;
  const sinceIso = windowStart.toISOString();
  // Fetch authored commits within window (page 1)
  const listUrl = `https://api.github.com/repos/${owner}/${repo}/commits?author=${encodeURIComponent(username)}&since=${encodeURIComponent(sinceIso)}&per_page=100&page=1`;
  const first = await fetch(listUrl, opts);
  if (!first.ok) return '—';
  const page1 = await first.json();
  if (!Array.isArray(page1) || page1.length === 0) return '—';
  let commitCount = page1.length;
  // If there are more pages, approximate count via Link header
  const link = first.headers.get('link');
  if (link && /<([^>]+)>; rel="last"/.test(link)) {
    const m = link.match(/page=(\d+)>; rel="last"/);
    if (m) {
      const lastPage = parseInt(m[1], 10);
      if (lastPage > 1) {
        const lastRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?author=${encodeURIComponent(username)}&since=${encodeURIComponent(sinceIso)}&per_page=100&page=${lastPage}`, opts);
        if (lastRes.ok) {
          const lastArr = await lastRes.json();
          commitCount = (lastPage - 1) * 100 + (Array.isArray(lastArr) ? lastArr.length : 0);
        }
      }
    }
  }
  // Sum additions/deletions by fetching commit details for up to 20 commits
  let additions = 0;
  let deletions = 0;
  const detailTargets = page1.slice(0, 20);
  for (const c of detailTargets) {
    const sha = c?.sha;
    if (!sha) continue;
    const det = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, opts);
    if (!det.ok) continue;
    const data = await det.json();
    const stats = data?.stats;
    if (stats) {
      additions += stats.additions || 0;
      deletions += stats.deletions || 0;
    }
  }
  if (!additions && !deletions && !commitCount) return '—';
  return `<span style="color:#7ee787;">+${additions.toLocaleString()}</span> <span style=\"color:#ff6b6b;\">−${deletions.toLocaleString()}</span> <span style=\"color:#61dafb;\">• ${commitCount} commits</span>`;
}
// Note: last updated timestamp is shown at top of README, not in table.

if (!repos) {
  cardHtml = `<div>❌ Could not fetch repositories</div>`;
} else if (recentProjects.length === 0) {
  // No recent projects
    cardHtml = `
<table align="center" style="border-collapse:collapse;border:1px solid #8CFF98;background:linear-gradient(135deg,#0d0f11 60%,#1c1f25 100%);font-family:'Fira Mono',monospace;box-shadow:0 0 18px rgba(140,255,152,.2);border-radius:8px;overflow:hidden;">
  <tr>
    <td colspan="5" style="background:linear-gradient(90deg,#8CFF98 0%,#7ee787 100%);padding:8px 12px;text-align:center;font-weight:bold;color:#0d0f11;text-shadow:0 1px 2px rgba(0,0,0,0.3);">
      🚀 RECENT PROJECTS (Last ${WINDOW_DAYS} Days)
    </td>
  </tr>
  <tr>
    <td colspan="5" style="padding:20px;border:1px solid #8CFF98;text-align:center;color:#ffb86c;font-style:italic;">
      No projects updated in the last 5 days
    </td>
  </tr>
</table>`;
  } else {
  // Generate table rows for recent projects
  let tableRows = '';
  for (const [index, repo] of recentProjects.entries()) {
    const topLangs = await fetchTopLanguages(repo.owner.login, repo.name);
    // Build language->icon id pairs, exclude unmapped, dedupe by id
    function getIconIdForLanguage(name) {
      const map = {
        'JavaScript': 'js','TypeScript': 'ts','Python': 'python','Java': 'java','Go': 'go','C': 'c','C++': 'cpp','C#': 'cs','Rust': 'rust','Ruby': 'ruby','PHP': 'php','Kotlin': 'kotlin','Swift': 'swift','Scala': 'scala','Dart': 'dart','Elixir': 'elixir','Haskell': 'haskell','Shell': 'bash','PowerShell': 'powershell','HTML': 'html','CSS': 'css','SCSS': 'scss','SASS': 'sass','Less': 'less','Objective-C': 'objectivec','R': 'r','Lua': 'lua','Perl': 'perl','TeX': 'latex','Jupyter Notebook': 'jupyter','Makefile': 'cmake','Vue': 'vue','Angular': 'angular','Svelte': 'svelte','React': 'react','Next.js': 'nextjs','Astro': 'astro','Solid': 'solidjs','Node.js': 'nodejs','Express': 'express','Dockerfile': 'docker','Docker': 'docker','Gradle': 'gradle','YAML': 'yaml','JSON': 'json','GraphQL': 'graphql','SQL': 'postgresql','PostgreSQL': 'postgresql','MySQL': 'mysql','SQLite': 'sqlite','MongoDB': 'mongodb','Redis': 'redis','Bash': 'bash','Powershell': 'powershell','Objective-C++': 'objectivec'
      };
      return map[name] || null;
    }
    const seenIds = new Set();
    const iconPairs = [];
    for (const lang of topLangs) {
      const id = getIconIdForLanguage(lang);
      if (!id) continue;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      iconPairs.push({ name: lang, id });
    }
    const esc = (s) => (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const stackIconsHtml = (iconPairs.length)
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;max-width:220px;margin:0 auto;">${iconPairs.map(p => `<img src=\"https://skillicons.dev/icons?i=${p.id}\" alt=\"${esc(p.name)} icon\" title=\"${esc(p.name)}\" style=\"height:16px;\"/>`).join('')}</div>`
      : `<img src=\"https://skillicons.dev/icons?i=github,git,markdown&theme=dark\" alt=\"fallback icons\" style=\"height:16px;\"/>`;
    const changesHtml = await buildChangesForRepo(repo.owner.login, repo.name);
    const contributors = await fetchContributors(repo.owner.login, repo.name);
    // Make sure the current user is included at the front if present
    const sortedContribs = (() => {
      if (!Array.isArray(contributors)) return [];
      const selfIdx = contributors.findIndex(c => (c?.login || '').toLowerCase() === (username || '').toLowerCase());
      if (selfIdx > 0) {
        const copy = [...contributors];
        const [self] = copy.splice(selfIdx, 1);
        copy.unshift(self);
        return copy;
      }
      return contributors;
    })();
    const avatarsHtml = sortedContribs.length
      ? buildStackedAvatars(sortedContribs)
      : `<img src="https://github.com/${username}.png" alt="${username}" style="width:22px;height:22px;border-radius:50%;border:1px solid #8CFF98;" title="${username}${repo.private ? ' (Private Project)' : ''}" />`;
    
    const escapeAttr = (s) => (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const projectName = repo.private 
      ? '🔒 Classified'
      : `<a href="${repo.html_url}" style="color:#ffb86c;text-decoration:none;transition:color 0.3s ease;" title="${escapeAttr(repo.description) || 'No description available'}">${repo.name}</a>`;
    
    // Row background (alternating)
    const rowBg = index % 2 === 0 ? 'rgba(13,15,17,0.6)' : 'rgba(28,31,37,0.8)';
    
    tableRows += `
  <tr style="background:${rowBg};">
    <td style="padding:4px 20px;border:1px solid #8CFF98;color:#ffb86c;font-weight:bold;text-align:center;">${index + 1}</td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;">${projectName}</td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;text-align:center;">
      ${stackIconsHtml}
    </td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;color:#8CFF98;text-align:center;">${changesHtml}</td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;text-align:center;">${avatarsHtml}</td>
  </tr>`;
  }
  
  cardHtml = `
<table align="center" style="border-collapse:collapse;border:1px solid #8CFF98;background:linear-gradient(135deg,#0d0f11 60%,#1c1f25 100%);font-family:'Fira Mono',monospace;box-shadow:0 0 18px rgba(140,255,152,.2);border-radius:8px;overflow:hidden;">
  <tr>
    <td colspan="5" style="background:linear-gradient(90deg,#8CFF98 0%,#7ee787 100%);padding:8px 12px;text-align:center;font-weight:bold;color:#0d0f11;text-shadow:0 1px 2px rgba(0,0,0,0.3);">
      🚀 RECENT PROJECTS (Last ${WINDOW_DAYS} Days)
    </td>
  </tr>
  <tr style="background:rgba(28,31,37,0.8);">
    <td style="padding:4px 20px;border:1px solid #8CFF98;color:#8CFF98;font-weight:bold;text-align:center;">SN</td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;color:#8CFF98;font-weight:bold;">Project</td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;color:#8CFF98;font-weight:bold;text-align:center;">Stack</td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;color:#8CFF98;font-weight:bold;text-align:center;">Changes</td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;color:#8CFF98;font-weight:bold;text-align:center;">Author</td>
  </tr>${tableRows}
</table>`;
}

// Replace in README.md
try {
let readme = fs.readFileSync("README.md", "utf8");
  // Update dynamic table
readme = readme.replace(
  /<!-- PROJECT_CARD_START -->[\s\S]*<!-- PROJECT_CARD_END -->/,
  `<!-- PROJECT_CARD_START -->\n${cardHtml}\n<!-- PROJECT_CARD_END -->`
);
  // Update top-level last updated badge
  const nowUtc = new Date().toUTCString();
  readme = readme.replace(
    /<!-- LAST_UPDATED -->[\s\S]*?<!-- \/LAST_UPDATED -->/,
    `<!-- LAST_UPDATED -->${nowUtc}<!-- /LAST_UPDATED -->`
  );
  // Remove commits footer block entirely if present
  readme = readme.replace(/<!-- COMMITS_FOOTER_START -->[\s\S]*<!-- COMMITS_FOOTER_END -->/, '');
  fs.writeFileSync("README.md", readme);
} catch (error) {
  console.error('Error updating README.md:', error.message);
  process.exit(1);
}

const apiMethod = token && repos ? 'authenticated' : 'public';
const projectCount = recentProjects.length;
console.log(`✅ Updated README with ${projectCount} recent project${projectCount !== 1 ? 's' : ''} (last ${WINDOW_DAYS} days) via ${apiMethod} API`);
