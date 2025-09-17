import fs from "fs";

const username = process.env.USERNAME;
const token = process.env.GITHUB_TOKEN;

if (!username) {
  console.error('Missing required environment variable: USERNAME');
  process.exit(1);
}

let repo = null;
let apiError = null;

// Try authenticated API first (if token is available)
if (token) {
  console.log('🔐 Attempting authenticated API call...');
  try {
    const headers = { Authorization: `token ${token}` };
    const api = `https://api.github.com/user/repos?sort=updated&direction=desc&per_page=1&affiliation=owner,collaborator`;
    
    const res = await fetch(api, { headers });
    const data = await res.json();
    
    if (res.ok && Array.isArray(data)) {
      repo = data[0];
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
if (!repo) {
  console.log('🌐 Falling back to public API...');
  try {
    const api = `https://api.github.com/users/${username}/repos?sort=updated&direction=desc&per_page=1&type=owner`;
    const res = await fetch(api);
    const data = await res.json();
    
    if (res.ok && Array.isArray(data)) {
      repo = data[0];
      console.log('✅ Public API call successful');
    } else {
      console.error(`Public API error: ${res.status} ${res.statusText}`);
      console.error(data);
    }
  } catch (error) {
    console.error('Public API error:', error.message);
  }
}

let cardHtml = "";
let language = "Unknown";
let status = "Unknown";

if (!repo) {
  cardHtml = `<div>❌ Could not fetch repo</div>`;
} else {
  language = repo.language ?? "Unknown";

  // Dynamic status
  status = "Live";
  if (repo.archived) {
    status = "Archived";
  } else {
    const lastPush = new Date(repo.pushed_at);
    const now = new Date();
    const diffDays = (now - lastPush) / (1000 * 60 * 60 * 24);
    if (diffDays > 180) {
      status = "Maintained";
    } else {
      status = "Active";
    }
  }

  if (repo.private) {
    // Private project (stack visible)
    cardHtml = `
<div style="background:linear-gradient(120deg,#222b36 70%,#141618 100%);border-radius:16px;box-shadow:0 0 22px rgba(124,255,152,.2);padding:28px 38px;max-width:350px;display:inline-block;position:relative;">
  <div style="font-size:1.1em;margin-bottom:14px;color:#8cff98;font-family:'Fira Mono',monospace;">
    🔒 Last Project: <span style="color:#ffb86c;">Classified</span>
  </div>
  <div style="color:#b7bac7;font-family:'Fira Mono',monospace;font-size:.95em;">
    Stack: <span style="color:#7ee787;font-weight:600">${language}</span><br>
    Status: <span style="color:#ffb86c;">${status}</span>
  </div>
  <div style="margin-top:20px;">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Mono&duration=1100&pause=500&color=FF6F61&center=true&vCenter=true&width=270&lines=ENCRYPTED+FILES;TRACE+BLOCKED;RETRY+IN+42s" />
  </div>
</div>`;
  } else {
    // Public project
    cardHtml = `
<div style="background:linear-gradient(120deg,#222b36 70%,#141618 100%);border-radius:16px;box-shadow:0 0 22px rgba(124,255,152,.2);padding:28px 38px;max-width:350px;display:inline-block;position:relative;">
  <div style="font-size:1.1em;margin-bottom:14px;color:#8cff98;font-family:'Fira Mono',monospace;">
    🚀 Last Project:
    <a href="${repo.html_url}" style="color:#ffb86c;font-weight:700;text-decoration:none;">${repo.name}</a>
  </div>
  <div style="color:#b7bac7;font-family:'Fira Mono',monospace;font-size:.95em;">
    Stack: <span style="color:#7ee787;font-weight:600">${language}</span><br>
    Status: <span style="color:#8cff98;">${status}</span>
  </div>
  <div style="margin-top:20px;">
    <img src="https://readme-typing-svg.demolab.com?font=Fira+Mono&duration=1100&pause=500&color=8CFF98&center=true&vCenter=true&width=270&lines=DEPLOYED;PRODUCTION;MAINTAINED" />
  </div>
</div>`;
  }
}

// Replace in README.md
try {
  let readme = fs.readFileSync("README.md", "utf8");
  readme = readme.replace(
    /<!-- PROJECT_CARD_START -->[\s\S]*<!-- PROJECT_CARD_END -->/,
    `<!-- PROJECT_CARD_START -->\n${cardHtml}\n<!-- PROJECT_CARD_END -->`
  );
  fs.writeFileSync("README.md", readme);
} catch (error) {
  console.error('Error updating README.md:', error.message);
  process.exit(1);
}

const apiMethod = token && repo ? 'authenticated' : 'public';
console.log(`✅ Updated README with last project: ${repo?.private ? "Classified" : repo?.name || "None"} (${language}, ${status}) via ${apiMethod} API`);
