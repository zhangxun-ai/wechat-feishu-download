const assert = require("node:assert/strict");
const {
  classifyExportUrl,
  isSingleExportUrl,
  isBatchExportUrl,
  isScysCourseUrl,
  isScysEmbeddedCourseUrl,
  selectScysCourseFrameTarget
} = require("../shared/export-url-utils.js");
const {
  isScysCourseParsedUrl
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

test("classifies feishu and wechat article urls as dedicated exporters", () => {
  assert.equal(classifyExportUrl("https://foo.feishu.cn/docx/abc123"), "feishu");
  assert.equal(classifyExportUrl("https://mp.weixin.qq.com/s/abc123"), "wechat");
});

test("classifies ordinary https pages as generic web exports", () => {
  assert.equal(classifyExportUrl("https://scys.com/articleDetail/xq_topic/45811224845518518"), "generic-web");
  assert.equal(isSingleExportUrl("https://example.com/blog/post"), true);
});

test("keeps batch scope restricted to current dedicated domains", () => {
  assert.equal(isBatchExportUrl("https://scys.com/articleDetail/xq_topic/45811224845518518"), false);
  assert.equal(isBatchExportUrl("https://mp.weixin.qq.com/s/abc123"), true);
});

test("rejects special pages and mp backend pages for generic export", () => {
  assert.equal(isSingleExportUrl("chrome://extensions"), false);
  assert.equal(isSingleExportUrl("chrome-extension://abc/popup.html"), false);
  assert.equal(isSingleExportUrl("https://mp.weixin.qq.com/cgi-bin/home"), false);
});

test("recognizes scys course chapter pages without widening batch scope", () => {
  assert.equal(isScysCourseUrl("https://scys.com/deepsea/2001/course/164?chapterId=11093"), true);
  assert.equal(isScysCourseUrl("https://scys.com/course/detail/172?chapterId=11403"), true);
  assert.equal(isScysCourseUrl("https://scys.com/activity/10096/course/190?chapterId=13368"), true);
  assert.equal(isScysEmbeddedCourseUrl("https://scys.com/activity/10096/course/190?chapterId=13368"), true);
  assert.equal(isScysCourseParsedUrl(new URL("https://scys.com/course/detail/172?chapterId=11403")), true);
  assert.equal(isScysCourseUrl("https://scys.com/deepsea/2001/course/164"), false);
  assert.equal(isScysCourseUrl("https://scys.com/activity/10096/course/190"), false);
  assert.equal(classifyExportUrl("https://scys.com/deepsea/2001/course/164?chapterId=11093"), "generic-web");
  assert.equal(classifyExportUrl("https://scys.com/activity/10096/course/190?chapterId=13368"), "generic-web");
  assert.equal(isSingleExportUrl("https://scys.com/deepsea/2001/course/164?chapterId=11093"), true);
  assert.equal(isBatchExportUrl("https://scys.com/deepsea/2001/course/164?chapterId=11093"), false);
});

test("selects the embedded scys course frame by course and chapter id", () => {
  const outerUrl = "https://scys.com/activity/10096/course/190?chapterId=13368";
  const target = selectScysCourseFrameTarget([
    { frameId: 0, result: outerUrl },
    {
      frameId: 7,
      result: "https://scys.com/course/detail/190?activity_id=10096&activity_embed=1&chapterId=13344"
    },
    {
      frameId: 9,
      result: "https://scys.com/course/detail/190?activity_id=10096&activity_embed=1&chapterId=13368"
    },
    {
      frameId: 11,
      result: "https://scys.com/course/detail/191?activity_id=10096&activity_embed=1&chapterId=13368"
    }
  ], outerUrl);

  assert.deepEqual(target, {
    frameId: 9,
    url: "https://scys.com/course/detail/190?activity_id=10096&activity_embed=1&chapterId=13368"
  });
});

test("does not fall back to an unrelated frame for an embedded scys course", () => {
  const outerUrl = "https://scys.com/activity/10096/course/190?chapterId=13368";
  assert.equal(selectScysCourseFrameTarget([
    { frameId: 0, result: outerUrl },
    { frameId: 5, result: "https://scys.com/course/detail/190?chapterId=99999" },
    { frameId: 6, result: "https://example.com/course/detail/190?chapterId=13368" }
  ], outerUrl), null);
});
