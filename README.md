# leetcode-archiver

A Firefox extension that automatically backs up accepted LeetCode submissions to a GitHub repository.

**[Install from Firefox Add-ons](https://addons.mozilla.org/firefox/addon/leetcode-archiver/)**

Every time a submission is accepted, the extension commits two files:

```
0001-two-sum/
  solution.py        ← your submitted code
  description.md     ← problem link, difficulty, runtime, memory
```

with commit message `feat: solve 0001. Two Sum`.

Requires only a fine-grained GitHub token scoped to a single repository — no broad access to your account.

---

## Installation

Install directly from the [Firefox Add-ons page](https://addons.mozilla.org/firefox/addon/leetcode-archiver/).

---

## Configuration

Before the extension can commit anything, you need to give it a GitHub token scoped to your target repository.

### 1. Create a fine-grained GitHub token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set **Resource owner** to your account
4. Under **Repository access**, choose **Only select repositories** and pick your solutions repo (create one first if needed)
5. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**
6. Generate and copy the token (`github_pat_…`)

### 2. Configure the extension

1. Click the extension icon in the Firefox toolbar
2. Paste your token into **GitHub token**
3. Enter your repository as **owner/repo** (e.g. `yourname/leetcode-solutions`)
4. Click **Save** — it will verify the token immediately

---

## Usage

Just use LeetCode normally. When a submission is accepted:

- The extension icon badge shows a spinner while pushing to GitHub
- On success: badge turns green ✓ for a few seconds
- On failure: badge turns red ✗ — click the popup to see the error
- The popup always shows the last submission result and when it happened

---

## Development

```bash
npm install
npm run build          # production build → dist/
npm run dev            # watch mode, rebuilds on save
```

To test changes, load `dist/manifest.json` as a temporary add-on via `about:debugging#/runtime/this-firefox` and reload after each build.

**Stack:** TypeScript + Preact, built with Vite. 
