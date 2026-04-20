# Course Acceleration And Obsidian Plan

> Inline execution plan for the approved implementation. Scope is limited to browser-render acceleration for SCYS course export and Obsidian vault writing for Markdown outputs.

**Goal:** Make SCYS course export materially faster without relying on direct fetch parsing, and add one-click Obsidian vault saving while keeping existing downloads intact.

**Architecture:** Keep the current browser-render export path. Introduce a course-export execution profile that removes redundant fixed waits for SCYS, raises worker counts for medium and large jobs, and keeps retries on a slower backoff path. Add a separate Obsidian bundle builder and vault storage layer so popup and batch-runner can write Markdown files directly into a user-authorized vault folder.

**Files:**
- Create: `docs/superpowers/plans/2026-04-21-course-accel-obsidian.md`
- Create: `shared/obsidian-export.js`
- Create: `shared/obsidian-vault-storage.js`
- Create: `tests/obsidian-export.test.cjs`
- Modify: `shared/course-export-runtime.js`
- Modify: `tests/course-export-runtime.test.cjs`
- Modify: `shared/course-export-builders.js`
- Modify: `tests/course-export-builders.test.cjs`
- Modify: `popup.html`
- Modify: `popup.css`
- Modify: `popup.js`
- Modify: `batch-runner.html`
- Modify: `batch-runner.js`

## Task 1: Lock the runtime profile in tests

- [ ] Add failing tests for fast SCYS browser-render profiles in `tests/course-export-runtime.test.cjs`.
- [ ] Verify the tests fail before touching `shared/course-export-runtime.js`.
- [ ] Implement execution profiles with explicit worker counts, delay knobs, and mode labels.
- [ ] Re-run the runtime tests until they pass.

## Task 2: Lock Obsidian bundle structure in tests

- [ ] Add failing tests for Obsidian file naming, frontmatter, and index-note linking in `tests/obsidian-export.test.cjs`.
- [ ] Verify the tests fail before creating `shared/obsidian-export.js`.
- [ ] Implement pure bundle builders for single-note and course-note export packages.
- [ ] Re-run the Obsidian bundle tests until they pass.

## Task 3: Wire browser-render acceleration into course export

- [ ] Replace hard-coded SCYS course delays in `batch-runner.js` with profile-driven values.
- [ ] Skip redundant fixed settle waits for SCYS course chapter exports because the content script already waits for the chapter root to become ready.
- [ ] Raise worker counts for medium and large course jobs.
- [ ] Keep retry backoff and add per-attempt slowdown so failures recover conservatively.
- [ ] Surface the active mode in runner metadata and status copy.

## Task 4: Add Obsidian vault authorization and writing

- [ ] Add popup UI for vault status, folder authorization, and a toggle to also save Markdown into Obsidian.
- [ ] Persist the directory handle in IndexedDB and lightweight settings in `chrome.storage.local`.
- [ ] For single-page Markdown export, write the generated note into the vault when enabled, while still keeping the normal download.
- [ ] For course export, write an Obsidian-friendly bundle: `index.md`, `chapters/*.md`, and optional metadata frontmatter.
- [ ] If the vault handle is missing or permission is no longer granted, show a clear re-authorization message and continue normal downloads.

## Task 5: Verify end-to-end and commit

- [ ] Run focused tests for runtime/builders/Obsidian bundle helpers.
- [ ] Run syntax checks for `popup.js`, `batch-runner.js`, `shared/obsidian-export.js`, and `shared/obsidian-vault-storage.js`.
- [ ] Run the existing regression smoke tests.
- [ ] Commit on `main` only after fresh verification evidence.
