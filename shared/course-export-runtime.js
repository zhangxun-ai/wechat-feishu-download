(function (globalScope) {
  const FAST_BROWSER_PROFILE = {
    mode: "browser-fast",
    label: "浏览器加速模式",
    settleDelayMs: 0,
    skipInitialSettle: true,
    interTaskDelayMs: 120,
    workerStaggerMs: 180,
    maxRetries: 2,
    retryBaseDelayMs: 1200,
    retrySettleDelayMs: 900
  };

  function formatElapsedDuration(value) {
    const totalSeconds = Math.max(0, Math.floor(Number(value) / 1000) || 0);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function getCourseExportExecutionProfile(totalCount) {
    const count = Math.max(0, Number(totalCount) || 0);

    if (count <= 0) {
      return {
        ...FAST_BROWSER_PROFILE,
        workerCount: 1
      };
    }

    if (count < 12) {
      return {
        ...FAST_BROWSER_PROFILE,
        workerCount: 2
      };
    }

    if (count < 60) {
      return {
        ...FAST_BROWSER_PROFILE,
        workerCount: 4
      };
    }

    return {
      ...FAST_BROWSER_PROFILE,
      workerCount: 5
    };
  }

  function getCourseExportWorkerCount(totalCount) {
    return getCourseExportExecutionProfile(totalCount).workerCount;
  }

  function buildCourseStoppedMessage(input = {}) {
    const successCount = Math.max(0, Number(input.successCount) || 0);
    const failureCount = Math.max(0, Number(input.failureCount) || 0);
    const skippedCount = Math.max(0, Number(input.skippedCount) || 0);
    const elapsed = String(input.elapsed || "00:00");
    return `专栏导出已停止，成功 ${successCount} 章，失败 ${failureCount} 章，未处理 ${skippedCount} 章，总耗时 ${elapsed}。`;
  }

  function getScysCourseIdFromUrl(value) {
    let url = null;
    try {
      url = new URL(String(value || ""));
    } catch (_) {
      return "";
    }

    if (!/(\.|^)scys\.com$/i.test(url.hostname)) {
      return "";
    }

    const detailMatch = url.pathname.match(/\/course\/detail\/(\d+)(?:\/|$)/);
    if (detailMatch) {
      return detailMatch[1];
    }

    const deepseaMatch = url.pathname.match(/\/course\/(\d+)(?:\/|$)/);
    if (deepseaMatch) {
      return deepseaMatch[1];
    }

    return url.searchParams.get("course_id") || url.searchParams.get("courseId") || "";
  }

  function isScysCourseApiRateLimited(payload) {
    const message = getScysCourseApiMessage(payload);
    return message.includes("操作过于频繁");
  }

  function getScysCourseApiMessage(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    return String(payload.message || payload.msg || payload.error || payload.errmsg || "");
  }

  function extractScysCourseApiMarkdown(payload) {
    const candidates = getScysCourseApiContentCandidates(payload);
    for (const candidate of candidates) {
      const markdown = normalizeScysMarkdown(convertScysContentValue(candidate, new WeakSet()));
      if (markdown) {
        return markdown;
      }
    }

    return "";
  }

  function getScysCourseApiContentCandidates(payload) {
    const candidates = [];
    const roots = [];

    if (payload && typeof payload === "object") {
      if (payload.data !== undefined) {
        roots.push(payload.data);
      }
      if (payload.result !== undefined) {
        roots.push(payload.result);
      }
      roots.push(payload);
    } else {
      roots.push(payload);
    }

    const paths = [
      ["markdown"],
      ["content_markdown"],
      ["contentMarkdown"],
      ["html"],
      ["htmlContent"],
      ["content_html"],
      ["contentHtml"],
      ["content"],
      ["detail"],
      ["body"],
      ["article", "content"],
      ["article", "html"],
      ["chapter", "markdown"],
      ["chapter", "content"],
      ["chapter", "html"],
      ["blocks"],
      ["nodes"]
    ];

    for (const root of roots) {
      for (const path of paths) {
        const value = getValueAtPath(root, path);
        if (value !== undefined && value !== null) {
          candidates.push(value);
        }
      }
    }

    return candidates;
  }

  function getValueAtPath(root, path) {
    let current = root;
    for (const key of path) {
      if (!current || typeof current !== "object" || !(key in current)) {
        return undefined;
      }
      current = current[key];
    }
    return current;
  }

  function convertScysContentValue(value, seen) {
    if (value === undefined || value === null) {
      return "";
    }

    if (typeof value === "string") {
      return convertScysContentString(value, seen);
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return "";
    }

    if (Array.isArray(value)) {
      if (value.some(isScysFeishuBlock)) {
        return value.map((item) => convertScysFeishuBlock(item, 0)).filter(Boolean).join("\n\n");
      }
      return value.map((item) => convertScysContentValue(item, seen)).filter(Boolean).join("\n\n");
    }

    if (typeof value !== "object") {
      return "";
    }

    if (seen.has(value)) {
      return "";
    }
    seen.add(value);

    if (isScysFeishuBlock(value)) {
      return convertScysFeishuBlock(value, 0);
    }

    const imageMarkdown = buildScysImageMarkdown(value);
    if (imageMarkdown) {
      return imageMarkdown;
    }

    const directKeys = ["markdown", "content_markdown", "contentMarkdown", "html", "content", "text", "value", "title"];
    const childKeys = ["children", "blocks", "nodes", "items", "paragraphs", "contents"];
    const parts = [];

    for (const key of directKeys) {
      if (typeof value[key] === "string") {
        const converted = convertScysContentString(value[key], seen);
        if (converted) {
          parts.push(converted);
        }
      }
    }

    for (const key of childKeys) {
      if (Array.isArray(value[key])) {
        const converted = convertScysContentValue(value[key], seen);
        if (converted) {
          parts.push(converted);
        }
      }
    }

    if (parts.length > 0) {
      return parts.join("\n\n");
    }

    return Object.entries(value)
      .filter(([key]) => !isScysCourseApiMetadataKey(key))
      .map(([, child]) => convertScysContentValue(child, seen))
      .filter(Boolean)
      .join("\n\n");
  }

  function isScysFeishuBlock(value) {
    return Boolean(value && typeof value === "object" && (
      value.block_type !== undefined
      || value.block_id !== undefined
      || value.text?.elements
      || value.bullet?.elements
      || value.ordered?.elements
      || value.children_blocks
    ));
  }

  function convertScysFeishuBlock(block, depth) {
    if (!block || typeof block !== "object") {
      return "";
    }

    if (block.table) {
      return convertScysFeishuTable(block);
    }

    if (block.image || block.file_url) {
      return buildScysImageMarkdown({
        type: "image",
        src: block.file_url || block.image?.url || block.image?.src || "",
        alt: block.image?.alt || block.image?.title || ""
      });
    }

    const children = Array.isArray(block.children_blocks)
      ? block.children_blocks.map((child) => convertScysFeishuBlock(child, depth + 1)).filter(Boolean)
      : [];

    if (block.quote_container) {
      return children.join("\n\n")
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }

    if (block.callout && children.length > 0) {
      return children.join("\n\n");
    }

    const bulletText = convertScysFeishuTextElements(block.bullet?.elements);
    if (bulletText) {
      return `${"  ".repeat(depth)}- ${bulletText}`;
    }

    const orderedText = convertScysFeishuTextElements(block.ordered?.elements);
    if (orderedText) {
      const sequence = String(block.ordered?.style?.sequence || "").trim();
      const marker = /^\d+$/.test(sequence) ? `${sequence}.` : "1.";
      return `${"  ".repeat(depth)}${marker} ${orderedText}`;
    }

    const text = convertScysFeishuTextElements(block.text?.elements);
    return [text, ...children].filter(Boolean).join("\n\n");
  }

  function convertScysFeishuTable(block) {
    const columnCount = Number(block.table?.property?.column_size) || 0;
    const rowCount = Number(block.table?.property?.row_size) || 0;
    if (columnCount <= 0 || rowCount <= 0) {
      return "";
    }

    const cellsById = new Map(
      Array.from(block.children_blocks || [])
        .filter((cell) => cell?.block_id)
        .map((cell) => [cell.block_id, cell])
    );
    const cellIds = Array.isArray(block.table?.cells) ? block.table.cells : [];
    const rows = [];

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row = [];
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const cellIndex = rowIndex * columnCount + columnIndex;
        const cell = cellsById.get(cellIds[cellIndex]) || block.children_blocks?.[cellIndex];
        row.push(formatScysMarkdownTableCell(convertScysFeishuTableCell(cell)));
      }
      rows.push(row);
    }

    if (rows.length === 0) {
      return "";
    }

    const header = rows[0];
    const separator = new Array(columnCount).fill("---");
    return [
      `| ${header.join(" | ")} |`,
      `| ${separator.join(" | ")} |`,
      ...rows.slice(1).map((row) => `| ${row.join(" | ")} |`)
    ].join("\n");
  }

  function convertScysFeishuTableCell(cell) {
    if (!cell || typeof cell !== "object") {
      return "";
    }

    return Array.from(cell.children_blocks || [])
      .map((child) => convertScysFeishuBlock(child, 0))
      .filter(Boolean)
      .join("\n");
  }

  function formatScysMarkdownTableCell(value) {
    return String(value || "")
      .replace(/\|/g, "\\|")
      .replace(/\r?\n+/g, "<br>")
      .trim();
  }

  function convertScysFeishuTextElements(elements) {
    if (!Array.isArray(elements)) {
      return "";
    }

    return elements.map((element) => {
      if (typeof element?.text_run?.content === "string") {
        return element.text_run.content;
      }

      const mention = element?.mention_user;
      return mention?.name || mention?.display_name || mention?.text || "";
    }).join("").trim();
  }

  function convertScysContentString(value, seen) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }

    if (/^[\[{]/.test(text)) {
      try {
        return convertScysContentValue(JSON.parse(text), seen);
      } catch (_) {
        // Fall through to text conversion.
      }
    }

    if (/<[a-z][\s\S]*>/i.test(text)) {
      return convertScysHtmlToMarkdown(text);
    }

    return decodeHtmlEntities(text);
  }

  function convertScysHtmlToMarkdown(value) {
    return decodeHtmlEntities(String(value || "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/<h([1-6])\b[^>]*>/gi, (_, level) => `\n${"#".repeat(Number(level))} `)
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<img\b[^>]*>/gi, (tag) => {
        const src = getHtmlAttribute(tag, "src");
        if (!src) {
          return "";
        }
        const alt = getHtmlAttribute(tag, "alt");
        return `\n![${alt}](${src})\n`;
      })
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/(?:p|div|section|article|blockquote|ul|ol)>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""));
  }

  function getHtmlAttribute(tag, name) {
    const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
    const match = String(tag || "").match(pattern);
    return decodeHtmlEntities(match?.[1] || match?.[2] || match?.[3] || "").trim();
  }

  function buildScysImageMarkdown(value) {
    const type = String(value?.type || value?.name || value?.tag || "").toLowerCase();
    const src = String(value?.src || value?.url || value?.image || value?.imageUrl || value?.image_url || "").trim();
    if (!src || (type && !/(image|img|photo|picture)/.test(type))) {
      return "";
    }
    const alt = String(value?.alt || value?.title || "").trim();
    return `![${alt}](${src})`;
  }

  function decodeHtmlEntities(value) {
    const namedEntities = {
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      nbsp: " ",
      quot: "\""
    };

    return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
      const key = entity.toLowerCase();
      if (key[0] === "#") {
        const codePoint = key[1] === "x"
          ? Number.parseInt(key.slice(2), 16)
          : Number.parseInt(key.slice(1), 10);
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
      }
      return namedEntities[key] || match;
    });
  }

  function isScysCourseApiMetadataKey(key) {
    return /^(id|chapter_id|course_id|created_at|updated_at|sort|order|status|message|msg|url)$/i.test(key);
  }

  function normalizeScysMarkdown(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim();
  }

  const api = {
    buildCourseStoppedMessage,
    extractScysCourseApiMarkdown,
    formatElapsedDuration,
    getScysCourseIdFromUrl,
    getCourseExportExecutionProfile,
    getCourseExportWorkerCount,
    isScysCourseApiRateLimited
  };

  globalScope.CourseExportRuntime = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
