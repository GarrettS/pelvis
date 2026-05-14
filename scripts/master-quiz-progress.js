const STORAGE_KEY = 'masterQuiz_progress';
const TOTAL_KEY = 'masterQuiz_total';
const MASTERY_STREAK = 3;

function tryLoadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    // Read failed (private mode, corrupted JSON). Treat as empty progress.
    return {};
  }
}

function trySaveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    // User-initiated save; silent failure violates fail-safe.
    // TODO: surface storage failures to the user.
  }
}

function getTotal() {
  try {
    const raw = localStorage.getItem(TOTAL_KEY);
    return raw ? +raw : 0;
  } catch (e) {
    // Read failed; treat as unknown total.
    return 0;
  }
}

function setTotal(n) {
  try {
    localStorage.setItem(TOTAL_KEY, String(n));
  } catch (e) {
    // User-initiated; silent failure violates fail-safe.
    // TODO: surface storage failures to the user.
  }
}

function getAllProgress() {
  return tryLoadProgress();
}

function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOTAL_KEY);
}

function updateEntry(qId, correct) {
  const progress = tryLoadProgress();
  const entry = progress[qId] || {
    correctStreak: 0, totalCorrect: 0, totalAttempts: 0
  };
  if (correct) {
    entry.correctStreak++;
    entry.totalCorrect++;
  } else {
    entry.correctStreak = 0;
  }
  entry.totalAttempts++;
  progress[qId] = entry;
  trySaveProgress(progress);
}

function getStats(questions) {
  const progress = tryLoadProgress();
  let attempted = 0;
  let missed = 0;
  let mastered = 0;
  for (const q of questions) {
    const p = progress[q.id];
    if (!p) continue;
    if (p.totalAttempts > 0) attempted++;
    if (p.correctStreak === 0 && p.totalAttempts > 0) missed++;
    if (p.correctStreak >= MASTERY_STREAK) mastered++;
  }
  return { attempted, missed, mastered, total: questions.length };
}

function getSummary() {
  const progress = tryLoadProgress();
  let attempted = 0;
  let mastered = 0;
  for (const id of Object.keys(progress)) {
    const p = progress[id];
    if (p.totalAttempts > 0) attempted++;
    if (p.correctStreak >= MASTERY_STREAK) mastered++;
  }
  return { attempted, mastered, total: getTotal() };
}

export { getAllProgress, setTotal, clearAll, updateEntry, getStats, getSummary,
  MASTERY_STREAK };
