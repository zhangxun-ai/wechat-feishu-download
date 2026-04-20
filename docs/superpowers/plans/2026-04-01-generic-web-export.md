# Generic Web Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single-page Markdown export for the currently open generic web page while keeping Feishu and WeChat export behavior intact.

**Architecture:** Keep domain-specific exporters for Feishu and WeChat. Route other ordinary `http/https` pages through a lightweight generic extractor inside the existing content script, and keep batch download restricted to the current supported domains.

**Tech Stack:** Chrome Extension MV3, vanilla JavaScript, content scripts, Node-based smoke tests

---

### Task 1: Lock URL-scope behavior

**Files:**
- Create: `tests/export-url-utils.test.cjs`
- Create: `shared/export-url-utils.js`
- Modify: `popup.html`
- Modify: `popup.js`
- Modify: `batch-runner.html`
- Modify: `batch-runner.js`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run the test to verify it fails**
- [ ] **Step 3: Add shared URL classification helpers**
- [ ] **Step 4: Update popup and batch runner to use the helpers**
- [ ] **Step 5: Run the test to verify it passes**

### Task 2: Add generic web single-page export

**Files:**
- Modify: `manifest.json`
- Modify: `content-scripts/feishu-exporter.js`
- Modify: `popup.html`
- Modify: `popup.js`

- [ ] **Step 1: Add a generic web export branch to page detection**
- [ ] **Step 2: Implement generic article root selection and noise cleanup**
- [ ] **Step 3: Wire the popup copy and runtime behavior to the new scope**
- [ ] **Step 4: Run static verification on changed scripts**
