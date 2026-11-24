const ROOT_NAME = "hybridnotes-assets";
const RECORD_PREFIX = "hybridnotes_asset_";

function recordKey(name) {
  return `${RECORD_PREFIX}${encodeURIComponent(name)}`;
}

function emit(name, status, progress = 0, error = "") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hybridnotes-asset-progress", {
      detail: { name, status, progress, error },
    }));
  }
}

function getRecord(name) {
  try {
    return JSON.parse(localStorage.getItem(recordKey(name)) || "null");
  } catch {
    return null;
  }
}

function saveRecord(name, record) {
  try {
    localStorage.setItem(recordKey(name), JSON.stringify(record));
  } catch {}
}

async function opfsRoot() {
  if (!navigator.storage?.getDirectory) return null;
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(ROOT_NAME, { create: true });
}

async function getOpfsFile(root, name) {
  const handle = await root.getFileHandle(name, { create: true });
  return handle;
}

export async function getStorageInfo() {
  const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : { usage: 0, quota: 0 };
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
  return { persisted, usage: estimate.usage || 0, quota: estimate.quota || 0 };
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export async function getAssetStatus(name) {
  const record = getRecord(name);
  if (!record) return { status: "missing", progress: 0 };
  if (record.status === "ready") return { status: "ready", progress: 100, size: record.size };
  if (record.status === "error") return { status: "error", progress: record.progress || 0, error: record.error || "" };
  return {
    status: record.received > 0 ? "partial" : "missing",
    progress: record.progress || 0,
    size: record.received || 0,
  };
}

async function sha256(blob) {
  if (!crypto?.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureAsset(name, url, expectedSize = 0, expectedSha256 = "") {
  const root = await opfsRoot();
  const existing = await getAssetStatus(name);
  if (existing.status === "ready") return existing;

  let received = getRecord(name)?.received || 0;
  const chunkSize = 8 * 1024 * 1024;

  try {
    const head = await fetch(url, { method: "HEAD" }).catch(() => null);
    const total = expectedSize || Number(head?.headers?.get("content-length") || 0);
    let writable = null;
    let fileHandle = null;
    if (root) {
      fileHandle = await getOpfsFile(root, name);
      const file = await fileHandle.getFile();
      received = Math.min(received, file.size);
      writable = await fileHandle.createWritable({ keepExistingData: true });
    }

    while (total > 0 && received < total) {
      const end = Math.min(received + chunkSize - 1, total - 1);
      const response = await fetch(url, { headers: { Range: `bytes=${received}-${end}` } });
      if (!response.ok && response.status !== 206) throw new Error(`Download failed (${response.status})`);
      const data = await response.arrayBuffer();
      if (root && writable) {
        await writable.seek(received);
        await writable.write(data);
      } else {
        throw new Error("OPFS unavailable");
      }
      received += data.byteLength;
      const progress = total ? Math.round((received / total) * 100) : 0;
      saveRecord(name, { status: "partial", received, progress });
      emit(name, "partial", progress);
    }

    if (writable) await writable.close();
    if (!root) throw new Error("OPFS unavailable");
    const file = await fileHandle.getFile();
    if (expectedSize && file.size !== expectedSize) throw new Error(`Size mismatch: expected ${expectedSize}, got ${file.size}`);
    if (expectedSha256) {
      const actual = await sha256(file);
      if (actual && actual !== expectedSha256) throw new Error("SHA-256 mismatch");
    }
    saveRecord(name, { status: "ready", received: file.size, size: file.size, progress: 100 });
    emit(name, "ready", 100);
    return { status: "ready", progress: 100, size: file.size };
  } catch (error) {
    saveRecord(name, { status: "error", received, progress: totalFromRecord(name), error: String(error?.message || error) });
    emit(name, "error", totalFromRecord(name), String(error?.message || error));
    return { status: "error", progress: totalFromRecord(name), error: String(error?.message || error) };
  }
}

function totalFromRecord(name) {
  return getRecord(name)?.progress || 0;
}

export async function deleteAsset(name) {
  const root = await opfsRoot();
  if (root) {
    try {
      await root.removeEntry(name);
    } catch {}
  }
  localStorage.removeItem(recordKey(name));
  emit(name, "missing", 0);
  return true;
}
