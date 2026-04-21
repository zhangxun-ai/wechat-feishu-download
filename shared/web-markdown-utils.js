(function (globalScope) {
  function cleanupRichInlineText(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[^\S\n]{2,}/g, " ")
      .trim();
  }

  function joinInlineFragments(fragments) {
    let output = "";

    for (const fragment of Array.isArray(fragments) ? fragments : []) {
      const value = String(fragment || "");
      if (!value) {
        continue;
      }

      if (output && shouldInsertInlineSpace(output, value)) {
        output += " ";
      }

      output += value;
    }

    return cleanupRichInlineText(output);
  }

  function shouldInsertInlineSpace(previous, next) {
    if (!previous || !next) {
      return false;
    }

    if (/\s$/.test(previous) || /^\s/.test(next)) {
      return false;
    }

    const previousChar = getTrailingContentChar(previous);
    const nextChar = getLeadingContentChar(next);

    if (!previousChar || !nextChar) {
      return false;
    }

    if (/[([{<"'“‘`]/.test(previousChar)) {
      return false;
    }

    if (/^[,.;:!?%)\]}>/"'”’、。，；：！？）》】]/.test(nextChar)) {
      return false;
    }

    if (previousChar === "," && /^[A-Za-z]/.test(nextChar)) {
      return true;
    }

    return /^[A-Za-z0-9@#]/.test(nextChar)
      && (/[A-Za-z0-9@#]$/.test(previousChar) || /[.!?;:]/.test(previousChar));
  }

  function getLeadingContentChar(value) {
    const trimmed = String(value || "").trimStart();
    if (!trimmed) {
      return "";
    }

    const unwrapped = trimmed
      .replace(/^!\[[^\]]*]\([^)]+\)/, "")
      .replace(/^(?:[*_~`>]+|!?\[|\()+/, "");

    return unwrapped.charAt(0) || trimmed.charAt(0) || "";
  }

  function getTrailingContentChar(value) {
    const trimmed = String(value || "").trimEnd();
    if (!trimmed) {
      return "";
    }

    const unwrapped = trimmed
      .replace(/\]\([^)]+\)$/g, "")
      .replace(/(?:[*_~`]+|[)\]}>])+$/g, "");

    return unwrapped.charAt(unwrapped.length - 1) || trimmed.charAt(trimmed.length - 1) || "";
  }

  function formatReadableMarkdown(markdown, options = {}) {
    const siteHint = String(options.siteHint || "generic").toLowerCase();
    const blocks = String(markdown || "")
      .split(/\n{2,}/)
      .map((block) => cleanupRichInlineText(block))
      .filter(Boolean);

    return blocks
      .map((block) => formatReadableBlock(block, siteHint))
      .join("\n\n")
      .trim();
  }

  function formatReadableBlock(block, siteHint) {
    if (!shouldFormatProseBlock(block, siteHint)) {
      return block;
    }

    const sentences = splitIntoSentences(block);
    if (sentences.length < 3) {
      return block;
    }

    const chunkSize = siteHint === "x" || siteHint === "twitter" ? 2 : 3;
    const paragraphs = [];

    for (let index = 0; index < sentences.length; index += chunkSize) {
      paragraphs.push(sentences.slice(index, index + chunkSize).join(" "));
    }

    return paragraphs.join("\n\n");
  }

  function shouldFormatProseBlock(block, siteHint) {
    const trimmed = String(block || "").trim();
    if (!trimmed) {
      return false;
    }

    if (/^(#{1,6}\s|[-*+]\s|>\s|\d+\.\s|```|!\[|\|)/m.test(trimmed)) {
      return false;
    }

    if (trimmed.includes("\n")) {
      return false;
    }

    const sentences = splitIntoSentences(trimmed);
    if (siteHint === "x" || siteHint === "twitter") {
      return trimmed.length >= 120 && sentences.length >= 4;
    }

    return trimmed.length >= 260 && sentences.length >= 5;
  }

  function splitIntoSentences(text) {
    const source = cleanupRichInlineText(text).replace(/\n+/g, " ");
    const sentences = [];
    let current = "";

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      current += char;

      if (!isSentenceBoundary(source, index, current)) {
        continue;
      }

      const sentence = cleanupRichInlineText(current);
      if (sentence) {
        sentences.push(sentence);
      }
      current = "";
    }

    const tail = cleanupRichInlineText(current);
    if (tail) {
      sentences.push(tail);
    }

    return sentences;
  }

  function isSentenceBoundary(source, index, current) {
    const char = source[index];
    if (/[。！？!?]/.test(char)) {
      return true;
    }

    if (char !== ".") {
      return false;
    }

    const lowered = current.trim().toLowerCase();
    if (/\b(?:e\.g|i\.e|mr|mrs|ms|dr|prof|vs|etc)\.$/.test(lowered)) {
      return false;
    }

    const previousChar = source[index - 1] || "";
    const nextChar = source[index + 1] || "";
    if (/\d/.test(previousChar) && /\d/.test(nextChar)) {
      return false;
    }

    const rest = source.slice(index + 1);
    if (!rest.trim()) {
      return true;
    }

    const nextContent = rest.match(/^\s*([^\s])/);
    if (!nextContent) {
      return true;
    }

    return /^[A-Z0-9"“”'‘’([]/.test(nextContent[1]);
  }

  const api = {
    cleanupRichInlineText,
    joinInlineFragments,
    formatReadableMarkdown
  };

  globalScope.WebMarkdownUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
