const assert = require("node:assert/strict");
const {
  buildScysChapterUrl,
  flattenScysCourseApiChapters,
  normalizeScysCourseEntries
} = require("../shared/scys-course-utils.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("normalizes raw scys course entries into ordered chapters", () => {
  const baseUrl = "https://scys.com/deepsea/2001/course/164?chapterId=11093";
  const result = normalizeScysCourseEntries([
    { title: "前言", chapterId: "11093", sectionTitle: "十二、数据库进阶", sectionId: "10837", sectionOrder: 1 },
    { title: "分组标题", chapterId: "" },
    { title: "MCP 里有三个角色，你需要知道", chapterId: "11098", sectionTitle: "十三、MCP", sectionId: "10850", sectionOrder: 2 }
  ], baseUrl);

  assert.deepEqual(result, [
    {
      order: 1,
      title: "前言",
      chapterId: "11093",
      url: buildScysChapterUrl(baseUrl, "11093"),
      sectionTitle: "十二、数据库进阶",
      sectionId: "10837",
      sectionOrder: 1
    },
    {
      order: 2,
      title: "MCP 里有三个角色，你需要知道",
      chapterId: "11098",
      url: buildScysChapterUrl(baseUrl, "11098"),
      sectionTitle: "十三、MCP",
      sectionId: "10850",
      sectionOrder: 2
    }
  ]);
});

test("flattens scys course api chapters into leaf chapter entries", () => {
  const result = flattenScysCourseApiChapters({
    data: {
      chapters: [
        {
          id: 100,
          title: "一、认知",
          children: [
            { id: 11403, title: "01. AI 时代，普通人怎么用好 AI" },
            { id: 11404, name: "02. AI 能力系统概览" }
          ]
        }
      ]
    }
  });

  assert.deepEqual(result, [
    {
      chapterId: "11403",
      title: "01. AI 时代，普通人怎么用好 AI",
      sectionTitle: "一、认知",
      sectionId: "100",
      sectionOrder: 1
    },
    {
      chapterId: "11404",
      title: "02. AI 能力系统概览",
      sectionTitle: "一、认知",
      sectionId: "100",
      sectionOrder: 1
    }
  ]);
});
