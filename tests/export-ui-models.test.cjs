const assert = require("node:assert/strict");
const {
  getPopupCategories,
  resolvePopupCategory,
  normalizeOutputTarget,
  getOutputTargetState,
  buildPrimaryActionModel
} = require("../shared/export-ui-models.js");

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function main() {
  await test("lists popup categories in the expected top-nav order", async () => {
    assert.deepEqual(
      getPopupCategories().map((item) => item.key),
      ["wechat", "feishu", "scys", "other"]
    );
    assert.deepEqual(
      getPopupCategories().map((item) => item.label),
      ["微信公众号", "飞书", "生财有术", "其它"]
    );
  });

  await test("resolves popup category from current page context", async () => {
    assert.equal(
      resolvePopupCategory({
        exportType: "wechat",
        isWechatMpBackend: false,
        isScysCourse: false
      }),
      "wechat"
    );
    assert.equal(
      resolvePopupCategory({
        exportType: "feishu",
        isWechatMpBackend: false,
        isScysCourse: false
      }),
      "feishu"
    );
    assert.equal(
      resolvePopupCategory({
        exportType: "generic-web",
        isWechatMpBackend: false,
        isScysCourse: true
      }),
      "scys"
    );
    assert.equal(
      resolvePopupCategory({
        exportType: "unsupported",
        isWechatMpBackend: true,
        isScysCourse: false
      }),
      "wechat"
    );
    assert.equal(
      resolvePopupCategory({
        exportType: "generic-web",
        isWechatMpBackend: false,
        isScysCourse: false
      }),
      "other"
    );
  });

  await test("normalizes output targets with backward-compatible defaults", async () => {
    assert.equal(normalizeOutputTarget("download"), "download");
    assert.equal(normalizeOutputTarget("both"), "both");
    assert.equal(normalizeOutputTarget("obsidian"), "obsidian");
    assert.equal(normalizeOutputTarget("unexpected"), "download");
    assert.equal(normalizeOutputTarget("", "both"), "both");
  });

  await test("derives output target state flags", async () => {
    assert.deepEqual(getOutputTargetState("download"), {
      key: "download",
      wantsDownload: true,
      wantsObsidian: false,
      label: "仅下载"
    });
    assert.deepEqual(getOutputTargetState("both"), {
      key: "both",
      wantsDownload: true,
      wantsObsidian: true,
      label: "下载 + Obsidian"
    });
    assert.deepEqual(getOutputTargetState("obsidian"), {
      key: "obsidian",
      wantsDownload: false,
      wantsObsidian: true,
      label: "仅 Obsidian"
    });
  });

  await test("builds course-first primary action for SCYS course pages", async () => {
    const model = buildPrimaryActionModel({
      isSupportedPage: true,
      isWechatMpBackend: false,
      canExportCourse: true,
      pageInfo: {
        title: "03 那我们到底应该学什么",
        docType: "生财课程章节",
        supports: ["markdown"]
      }
    });

    assert.equal(model.headline, "当前页已就绪");
    assert.equal(model.primaryAction?.key, "export-course");
    assert.equal(model.primaryAction?.label, "导出当前专栏");
    assert.equal(model.secondaryAction?.key, "export-markdown");
    assert.match(model.summary, /优先导出整个专栏/);
  });

  await test("builds single-page export action for normal document pages", async () => {
    const model = buildPrimaryActionModel({
      isSupportedPage: true,
      isWechatMpBackend: false,
      canExportCourse: false,
      exportType: "generic-web",
      pageInfo: {
        title: "MCP 里有三个角色，你需要知道",
        docType: "当前网页正文",
        supports: ["markdown"]
      }
    });

    assert.equal(model.primaryAction?.key, "export-markdown");
    assert.equal(model.primaryAction?.label, "导出当前网页");
    assert.equal(model.secondaryAction, null);
  });

  await test("routes wechat backend pages to the dedicated wechat workspace", async () => {
    const model = buildPrimaryActionModel({
      isSupportedPage: false,
      isWechatMpBackend: true,
      canExportCourse: false,
      exportType: "unsupported",
      pageInfo: {
        title: "公众号后台",
        docType: "公众号后台",
        supports: []
      }
    });

    assert.equal(model.primaryAction?.key, "focus-wechat-history");
    assert.equal(model.primaryAction?.label, "打开后台模式");
    assert.match(model.summary, /切到“微信公众号”分类/);
  });

  await test("returns a disabled state for unsupported pages", async () => {
    const model = buildPrimaryActionModel({
      isSupportedPage: false,
      isWechatMpBackend: false,
      canExportCourse: false,
      pageInfo: null
    });

    assert.equal(model.primaryAction, null);
    assert.match(model.summary, /请先打开支持导出的页面/);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
