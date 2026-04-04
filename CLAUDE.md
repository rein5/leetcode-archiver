# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # production build → dist/
npm run dev            # watch mode (Vite rebuilds on save)
npm run run:firefox    # launch Firefox with the extension loaded (requires dist/ to be built first)
npm run package        # zip dist/ into web-ext-artifacts/ for submission
```

To develop with live reload:
1. `npm run dev` in one terminal
2. `npm run run:firefox` in another — web-ext watches `dist/` and reloads automatically

## Architecture

Firefox MV2 extension. TypeScript + React, built with Vite.

```
src/
  background/index.ts   — core logic: intercepts LeetCode GraphQL responses via
                          browser.webRequest.filterResponseData (Firefox-only MV2 API),
                          extracts accepted submissions, commits files to GitHub
  content/index.tsx     — injects a React status badge (shadow DOM) into LeetCode pages,
                          listens for UPLOAD_STATUS messages from the background
  popup/
    index.html          — entry point for the browser_action popup
    main.tsx            — React root
    Popup.tsx           — settings UI: GitHub PAT input, repo name, connection test
  shared/
    github.ts           — GitHub Contents API (verifyToken, putFile with SHA-aware upsert)
    storage.ts          — typed wrapper around browser.storage.local
    types.ts            — shared types (Submission, Settings, ContentMessage)
    languages.ts        — LeetCode language slug → file extension map
public/
  manifest.json         — Firefox MV2 manifest (webRequest + webRequestBlocking permissions)
  icons/
```

## Key design decisions

- **No OAuth**: users supply a fine-grained GitHub PAT scoped to a single repo (Contents: read/write). No client secrets, no broad repo access.
- **filterResponseData**: the background script intercepts `/graphql` responses to detect accepted submissions and extract the submitted code directly from the response body — no DOM scraping needed.
- **Shadow DOM badge**: the content script mounts its React tree inside a shadow root so LeetCode's styles don't interfere.
- **MV2**: `filterResponseData` requires `webRequestBlocking`, which is only available in MV2. MV3's `declarativeNetRequest` cannot read response bodies.

## Build output layout (dist/)

```
dist/
  manifest.json
  icons/
  background/index.js
  content/index.js
  popup/index.html
  popup/index.js
  shared/           ← shared chunks (React, polyfill, github helpers)
```
