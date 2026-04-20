const assert = require("node:assert/strict");
const {
  stripWechatUiNoiseFromMarkdown,
  maybeStripWechatUiNoiseFromMarkdown
} = require("../wechat-markdown-cleanup.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("removes trailing wechat reward and like noise", () => {
  const input = [
    "AI 时代，小团队干掉大公司，不是鸡汤，是数学。",
    "",
    "3个人的团队，审批层数是零，想法到上线 1 天。",
    "",
    "刘小排",
    "",
    "我也喜欢你哦 (⑉• •⑉)‥♡",
    "",
    "微信扫一扫赞赏作者Like the Author",
    "",
    "Close",
    "",
    "5人喜欢",
    "",
    "Loading...",
    "",
    "Name cleared",
    "",
    "赞赏后展示我的头像",
    "",
    "作品",
    "",
    "暂无作品",
    "",
    "Back",
    "",
    "赞赏金额",
    "",
    "¥",
    "",
    "最低赞赏 ¥0",
    "",
    "1 2 3 4 5 6 7 8 9 0 .",
    "",
    "北京,2026年3月18日 15:16"
  ].join("\n");

  const output = stripWechatUiNoiseFromMarkdown(input);

  assert.equal(output, [
    "AI 时代，小团队干掉大公司，不是鸡汤，是数学。",
    "",
    "3个人的团队，审批层数是零，想法到上线 1 天。"
  ].join("\n"));
});

test("keeps ordinary article ending", () => {
  const input = [
    "结论很简单：审批层数越少，反馈闭环越短。",
    "",
    "北京不是这里的地点标签，而是案例的一部分。",
    "",
    "2026年我们继续验证这个判断。"
  ].join("\n");

  const output = stripWechatUiNoiseFromMarkdown(input);

  assert.equal(output, input);
});

test("removes concatenated author reward text blocks", () => {
  const input = [
    "正文最后一段",
    "",
    "Close",
    "",
    "Name cleared",
    "",
    "微信扫一扫赞赏作者",
    "",
    "Like the AuthorOther Amount",
    "",
    "赞赏后展示我的头像",
    "",
    "作品",
    "",
    "暂无作品",
    "",
    "Back",
    "",
    "Other Amount"
  ].join("\n");

  const output = stripWechatUiNoiseFromMarkdown(input);

  assert.equal(output, "正文最后一段");
});

test("removes reward noise when other amount is rendered as a markdown link", () => {
  const input = [
    "正文最后一段",
    "",
    "Close",
    "",
    "Name cleared",
    "",
    "微信扫一扫赞赏作者",
    "",
    "Like the Author[Other Amount](https://example.com/reward)",
    "",
    "赞赏后展示我的头像",
    "",
    "作品",
    "",
    "暂无作品",
    "",
    "Back",
    "",
    "[Other Amount](https://example.com/reward)"
  ].join("\n");

  const output = stripWechatUiNoiseFromMarkdown(input);

  assert.equal(output, "正文最后一段");
});

test("auto-detects and cleans full wechat markdown documents", () => {
  const input = [
    "# 每多一个人，速度慢10倍",
    "",
    "- 页面类型: 公众号文章",
    "- 来源: https://mp.weixin.qq.com/s/oK1HExfy4uBev693xg1i9A",
    "- 发布时间: 2026年3月18日 15:16",
    "- 导出时间: 3/31/2026, 3:58:15 PM",
    "",
    "---",
    "",
    "正文最后一段",
    "",
    "Close",
    "",
    "Name cleared",
    "",
    "微信扫一扫赞赏作者",
    "",
    "Like the AuthorOther Amount",
    "",
    "赞赏后展示我的头像",
    "",
    "作品",
    "",
    "暂无作品",
    "",
    "Back",
    "",
    "Other Amount"
  ].join("\n");

  const output = maybeStripWechatUiNoiseFromMarkdown(input);

  assert.equal(output, [
    "# 每多一个人，速度慢10倍",
    "",
    "- 页面类型: 公众号文章",
    "- 来源: https://mp.weixin.qq.com/s/oK1HExfy4uBev693xg1i9A",
    "- 发布时间: 2026年3月18日 15:16",
    "- 导出时间: 3/31/2026, 3:58:15 PM",
    "",
    "---",
    "",
    "正文最后一段"
  ].join("\n"));
});
