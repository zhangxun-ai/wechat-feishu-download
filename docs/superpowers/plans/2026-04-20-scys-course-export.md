# SCYS Course Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "export current course" mode for SCYS chapter pages that discovers the current sidebar outline, exports every chapter in order, and downloads a single Markdown file plus a single HTML reader file without changing existing export flows.

**Architecture:** Keep existing single-page export behavior intact. Add a site-specific SCYS outline discovery path in the content script, create a new `course-export` batch job type from the popup, and extend the batch runner to iterate chapters and then merge results into single-file Markdown and HTML outputs. Extract merge logic and SCYS normalization into shared helpers so the new behavior is testable with Node smoke tests.

**Tech Stack:** Chrome Extension MV3, vanilla JavaScript, content scripts, Chrome tabs/download/storage APIs, Node-based smoke tests

---

### Task 1: Lock SCYS page detection and popup affordance

**Files:**
- Modify: `shared/export-url-utils.js`
- Modify: `tests/export-url-utils.test.cjs`
- Modify: `popup.html`
- Modify: `popup.js`

- [ ] **Step 1: Write the failing URL-scope tests**

Add tests for the new site-specific helper and make the desired behavior explicit:

```js
const {
  classifyExportUrl,
  isSingleExportUrl,
  isScysCourseUrl
} = require("../shared/export-url-utils.js");

test("recognizes SCYS course chapter pages", () => {
  assert.equal(isScysCourseUrl("https://scys.com/deepsea/2001/course/164?chapterId=11093"), true);
  assert.equal(isScysCourseUrl("https://scys.com/deepsea/2001/course/164"), false);
  assert.equal(classifyExportUrl("https://scys.com/deepsea/2001/course/164?chapterId=11093"), "generic-web");
  assert.equal(isSingleExportUrl("https://scys.com/deepsea/2001/course/164?chapterId=11093"), true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/export-url-utils.test.cjs`  
Expected: FAIL because `isScysCourseUrl` does not exist yet.

- [ ] **Step 3: Add the shared SCYS URL helper**

Extend `shared/export-url-utils.js` with a focused helper:

```js
function isScysCourseUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "scys.com"
      && /^\/deepsea\/\d+\/course\/\d+/.test(parsed.pathname)
      && parsed.searchParams.has("chapterId");
  } catch (error) {
    return false;
  }
}
```

Keep `classifyExportUrl()` unchanged for batch scope. This feature is a new affordance layered on top of generic-web support, not a new global exporter type.

- [ ] **Step 4: Expose the new popup control without changing old buttons**

Update `popup.html` to add a dedicated button, hidden or disabled by default:

```html
<button id="exportCourse" class="button" hidden disabled>导出当前专栏</button>
```

Update `popup.js` so that:

- the button is only shown when `isScysCourseUrl(tab.url)` is true
- the existing `导出 Markdown` button keeps its current behavior
- button state is managed independently from `setButtonsDisabled()`

- [ ] **Step 5: Re-run the tests and static checks**

Run:

- `node tests/export-url-utils.test.cjs`
- `node --check popup.js`

Expected:

- URL helper tests PASS
- popup syntax check exits 0

- [ ] **Step 6: Commit**

```bash
git add shared/export-url-utils.js tests/export-url-utils.test.cjs popup.html popup.js
git commit -m "feat: add SCYS course export entry"
```

### Task 2: Add SCYS outline discovery in the content script

**Files:**
- Create: `shared/scys-course-utils.js`
- Create: `tests/scys-course-utils.test.cjs`
- Modify: `content-scripts/feishu-exporter.js`
- Modify: `popup.js`

- [ ] **Step 1: Write the failing normalization test**

Create a pure helper test that turns raw extracted entries into canonical chapter objects:

```js
const {
  buildScysChapterUrl,
  normalizeScysCourseEntries
} = require("../shared/scys-course-utils.js");

test("normalizes raw SCYS course entries into ordered chapters", () => {
  const baseUrl = "https://scys.com/deepsea/2001/course/164?chapterId=11093";
  const result = normalizeScysCourseEntries([
    { title: "前言", chapterId: "11093" },
    { title: "分组标题", chapterId: "" },
    { title: "MCP 里有三个角色，你需要知道", chapterId: "11098" }
  ], baseUrl);

  assert.deepEqual(result, [
    {
      order: 1,
      title: "前言",
      chapterId: "11093",
      url: buildScysChapterUrl(baseUrl, "11093")
    },
    {
      order: 2,
      title: "MCP 里有三个角色，你需要知道",
      chapterId: "11098",
      url: buildScysChapterUrl(baseUrl, "11098")
    }
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/scys-course-utils.test.cjs`  
Expected: FAIL because the new helper module does not exist yet.

