// Sole owner of the masterQuiz_progress and masterQuiz_total localStorage
// keys. DOM-free: write failures are returned to the caller, never rendered
// here. Each key is read and parsed once, then held in memory; writers
// mutate the in-memory copy and write through. As in flashcard-storage.js,
// a second tab's writes are not seen until reload.
//
// masterQuiz_total persists QUESTIONS.length so the home card can show a
// progress denominator without loading master-quiz.json — the quiz module
// is lazy-loaded and may never have run when the home card renders.

const STORAGE_KEY = 'masterQuiz_progress';
const QUESTION_BANK_COUNT_KEY = 'masterQuiz_total';
const MASTERY_STREAK = 3;

let progressCache = null;
let questionBankCountCache = null;

function getAllProgress() {
  if (progressCache) return progressCache;

  try {
    const rawProgress = localStorage.getItem(STORAGE_KEY);
    progressCache = rawProgress ? JSON.parse(rawProgress) : {};
  } catch (storageOrParseError) {
    // Private mode or corrupted JSON: start from an empty record.
    progressCache = {};
  }
  return progressCache;
}

function getQuestionBankCount() {
  if (questionBankCountCache !== null) return questionBankCountCache;

  try {
    questionBankCountCache =
      +localStorage.getItem(QUESTION_BANK_COUNT_KEY) || 0;
  } catch (storageReadError) {
    // Storage unavailable; count unknown, treat as 0.
    questionBankCountCache = 0;
  }
  return questionBankCountCache;
}

function persist(key, value) {
  try {
    localStorage.setItem(key, value);
    return {ok: true};
  } catch (storageWriteError) {
// Persisting is a background enhancement, we return write outcome
// for the caller to handle (e.g. by a non-blocking toast).
    return {
      ok: false,
      message: "Progress couldn't be saved — browser storage may be full "
        + 'or disabled.'
    };
  }
}

function setQuestionBankCount(count) {
  questionBankCountCache = count;
  return persist(QUESTION_BANK_COUNT_KEY, count);
}

function clearAll() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(QUESTION_BANK_COUNT_KEY);
  } catch (storageWriteError) {
    return {
      ok: false,
      message: "Progress couldn't be reset — browser storage may be full "
        + 'or disabled.'
    };
  }
  progressCache = {};
  questionBankCountCache = 0;
  return {ok: true};
}

function updateEntry(questionId, correct) {
  const progress = getAllProgress();
  const entry = progress[questionId] || {
    correctStreak: 0, totalCorrect: 0, totalAttempts: 0
  };
  if (correct) {
    entry.correctStreak++;
    entry.totalCorrect++;
  } else {
    entry.correctStreak = 0;
  }
  entry.totalAttempts++;
  progress[questionId] = entry;
  return persist(STORAGE_KEY, JSON.stringify(progress));
}

function getStats(selectedQuestions) {
  const progress = getAllProgress();
  let attempted = 0;
  let missed = 0;
  let mastered = 0;
  for (const question of selectedQuestions) {
    const entry = progress[question.id];
    if (!entry) continue;
    if (entry.totalAttempts > 0) attempted++;
    if (entry.correctStreak === 0 && entry.totalAttempts > 0) missed++;
    if (entry.correctStreak >= MASTERY_STREAK) mastered++;
  }
  return {
    attempted, missed, mastered,
    selectedQuestionCount: selectedQuestions.length
  };
}

function getSummary() {
  const progress = getAllProgress();
  let attempted = 0;
  let mastered = 0;
  for (const entry of Object.values(progress)) {
    if (entry.totalAttempts > 0) attempted++;
    if (entry.correctStreak >= MASTERY_STREAK) mastered++;
  }
  return {
    attempted, mastered, questionBankCount: getQuestionBankCount()
  };
}

export { getAllProgress, setQuestionBankCount, clearAll, updateEntry,
  getStats, getSummary, MASTERY_STREAK };
