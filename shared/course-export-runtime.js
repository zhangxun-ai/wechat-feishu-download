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

  const api = {
    formatElapsedDuration,
    getCourseExportExecutionProfile,
    getCourseExportWorkerCount
  };

  globalScope.CourseExportRuntime = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
