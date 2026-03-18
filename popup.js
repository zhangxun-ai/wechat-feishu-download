const BACKGROUND_TAB_SETTLE_DELAY_MS = 1500;
const DEFAULT_HISTORY_RANGE_DAYS = 30;
const WECHAT_MP_LOGIN_URL = "https://mp.weixin.qq.com/";

const statusEl = document.getElementById("status");
const titleEl = document.getElementById("docTitle");
const typeEl = document.getElementById("docType");
const exportMarkdownButton = document.getElementById("exportMarkdown");
const includeImagesInput = document.getElementById("includeImages");
const includeImagesHelperInput = document.getElementById("includeImagesHelper");
const batchZipOutputInput = document.getElementById("batchZipOutput");
const batchStatusEl = document.getElementById("batchStatus");
const batchLinksInput = document.getElementById("batchLinks");
const batchDownloadLinksButton = document.getElementById("batchDownloadLinks");
const batchLogEl = document.getElementById("batchLog");
const helperStatusEl = document.getElementById("helperStatus");
const helperSeedUrlInput = document.getElementById("helperSeedUrl");
const helperStartDateInput = document.getElementById("helperStartDate");
const helperEndDateInput = document.getElementById("helperEndDate");
const helperCheckButton = document.getElementById("helperCheck");
const openWechatMpLoginButton = document.getElementById("openWechatMpLogin");
const helperDownloadButton = document.getElementById("helperDownload");
const helperLogEl = document.getElementById("helperLog");

let activeTabId = null;
let pageInfo = null;
let isWechatHistoryRunning = false;

init().catch((error) => {
  setStatus(error.message || "初始化失败", "error");
});

exportMarkdownButton.addEventListener("click", () => handleExport("markdown"));
batchDownloadLinksButton.addEventListener("click", handleBatchDownloadLinks);
helperCheckButton.addEventListener("click", () => refreshWechatMpStatus({ silent: false }));
openWechatMpLoginButton.addEventListener("click", handleOpenWechatMpLogin);
helperDownloadButton.addEventListener("click", handleWechatHistoryDownload);
includeImagesInput.addEventListener("change", () => syncIncludeImages(true));
includeImagesHelperInput.addEventListener("change", () => syncIncludeImages(false));

async function init() {
  initializeHistoryDateRange();
  syncIncludeImages(true);

  const [tab] = await queryActiveTab();
  if (!tab?.id) {
    throw new Error("未找到当前标签页");
  }

  activeTabId = tab.id;

  if (tab.url && isWechatArticleUrl(tab.url)) {
    helperSeedUrlInput.value = tab.url;
  }

  if (tab.url && isWechatMpBackendUrl(tab.url)) {
    pageInfo = {
      title: "公众号后台",
      docType: "公众号后台",
      supports: []
    };
    setPageMeta(pageInfo);
    setStatus("当前是公众号后台页，可用于公众号历史范围下载。", "ready");
    setButtonsDisabled(true);
  } else if (!tab.url || !isSupportedExportUrl(tab.url)) {
    setPageMeta(null);
    setStatus("请先打开飞书 docx/wiki 或微信公众号文章页面。", "error");
    setButtonsDisabled(true);
  } else {
    try {
      pageInfo = await sendMessageWithRecovery(activeTabId, { type: "feishu-export:get-page-info" });
      setPageMeta(pageInfo);

      if (!pageInfo?.supports || !pageInfo.supports.includes("markdown")) {
        setStatus("检测到当前页面还在运行旧版脚本，请刷新页面后再试。", "error");
        setButtonsDisabled(true);
      } else {
        setStatus("页面已就绪，可以直接导出。", "ready");
        setButtonsDisabled(false);
      }
    } catch (error) {
      setPageMeta(null);
      setStatus(error.message || "页面检测失败", "error");
      setButtonsDisabled(true);
    }
  }

  if (isWechatArticleUrl(helperSeedUrlInput.value.trim())) {
    await refreshWechatMpStatus({ silent: true }).catch(() => null);
  } else {
    setHelperStatus("请先粘贴公众号种子文章链接。", "loading");
  }
}

