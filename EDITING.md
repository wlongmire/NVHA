# Editing the NVHA site

## For staff

1. Go to **nickvirgiliohaiku.org/edit/** and enter the shared password.
2. Pick a tab: **Events, Articles, Pages, Store** or **Homepage**.
3. Choose an item on the left (or **+ New**), change what you need, and press **Save**.
4. The change goes live in about a minute. Reload the public page to see it.

Tips:
- Pictures: use the **Upload** button. Large pictures are shrunk automatically (JPG, PNG or WebP, up to 4 MB).
- To hide something without deleting it, tick **Hide from the site** (draft).
- Each page has optional search-engine fields (title and description). Leave them blank to use the defaults.
- If you see "Someone else changed this", reload the item and redo your edit.
- Closing the tab with unsaved changes will ask you first. Sessions expire after 4 hours.

## Setup (one time, for whoever deploys)

Set these environment variables in Vercel (Project, Settings, Environment Variables), then redeploy:

| Name | Value |
| --- | --- |
| `EDIT_PASSWORD` | The shared staff password (long, not reused elsewhere) |
| `GITHUB_TOKEN` | Fine-grained token for this repo only, with **Contents: read and write** |
| `GITHUB_REPO` | `owner/repo` of this site (default in code is `TODO-owner/nvha-site`) |
| `GITHUB_BRANCH` | Optional, defaults to `main` |

Every save becomes a commit on that branch, and Vercel redeploys from it. To change the password, update `EDIT_PASSWORD` and redeploy. To see or undo any edit, use the git history.

## Local testing

`npm run dev`, then open `http://localhost:4321/edit/`. With no `GITHUB_TOKEN` set, the editor runs in test mode: no password, and saves write straight to local files (the header shows a badge).

## What the editor can and cannot change

It only edits content files (`src/content/events|posts|pages|products` and `src/data/home.json`) and uploads to `public/uploads`. It never touches code, layouts or styles, and rejects scripts, frames and invalid dates, links or prices.
