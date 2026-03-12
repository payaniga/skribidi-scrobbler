function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (mins > 0) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  return "just now";
}

function timeUntil(ts) {
  const diff = ts - Date.now();
  if (diff <= 0) return "soon";
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `in ${days} day${days > 1 ? "s" : ""}`;
  if (hours > 0) return `in ${hours} hour${hours > 1 ? "s" : ""}`;
  return `in ${mins} min${mins > 1 ? "s" : ""}`;
}

async function loadStatus() {
  const { lastStatus } = await chrome.storage.local.get("lastStatus");

  if (lastStatus) {
    document.getElementById("lastRefresh").textContent = timeAgo(lastStatus.ts);
    const statusEl = document.getElementById("statusText");
    if (lastStatus.type === "success") {
      statusEl.textContent = "✅ Success";
      statusEl.className = "value status-success";
    } else {
      statusEl.textContent = "❌ Failed";
      statusEl.className = "value status-error";
      const errEl = document.getElementById("errorMsg");
      errEl.textContent = lastStatus.message;
      errEl.style.display = "block";
    }
  }

  const alarm = await chrome.alarms.get("ytm_refresh");
  if (alarm) {
    document.getElementById("nextRefresh").textContent = timeUntil(alarm.scheduledTime);
  }
}

document.getElementById("refreshBtn").addEventListener("click", async () => {
  const btn = document.getElementById("refreshBtn");
  btn.disabled = true;
  btn.textContent = "Refreshing...";

  chrome.runtime.sendMessage({ type: "MANUAL_REFRESH" }, async () => {
    await loadStatus();
    btn.disabled = false;
    btn.textContent = "Refresh Now";
  });
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

loadStatus();
