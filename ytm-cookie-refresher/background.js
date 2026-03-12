importScripts("lib/tweetnacl.min.js");
importScripts("lib/blakejs.js");
importScripts("lib/sealedbox.js");

const ALARM_NAME = "ytm_refresh";

// ── Cookie extraction ────────────────────────────────────────────────────────

async function getCookies() {
  const domains = ["music.youtube.com", ".youtube.com", ".google.com"];
  const seen = new Set();
  const all = [];

  for (const domain of domains) {
    const cookies = await chrome.cookies.getAll({ domain });
    for (const c of cookies) {
      if (!seen.has(c.name)) {
        seen.add(c.name);
        all.push(`${c.name}=${c.value}`);
      }
    }
  }

  return all.join("; ");
}

// ── Build browser.json structure ─────────────────────────────────────────────

function buildBrowserJson(cookieString, authuser) {
  return JSON.stringify({
    "accept": "*/*",
    "accept-encoding": "gzip, deflate",
    "authorization": "SAPISIDHASH placeholder",
    "content-type": "application/json",
    "cookie": cookieString,
    "origin": "https://music.youtube.com",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "x-goog-authuser": String(authuser),
    "x-origin": "https://music.youtube.com"
  }, null, 4);
}

// ── GitHub API ────────────────────────────────────────────────────────────────

async function fetchRepoPublicKey(owner, repo, token) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/public-key`, {
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github+json"
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch public key: ${res.status} ${res.statusText}`);
  return res.json();
}

function encryptSecret(value, base64PublicKey) {
  const publicKey = base64ToBytes(base64PublicKey);
  const message = new TextEncoder().encode(value);
  const encrypted = sealedBoxSeal(message, publicKey);
  return bytesToBase64(encrypted);
}

async function pushToGitHub(owner, repo, secretName, encryptedValue, keyId, token) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`, {
    method: "PUT",
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId })
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Failed to push secret: ${res.status} ${text}`);
  }
}

// ── Main refresh pipeline ─────────────────────────────────────────────────────

async function runRefresh() {
  const settings = await chrome.storage.sync.get([
    "githubToken", "repoOwner", "repoName", "secretName", "authuser"
  ]);

  const { githubToken, repoOwner, repoName, secretName = "YTM_BROWSER", authuser = "1" } = settings;

  if (!githubToken || !repoOwner || !repoName) {
    await saveStatus("error", "Missing settings. Please configure the extension.");
    return;
  }

  try {
    const cookieString = await getCookies();
    if (!cookieString) throw new Error("No cookies found for music.youtube.com. Make sure you're logged in.");

    const browserJson = buildBrowserJson(cookieString, authuser);
    const { key, key_id } = await fetchRepoPublicKey(repoOwner, repoName, githubToken);
    const encryptedValue = encryptSecret(browserJson, key);
    await pushToGitHub(repoOwner, repoName, secretName, encryptedValue, key_id, githubToken);

    await saveStatus("success", new Date().toISOString());
    console.log("YTM Cookie Refresher: secret updated successfully.");
  } catch (err) {
    await saveStatus("error", err.message);
    console.error("YTM Cookie Refresher error:", err);
  }
}

async function saveStatus(type, message) {
  await chrome.storage.local.set({ lastStatus: { type, message, ts: Date.now() } });
}

// ── Alarm scheduling ──────────────────────────────────────────────────────────

async function scheduleAlarm() {
  const { intervalDays = 7 } = await chrome.storage.sync.get("intervalDays");
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: intervalDays * 24 * 60 });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) runRefresh();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "MANUAL_REFRESH") {
    runRefresh().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: e.message }));
    return true; // keep channel open for async response
  }
  if (msg.type === "RESCHEDULE") {
    scheduleAlarm().then(() => sendResponse({ ok: true }));
    return true;
  }
});
