const assert = require("node:assert/strict");
const {
  buildCourseMarkdownDocument,
  buildCourseHtmlDocument
} = require("../shared/course-export-builders.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

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

test("builds a standalone html reader with nav links and failure panel", () => {
  const html = buildCourseHtmlDocument({
    title: "CLI类AI编程工具速通",
    sourceUrl: "https://scys.com/deepsea/2001/course/164?chapterId=11093",
    exportedAt: "2026-04-20T00:00:00.000Z",
    chapters: [
      { order: 1, title: "前言", url: "https://example.com/1", markdown: "第一章正文" },
      { order: 2, title: "MCP", url: "https://example.com/2", markdown: "第二章正文" }
    ],
    failedChapters: [{ title: "Claude Code", url: "https://example.com/3", message: "未提取到正文" }]
  });

  assert.match(html, /<nav[\s>]/);
  assert.match(html, /href="#前言"/);
  assert.match(html, /<section id="前言"/);
  assert.match(html, /失败章节/);
});
