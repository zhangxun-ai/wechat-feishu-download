const assert = require("node:assert/strict");
const {
  buildScysChapterUrl,
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
