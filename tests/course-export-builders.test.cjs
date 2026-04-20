const assert = require("node:assert/strict");
const {
  buildCourseMarkdownDocument,
  buildCourseHtmlDocument,
  extractCourseChapterMarkdown,
  getCourseChapterMarkdownError
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

test("extracts body from wrapped single-page markdown before merge", () => {
  const wrappedMarkdown = [
    "# 生财有术",
    "",
    "- 页面类型: 网页文章",
    "- 来源: https://scys.com/deepsea/2001/course/164?chapterId=10899",
    "- 导出时间: 4/20/2026, 8:00:00 PM",
    "",
    "---",
    "",
    "6. 看看效果",
    "",
    "做完上面六步，试一下：",
    "",
    "1. 让纸片人男友生成一张图片。"
  ].join("\n");

  assert.equal(
    extractCourseChapterMarkdown(wrappedMarkdown),
    [
      "6. 看看效果",
      "",
      "做完上面六步，试一下：",
      "",
      "1. 让纸片人男友生成一张图片。"
    ].join("\n")
  );
});

test("marks scys markdown with load-more noise as invalid", () => {
  const wrappedMarkdown = [
    "# 生财有术",
    "",
    "- 页面类型: 网页文章",
    "- 来源: https://scys.com/deepsea/2001/course/164?chapterId=10899",
    "- 导出时间: 4/20/2026, 8:00:00 PM",
    "",
    "---",
    "",
    "向上滚动加载更多内容",
    "",
    "6. 看看效果",
    "",
    "继续滚动加载更多内容"
  ].join("\n");

  assert.equal(
    getCourseChapterMarkdownError(wrappedMarkdown, "https://scys.com/deepsea/2001/course/164?chapterId=10899"),
    "章节正文仍包含页面加载噪音"
  );
});
