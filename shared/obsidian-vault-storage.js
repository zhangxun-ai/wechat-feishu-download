(function (globalScope) {
  const DB_NAME = "local-export-obsidian";
  const STORE_NAME = "bindings";
  const HANDLE_KEY = "vault-handle";
  const META_KEY = "vault-meta";

  function isSupported() {
    return typeof globalScope.indexedDB !== "undefined" && typeof globalScope.showDirectoryPicker === "function";
  }

  async function pickDirectory() {
    if (!isSupported()) {
      throw new Error("当前浏览器环境不支持 Obsidian 目录授权");
    }

    return globalScope.showDirectoryPicker({ mode: "readwrite" });
  }

  async function saveVaultBinding(handle, metadata = {}) {
    if (!handle) {
      throw new Error("缺少目标目录句柄");
    }

    const meta = {
      folderName: String(handle.name || metadata.folderName || "未命名目录"),
      savedAt: new Date().toISOString(),
      ...metadata
    };

    await putValue(HANDLE_KEY, handle);
    await putValue(META_KEY, meta);
    return meta;
  }

  async function getVaultBinding() {
    const [handle, meta] = await Promise.all([getValue(HANDLE_KEY), getValue(META_KEY)]);
    if (!handle) {
      return null;
    }

    return {
      handle,
      meta: meta || {
        folderName: String(handle.name || "未命名目录"),
        savedAt: ""
      }
    };
  }

  async function clearVaultBinding() {
    await deleteValue(HANDLE_KEY);
    await deleteValue(META_KEY);
  }

  async function queryVaultPermission(handle, mode = "readwrite") {
    if (!handle?.queryPermission) {
      return "prompt";
    }

    try {
      return await handle.queryPermission({ mode });
    } catch (error) {
      return "prompt";
    }
  }

  async function writeTextFiles(handle, files) {
    if (!handle) {
      throw new Error("未配置 Obsidian 目标目录");
    }

    const permission = await queryVaultPermission(handle, "readwrite");
    if (permission !== "granted") {
      throw new Error("Obsidian 目标目录权限已失效，请先在弹窗里重新授权");
    }

    for (const file of files || []) {
      const relativePath = String(file?.path || "").trim();
      if (!relativePath) {
        continue;
      }
      await writeTextFile(handle, relativePath, String(file?.content || ""));
    }
  }

  async function writeTextFile(rootHandle, relativePath, content) {
    const segments = relativePath.split("/").map((part) => part.trim()).filter(Boolean);
    if (segments.length === 0) {
      throw new Error("无效的文件路径");
    }

    const fileName = segments.pop();
    let directoryHandle = rootHandle;

    for (const segment of segments) {
      directoryHandle = await directoryHandle.getDirectoryHandle(segment, { create: true });
    }

    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(content);
    } finally {
      await writable.close();
    }
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = globalScope.indexedDB.open(DB_NAME, 1);

      request.onerror = () => reject(request.error || new Error("Obsidian 本地存储初始化失败"));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  async function getValue(key) {
    const db = await openDatabase();

    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onerror = () => reject(request.error || new Error("读取 Obsidian 配置失败"));
        request.onsuccess = () => resolve(request.result || null);
      });
    } finally {
      db.close();
    }
  }

  async function putValue(key, value) {
    const db = await openDatabase();

    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onerror = () => reject(request.error || new Error("保存 Obsidian 配置失败"));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("保存 Obsidian 配置失败"));
      });
    } finally {
      db.close();
    }
  }

  async function deleteValue(key) {
    const db = await openDatabase();

    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onerror = () => reject(request.error || new Error("清理 Obsidian 配置失败"));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error("清理 Obsidian 配置失败"));
      });
    } finally {
      db.close();
    }
  }

  const api = {
    isSupported,
    pickDirectory,
    saveVaultBinding,
    getVaultBinding,
    clearVaultBinding,
    queryVaultPermission,
    writeTextFiles
  };

  globalScope.ObsidianVaultStorage = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
