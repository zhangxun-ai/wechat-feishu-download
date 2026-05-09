(function (globalScope) {
  const EXPORT_METADATA_LINE_RE = /^- (?:页面类型|来源|作者|发布时间|导出时间):/u;
  const SCYS_NOISE_MARKERS = [
    "向上滚动加载更多内容",
    "继续滚动加载更多内容",
    "加载中..."
  ];

  function buildCourseMarkdownDocument(payload) {
    const chapters = Array.isArray(payload?.chapters) ? payload.chapters : [];
    const failedChapters = Array.isArray(payload?.failedChapters) ? payload.failedChapters : [];
    const title = String(payload?.title || "未命名专栏").trim() || "未命名专栏";
    const sourceUrl = String(payload?.sourceUrl || "").trim();
    const exportedAt = String(payload?.exportedAt || new Date().toISOString()).trim();
    const chapterAnchors = buildChapterAnchorMap(chapters);
    const chapterGroups = groupCourseChapters(chapters);
    const lines = [
      `# ${title}`,
      "",
      sourceUrl ? `来源：${sourceUrl}` : "",
      `导出时间：${exportedAt}`,
      `成功：${chapters.length} 章`,
      `失败：${failedChapters.length} 章`,
      "",
      "## 目录",
      ""
    ].filter(Boolean);

    for (const group of chapterGroups) {
      if (group.sectionTitle) {
        lines.push(`- ${group.sectionTitle}`);
      }

      for (const chapter of group.chapters) {
        const anchor = chapterAnchors.get(chapter) || buildChapterAnchorId(chapter);
        const prefix = group.sectionTitle ? "  " : "";
        lines.push(`${prefix}- [${chapter.title}](#${anchor})`);
      }
    }

    for (const group of chapterGroups) {
      lines.push("", "---", "");
      if (group.sectionTitle) {
        lines.push(`## ${group.sectionTitle}`, "");
      }

      for (const chapter of group.chapters) {
        const anchor = chapterAnchors.get(chapter) || buildChapterAnchorId(chapter);
        lines.push(
          `<a id="${anchor}"></a>`,
          "",
          `${group.sectionTitle ? "###" : "##"} ${chapter.title}`,
          "",
          chapter.url ? `原文：${chapter.url}` : "",
          "",
          String(chapter.markdown || "").trim(),
          ""
        );
      }
    }

    if (failedChapters.length > 0) {
      lines.push("", "---", "", "## 失败章节", "");
      for (const chapter of failedChapters) {
        const message = String(chapter?.message || "未知错误").trim();
        const url = String(chapter?.url || "").trim();
        lines.push(`- ${String(chapter?.title || "未命名章节").trim() || "未命名章节"}${url ? ` | ${url}` : ""} | ${message}`);
      }
    }

    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  function buildCourseHtmlDocument(payload) {
    const chapters = Array.isArray(payload?.chapters) ? payload.chapters : [];
    const failedChapters = Array.isArray(payload?.failedChapters) ? payload.failedChapters : [];
    const title = escapeHtml(String(payload?.title || "未命名专栏").trim() || "未命名专栏");
    const sourceUrl = String(payload?.sourceUrl || "").trim();
    const exportedAt = escapeHtml(String(payload?.exportedAt || new Date().toISOString()).trim());
    const chapterAnchors = buildChapterAnchorMap(chapters);
    const chapterGroups = groupCourseChapters(chapters);
    const navItems = chapterGroups.map((group) => {
      const childItems = group.chapters.map((chapter) => {
        const id = chapterAnchors.get(chapter) || buildChapterAnchorId(chapter);
        return `<li><a href="#${escapeAttribute(id)}">${escapeHtml(chapter.title)}</a></li>`;
      }).join("");

      if (!group.sectionTitle) {
        return childItems;
      }

      return [
        '<li class="nav-group">',
        `<p class="nav-group-title">${escapeHtml(group.sectionTitle)}</p>`,
        `<ul>${childItems}</ul>`,
        "</li>"
      ].join("");
    }).join("");
    const chapterSections = chapterGroups.map((group) => {
      const sections = [];
      if (group.sectionTitle) {
        sections.push(`<section class="chapter-group"><h2 class="chapter-group-title">${escapeHtml(group.sectionTitle)}</h2>`);
      }

      for (const chapter of group.chapters) {
        const id = chapterAnchors.get(chapter) || buildChapterAnchorId(chapter);
        const source = chapter.url
          ? `<p class="chapter-source"><a href="${escapeAttribute(chapter.url)}" target="_blank" rel="noreferrer">原文链接</a></p>`
          : "";
        sections.push([
          `<section id="${escapeAttribute(id)}" class="chapter-section">`,
          `<h${group.sectionTitle ? 3 : 2}>${escapeHtml(chapter.title)}</h${group.sectionTitle ? 3 : 2}>`,
          source,
          `<div class="chapter-body">${renderMarkdownToHtml(String(chapter.markdown || ""))}</div>`,
          "</section>"
        ].join(""));
      }

      if (group.sectionTitle) {
        sections.push("</section>");
      }

      return sections.join("");
    }).join("");
    const failures = failedChapters.length > 0
      ? [
          '<section class="failure-panel">',
          "<h2>失败章节</h2>",
          "<ul>",
          failedChapters.map((chapter) => {
            const titleText = escapeHtml(String(chapter?.title || "未命名章节"));
            const message = escapeHtml(String(chapter?.message || "未知错误"));
            const url = String(chapter?.url || "").trim();
            const link = url ? ` <a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">原文</a>` : "";
            return `<li><strong>${titleText}</strong>${link}<span> ${message}</span></li>`;
          }).join(""),
          "</ul>",
          "</section>"
        ].join("")
      : "";

    return [
      "<!DOCTYPE html>",
      '<html lang="zh-CN">',
      "<head>",
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `<title>${title}</title>`,
      "<style>",
      "body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;background:#f8fafc;}",
      ".layout{display:grid;grid-template-columns:280px minmax(0,1fr);min-height:100vh;}",
      ".sidebar{position:sticky;top:0;height:100vh;overflow:auto;padding:24px;background:#0f172a;color:#e2e8f0;}",
      ".sidebar h1{margin:0 0 12px;font-size:20px;line-height:1.4;}",
      ".sidebar .meta{font-size:13px;line-height:1.6;color:#94a3b8;}",
      ".sidebar ul{margin:20px 0 0;padding-left:20px;}",
      ".sidebar .nav-group{margin-bottom:16px;}",
      ".sidebar .nav-group-title{margin:0 0 8px;font-size:13px;line-height:1.6;color:#94a3b8;}",
      ".sidebar .nav-group ul{margin:0;padding-left:18px;}",
      ".sidebar a{color:#e2e8f0;text-decoration:none;}",
      ".sidebar a:hover{text-decoration:underline;}",
      ".content{padding:32px 40px;max-width:960px;}",
      ".content h1,.content h2,.content h3{color:#0f172a;}",
      ".chapter-group{margin-bottom:40px;}",
      ".chapter-group-title{margin:0 0 24px;padding-bottom:12px;border-bottom:2px solid #e2e8f0;}",
      ".chapter-section{margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid #e2e8f0;}",
      ".chapter-source{margin:0 0 16px;font-size:14px;}",
      ".chapter-source a{color:#2563eb;}",
      ".chapter-body p,.chapter-body li{line-height:1.8;}",
      ".chapter-body table{width:100%;border-collapse:collapse;margin:16px 0;background:#fff;}",
      ".chapter-body th,.chapter-body td{padding:10px 12px;border:1px solid #d1d5db;vertical-align:top;text-align:left;}",
      ".chapter-body th{background:#f8fafc;font-weight:700;}",
      ".chapter-body img{max-width:100%;height:auto;}",
      ".chapter-body blockquote{margin:16px 0;padding:8px 16px;border-left:4px solid #cbd5e1;color:#475569;background:#f8fafc;}",
      ".chapter-body pre{overflow:auto;padding:16px;background:#0f172a;color:#e2e8f0;border-radius:12px;}",
      ".chapter-body code{font-family:'SFMono-Regular',Consolas,monospace;}",
      ".failure-panel{padding:24px;border-radius:16px;background:#fff1f2;border:1px solid #fecdd3;}",
      ".failure-panel ul{padding-left:20px;}",
      "@media (max-width: 960px){.layout{grid-template-columns:1fr;}.sidebar{position:relative;height:auto;}}",
      "</style>",
      "</head>",
      "<body>",
      '<div class="layout">',
      '<aside class="sidebar">',
      `<h1>${title}</h1>`,
      `<div class="meta"><p>导出时间：${exportedAt}</p>${sourceUrl ? `<p><a href="${escapeAttribute(sourceUrl)}" target="_blank" rel="noreferrer">专栏入口</a></p>` : ""}<p>成功：${chapters.length} 章</p><p>失败：${failedChapters.length} 章</p></div>`,
      `<nav><ul>${navItems}</ul></nav>`,
      "</aside>",
      '<main class="content">',
      `<section class="summary"><h1>${title}</h1></section>`,
      chapterSections,
      failures,
      "</main>",
      "</div>",
      "</body>",
      "</html>"
    ].join("");
  }

  function buildCourseFilename(title, extension) {
    const base = String(title || "course-export")
      .replace(/[<>:"/\\|?*\u0000-\u001F\u007F-\u009F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "")
      .slice(0, 80) || "course-export";
    return `${base}.${extension}`;
  }

  function groupCourseChapters(chapters) {
    const groups = [];
    let currentGroup = null;

    for (const chapter of chapters) {
      const sectionTitle = cleanupCourseTitle(chapter?.sectionTitle);
      const sectionId = cleanupCourseTitle(chapter?.sectionId);
      const sectionOrder = Number(chapter?.sectionOrder) || 0;
      const sameGroup = currentGroup
        && currentGroup.sectionTitle === sectionTitle
        && currentGroup.sectionId === sectionId
        && currentGroup.sectionOrder === sectionOrder;

      if (!sameGroup) {
        currentGroup = {
          sectionTitle,
          sectionId,
          sectionOrder,
          chapters: []
        };
        groups.push(currentGroup);
      }

      currentGroup.chapters.push(chapter);
    }

    return groups;
  }

  function buildChapterAnchorMap(chapters) {
    const anchors = new Map();
    const used = new Set();

    for (const chapter of chapters) {
      let anchor = buildChapterAnchorId(chapter);
      while (used.has(anchor)) {
        anchor = `${anchor}-dup`;
      }
      used.add(anchor);
      anchors.set(chapter, anchor);
    }

    return anchors;
  }

  function buildChapterAnchorId(chapter) {
    const pieces = [
      "chapter",
      Number(chapter?.order) || 0,
      slugifyHeading(cleanupCourseTitle(chapter?.sectionTitle) || cleanupCourseTitle(chapter?.title))
    ].filter(Boolean);
    return pieces.join("-");
  }

  function extractCourseChapterMarkdown(markdown) {
    const text = normalizeCourseMarkdownText(markdown);
    if (!text) {
      return "";
    }

    const separatorIndex = text.indexOf("\n---\n");
    if (separatorIndex < 0) {
      return text;
    }

    const preamble = text.slice(0, separatorIndex).trim();
    const body = text.slice(separatorIndex + "\n---\n".length).trim();

    if (!body || !looksLikeWrappedExportMarkdown(preamble)) {
      return text;
    }

    return body;
  }

  function getCourseChapterMarkdownError(markdown, sourceUrl) {
    const body = extractCourseChapterMarkdown(markdown);
    if (!body) {
      return "未提取到章节正文";
    }

    if (isScysCourseUrl(sourceUrl) && SCYS_NOISE_MARKERS.some((marker) => body.includes(marker))) {
      return "章节正文仍包含页面加载噪音";
    }

    return "";
  }

  function slugifyHeading(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "chapter";
  }

  function renderMarkdownToHtml(markdown) {
    const lines = String(markdown || "").split(/\r?\n/);
    const chunks = [];
    let listItems = [];
    let listTag = "ul";
    let paragraphLines = [];
    let codeLines = null;

    const flushParagraph = () => {
      if (paragraphLines.length === 0) {
        return;
      }
      chunks.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
      paragraphLines = [];
    };

    const flushList = () => {
      if (listItems.length === 0) {
        return;
      }
      chunks.push(`<${listTag}>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${listTag}>`);
      listItems = [];
      listTag = "ul";
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();

      if (codeLines) {
        if (/^```/.test(trimmed)) {
          chunks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
          codeLines = null;
        } else {
          codeLines.push(line);
        }
        continue;
      }

      if (!trimmed) {
        flushParagraph();
        flushList();
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushParagraph();
        flushList();
        const level = headingMatch[1].length;
        chunks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
        continue;
      }

      if (/^- /.test(trimmed)) {
        flushParagraph();
        if (listTag !== "ul") {
          flushList();
        }
        listTag = "ul";
        listItems.push(trimmed.replace(/^- /, ""));
        continue;
      }

      const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (orderedMatch) {
        flushParagraph();
        if (listTag !== "ol") {
          flushList();
        }
        listTag = "ol";
        listItems.push(orderedMatch[1]);
        continue;
      }

      const quoteMatch = trimmed.match(/^>\s?(.*)$/);
      if (quoteMatch) {
        flushParagraph();
        flushList();
        chunks.push(`<blockquote>${renderInlineMarkdown(quoteMatch[1])}</blockquote>`);
        continue;
      }

      if (/^```/.test(trimmed)) {
        flushParagraph();
        flushList();
        codeLines = [];
        continue;
      }

      if (isMarkdownTableStart(lines, index)) {
        flushParagraph();
        flushList();
        const tableRows = [];
        while (index < lines.length && isMarkdownTableRow(lines[index])) {
          tableRows.push(splitMarkdownTableRow(lines[index]));
          index += 1;
        }
        index -= 1;
        chunks.push(renderMarkdownTable(tableRows));
        continue;
      }

      paragraphLines.push(trimmed);
    }

    flushParagraph();
    flushList();
    if (codeLines) {
      chunks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    }
    return chunks.join("");
  }

  function isMarkdownTableStart(lines, index) {
    return isMarkdownTableRow(lines[index]) && isMarkdownTableSeparator(lines[index + 1]);
  }

  function isMarkdownTableRow(line) {
    const trimmed = String(line || "").trim();
    return /^\|.*\|$/.test(trimmed);
  }

  function isMarkdownTableSeparator(line) {
    if (!isMarkdownTableRow(line)) {
      return false;
    }

    return splitMarkdownTableRow(line).every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
  }

  function splitMarkdownTableRow(line) {
    return String(line || "")
      .trim()
      .replace(/^\||\|$/g, "")
      .split(/(?<!\\)\|/u)
      .map((cell) => cell.replace(/\\\|/g, "|").trim());
  }

  function renderMarkdownTable(rows) {
    const header = rows[0] || [];
    const bodyRows = rows.slice(2);
    const headHtml = header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("");
    const bodyHtml = bodyRows.map((row) => {
      return `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`;
    }).join("");
    return `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
  }

  function renderInlineMarkdown(value) {
    const placeholders = [];
    const put = (html) => {
      const index = placeholders.push(html) - 1;
      return `\u0000${index}\u0000`;
    };
    const restore = (text) => String(text).replace(/\u0000(\d+)\u0000/g, (_, index) => placeholders[Number(index)] || "");
    let text = escapeHtml(value)
      .replace(/&lt;br&gt;/g, "<br>")
      .replace(/&lt;u&gt;/g, "<u>")
      .replace(/&lt;\/u&gt;/g, "</u>");

    text = text.replace(/`([^`]+)`/g, (_, code) => put(`<code>${escapeHtml(code)}</code>`));
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      return put(`<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}">`);
    });
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      return put(`<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${restore(label)}</a>`);
    });
    text = text.replace(/\*\*([^*]+)\*\*/g, (_, inner) => `<strong>${restore(inner)}</strong>`);
    text = text.replace(/\*([^*]+)\*/g, (_, inner) => `<em>${restore(inner)}</em>`);
    text = text.replace(/~~([^~]+)~~/g, (_, inner) => `<del>${restore(inner)}</del>`);

    return restore(text);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
  }

  function looksLikeWrappedExportMarkdown(preamble) {
    const lines = normalizeCourseMarkdownText(preamble)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 3 || !/^#\s+\S/u.test(lines[0])) {
      return false;
    }

    return lines.slice(1).every((line) => EXPORT_METADATA_LINE_RE.test(line));
  }

  function isScysCourseUrl(value) {
    try {
      const parsed = new URL(String(value || ""));
      return parsed.hostname === "scys.com"
        && /^\/deepsea\/\d+\/course\/\d+/.test(parsed.pathname)
        && parsed.searchParams.has("chapterId");
    } catch (error) {
      return false;
    }
  }

  function normalizeCourseMarkdownText(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .trim();
  }

  function cleanupCourseTitle(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  const api = {
    slugifyHeading,
    buildCourseMarkdownDocument,
    buildCourseHtmlDocument,
    buildCourseFilename,
    extractCourseChapterMarkdown,
    getCourseChapterMarkdownError
  };

  globalScope.CourseExportBuilders = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