- [ ] **Step 3: Implement the shared SCYS normalization helper**

Create `shared/scys-course-utils.js` with small pure functions:

- `isScysCourseParsedUrl(parsed)`
- `buildScysChapterUrl(baseUrl, chapterId)`
- `normalizeScysCourseEntries(entries, baseUrl)`

Keep this file free of DOM access so it remains Node-testable.

- [ ] **Step 4: Add a new content-script message for course outline discovery**

In `content-scripts/feishu-exporter.js`, add a new message type such as:

```js
const MESSAGE_GET_SCYS_COURSE_OUTLINE = "feishu-export:get-scys-course-outline";
```

Wire it in `handleMessage()` and implement `getScysCourseOutline()` that:

1. verifies the current page is an SCYS chapter page
2. extracts the course title
3. tries structured page state first
4. falls back to parsing sidebar anchors / chapter nodes from the DOM
5. calls `normalizeScysCourseEntries()` before returning

Expected return shape:

```js
{
  courseTitle,
  courseUrl: location.href,
  chapters
}
```

- [ ] **Step 5: Request outline data from the popup and build a dedicated job**

In `popup.js`, add a new click handler for `exportCourse` that:

1. calls `sendMessageWithRecovery(activeTabId, { type: "feishu-export:get-scys-course-outline" })`
2. validates that `chapters.length > 0`
3. creates a dedicated stored job with a new helper such as `createStoredCourseExportJob(outline, options)`
4. opens the existing batch runner page

Use a job shape like:

```js
{
  id,
  type: "course-export",
  source: "scys-course",
  title: `专栏导出 - ${outline.courseTitle}`,
  courseTitle: outline.courseTitle,
  courseUrl: outline.courseUrl,
  includeImages: options.includeImages !== false,
  chapters: outline.chapters,
  createdAt: new Date().toISOString()
}
```

- [ ] **Step 6: Re-run the helper test and static checks**

Run:

- `node tests/scys-course-utils.test.cjs`
- `node --check content-scripts/feishu-exporter.js`
- `node --check popup.js`

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add shared/scys-course-utils.js tests/scys-course-utils.test.cjs content-scripts/feishu-exporter.js popup.js
git commit -m "feat: discover SCYS course outlines"
```

### Task 3: Add single-file Markdown and HTML course builders

**Files:**
- Create: `shared/course-export-builders.js`
- Create: `tests/course-export-builders.test.cjs`

- [ ] **Step 1: Write the failing builder tests**

Cover both output formats with pure tests:

```js
const {
  buildCourseMarkdownDocument,
  buildCourseHtmlDocument
} = require("../shared/course-export-builders.js");

