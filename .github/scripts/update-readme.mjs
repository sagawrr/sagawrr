import fs from "fs";

const username = process.env.USERNAME;
const token = process.env.GITHUB_TOKEN;

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
    const api = `https://api.github.com/user/repos?sort=updated&direction=desc&per_page=10&affiliation=owner,collaborator`;
    
    const res = await fetch(api, { headers });
    const data = await res.json();
    
    if (res.ok && Array.isArray(data)) {
      repos = data;
      console.log('✅ Authenticated API call successful');
    } else {
      apiError = `GitHub API error: ${res.status} ${res.statusText}`;
      console.log(`⚠️  Authenticated API failed: ${apiError}`);
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
    const api = `https://api.github.com/users/${username}/repos?sort=updated&direction=desc&per_page=10&type=owner`;
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
function getChangesDisplay(repo) {
  return '—';
}

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

// Filter projects from last 5 days
let recentProjects = [];
if (repos && Array.isArray(repos)) {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  
  recentProjects = repos.filter(repo => {
    const updatedAt = new Date(repo.pushed_at);
    return updatedAt >= fiveDaysAgo;
  });
}

let cardHtml = "";
// Note: last updated timestamp is shown at top of README, not in table.

if (!repos) {
  cardHtml = `<div>❌ Could not fetch repositories</div>`;
} else if (recentProjects.length === 0) {
  // No recent projects
  cardHtml = `
<table align="center" style="border-collapse:collapse;border:1px solid #8CFF98;background:linear-gradient(135deg,#0d0f11 60%,#1c1f25 100%);font-family:'Fira Mono',monospace;box-shadow:0 0 18px rgba(140,255,152,.2);border-radius:8px;overflow:hidden;">
  <tr>
    <td colspan="5" style="background:linear-gradient(90deg,#8CFF98 0%,#7ee787 100%);padding:8px 12px;text-align:center;font-weight:bold;color:#0d0f11;text-shadow:0 1px 2px rgba(0,0,0,0.3);">
      🚀 RECENT PROJECTS (Last 5 Days)
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
  recentProjects.forEach((repo, index) => {
    const stackIcon = getTechStackIcons(repo.language);
    
    // Generate project name with tooltip
    const projectName = repo.private 
      ? '🔒 Classified'
      : `<a href="${repo.html_url}" style="color:#ffb86c;text-decoration:none;transition:color 0.3s ease;" title="${repo.description || 'No description available'}">${repo.name}</a>`;
    
    // Generate author avatar (simplified for now - just show owner)
    const authorAvatar = `<img src="https://github.com/${username}.png" alt="${username}" style="width:22px;height:22px;border-radius:50%;border:1px solid #8CFF98;" title="${username}${repo.private ? ' (Private Project)' : ''}" />`;
    
    // Row background (alternating)
    const rowBg = index % 2 === 0 ? 'rgba(13,15,17,0.6)' : 'rgba(28,31,37,0.8)';
    
    tableRows += `
  <tr style="background:${rowBg};">
    <td style="padding:4px 20px;border:1px solid #8CFF98;color:#ffb86c;font-weight:bold;text-align:center;">${index + 1}</td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;">${projectName}</td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;text-align:center;">
      <img src="${stackIcon}" alt="${repo.language || 'Unknown'}" style="width:60px;height:16px;vertical-align:middle;" />
    </td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;color:#8CFF98;text-align:center;">${getChangesDisplay(repo)}</td>
    <td style="padding:4px 20px;border:1px solid #8CFF98;text-align:center;">${authorAvatar}</td>
  </tr>`;
  });
  
  cardHtml = `
<table align="center" style="border-collapse:collapse;border:1px solid #8CFF98;background:linear-gradient(135deg,#0d0f11 60%,#1c1f25 100%);font-family:'Fira Mono',monospace;box-shadow:0 0 18px rgba(140,255,152,.2);border-radius:8px;overflow:hidden;">
  <tr>
    <td colspan="5" style="background:linear-gradient(90deg,#8CFF98 0%,#7ee787 100%);padding:8px 12px;text-align:center;font-weight:bold;color:#0d0f11;text-shadow:0 1px 2px rgba(0,0,0,0.3);">
      🚀 RECENT PROJECTS (Last 5 Days)
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
  fs.writeFileSync("README.md", readme);
} catch (error) {
  console.error('Error updating README.md:', error.message);
  process.exit(1);
}

const apiMethod = token && repos ? 'authenticated' : 'public';
const projectCount = recentProjects.length;
console.log(`✅ Updated README with ${projectCount} recent project${projectCount !== 1 ? 's' : ''} (last 5 days) via ${apiMethod} API`);
