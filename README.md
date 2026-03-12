# skribidi

Automatically scrobbles your YouTube Music listening history to Last.fm — every 4 hours, with zero manual interaction.

---

## What it does

YouTube Music has no native Last.fm integration. This project fills that gap by periodically fetching your YT Music listening history and scrobbling new tracks to your Last.fm profile, including artist, title, and an approximate timestamp.

It runs entirely on GitHub Actions — no server, no cost, no third-party services that touch your Google account.

---

## How it works

1. A GitHub Actions cron job fires every 4 hours
2. It fetches your top 50 recently played tracks from YT Music (via OAuth)
3. It compares them against the last saved snapshot to find new plays
4. New tracks are scrobbled to Last.fm with approximate timestamps (spaced 3 minutes apart)
5. The updated snapshot is committed back to the repo for the next run

> Note: YT Music does not expose exact play timestamps — only relative labels like "Today" or "Yesterday". Timestamps are therefore approximated based on the time of each sync run.

---

## Prerequisites

- A [GitHub](https://github.com) account
- A [Last.fm](https://www.last.fm) account
- Python 3.11+ installed locally (for the one-time OAuth setup)
- A YouTube Music account with listening history enabled

---

## Setup

### 1. Fork or clone this repo

```bash
git clone https://github.com/payaniga/skribidi.git
cd skribidi
```

### 2. Set up your Python environment

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Authenticate with YouTube Music

This project uses browser cookie auth (OAuth does not work with YouTube Music's internal API).

1. Open [music.youtube.com](https://music.youtube.com) in Chrome and make sure you're logged in
2. Open DevTools (`Cmd+Option+I`) → **Network** tab
3. Type `browse` in the filter box, then click anything on the page
4. Right-click the `browse` request that appears → **Copy** → **Copy as cURL**
5. Paste the cURL into `refresh_auth.py` and run it — this generates `browser.json`

`browser.json` contains your session cookies — **keep it private, never commit it**.

Verify it works:

```python
from ytmusicapi import YTMusic
yt = YTMusic("browser.json")
print(yt.get_history()[:3])
```

You should see track data with `title`, `artists`, and `videoId` fields.

> **Cookie expiry:** Browser cookies expire every 1–3 months. When the workflow fails, repeat step 4–5 above and update the `YTM_BROWSER` GitHub Secret.

### 4. Register a Last.fm API application

1. Go to [last.fm/api/account/create](https://www.last.fm/api/account/create)
2. Fill in the app name (e.g. `skribidi`), description, and any callback URL
3. Copy the **API Key** and **Shared Secret**

### 5. Add GitHub Actions Secrets

In your GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret name | Value |
|---|---|
| `YTM_BROWSER` | Full contents of your `browser.json` file |
| `LASTFM_API_KEY` | Your Last.fm API key |
| `LASTFM_SECRET` | Your Last.fm shared secret |
| `LASTFM_USERNAME` | Your Last.fm username |
| `LASTFM_PASSWORD` | Your Last.fm password |

---

## Monitoring

- **Last.fm profile** — scrobbled tracks appear here within minutes of each run
- **GitHub Actions** — go to the Actions tab to see run logs and history
- **runs.log** — a log file committed to the repo after each run, showing how many tracks were scrobbled and when

---

## Refreshing browser auth

YouTube Music session cookies expire every 1–3 months. When the workflow fails:

1. Open [music.youtube.com](https://music.youtube.com) in Chrome
2. DevTools → Network → filter by `browse` → click anything on the page
3. Right-click the `browse` request → **Copy** → **Copy as cURL**
4. Run `refresh_auth.py` locally with the new cURL to regenerate `browser.json`
5. Copy the new contents of `browser.json` and update the `YTM_BROWSER` GitHub Secret

GitHub Actions will email you when a workflow run fails, so you'll know when it's time to refresh.

---

## Changing the sync frequency

The cron schedule is defined in `.github/workflows/scrobble.yml`:

```yaml
on:
  schedule:
    - cron: '0 */4 * * *'
```

To change the frequency, edit the cron expression. The format is:

```
┌─ minute (0–59)
│ ┌─ hour (0–23)
│ │ ┌─ day of month (1–31)
│ │ │ ┌─ month (1–12)
│ │ │ │ ┌─ day of week (0–7, 0 and 7 = Sunday)
│ │ │ │ │
* * * * *
```

**Common examples:**

| Frequency | Cron expression |
|---|---|
| Every hour | `0 * * * *` |
| Every 4 hours (default) | `0 */4 * * *` |
| Every 6 hours | `0 */6 * * *` |
| Once a day at midnight UTC | `0 0 * * *` |
| Once a day at 9am UTC | `0 9 * * *` |

After editing, commit and push the file:

```bash
git add .github/workflows/scrobble.yml
git commit -m "chore: update sync frequency"
git push
```

> Note: GitHub Actions cron has a minimum resolution of 5 minutes and may run up to a few minutes late under heavy load.

---

## Tech stack

| Component | Tool |
|---|---|
| YT Music history | `ytmusicapi` |
| Last.fm scrobbling | `pylast` |
| Scheduler | GitHub Actions cron |
| State / dedup | `last_snapshot.json` (committed to repo) |
| Secrets | GitHub Actions Secrets |