test("builds a merged markdown document with toc and failures", () => {
  const markdown = buildCourseMarkdownDocument({
    title: "CLI类AI编程工具速通",
    sourceUrl: "https://scys.com/deepsea/2001/course/164?chapterId=11093",
    exportedAt: "2026-04-20T00:00:00.000Z",
    chapters: [
      { order: 1, title: "前言", url: "https://example.com/1", markdown: "第一章正文" },
      { order: 2, title: "MCP", url: "https://example.com/2", markdown: "第二章正文" }
    ],
    failedChapters: [{ title: "Claude Code", url: "https://example.com/3", message: "未提取到正文" }]
  });

  assert.match(markdown, /^# CLI类AI编程工具速通/m);
  assert.match(markdown, /\[前言\]\(#前言\)/);
  assert.match(markdown, /## 前言/);
  assert.match(markdown, /失败章节/);
});
```

Add a paired HTML test that asserts:

- nav links exist
- sections have matching `id`
- the failure panel renders when failures are present

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/course-export-builders.test.cjs`  
Expected: FAIL because the builders do not exist yet.

- [ ] **Step 3: Implement the document builders**

Create `shared/course-export-builders.js` with:

- `slugifyHeading(text)`
- `buildCourseMarkdownDocument(payload)`
- `buildCourseHtmlDocument(payload)`
- `buildCourseFilename(title, ext)`

Implementation constraints:

- Markdown stays plain and AI-friendly
- HTML is a fully self-contained single file with embedded CSS only
- HTML uses semantic structure: `nav`, `main`, `section`
- heading IDs are deterministic and reused in both TOC and chapter sections

- [ ] **Step 4: Re-run the builder tests**

Run: `node tests/course-export-builders.test.cjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/course-export-builders.js tests/course-export-builders.test.cjs
git commit -m "feat: add course export document builders"
```

### Task 4: Teach the batch runner to execute `course-export` jobs

**Files:**
- Modify: `batch-runner.js`
- Modify: `batch-runner.html`
- Modify: `popup.js`
- Modify: `shared/course-export-builders.js`

- [ ] **Step 1: Write a failing smoke test for course job metadata**

If `buildMeta()` remains pure enough, move it into a small helper or add a new helper test that locks the new course-job labeling:

```js
test("describes course export jobs without ZIP wording", () => {
  const meta = buildJobMeta({
    type: "course-export",
    chapters: [{}, {}],
    includeImages: true,
    courseTitle: "CLI类AI编程工具速通"
  });

  assert.match(meta, /共 2 章/);
  assert.match(meta, /单文件 Markdown/);
  assert.match(meta, /单文件 HTML/);
});
```

If extracting `buildJobMeta()` is more effort than value, skip the dedicated test and keep this task verified with runtime checks only.

- [ ] **Step 2: Add the new job branch to the runner**

Refactor `batch-runner.js` so `init()` branches on job type:

- `manual` / `wechat-history`: keep current link list loop untouched
- `course-export`: run a new `runCourseExportJob(job)` path

`runCourseExportJob(job)` should:

1. iterate `job.chapters` in order
2. open each chapter URL in a background tab
3. wait for page stability
4. export the page markdown with the existing message API
5. collect successful and failed chapter records
6. build merged Markdown and HTML with `shared/course-export-builders.js`
7. trigger two downloads with `chrome.downloads.download`

- [ ] **Step 3: Preserve existing batch behavior**

Make sure the existing ZIP path is still only used for the old job types. Do not overload `links` and `chapters` into one field. Keep job-shape branching explicit so regressions stay obvious.

- [ ] **Step 4: Update the task page copy**

Adjust `batch-runner.html` or runner status text so a course-export job reads naturally:

- progress counts chapters instead of articles where appropriate
- status messages say `正在处理 3/18 章`
- success message mentions both downloaded files

- [ ] **Step 5: Run static verification**

Run:

- `node --check batch-runner.js`
- `node --check popup.js`

Expected: both exit 0.

- [ ] **Step 6: Manual smoke-check the control flow**

In Chrome:

1. reload the unpacked extension
2. open an SCYS course chapter page
3. open the popup
4. confirm the new button appears without changing the old controls
5. click it and verify the task page opens with chapter-oriented copy

Expected: no runtime errors before the first chapter starts.

- [ ] **Step 7: Commit**

```bash
git add batch-runner.js batch-runner.html popup.js shared/course-export-builders.js
git commit -m "feat: run SCYS course export jobs"
```

### Task 5: Add SCYS runtime support, permissions, and documentation

**Files:**
- Modify: `manifest.json`
- Modify: `README.MD`
- Modify: `content-scripts/feishu-exporter.js`

- [ ] **Step 1: Add the required host permission**

Because the runner creates background tabs and injects the content script outside the active tab, add:

```json
"https://scys.com/*"
```

to `host_permissions` in `manifest.json`.

- [ ] **Step 2: Verify SCYS pages can export as generic web content**

Ensure the content script path used in course-export jobs still reuses the existing generic page exporter for each chapter page. If SCYS chapter pages need extra cleanup selectors, add the minimal site-specific adjustments inside `content-scripts/feishu-exporter.js` without changing Feishu or WeChat branches.

- [ ] **Step 3: Document the new feature**

Update `README.MD` to describe:

- when `导出当前专栏` appears
- what files it downloads
- that the feature currently targets SCYS course chapter pages only
- that old batch features remain unchanged

- [ ] **Step 4: Run final verification**

Run:

- `node tests/export-url-utils.test.cjs`
- `node tests/scys-course-utils.test.cjs`
- `node tests/course-export-builders.test.cjs`
- `node --check popup.js`
- `node --check batch-runner.js`
- `node --check content-scripts/feishu-exporter.js`
- `jq . manifest.json >/dev/null`

Expected: all commands exit 0.

- [ ] **Step 5: End-to-end manual verification**

In Chrome, validate one real SCYS course:

1. open a chapter page that shows the sidebar outline
2. click `导出当前专栏`
3. wait for the task page to finish
4. confirm two downloads occur: one `.md`, one `.html`
5. open the `.html` locally and verify left-nav jumps work
6. open the `.md` in Obsidian or a text editor and verify the merged TOC and chapter order
7. confirm failures, if any, appear in the output footer instead of aborting the whole export

- [ ] **Step 6: Commit**

```bash
git add manifest.json README.MD content-scripts/feishu-exporter.js
git commit -m "feat: add SCYS course export support"
```
