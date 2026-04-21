# UI Workbench Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the popup and batch runner UI into a cleaner category-based workbench without changing any existing export behavior.

**Architecture:** Keep the current popup and batch-runner JavaScript behavior intact, and reshape the interface mostly through HTML/CSS hierarchy changes plus small view-model additions. Introduce preset-style UI labels in the popup while preserving the existing output target state machine and event bindings underneath.

**Tech Stack:** Chrome extension popup/task pages, vanilla HTML/CSS/JS, shared export UI models, existing local test scripts.

---

### Task 1: Add a regression test for popup output-target behavior

**Files:**
- Modify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/tests/export-ui-models.test.cjs`
- Test: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/tests/export-ui-models.test.cjs`

- [ ] **Step 1: Write a failing test**

Add a test that locks in the existing output-target semantics so the UI copy can change without changing behavior:

```js
it("preserves download and obsidian intent flags when UI labels are refreshed", () => {
  const download = exportUiModels.getOutputTargetState("download");
  const both = exportUiModels.getOutputTargetState("both");
  const obsidian = exportUiModels.getOutputTargetState("obsidian");

  assert.equal(download.wantsDownload, true);
  assert.equal(download.wantsObsidian, false);
  assert.equal(both.wantsDownload, true);
  assert.equal(both.wantsObsidian, true);
  assert.equal(obsidian.wantsDownload, false);
  assert.equal(obsidian.wantsObsidian, true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/export-ui-models.test.cjs`

Expected: FAIL because the new regression case is not present yet.

- [ ] **Step 3: Add the minimal test code**

Append only the new regression case to the existing test file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/export-ui-models.test.cjs`

Expected: PASS with the new regression case included.

### Task 2: Restructure popup markup into the new workbench layout

**Files:**
- Modify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/popup.html`
- Modify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/popup.js`

- [ ] **Step 1: Write a failing structure check**

Create a lightweight structure assertion script target by checking for the new section ids/classes after the HTML update:

```bash
rg -n "topbar|presetBar|workspaceShell|obsidianDock" popup.html
```

Expected: FAIL because the new structure markers do not exist yet.

- [ ] **Step 2: Update popup markup**

Reshape `popup.html` to match the approved design:

- replace the large hero with a compact top bar
- keep the 4 category tabs
- keep the main action panel
- replace the radio-style output target block with a preset block while preserving hidden or bound inputs for behavior
- move Obsidian into a lightweight bottom dock
- keep category-specific workspaces, but visually subordinate them

- [ ] **Step 3: Update popup bindings minimally**

Adjust `popup.js` only where element lookups or rendering assumptions change:

- remap selectors for renamed sections
- keep existing action handlers
- keep category detection and export logic unchanged
- add minimal preset-render text handling if needed, without changing output-target semantics

- [ ] **Step 4: Run a structure sanity check**

Run: `rg -n "topbar|presetBar|workspaceShell|obsidianDock" popup.html`

Expected: PASS with the new structure markers found.

### Task 3: Re-skin popup styles to the approved visual system

**Files:**
- Modify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/popup.css`

- [ ] **Step 1: Write a failing style-target check**

Run:

```bash
rg -n "topbar|preset-card|workspace-shell|obsidian-dock" popup.css
```

Expected: FAIL because the new styling hooks do not exist yet.

- [ ] **Step 2: Implement popup CSS refresh**

Update `popup.css` to:

- reduce the heavy hero treatment
- introduce a compact top bar
- tighten card layering and spacing
- make one clear primary action and calmer secondary actions
- style the preset cards for `快速导出 / 发给 AI / 存到 Obsidian`
- keep the 4 category tabs but make them feel like a stable tool navigation bar
- compress Obsidian into a bottom dock instead of a full panel

- [ ] **Step 3: Run the style-target check**

Run:

```bash
rg -n "topbar|preset-card|workspace-shell|obsidian-dock" popup.css
```

Expected: PASS with the new style hooks present.

### Task 4: Restructure batch-runner markup for a quieter task page

**Files:**
- Modify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/batch-runner.html`
- Modify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/batch-runner.js`

- [ ] **Step 1: Write a failing structure check**

Run:

```bash
rg -n "resultActions|summaryPanel|detailsToggle" batch-runner.html
```

Expected: FAIL because the new sections do not exist yet.

- [ ] **Step 2: Update batch-runner markup**

Reshape `batch-runner.html` so it presents:

- a calmer summary header
- a result-first action area
- a compact stats region
- collapsible or visually subordinate worker/log sections

- [ ] **Step 3: Adjust JS bindings without touching job logic**

Update `batch-runner.js` only enough to:

- bind any renamed result/action containers
- support collapsed detail sections if introduced
- keep export execution, retries, elapsed time, and Obsidian retry behavior unchanged

- [ ] **Step 4: Run the structure check**

Run:

```bash
rg -n "resultActions|summaryPanel|detailsToggle" batch-runner.html
```

Expected: PASS with the new sections present.

### Task 5: Re-skin batch-runner styles

**Files:**
- Modify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/batch-runner.css`

- [ ] **Step 1: Write a failing style-target check**

Run:

```bash
rg -n "result-actions|summary-panel|detail-card|detail-toggle" batch-runner.css
```

Expected: FAIL because the new classes do not exist yet.

- [ ] **Step 2: Implement batch-runner CSS refresh**

Update `batch-runner.css` to:

- reduce the “log console” feel
- move visual emphasis to result actions and summary
- make worker/log sections calmer and more collapsible
- keep the same warm visual family as the popup

- [ ] **Step 3: Run the style-target check**

Run:

```bash
rg -n "result-actions|summary-panel|detail-card|detail-toggle" batch-runner.css
```

Expected: PASS with the new hooks present.

### Task 6: Verify behavior and complete the refresh

**Files:**
- Verify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/popup.html`
- Verify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/popup.css`
- Verify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/popup.js`
- Verify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/batch-runner.html`
- Verify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/batch-runner.css`
- Verify: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/batch-runner.js`
- Test: `/Users/zhanghanting/工具箱/my_feishu_clipper_youxia/tests/export-ui-models.test.cjs`

- [ ] **Step 1: Run the model test suite**

Run: `node --test tests/export-ui-models.test.cjs`

Expected: PASS.

- [ ] **Step 2: Run a fast diff review**

Run: `git diff -- popup.html popup.css popup.js batch-runner.html batch-runner.css batch-runner.js tests/export-ui-models.test.cjs`

Expected: Only UI structure/style changes plus minimal binding updates, no accidental export-logic rewrites.

- [ ] **Step 3: Manually verify the approved design goals**

Checklist:

- popup opens into a category-based workbench
- the 4 tabs remain `微信公众号 / 飞书 / 生财有术 / 其它`
- the main action is the visual focus
- the preset area is present and understandable
- Obsidian is visible but visually lighter
- batch-runner emphasizes results over logs

- [ ] **Step 4: Commit**

```bash
git add popup.html popup.css popup.js batch-runner.html batch-runner.css batch-runner.js tests/export-ui-models.test.cjs docs/superpowers/plans/2026-04-21-ui-workbench-refresh.md
git commit -m "feat: refresh popup and task workbench UI"
```
