// Sole owner of the masterQuiz_progress and masterQuiz_total localStorage
// buckets. DOM-free by design: failures are returned to the caller, never
// rendered here. Both buckets are read and parsed once, then held in memory;
// writers mutate the in-memory copy and write through. Same single-page
// assumption as flashcard-storage.js: a second tab's writes are not reflected
// until reload.

const STORAGE_KEY = 'masterQuiz_progress';
const TOTAL_KEY = 'masterQuiz_total';
const MASTERY_STREAK = 3;

// null until first access. A read failure degrades to empty progress and is
// memoized — private mode / disabled storage does not heal mid-session.
let progressCache = null;
let totalCache = null;

function loadProgress() {
  if (progressCache) return progressCache;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    progressCache = raw ? JSON.parse(raw) : {};
  } catch (e) {
    // Background read (private mode, corrupted JSON). Quiz functions
    // without prior progress; the user starts from an empty record.
    progressCache = {};
  }
  return progressCache;
}

function getTotal() {
  if (totalCache !== null) return totalCache;

  try {
    totalCache = +localStorage.getItem(TOTAL_KEY) || 0;
  } catch (e) {
    // Storage unavailable; total unknown, treat as 0.
    totalCache = 0;
  }
  return totalCache;
}

// Persisting the question total is a background enhancement. The doctrine
// default is silent degradation; this project surfaces it via a non-blocking
// toast (an approved exception), so the write outcome is returned, not
// swallowed. The in-memory total stays correct for the session regardless.
function setTotal(n) {
  totalCache = n;

  try {
    localStorage.setItem(TOTAL_KEY, String(n));
    return {ok: true};
  } catch (storageWriteError) {
    return {
      ok: false,
      message: "Progress couldn't be saved — browser storage may be full "
        + 'or disabled.'
    };
  }
}

function getAllProgress() {
  return loadProgress();
}

function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOTAL_KEY);
  progressCache = {};
  totalCache = 0;
}

// Same approved-exception rationale as setTotal: the answer is recorded in
// memory so stats and queueing stay correct for the session; only the write
// outcome is returned for the caller to surface as the non-blocking toast.
function updateEntry(qId, correct) {
  const progress = loadProgress();
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

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return {ok: true};
  } catch (storageWriteError) {
    return {
      ok: false,
      message: "Progress couldn't be saved — browser storage may be full "
        + 'or disabled.'
    };
  }
}

function getStats(questions) {
  const progress = loadProgress();
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
  const progress = loadProgress();
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
