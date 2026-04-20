(function (globalScope) {
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

  function getCourseExportWorkerCount(totalCount) {
    const count = Math.max(0, Number(totalCount) || 0);
    if (count < 12) {
      return 1;
    }
    if (count < 48) {
      return 2;
    }
    return 3;
  }

  const api = {
    formatElapsedDuration,
    getCourseExportWorkerCount
  };

  globalScope.CourseExportRuntime = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
