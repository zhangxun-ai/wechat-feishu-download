const assert = require("node:assert/strict");
const {
  classifyExportUrl,
  isSingleExportUrl,
  isBatchExportUrl,
  isScysCourseUrl
} = require("../shared/export-url-utils.js");

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
  assert.equal(isScysCourseUrl("https://scys.com/deepsea/2001/course/164"), false);
  assert.equal(classifyExportUrl("https://scys.com/deepsea/2001/course/164?chapterId=11093"), "generic-web");
  assert.equal(isSingleExportUrl("https://scys.com/deepsea/2001/course/164?chapterId=11093"), true);
  assert.equal(isBatchExportUrl("https://scys.com/deepsea/2001/course/164?chapterId=11093"), false);
});
