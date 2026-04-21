const assert = require("node:assert/strict");
const {
  joinInlineFragments,
  formatReadableMarkdown
} = require("../shared/web-markdown-utils.js");

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
  await test("inserts missing spaces between adjacent latin text fragments", async () => {
    assert.equal(
      joinInlineFragments([
        "A few random notes from claude coding",
        "and",
        "20% agents"
      ]),
      "A few random notes from claude coding and 20% agents"
    );
  });

  await test("preserves paragraph breaks instead of collapsing them into one block", async () => {
    assert.equal(
      joinInlineFragments([
        "A few random notes from claude coding.",
        "\n\n",
        "Coding workflow.",
        "\n\n",
        "Given the latest lift in LLM coding capability."
      ]),
      [
        "A few random notes from claude coding.",
        "Coding workflow.",
        "Given the latest lift in LLM coding capability."
      ].join("\n\n")
    );
  });

  await test("does not add spaces before punctuation when joining fragments", async () => {
    assert.equal(
      joinInlineFragments([
        "Coding workflow",
        ".",
        "Given",
        "the latest lift"
      ]),
      "Coding workflow. Given the latest lift"
    );
  });

  await test("inserts a space after comma fragments when the next token is prose", async () => {
    assert.equal(
      joinInlineFragments([
        "out there",
        ",",
        "while the awareness",
        "of it is still low"
      ]),
      "out there, while the awareness of it is still low"
    );
  });

  await test("formats dense X-style prose blocks into shorter readable paragraphs", async () => {
    const input = [
      "Andrej Karpathy",
      "",
      "@karpathy",
      "",
      "A few random notes from claude coding quite a bit last few weeks. Coding workflow. Given the latest lift in LLM coding capability, like many others I rapidly went from about 80% manual+autocomplete coding and 20% agents in November to 80% agent coding and 20% edits+touchups in December. I really am mostly programming in English now. It hurts the ego a bit but the power to operate over software in large code actions is just too net useful. The mistakes have changed a lot. They also don't manage their confusion very well."
    ].join("\n");

    assert.equal(
      formatReadableMarkdown(input, { siteHint: "x" }),
      [
        "Andrej Karpathy",
        "",
        "@karpathy",
        "",
        "A few random notes from claude coding quite a bit last few weeks. Coding workflow.",
        "",
        "Given the latest lift in LLM coding capability, like many others I rapidly went from about 80% manual+autocomplete coding and 20% agents in November to 80% agent coding and 20% edits+touchups in December. I really am mostly programming in English now.",
        "",
        "It hurts the ego a bit but the power to operate over software in large code actions is just too net useful. The mistakes have changed a lot.",
        "",
        "They also don't manage their confusion very well."
      ].join("\n")
    );
  });

  await test("keeps headings and bullet lists unchanged while formatting prose", async () => {
    const input = [
      "## 要点回顾",
      "",
      "- 第一条",
      "- 第二条",
      "",
      "This is a very long paragraph with several sentences. It should be broken up for readability. The formatter should keep the heading and list intact. The prose block alone should change."
    ].join("\n");

    assert.equal(
      formatReadableMarkdown(input, { siteHint: "x" }),
      [
        "## 要点回顾",
        "",
        "- 第一条",
        "- 第二条",
        "",
        "This is a very long paragraph with several sentences. It should be broken up for readability.",
        "",
        "The formatter should keep the heading and list intact. The prose block alone should change."
      ].join("\n")
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