async function handleExport(format) {
  if (!activeTabId) {
    setStatus("当前标签页不可用。", "error");
    return;
  }

  setButtonsDisabled(true);
  setStatus(`正在导出 ${format.toUpperCase()}…`, "loading");

  try {
    const payload = await sendMessageWithRecovery(activeTabId, {
      type: "feishu-export:export-document",
      format,
      options: {
        includeImages: includeImagesInput.checked
      }
    });

    const blob = new Blob([payload.content], { type: payload.mimeType });
    const url = URL.createObjectURL(blob);
    const filename = normalizeDownloadFilename(payload.filename, format);

    try {
      await downloadWithFallback(url, filename, format, true);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    setStatus(`${format.toUpperCase()} 已生成，浏览器将开始下载。`, "ready");
  } catch (error) {
    if (format === "markdown" && error.message === "不支持的导出格式") {
      setStatus("当前页面还在运行旧版脚本，请刷新页面后再试。", "error");
    } else {
      setStatus(error.message || "导出失败", "error");
    }
  } finally {
    setButtonsDisabled(false);
  }
}

async function handleBatchDownloadLinks() {
  if (isWechatHistoryRunning) {
    return;
  }

  const links = parseBatchLinks(batchLinksInput.value);
  if (links.length === 0) {
    setBatchStatus("请至少粘贴一个受支持的文章链接。", "error");
    return;
  }

  try {
    const job = await createStoredBatchJob(links, {
      includeImages: includeImagesInput.checked,
      zipOutput: batchZipOutputInput.checked,
      title: "批量下载链接列表",
      source: "manual-links"
    });
    await openBatchRunner(job.id);
    setBatchStatus(`已打开批量任务页，共 ${job.links.length} 篇。后续下载会在任务页继续执行。`, "ready");
    appendBatchLog(`已创建批量任务，共 ${job.links.length} 篇。`);
  } catch (error) {
    setBatchStatus(error.message || "批量下载失败", "error");
  }
}

async function handleWechatHistoryDownload() {
  if (isWechatHistoryRunning) {
    setHelperStatus("当前还有进行中的批量任务，请等待完成后再试。", "error");
    return;
  }

  const seedUrl = String(helperSeedUrlInput.value || "").trim();
  const startDate = String(helperStartDateInput.value || "").trim();
  const endDate = String(helperEndDateInput.value || "").trim();

  if (!isWechatArticleUrl(seedUrl)) {
    setHelperStatus("请输入微信公众号文章种子链接。", "error");
    return;
  }

  if (!startDate || !endDate) {
    setHelperStatus("请选择开始和结束日期。", "error");
    return;
  }

  if (startDate > endDate) {
    setHelperStatus("开始日期不能晚于结束日期。", "error");
    return;
  }

  isWechatHistoryRunning = true;
  setHistoryControlsDisabled(true);
  clearHelperLog();
  setHelperStatus("正在通过公众号后台登录态定位历史文章…", "loading");

  try {
    const result = await resolveWechatHistoryInBackground(seedUrl, startDate, endDate);

    for (const line of result.logs || []) {
      appendHelperLog(line);
    }

    if (result.loginRequired) {
      await openForegroundTab(WECHAT_MP_LOGIN_URL);
      setHelperStatus("未检测到当前 Chrome 的公众号后台登录态。已为你打开登录页，登录完成后回来重试。", "error");
      appendHelperLog("未检测到后台登录态，已自动打开 `mp.weixin.qq.com` 登录页。", "error");
      return;
    }

    const links = normalizeSupportedLinks(result.links || []);
    if (links.length === 0) {
      setHelperStatus(result.message || "该时间范围没有命中任何历史文章。", "ready");
      appendHelperLog(result.message || "后台没有返回可下载文章。");
      return;
    }

    batchLinksInput.value = links.join("\n");
    appendHelperLog(
      `已匹配公众号: ${formatWechatAccountLabel(result.matchedAccount)}，命中 ${links.length} 篇。`,
      "success"
    );
    setHelperStatus(`已找到 ${links.length} 篇历史文章，开始自动下载。`, "loading");

    const job = await createStoredBatchJob(links, {
      includeImages: includeImagesInput.checked,
      zipOutput: batchZipOutputInput.checked,
      title: `公众号历史下载 - ${formatWechatAccountLabel(result.matchedAccount)}`,
      source: "wechat-history",
      account: result.matchedAccount || null,
      dateRange: { startDate, endDate }
    });
    await openBatchRunner(job.id);
    setHelperStatus(`已打开任务页，共 ${links.length} 篇。后续下载会在任务页继续执行。`, "ready");
    appendHelperLog(`已创建历史下载任务，共 ${links.length} 篇。`, "success");
  } catch (error) {
    setHelperStatus(error.message || "公众号历史下载失败", "error");
    appendHelperLog(error.message || "公众号历史下载失败", "error");
  } finally {
    isWechatHistoryRunning = false;
    setHistoryControlsDisabled(false);
  }
}

async function handleOpenWechatMpLogin() {
  await openForegroundTab(WECHAT_MP_LOGIN_URL);
  setHelperStatus("已打开公众号后台登录页。登录完成后回到这里继续。", "ready");
  appendHelperLog("已打开 `mp.weixin.qq.com` 登录页。完成一次登录后，再执行“按范围批量下载”。", "success");
}

async function refreshWechatMpStatus({ silent = false } = {}) {
  const seedUrl = String(helperSeedUrlInput.value || "").trim();
  if (!isWechatArticleUrl(seedUrl)) {
    const message = "请先粘贴公众号种子文章链接。";
    setHelperStatus(message, "loading");
    if (!silent) {
      appendHelperLog(message);
    }
    return null;
  }

  try {
    const payload = await checkWechatMpLoginFromSeed(seedUrl);
    if (payload.loggedIn) {
      const accountName = payload.accountName ? `，账号 ${payload.accountName}` : "";
      setHelperStatus(`已检测到公众号后台登录态${accountName}。`, "ready");
      if (!silent) {
        appendHelperLog(`已检测到公众号后台登录态${accountName}。`, "success");
      }
    } else {
      setHelperStatus("未检测到当前 Chrome 的公众号后台登录态。先点“打开后台登录页”登录一次。", "error");
      if (!silent) {
        appendHelperLog("当前 Chrome 里没有可用的 `mp.weixin.qq.com` 登录态。", "error");
      }
    }
    return payload;
  } catch (error) {
    setHelperStatus(error.message || "检测公众号后台登录失败", "error");
    if (!silent) {
      appendHelperLog(error.message || "检测公众号后台登录失败", "error");
    }
    throw error;
  }
}

async function resolveWechatHistoryInBackground(seedUrl, startDate, endDate) {
  const tabId = await createTab(seedUrl, false);

  try {
    await waitForTabReady(tabId, seedUrl);
    await sleep(BACKGROUND_TAB_SETTLE_DELAY_MS);

    return await sendMessageWithRecovery(tabId, {
      type: "feishu-export:resolve-wechat-mp-history",
      startDate,
      endDate
    });
  } finally {
    await closeTab(tabId);
  }
}

async function checkWechatMpLoginFromSeed(seedUrl) {
  const tabId = await createTab(seedUrl, false);

  try {
    await waitForTabReady(tabId, seedUrl);
    await sleep(BACKGROUND_TAB_SETTLE_DELAY_MS);

    return await sendMessageWithRecovery(tabId, {
      type: "feishu-export:get-wechat-mp-login-status"
    });
  } finally {
    await closeTab(tabId);
  }
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error("页面没有返回数据"));
        return;
      }

      if (!response.ok) {
        reject(new Error(response.error || "请求失败"));
        return;
      }

      resolve(response.data);
    });
  });
}

