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

function buildClientVarsWithImage(count = 1) {
  const blockMap = {
    docToken: {
      data: {
        children: Array.from({ length: count }, (_, index) => `imageBlock${index + 1}`)
      }
    }
  };

  for (let index = 1; index <= count; index += 1) {
    blockMap[`imageBlock${index}`] = {
      data: {
        type: "image",
        image: {
          token: `imageToken${index}`,
          name: count === 1 ? "配图" : `配图${index}`
        }
      }
    };
  }

  return {
    data: {
      block_map: blockMap
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

  {
    let linkedFetchCalls = 0;
    const linkedExporter = loadExporterForTest(async () => {
      linkedFetchCalls += 1;
      return new Promise(() => {});
    });

    const linkedMarkdown = await assertSettlesWithin(
      linkedExporter.convertClientVarsToMarkdown(
        {
          exportToken: "docToken",
          pageTitle: "测试文档",
          title: "测试文档"
        },
        buildClientVarsWithImage(3),
        {
          includeImages: true,
          localImageAssets: false,
          assets: []
        }
      ),
      20
    );

    assert.equal(linkedFetchCalls, 0);
    assert.match(linkedMarkdown, /!\[配图1]\(https:\/\/internal-api-drive-stream\.feishu\.cn/);
    assert.match(linkedMarkdown, /!\[配图2]\(https:\/\/internal-api-drive-stream\.feishu\.cn/);
    assert.match(linkedMarkdown, /!\[配图3]\(https:\/\/internal-api-drive-stream\.feishu\.cn/);
  }

  {
    let hangingFetchCalls = 0;
    const hangingExporter = loadExporterForTest(async () => {
      hangingFetchCalls += 1;
      return new Promise(() => {});
    });
    const hangingAssets = [];

    const timedOutMarkdown = await assertSettlesWithin(
      hangingExporter.convertClientVarsToMarkdown(
        {
          exportToken: "docToken",
          pageTitle: "测试文档",
          title: "测试文档"
        },
        buildClientVarsWithImage(3),
        {
          includeImages: true,
          localImageAssets: true,
          imageFetchTimeoutMs: 20,
          assets: hangingAssets
        }
      ),
      45
    );

    assert.equal(hangingFetchCalls, 3);
    assert.deepEqual(hangingAssets, []);
    assert.match(timedOutMarkdown, /!\[配图1]\(https:\/\/internal-api-drive-stream\.feishu\.cn/);
    assert.match(timedOutMarkdown, /!\[配图2]\(https:\/\/internal-api-drive-stream\.feishu\.cn/);
    assert.match(timedOutMarkdown, /!\[配图3]\(https:\/\/internal-api-drive-stream\.feishu\.cn/);
  }
})();
