const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadExporterForTest(fetchImpl) {
  const sourcePath = path.join(__dirname, "../content-scripts/feishu-exporter.js");
  const source = fs.readFileSync(sourcePath, "utf8").replace(
    "convertBlock,\n        getGenericWebMeta",
    "convertBlock,\n        getGenericWebMeta,\n        convertClientVarsToMarkdown"
  );
  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    setTimeout,
    clearTimeout,
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    Blob,
    FileReader: class {
      readAsDataURL() {}
    },
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    Element: class {},
    window: {
      getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" })
    },
    location: {
      href: "https://example.feishu.cn/wiki/wikiToken",
      hostname: "example.feishu.cn",
      pathname: "/wiki/wikiToken",
      protocol: "https:",
      origin: "https://example.feishu.cn"
    },
    document: {
      scripts: [],
      title: "测试文档",
      querySelector: () => null,
      querySelectorAll: () => []
    },
    chrome: {
      runtime: {
        onMessage: { addListener() {} }
      }
    },
    fetch: fetchImpl,
    globalThis: {}
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: sourcePath });
  return sandbox.module.exports.__test;
}

function buildClientVarsWithImage() {
  return {
    data: {
      block_map: {
        docToken: {
          data: {
            children: ["imageBlock"]
          }
        },
        imageBlock: {
          data: {
            type: "image",
            image: {
              token: "imageToken",
              name: "配图"
            }
          }
        }
      }
    }
  };
}

async function assertSettlesWithin(promise, timeoutMs) {
  const timeout = new Promise((resolve) => setTimeout(() => resolve("timeout"), timeoutMs));
  const result = await Promise.race([promise, timeout]);
  assert.notEqual(result, "timeout");
  return result;
}

(async () => {
  let fetchCalls = 0;
  const exporter = loadExporterForTest(async () => {
    fetchCalls += 1;
    return {
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" })
    };
  });
  const assets = [];

  const markdown = await assertSettlesWithin(
    exporter.convertClientVarsToMarkdown(
      {
        exportToken: "docToken",
        pageTitle: "测试文档",
        title: "测试文档"
      },
      buildClientVarsWithImage(),
      {
        includeImages: true,
        localImageAssets: true,
        imageFetchTimeoutMs: 20,
        assets
      }
    ),
    100
  );

  assert.equal(fetchCalls, 1);
  assert.doesNotMatch(markdown, /data:image\//);
  assert.doesNotMatch(markdown, /internal-api-drive-stream\.feishu\.cn/);
  assert.match(markdown, /!\[配图]\(assets\/image-001\.png\)/);
  assert.deepEqual(JSON.parse(JSON.stringify(assets)), [
    {
      path: "assets/image-001.png",
      mimeType: "image/png",
      contentBase64: "aW1hZ2UtYnl0ZXM="
    }
  ]);
})();
