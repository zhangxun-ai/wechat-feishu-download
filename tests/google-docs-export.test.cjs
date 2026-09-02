const assert = require("node:assert/strict");

global.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

class FakeElement {
  constructor(textContent, tagName = "DIV", childNodes = null) {
    this.nodeType = Node.ELEMENT_NODE;
    this.tagName = tagName;
    this.textContent = textContent;
    this.innerHTML = `<p>${textContent}</p>`;
    this.childNodes = childNodes || [{ nodeType: Node.TEXT_NODE, textContent }];
    this.children = this.childNodes.filter((node) => node.nodeType === Node.ELEMENT_NODE);
    this.classList = { contains: () => false };
    this.hidden = false;
  }

  cloneNode() {
    return new FakeElement(
      this.textContent,
      this.tagName,
      this.childNodes.map((node) => node.nodeType === Node.ELEMENT_NODE
        ? node.cloneNode(true)
        : { ...node })
    );
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  matches() {
    return false;
  }

  getAttribute() {
    return null;
  }
}

global.Element = FakeElement;
global.window = {
  getComputedStyle: () => ({
    display: "block",
    visibility: "visible",
    opacity: "1",
    fontSize: "16px",
    fontWeight: "400"
  })
};
global.location = {
  href: "https://docs.google.com/document/d/10RFLy_d8oXwWGI9DcW-Reg01INZb6Q-3ts08K3r9Lh8/edit?tab=t.0#heading=h.example",
  hostname: "docs.google.com",
  pathname: "/document/d/10RFLy_d8oXwWGI9DcW-Reg01INZb6Q-3ts08K3r9Lh8/edit",
  protocol: "https:",
  origin: "https://docs.google.com"
};
global.document = {
  title: "文明上网方案技术交流 - Google 文档",
  scripts: [],
  querySelector(selector) {
    if (selector === '[aria-label="重命名"]') {
      return { value: "文明上网方案技术交流", textContent: "文明上网方案技术交流" };
    }
    return null;
  },
  querySelectorAll: () => []
};
global.chrome = {
  runtime: {
    onMessage: {
      addListener() {}
    }
  }
};

let requestedExportUrl = "";
let requestedFetchOptions = null;
global.fetch = async (url, options) => {
  requestedExportUrl = String(url);
  requestedFetchOptions = options;
  return {
    ok: true,
    status: 200,
    url: "https://doc-00-00-docstext.googleusercontent.com/export/example",
    headers: {
      get: (name) => name === "content-type" ? "text/html; charset=utf-8" : null
    },
    text: async () => "<html><body class=\"doc-content\">正文</body></html>"
  };
};

global.DOMParser = class {
  parseFromString() {
    const root = new FakeElement(
      "一、全局总览正文实际内容",
      "BODY",
      [
        new FakeElement("一、全局总览", "P"),
        new FakeElement("正文实际内容", "P")
      ]
    );
    return {
      body: root,
      querySelector: () => root
    };
  }
};

const exporter = require("../content-scripts/feishu-exporter.js").__test;

assert.equal(exporter.isGoogleDocsPage(), true);
assert.deepEqual(exporter.getGoogleDocsMeta(), {
  pageType: "Google 文档",
  exportType: "google-docs",
  title: "文明上网方案技术交流",
  author: "",
  publishTime: ""
});
assert.equal(
  exporter.buildGoogleDocsExportUrl(location.href),
  "https://docs.google.com/document/d/10RFLy_d8oXwWGI9DcW-Reg01INZb6Q-3ts08K3r9Lh8/export?format=html&tab=t.0"
);

(async () => {
  const payload = await exporter.exportGoogleDocsDocument("markdown", { includeImages: false });
  assert.equal(requestedExportUrl, exporter.buildGoogleDocsExportUrl(location.href));
  assert.equal(requestedFetchOptions.credentials, "same-origin");
  assert.equal(requestedFetchOptions.redirect, "follow");
  assert.equal(payload.filename, "文明上网方案技术交流.md");
  assert.match(payload.content, /一、全局总览\n\n正文实际内容/);
  assert.doesNotMatch(payload.content, /匹配文档格式|正在加载/);
  console.log("PASS exports Google Docs from the native HTML endpoint instead of the canvas editor DOM");

  const fallbackUrls = [];
  global.DOMParser = class {
    parseFromString() {
      throw new TypeError("TrustedHTML required");
    }
  };
  global.fetch = async (url) => {
    fallbackUrls.push(String(url));
    const isPlainText = String(url).includes("format=txt");
    return {
      ok: true,
      status: 200,
      url: "https://doc-00-00-docstext.googleusercontent.com/export/example",
      headers: {
        get: (name) => name === "content-type"
          ? (isPlainText ? "text/plain; charset=utf-8" : "text/html; charset=utf-8")
          : null
      },
      text: async () => isPlainText
        ? "\uFEFF第一段\f第二段"
        : "<html><body class=\"doc-content\">正文</body></html>"
    };
  };

  const fallbackPayload = await exporter.exportGoogleDocsDocument("markdown", { includeImages: true });
  assert.equal(fallbackUrls.length, 2);
  assert.match(fallbackUrls[0], /format=html/);
  assert.match(fallbackUrls[1], /format=txt/);
  assert.match(fallbackPayload.content, /已自动使用纯文本正文/);
  assert.match(fallbackPayload.content, /第一段\n\n第二段/);
  console.log("PASS falls back to native plain text when Google blocks HTML parsing");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
