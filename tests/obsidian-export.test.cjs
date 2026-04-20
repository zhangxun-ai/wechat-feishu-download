const assert = require("node:assert/strict");
const {
  buildObsidianNoteFile,
  buildObsidianCourseBundle
} = require("../shared/obsidian-export.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("builds a single-note obsidian file with frontmatter and stable path", () => {
  const note = buildObsidianNoteFile({
    title: "MCP 里有三个角色，你需要知道",
    sourceUrl: "https://scys.com/deepsea/2001/course/164?chapterId=11098",
    exportedAt: "2026-04-21T08:00:00.000Z",
    markdown: "第一段\n\n第二段"
  });

  assert.equal(note.path, "文档本地导出/单篇文档/2026-04-21/MCP 里有三个角色，你需要知道.md");
  assert.match(note.content, /^---\ntitle: "?MCP 里有三个角色，你需要知道"?/m);
  assert.match(note.content, /source: https:\/\/scys\.com\/deepsea\/2001\/course\/164\?chapterId=11098/);
  assert.match(note.content, /\n# MCP 里有三个角色，你需要知道\n/);
});

test("builds a grouped obsidian course bundle with index and chapter notes", () => {
  const bundle = buildObsidianCourseBundle({
    title: "生财有术",
    sourceUrl: "https://scys.com/deepsea/2001/course/164?chapterId=10899",
    exportedAt: "2026-04-21T08:00:00.000Z",
    chapters: [
      {
        order: 1,
        chapterId: "10899",
        title: "前言",
        sectionTitle: "一、开篇",
        url: "https://scys.com/deepsea/2001/course/164?chapterId=10899",
        markdown: "欢迎开始。"
      },
      {
        order: 2,
        chapterId: "10900",
        title: "要点回顾",
        sectionTitle: "一、开篇",
        url: "https://scys.com/deepsea/2001/course/164?chapterId=10900",
        markdown: "1. 第一条"
      },
      {
        order: 3,
        chapterId: "10937",
        title: "要点回顾",
        sectionTitle: "二、进阶",
        url: "https://scys.com/deepsea/2001/course/164?chapterId=10937",
        markdown: "1. 第二条"
      }
    ],
    failedChapters: [{ title: "作业", url: "https://example.com/4", message: "未提取到正文" }]
  });

  assert.equal(bundle.folderPath, "文档本地导出/课程专栏/生财有术");
  assert.equal(bundle.indexPath, "文档本地导出/课程专栏/生财有术/index.md");
  assert.equal(bundle.files.length, 4);
  assert.equal(bundle.files[1].path, "文档本地导出/课程专栏/生财有术/chapters/001-前言.md");
  assert.equal(bundle.files[2].path, "文档本地导出/课程专栏/生财有术/chapters/002-要点回顾.md");
  assert.equal(bundle.files[3].path, "文档本地导出/课程专栏/生财有术/chapters/003-要点回顾.md");
  assert.match(bundle.files[0].content, /\[\[chapters\/001-前言\|前言\]\]/);
  assert.match(bundle.files[0].content, /\[\[chapters\/003-要点回顾\|要点回顾\]\]/);
  assert.match(bundle.files[0].content, /## 失败章节/);
  assert.match(bundle.files[3].content, /chapter_id: "10937"/);
});
