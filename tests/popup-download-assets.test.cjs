const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadDownloadHelpersForTest() {
  const sourcePath = path.join(__dirname, "../popup.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  const start = source.indexOf("function shouldUseDirectoryAssetDownload");
  const end = source.indexOf("function forceStripWechatNoiseTail");

  assert.ok(start >= 0, "download asset helper block not found");
  assert.ok(end > start, "download helper block not found");

  const calls = [];
  const revokedUrls = [];
  const directoryPickerCalls = [];
  const directoryHandle = {};
  const sandbox = {
    Blob,
    Uint8Array,
    includeImagesInput: { checked: true },
    currentExportType: "feishu",
    globalThis: {
      showDirectoryPicker: async (options) => {
        directoryPickerCalls.push(options);
        return directoryHandle;
      }
    },
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    setTimeout: (callback) => {
      callback();
    },
    URL: {
      createObjectURL: (() => {
        let nextId = 1;
        return () => `blob:test-${nextId++}`;
      })(),
      revokeObjectURL: (url) => revokedUrls.push(url)
    },
    downloadWithFallback: async (url, filename, format, saveAs) => {
      calls.push({ url, filename, format, saveAs });
      return { filename };
    }
  };

  vm.runInNewContext(
    [
      source.slice(start, end),
      "this.downloadExportPayload = downloadExportPayload;",
      "this.writeExportPayloadToDirectory = writeExportPayloadToDirectory;",
      "this.pickAssetDownloadDirectory = pickAssetDownloadDirectory;"
    ].join("\n"),
    sandbox,
    { filename: sourcePath }
  );

  return {
    downloadExportPayload: sandbox.downloadExportPayload,
    writeExportPayloadToDirectory: sandbox.writeExportPayloadToDirectory,
    pickAssetDownloadDirectory: sandbox.pickAssetDownloadDirectory,
    calls,
    revokedUrls,
    directoryPickerCalls,
    directoryHandle
  };
}

function createDirectoryHandleForTest() {
  const writes = [];

  function createDirectory(pathParts) {
    return {
      async getDirectoryHandle(name) {
        return createDirectory([...pathParts, name]);
      },
      async getFileHandle(name) {
        const filePath = [...pathParts, name].join("/");
        return {
          async createWritable() {
            return {
              async write(content) {
                writes.push({ path: filePath, content });
              },
              async close() {}
            };
          }
        };
      }
    };
  }

  return { handle: createDirectory([]), writes };
}

(async () => {
  {
    const { pickAssetDownloadDirectory, directoryPickerCalls, directoryHandle } = loadDownloadHelpersForTest();

    const result = await pickAssetDownloadDirectory();

    assert.equal(result, directoryHandle);
    assert.equal(directoryPickerCalls.length, 1);
    assert.equal(directoryPickerCalls[0].id, "feishu-markdown-assets");
    assert.equal(directoryPickerCalls[0].mode, "readwrite");
    assert.equal(directoryPickerCalls[0].startIn, "downloads");
  }

  {
    const { downloadExportPayload, calls, revokedUrls } = loadDownloadHelpersForTest();

    const result = await downloadExportPayload(
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
      "markdown"
    );

    assert.equal(result.filename, "Obsidian + Claude cod...我的 AI 知识库拆解/document.md");
    assert.deepEqual(calls.map((call) => call.filename), [
      "Obsidian + Claude cod...我的 AI 知识库拆解/document.md",
      "Obsidian + Claude cod...我的 AI 知识库拆解/assets/image-001.png"
    ]);
    assert.equal(calls.every((call) => call.saveAs === false), true);
    assert.equal(calls.some((call) => call.filename.endsWith(".zip")), false);
    assert.deepEqual(revokedUrls, ["blob:test-1", "blob:test-2"]);
  }

  {
    const { writeExportPayloadToDirectory, calls } = loadDownloadHelpersForTest();
    const { handle, writes } = createDirectoryHandleForTest();

    const result = await writeExportPayloadToDirectory(
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
      handle
    );

    assert.equal(result.filename, "Obsidian + Claude cod...我的 AI 知识库拆解/document.md");
    assert.deepEqual(writes.map((item) => item.path), [
      "Obsidian + Claude cod...我的 AI 知识库拆解/document.md",
      "Obsidian + Claude cod...我的 AI 知识库拆解/assets/image-001.png"
    ]);
    assert.equal(writes[0].content, "# 文档\n\n![配图](assets/image-001.png)\n");
    assert.deepEqual(Array.from(writes[1].content), [105, 109, 103]);
    assert.equal(calls.length, 0);
  }

  {
    const { downloadExportPayload, calls } = loadDownloadHelpersForTest();

    const result = await downloadExportPayload(
      {
        mimeType: "text/markdown;charset=utf-8",
        content: "# 文档\n"
      },
      "纯文本.md",
      "markdown"
    );

    assert.equal(result.filename, "纯文本.md");
    assert.deepEqual(calls.map((call) => call.filename), ["纯文本.md"]);
    assert.equal(calls[0].saveAs, true);
  }
})();
