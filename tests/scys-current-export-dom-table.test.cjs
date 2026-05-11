const assert = require("node:assert/strict");

class FakeText {
  constructor(text) {
    this.nodeType = Node.TEXT_NODE;
    this.textContent = text;
  }
}

class FakeElement {
  constructor(tagName, attrs = {}, children = []) {
    this.nodeType = Node.ELEMENT_NODE;
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attrs };
    this.id = attrs.id || "";
    this.className = attrs.class || "";
    this.classList = {
      contains: (name) => this.className.split(/\s+/).includes(name)
    };
    this.childNodes = children.map((child) => typeof child === "string" ? new FakeText(child) : child);
    this.children = this.childNodes.filter((child) => child.nodeType === Node.ELEMENT_NODE);
    for (const child of this.children) {
      child.parentElement = this;
    }
  }

  get textContent() {
    return this.childNodes.map((child) => child.textContent || "").join("");
  }

  getAttribute(name) {
    return this.attributes[name] || "";
  }

  matches(selector) {
    return selector.split(",").some((part) => {
      const value = part.trim();
      return value.startsWith(".") && this.classList.contains(value.slice(1));
    });
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      if (!(node instanceof FakeElement)) {
        return;
      }
      if (selector === ".table_cell" && node.classList.contains("table_cell")) {
        matches.push(node);
      }
      for (const child of node.children) {
        visit(child);
      }
    };

    for (const child of this.children) {
      visit(child);
    }
    return matches;
  }
}

global.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
global.Element = FakeElement;
global.window = {
  getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1", fontSize: "16px", fontWeight: "400" })
};
global.location = { href: "https://scys.com/course/detail/172?chapterId=11408" };
global.document = { querySelectorAll: () => [] };
global.chrome = {
  runtime: {
    onMessage: {
      addListener() {}
    }
  }
};

const exporter = require("../content-scripts/feishu-exporter.js");

function cell(text) {
  return new FakeElement("div", { class: "vc-doc-item" }, [
    new FakeElement("div", { class: "table_cell" }, [
      new FakeElement("div", { class: "block-text" }, [text])
    ])
  ]);
}

const table = new FakeElement("div", { class: "table table_2" }, [
  new FakeElement("div", {}, [
    cell("用途"),
    cell("对应做法"),
    cell("复盘"),
    cell("存自己的项目记录、每日反思、决策过程，让 AI 回顾过往踩过的坑")
  ])
]);

const markdown = exporter.__test.convertBlock(table, 0);

assert.equal(markdown, [
  "| 用途 | 对应做法 |",
  "| --- | --- |",
  "| 复盘 | 存自己的项目记录、每日反思、决策过程，让 AI 回顾过往踩过的坑 |"
].join("\n"));