async function sendMessageWithRecovery(arg1, arg2) {
  const tabId = typeof arg1 === "number" ? arg1 : arg1?.tabId;
  const message = typeof arg1 === "number" ? arg2 : arg1?.message;

  if (!tabId || !message) {
    throw new Error("消息发送参数不完整");
  }

  try {
    return await sendMessageToTab(tabId, message);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    await injectContentScript(tabId);
    return sendMessageToTab(tabId, message);
  }
}

function injectContentScript(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["content-scripts/feishu-exporter.js"]
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
      }
    );
  });
}

function isMissingReceiverError(error) {
  const message = String(error?.message || "");
  return message.includes("Receiving end does not exist");
}

function queryActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(tabs || []);
    });
  });
}

function createTab(url, active) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create({ url, active }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!tab?.id) {
        reject(new Error("标签页创建失败"));
        return;
      }

      resolve(tab.id);
    });
  });
}

function openForegroundTab(url) {
  return createTab(url, true);
}

async function createStoredBatchJob(links, options = {}) {
  const normalizedLinks = normalizeSupportedLinks(links);
  if (normalizedLinks.length === 0) {
    throw new Error("没有可处理的受支持链接");
  }

  const id = (crypto.randomUUID ? crypto.randomUUID() : `job-${Date.now()}`);
  const job = {
    id,
    title: String(options.title || "批量下载任务"),
    source: String(options.source || "manual"),
    includeImages: options.includeImages !== false,
    zipOutput: options.zipOutput !== false,
    links: normalizedLinks,
    account: options.account || null,
    dateRange: options.dateRange || null,
    createdAt: new Date().toISOString()
  };

  await storageSet({ [`batchJob:${id}`]: job });
  return job;
}

