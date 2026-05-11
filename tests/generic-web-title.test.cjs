const assert = require("node:assert/strict");

class FakeElement {
  constructor(tagName, textContent = "", attrs = {}) {
    this.nodeType = Node.ELEMENT_NODE;
    this.tagName = tagName.toUpperCase();
    this.textContent = textContent;
    this.attrs = attrs;
    this.className = attrs.class || "";
    this.id = attrs.id || "";
  }

  getAttribute(name) {
    return this.attrs[name] || "";
  }

  matches(selector) {
    const value = selector.trim();
    if (value === "h1") {
      return this.tagName === "H1";
    }
    if (value.startsWith(".")) {
      return this.className.split(/\s+/).includes(value.slice(1));
    }
    return false;
  }

  closest(selector) {
    const selectors = selector.split(",").map((value) => value.trim());
    let current = this.parentElement || null;
    while (current) {
      if (selectors.some((value) => current.matches(value))) {
        return current;
      }
      current = current.parentElement || null;
    }
    return null;
  }
}

global.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
global.Element = FakeElement;
global.window = {
  getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" })
};
global.location = { href: "https://scys.com/articleDetail/xq_topic/123" };

const articleTitle = new FakeElement(
  "div",
  "一次性解决出海网络问题（野卡方案失效，订阅支付方案请看主页另一篇帖子，仅用于学习交流）"
);
articleTitle.parentElement = new FakeElement("div", "", { class: "post-detail-content" });
const sectionTitle = new FakeElement("h1", "一、全局总览");
sectionTitle.parentElement = new FakeElement("div", "", { class: "note-content" });
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
    if (selector === ".post-detail-content h1, .post-detail-content [class*='title'], [class*='post-detail'] h1, [class*='article'] h1, [class*='entry'] h1, .article-title, .post-title, .entry-title") {
      return [articleTitle];
    }
    if (selector === "h1") {
      return [sectionTitle];
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
  "一次性解决出海网络问题（野卡方案失效，订阅支付方案请看主页另一篇帖子，仅用于学习交流）"
);
