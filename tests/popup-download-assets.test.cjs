const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadDownloadHelpersForTest() {
  const sourcePath = path.join(__dirname, "../popup.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  const start = source.indexOf("async function downloadExportPayload");
  const end = source.indexOf("function forceStripWechatNoiseTail");

  assert.ok(start >= 0, "downloadExportPayload not found");
  assert.ok(end > start, "download helper block not found");

  const calls = [];
  const anchorDownloads = [];
  const objectUrls = new Map();
  const revokedUrls = [];
  const sandbox = {
    Blob,
    Uint8Array,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    setTimeout: (callback) => {
      callback();
    },
    URL: {
      createObjectURL: (() => {
        let nextId = 1;
        return (value) => {
          const url = `blob:test-${nextId++}`;
          objectUrls.set(url, value);
          return url;
        };
      })(),
      revokeObjectURL: (url) => revokedUrls.push(url)
    },
    document: {
      body: {
        appendChild: () => {}
      },
      createElement: () => {
        const link = {
          href: "",
          download: "",
          rel: "",
          style: {},
          click: () => anchorDownloads.push({ href: link.href, download: link.download }),
          remove: () => {}
        };
        return link;
      }
    },
    downloadWithFallback: async (url, filename, format, saveAs) => {
      calls.push({ url, filename, format, saveAs });
      return { filename };
    }
  };

  vm.runInNewContext(
    `${source.slice(start, end)}\nthis.downloadExportPayload = downloadExportPayload;\nthis.downloadSelfContainedMarkdownPayload = downloadSelfContainedMarkdownPayload;`,
    sandbox,
    { filename: sourcePath }
  );

  return {
    downloadExportPayload: sandbox.downloadExportPayload,
    downloadSelfContainedMarkdownPayload: sandbox.downloadSelfContainedMarkdownPayload,
    calls,
    anchorDownloads,
    objectUrls,
    revokedUrls
  };
}

(async () => {
  {
    const { downloadSelfContainedMarkdownPayload, calls, anchorDownloads, objectUrls, revokedUrls } = loadDownloadHelpersForTest();

    const result = await downloadSelfContainedMarkdownPayload(
      {
        mimeType: "text/markdown;charset=utf-8",
        content: "# 文档\n\n![配图](assets/image-001.png)\n",
        assets: [
          {
            path: "assets/image-001.png",
            mimeType: "image/png",
            contentBase64: "aW1n"
          }
        ]
      },
      "Obsidian + Claude cod...我的 AI 知识库拆解.md",
    );

    assert.equal(result.filename, "Obsidian + Claude cod...我的 AI 知识库拆解.md");
    assert.equal(result.started, true);
    assert.deepEqual(calls, []);
    assert.deepEqual(anchorDownloads, [
      { href: "blob:test-1", download: "Obsidian + Claude cod...我的 AI 知识库拆解.md" }
    ]);
    const markdownText = await objectUrls.get("blob:test-1").text();
    assert.match(markdownText, /# 文档/);
    assert.match(markdownText, /!\[配图]\(data:image\/png;base64,aW1n\)/);
    assert.doesNotMatch(markdownText, /assets\/image-001\.png/);
    assert.deepEqual(revokedUrls, ["blob:test-1"]);
  }

  {
    const { downloadExportPayload, calls, anchorDownloads, revokedUrls } = loadDownloadHelpersForTest();

    const result = await downloadExportPayload(
      {
        mimeType: "text/markdown;charset=utf-8",
        content: "# 文档\n"
      },
      "纯文本.md",
      "markdown"
    );

    assert.equal(result.filename, "纯文本.md");
    assert.equal(result.started, true);
    assert.deepEqual(calls, []);
    assert.deepEqual(anchorDownloads, [{ href: "blob:test-1", download: "纯文本.md" }]);
    assert.deepEqual(revokedUrls, ["blob:test-1"]);
  }

})();
