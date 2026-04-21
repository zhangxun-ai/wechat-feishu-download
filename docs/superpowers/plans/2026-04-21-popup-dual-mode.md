# Popup Dual-Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the popup into a default-first export surface with an expandable advanced workspace, while introducing a unified output-target model across single export, batch export, and SCYS course export.

**Architecture:** Add a small shared view-model module for popup decisions so the primary-action logic and output-target semantics are testable outside the DOM. Then reshape the popup markup and styles around a simple primary surface, update popup state management to use the new output target, and finally teach batch-runner to honor download-only, download-plus-Obsidian, and Obsidian-only jobs.

**Tech Stack:** Chrome extension MV3, vanilla JS, shared browser globals, focused Node-based CJS tests.

---

### Task 1: Lock the popup decision model in tests

**Files:**
- Create: `shared/export-ui-models.js`
- Create: `tests/export-ui-models.test.cjs`

- [ ] **Step 1: Write failing tests for output target normalization**

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node tests/export-ui-models.test.cjs`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Write failing tests for primary action selection**

- [ ] **Step 4: Implement the shared helper minimally**

- [ ] **Step 5: Re-run the helper tests until they pass**

Run: `node tests/export-ui-models.test.cjs`
Expected: PASS

### Task 2: Reshape popup markup and styling

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`

- [ ] **Step 1: Replace the current stacked layout with a primary surface**

- [ ] **Step 2: Add quick settings for output target and include-images**

- [ ] **Step 3: Add an expandable advanced workspace shell**

- [ ] **Step 4: Move batch, WeChat backend, and Obsidian management into the advanced workspace**

- [ ] **Step 5: Verify the popup HTML/CSS remains internally consistent**

### Task 3: Rewire popup behavior around the new UI model

**Files:**
- Modify: `popup.js`
- Modify: `popup.html`
- Modify: `shared/export-ui-models.js`

- [ ] **Step 1: Load and persist the new output target preference**

- [ ] **Step 2: Render the dynamic primary action based on page context**

- [ ] **Step 3: Make the primary action button call the correct existing workflow**

- [ ] **Step 4: Gate Obsidian-related targets on usable directory authorization**

- [ ] **Step 5: Keep advanced controls working after the structural move**

### Task 4: Honor output targets in background task execution

**Files:**
- Modify: `batch-runner.js`
- Modify: `batch-runner.html`
- Modify: `shared/export-ui-models.js`

- [ ] **Step 1: Read `outputTarget` from stored jobs with backward-compatible fallback**

- [ ] **Step 2: Skip browser downloads when a job is Obsidian-only**

- [ ] **Step 3: Continue writing Markdown into Obsidian when the target includes Obsidian**

- [ ] **Step 4: Update runner copy and metadata so users can see the chosen output mode**

### Task 5: Verify and commit

**Files:**
- Test: `tests/export-ui-models.test.cjs`
- Test: `tests/obsidian-vault-storage.test.cjs`
- Test: `tests/obsidian-export.test.cjs`
- Test: `tests/course-export-runtime.test.cjs`
- Test: `popup.js`
- Test: `batch-runner.js`
- Test: `shared/export-ui-models.js`

- [ ] **Step 1: Run focused helper tests**

Run:
`node tests/export-ui-models.test.cjs`
`node tests/obsidian-vault-storage.test.cjs`

Expected: PASS

- [ ] **Step 2: Run related regression tests**

Run:
`node tests/obsidian-export.test.cjs`
`node tests/course-export-runtime.test.cjs`

Expected: PASS

- [ ] **Step 3: Run syntax checks**

Run:
`node --check popup.js`
`node --check batch-runner.js`
`node --check shared/export-ui-models.js`

Expected: exit code 0

- [ ] **Step 4: Commit only after fresh verification**
