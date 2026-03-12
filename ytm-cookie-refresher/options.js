const fields = ["githubToken", "repoOwner", "repoName", "secretName", "authuser", "intervalDays"];
const defaults = { secretName: "YTM_BROWSER", authuser: "1", intervalDays: 7 };

function showStatus(type, message) {
  const el = document.getElementById("status");
  el.className = type;
  el.textContent = message;
}

// Load saved settings into form
chrome.storage.sync.get(fields, (data) => {
  for (const field of fields) {
    document.getElementById(field).value = data[field] ?? defaults[field] ?? "";
  }
});

// Save
document.getElementById("saveBtn").addEventListener("click", () => {
  const values = {};
  for (const field of fields) {
    const val = document.getElementById(field).value.trim();
    if (val) values[field] = field === "intervalDays" ? Number(val) : val;
  }
  chrome.storage.sync.set(values, () => {
    chrome.runtime.sendMessage({ type: "RESCHEDULE" });
    showStatus("success", "Settings saved.");
  });
});

// Test connection
document.getElementById("testBtn").addEventListener("click", async () => {
  const token = document.getElementById("githubToken").value.trim();
  const owner = document.getElementById("repoOwner").value.trim();
  const repo = document.getElementById("repoName").value.trim();

  if (!token || !owner || !repo) {
    showStatus("error", "Please fill in token, owner, and repo name first.");
    return;
  }

  showStatus("success", "Testing...");

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/public-key`, {
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github+json" }
    });
    if (res.ok) {
      showStatus("success", "Connection successful! GitHub token and repo are valid.");
    } else {
      const data = await res.json();
      showStatus("error", `Error ${res.status}: ${data.message}`);
    }
  } catch (err) {
    showStatus("error", `Network error: ${err.message}`);
  }
});
