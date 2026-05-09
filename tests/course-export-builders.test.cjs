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
  assert.match(markdown, /\[前言\]\(#chapter-1-/);
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
  assert.match(html, /href="#chapter-1-/);
  assert.match(html, /<section id="chapter-1-/);
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

test("builds grouped course navigation with unique anchors for duplicate titles", () => {
  const markdown = buildCourseMarkdownDocument({
    title: "生财有术",
    sourceUrl: "https://scys.com/deepsea/2001/course/164?chapterId=10919",
    exportedAt: "2026-04-20T00:00:00.000Z",
    chapters: [
      {
        order: 1,
        title: "事务性邮件（Transactional Email）",
        sectionTitle: "十九、邮件服务：想让产品主动联系用户，怎么办？",
        url: "https://example.com/10919",
        markdown: "- 注册成功后的欢迎邮件"
      },
      {
        order: 2,
        title: "要点回顾",
        sectionTitle: "十九、邮件服务：想让产品主动联系用户，怎么办？",
        url: "https://example.com/10927",
        markdown: "1. 选 Resend。"
      },
      {
        order: 3,
        title: "要点回顾",
        sectionTitle: "二十、定时任务：你睡了，产品还能自己干活",
        url: "https://example.com/10937",
        markdown: "1. 理解定时任务。"
      }
    ],
    failedChapters: []
  });

  assert.match(markdown, /- 十九、邮件服务：想让产品主动联系用户，怎么办？/);
  assert.match(markdown, /- 二十、定时任务：你睡了，产品还能自己干活/);
  assert.match(markdown, /### 事务性邮件（Transactional Email）/);
  assert.match(markdown, /### 要点回顾/);
  assert.match(markdown, /\(#chapter-2-/);
  assert.match(markdown, /\(#chapter-3-/);
});

test("builds grouped html nav with unique ids for duplicate titles", () => {
  const html = buildCourseHtmlDocument({
    title: "生财有术",
    sourceUrl: "https://scys.com/deepsea/2001/course/164?chapterId=10919",
    exportedAt: "2026-04-20T00:00:00.000Z",
    chapters: [
      {
        order: 1,
        title: "要点回顾",
        sectionTitle: "十九、邮件服务：想让产品主动联系用户，怎么办？",
        url: "https://example.com/10927",
        markdown: "1. 选 Resend。"
      },
      {
        order: 2,
        title: "要点回顾",
        sectionTitle: "二十、定时任务：你睡了，产品还能自己干活",
        url: "https://example.com/10937",
        markdown: "1. 理解定时任务。"
      }
    ],
    failedChapters: []
  });

  assert.match(html, /十九、邮件服务：想让产品主动联系用户，怎么办？/);
  assert.match(html, /二十、定时任务：你睡了，产品还能自己干活/);
  assert.match(html, /href="#chapter-1-/);
  assert.match(html, /href="#chapter-2-/);
  assert.match(html, /section id="chapter-1-/);
  assert.match(html, /section id="chapter-2-/);
});

test("renders course html body with tables media links and code blocks", () => {
  const html = buildCourseHtmlDocument({
    title: "生财有术",
    sourceUrl: "https://scys.com/course/detail/172?chapterId=11404",
    exportedAt: "2026-05-09T00:00:00.000Z",
    chapters: [
      {
        order: 1,
        title: "02. AI 能力系统概览",
        url: "https://scys.com/course/detail/172?chapterId=11404",
        markdown: [
          "#### 0. 本章概要",
          "",
          "| 能力 | 工具 |",
          "| --- | --- |",
          "| 思考能力 | **[Claude](https://claude.ai/)** 和 `code` |",
          "",
          "![示例图](https://example.com/image.png)",
          "",
          "[媒体链接](https://example.com/video.mp4)",
          "",
          "1. <u>第一步</u>",
          "",
          "> 引用内容",
          "",
          "```",
          "const answer = 42;",
          "```"
        ].join("\n")
      }
    ],
    failedChapters: []
  });

  assert.match(html, /<h4>0\. 本章概要<\/h4>/);
  assert.match(html, /<table>/);
  assert.match(html, /<th>能力<\/th>/);
  assert.match(html, /<td>思考能力<\/td>/);
  assert.match(html, /<strong><a href="https:\/\/claude\.ai\/" target="_blank" rel="noreferrer">Claude<\/a><\/strong> 和 <code>code<\/code>/);
  assert.match(html, /<img src="https:\/\/example\.com\/image\.png" alt="示例图">/);
  assert.match(html, /<a href="https:\/\/example\.com\/video\.mp4" target="_blank" rel="noreferrer">媒体链接<\/a>/);
  assert.match(html, /<ol><li><u>第一步<\/u><\/li><\/ol>/);
  assert.match(html, /<blockquote>引用内容<\/blockquote>/);
  assert.match(html, /<pre><code>const answer = 42;<\/code><\/pre>/);
});
