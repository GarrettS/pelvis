const STORAGE_KEY = 'anatomize_progress';

function tryLoad() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (storageErr) {
    // Background load — storage unavailable (private mode). App starts fresh.
    return {};
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (parseErr) {
    // Corrupt stored progress. Flush so subsequent reads don't repeat
    // the failure; app starts fresh.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (innerErr) {
      // Storage unavailable for write too. Continue with empty progress.
    }
    return {};
  }
}

function trySave(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (saveErr) {
    // Background save — quota exceeded or private mode. Session continues
    // in-memory; user loses progress only on reload.
  }
}

function loadImage(imageId) {
  return tryLoad()[imageId];
}

function saveImage(imageId, snapshot) {
  const progress = tryLoad();
  progress[imageId] = snapshot;
  trySave(progress);
}

function removeImage(imageId) {
  const progress = tryLoad();
  delete progress[imageId];
  trySave(progress);
}

export { loadImage, saveImage, removeImage };