async function openBatchRunner(jobId) {
  const url = chrome.runtime.getURL(`batch-runner.html?jobId=${encodeURIComponent(jobId)}`);
  await openForegroundTab(url);
}

function downloadFile(options) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(options, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(downloadId);
    });
  });
}

function storageSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

async function downloadWithFallback(url, filename, format, saveAs) {
  try {
    return await downloadFile({
      url,
      filename,
      saveAs,
      conflictAction: "uniquify"
    });
  } catch (error) {
    if (!isInvalidFilenameError(error)) {
      throw error;
    }

    return downloadFile({
      url,
      filename: buildFallbackFilename(format),
      saveAs,
      conflictAction: "uniquify"
    });
  }
}

function setButtonsDisabled(disabled) {
  exportMarkdownButton.disabled = disabled;
}

function setBatchControlsDisabled(disabled) {
  batchDownloadLinksButton.disabled = disabled || isWechatHistoryRunning;
  batchLinksInput.disabled = disabled || isWechatHistoryRunning;
}

function setHistoryControlsDisabled(disabled) {
  helperCheckButton.disabled = disabled;
  openWechatMpLoginButton.disabled = disabled;
  helperDownloadButton.disabled = disabled;
  helperSeedUrlInput.disabled = disabled;
  helperStartDateInput.disabled = disabled;
  helperEndDateInput.disabled = disabled;
  includeImagesHelperInput.disabled = disabled;
}

function setPageMeta(info) {
  titleEl.textContent = info?.title || "-";
  typeEl.textContent = info?.docType || "-";
}

function setStatus(message, variant) {
  statusEl.textContent = message;
  statusEl.className = `status status-${variant}`;
}

function setBatchStatus(message, variant) {
  batchStatusEl.textContent = message;
  batchStatusEl.className = `status status-${variant}`;
}

function setHelperStatus(message, variant) {
  helperStatusEl.textContent = message;
  helperStatusEl.className = `status status-${variant}`;
}

function appendBatchLog(message, variant = "") {
  const entry = document.createElement("div");
  entry.className = `log-entry${variant ? ` log-entry-${variant}` : ""}`;
  entry.textContent = message;
  batchLogEl.prepend(entry);
}

