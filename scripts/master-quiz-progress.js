const STORAGE_KEY = 'masterQuiz_progress';
const MASTERY_STREAK = 3;

function tryLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function trySave(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    // Background save — not user-initiated, no alert
  }
}

function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
}

function updateEntry(qId, correct) {
  const progress = tryLoad();
  const entry = progress[qId] || {
    correctStreak: 0, totalCorrect: 0,
    totalAttempts: 0, lastSeen: ''
  };
  if (correct) {
    entry.correctStreak++;
    entry.totalCorrect++;
  } else {
    entry.correctStreak = 0;
  }
  entry.totalAttempts++;
  entry.lastSeen = new Date().toISOString().slice(0, 10);
  progress[qId] = entry;
  trySave(progress);
}

function getStats(questions) {
  const progress = tryLoad();
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
  const progress = tryLoad();
  let attempted = 0;
  let mastered = 0;
  for (const id of Object.keys(progress)) {
    const p = progress[id];
    if (!p) continue;
    if (p.totalAttempts > 0) attempted++;
    if (p.correctStreak >= MASTERY_STREAK) mastered++;
  }
  return { attempted, mastered };
}

export { tryLoad, trySave, clearAll, updateEntry, getStats, getSummary,
  MASTERY_STREAK };
