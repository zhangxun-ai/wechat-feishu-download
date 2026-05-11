const assert = require("node:assert/strict");

class FakeElement {
  constructor(tagName, textContent = "", attrs = {}) {
    this.nodeType = Node.ELEMENT_NODE;
    this.tagName = tagName.toUpperCase();
    this.textContent = textContent;
    this.attrs = attrs;
  }

  getAttribute(name) {
    return this.attrs[name] || "";
  }
}

global.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
global.Element = FakeElement;
global.window = {
  getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" })
};
global.location = { href: "https://scys.com/articleDetail/xq_topic/123" };

const articleTitle = new FakeElement(
  "h1",
  "一次性解决出海网络问题（野卡方案失效，订阅支付方案请看主页学习交流）"
);
const siteTitle = new FakeElement("meta", "", { content: "生财有术" });

global.document = {
  title: "生财有术",
  querySelector(selector) {
    if (selector === 'meta[property="og:title"]') {
      return siteTitle;
    }
    return null;
  },
  querySelectorAll(selector) {
    if (selector === "h1") {
      return [articleTitle];
    }
    return [];
  }
};
global.chrome = {
  runtime: {
    onMessage: {
      addListener() {}
    }
  }
};

const exporter = require("../content-scripts/feishu-exporter.js");

assert.equal(
  exporter.__test.getGenericWebMeta().title,
  "一次性解决出海网络问题（野卡方案失效，订阅支付方案请看主页学习交流）"
);
