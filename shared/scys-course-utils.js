(function (globalScope) {
  function isScysCourseParsedUrl(parsed) {
    return parsed.hostname === "scys.com"
      && (
        /^\/deepsea\/\d+\/course\/\d+/.test(parsed.pathname)
        || /^\/course\/detail\/\d+/.test(parsed.pathname)
      )
      && parsed.searchParams.has("chapterId");
  }

  function buildScysChapterUrl(baseUrl, chapterId) {
    const parsed = new URL(baseUrl);
    parsed.searchParams.set("chapterId", String(chapterId || "").trim());
    return parsed.toString();
  }

  function normalizeScysCourseEntries(entries, baseUrl) {
    const normalized = [];
    const seenChapterIds = new Set();

    for (const entry of entries || []) {
      const chapterId = cleanupChapterId(entry?.chapterId);
      const title = cleanupTitle(entry?.title);
      const sectionTitle = cleanupTitle(entry?.sectionTitle);
      const sectionId = cleanupChapterId(entry?.sectionId);
      const sectionOrder = cleanupOrder(entry?.sectionOrder);

      if (!chapterId || !title || seenChapterIds.has(chapterId)) {
        continue;
      }

      seenChapterIds.add(chapterId);
      normalized.push({
        order: normalized.length + 1,
        title,
        chapterId,
        url: buildScysChapterUrl(baseUrl, chapterId),
        sectionTitle: sectionTitle || "",
        sectionId: sectionId || "",
        sectionOrder
      });
    }

    return normalized;
  }

  function flattenScysCourseApiChapters(payload) {
    const chapters = Array.isArray(payload?.data?.chapters)
      ? payload.data.chapters
      : Array.isArray(payload?.chapters)
        ? payload.chapters
        : [];
    const entries = [];

    collectApiChapterEntries(chapters, entries, {
      sectionTitle: "",
      sectionId: "",
      sectionOrder: 0
    });

    return entries;
  }

  function collectApiChapterEntries(chapters, entries, section) {
    let sectionOrder = section.sectionOrder;

    for (const chapter of chapters || []) {
      const chapterId = cleanupChapterId(chapter?.id || chapter?.chapterId || chapter?.chapter_id);
      const title = cleanupTitle(chapter?.title || chapter?.name || chapter?.chapterTitle);
      const children = Array.isArray(chapter?.children) ? chapter.children : [];

      if (children.length > 0) {
        sectionOrder += 1;
        collectApiChapterEntries(children, entries, {
          sectionTitle: title || section.sectionTitle,
          sectionId: chapterId || section.sectionId,
          sectionOrder
        });
        continue;
      }

      if (!chapterId || !title) {
        continue;
      }

      entries.push({
        chapterId,
        title,
        sectionTitle: section.sectionTitle,
        sectionId: section.sectionId,
        sectionOrder: section.sectionOrder
      });
    }
  }

  function cleanupChapterId(value) {
    const text = String(value || "").trim();
    return /^\d+$/.test(text) ? text : "";
  }

  function cleanupTitle(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanupOrder(value) {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
  }

  const api = {
    isScysCourseParsedUrl,
    buildScysChapterUrl,
    flattenScysCourseApiChapters,
    normalizeScysCourseEntries
  };

  globalScope.ScysCourseUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