function appendHelperLog(message, variant = "") {
  const entry = document.createElement("div");
  entry.className = `log-entry${variant ? ` log-entry-${variant}` : ""}`;
  entry.textContent = message;
  helperLogEl.prepend(entry);
}

function clearBatchLog() {
  batchLogEl.innerHTML = "";
}

function clearHelperLog() {
  helperLogEl.innerHTML = "";
}

function isSupportedExportUrl(url) {
  try {
    const parsed = new URL(url);
    const isFeishuPage = /(^|\.)((feishu\.cn)|(larksuite\.com)|(larkoffice\.com))$/.test(parsed.hostname)
      && /^\/(docx|wiki)\//.test(parsed.pathname);
    return isFeishuPage || isWechatArticleUrl(url);
  } catch (error) {
    return false;
  }
}

function isWechatArticleUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "mp.weixin.qq.com" && /^\/s(?:$|\/)/.test(parsed.pathname);
  } catch (error) {
    return false;
  }
}

function isWechatMpBackendUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "mp.weixin.qq.com" && /^\/cgi-bin\//.test(parsed.pathname);
  } catch (error) {
    return false;
  }
}

function parseBatchLinks(value) {
  return normalizeSupportedLinks(
    String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

function normalizeSupportedLinks(values) {
  const unique = new Set();
  const result = [];

  for (const value of values || []) {
    const link = String(value || "").trim();
    if (!link || !isSupportedExportUrl(link) || unique.has(link)) {
      continue;
    }

    unique.add(link);
    result.push(link);
  }

  return result;
}

function normalizeDownloadFilename(filename, format) {
  const extension = format === "json" ? "json" : "md";
  const raw = String(filename || "");
  const withoutExtension = raw.replace(/\.[^.]+$/, "");
  const cleaned = withoutExtension
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F-\u009F]/g, "_")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 80);

  if (!cleaned) {
    return buildFallbackFilename(format);
  }

  return `${cleaned}.${extension}`;
}

function buildFallbackFilename(format) {
  const extension = format === "json" ? "json" : "md";
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");

  return `local-export-${timestamp}.${extension}`;
}

function isInvalidFilenameError(error) {
  const message = String(error?.message || "");
  return message.toLowerCase().includes("invalid filename");
}

function waitForTabReady(tabId, sourceUrl, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(listener);
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("页面加载超时"));
    }, timeoutMs);

    const inspectTab = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          cleanup();
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (isTabReadyForExport(tab, sourceUrl)) {
          cleanup();
          resolve();
        }
      });
    };

    const listener = (updatedTabId) => {
      if (updatedTabId !== tabId) {
        return;
      }

      inspectTab();
    };

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        cleanup();
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (isTabReadyForExport(tab, sourceUrl)) {
        cleanup();
        resolve();
        return;
      }

      inspectTab();
    });
  });
}

function closeTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => {
      resolve();
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTabReadyForExport(tab, sourceUrl) {
  const currentUrl = String(tab?.url || "");
  if (!currentUrl || currentUrl === "about:blank") {
    return false;
  }

  if (tab?.status !== "complete") {
    return false;
  }

  if (currentUrl === sourceUrl) {
    return true;
  }

  return isSupportedExportUrl(currentUrl);
}

function initializeHistoryDateRange() {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - DEFAULT_HISTORY_RANGE_DAYS);

  helperStartDateInput.value = toDateInputValue(startDate);
  helperEndDateInput.value = toDateInputValue(endDate);
}

function toDateInputValue(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWechatAccountLabel(account) {
  if (!account) {
    return "未命名公众号";
  }

  const nickname = String(account.nickname || "").trim();
  const alias = String(account.alias || "").trim();

  if (nickname && alias && alias !== nickname) {
    return `${nickname} (${alias})`;
  }

  return nickname || alias || "未命名公众号";
}

function syncIncludeImages(fromPrimary) {
  const checked = fromPrimary ? includeImagesInput.checked : includeImagesHelperInput.checked;
  includeImagesInput.checked = checked;
  includeImagesHelperInput.checked = checked;
}
