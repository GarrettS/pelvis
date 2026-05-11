import { showFetchError } from './load-errors.js';
import { loadJson } from './load-json.js';

let SYMPTOM_PATTERNS = null;
const quizState = {
  idx: 0,
  isQuizDone: false,
  score: { correct: 0, total: 0 },
  markedBtns: []
};

const containerEl = document.getElementById('symptom-quiz-wrap');

const result = await loadJson('./data/symptom-patterns.json');
if (result.ok) {
  SYMPTOM_PATTERNS = result.data;
  initSymptomQuiz();
} else {
  showFetchError(containerEl, result);
}

function initSymptomQuiz() {
  const answersEl = document.getElementById('symptom-answers');
  document.getElementById('symptom-controls').disabled = false;
  quizState.idx = 0;
  quizState.markedBtns = [];
  renderQuestion();

  document.getElementById('symptom-next').addEventListener('click', () => {
    quizState.idx = (quizState.idx + 1) % SYMPTOM_PATTERNS.length;
    quizState.isQuizDone = false;
    renderQuestion();
  });

  answersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.answer-btn');
    if (!btn || quizState.isQuizDone) return;
    gradeAnswer(btn, answersEl);
  });
}

function gradeAnswer(btn, answersEl) {
  const current = SYMPTOM_PATTERNS[quizState.idx];
  const isCorrect = btn.value === current.patternKey;

  quizState.isQuizDone = true;
  quizState.score.total++;
  showScoreUpdate(isCorrect);
  markCorrectAnswer(answersEl, current.patternKey);
  if (!isCorrect) {
    btn.classList.add('incorrect');
    quizState.markedBtns.push(btn);
  }
  answersEl.classList.add('answered');
  showFeedback(current.explanation, isCorrect);
  document.getElementById('symptom-next').classList.remove('hidden');
}

function markCorrectAnswer(answersEl, correctKey) {
  const correctBtn = answersEl.querySelector('[value="' + correctKey + '"]');
  correctBtn.classList.add('correct');
  quizState.markedBtns = [correctBtn];
}

function showScoreUpdate(isCorrect) {
  quizState.score.correct += +isCorrect;
  document.getElementById('symptom-score').textContent =
    'Score: ' + quizState.score.correct + ' / ' + quizState.score.total;
}

function showFeedback(explanation, isCorrect) {
  const feedback = document.getElementById('symptom-feedback');
  const verdict = isCorrect ? 'Correct.' : 'Incorrect.';
  feedback.classList.toggle('error', !isCorrect);
  feedback.innerHTML = '<strong>' + verdict + '</strong> ' + explanation;
  feedback.classList.remove('hidden');
}

function renderQuestion() {
  const current = SYMPTOM_PATTERNS[quizState.idx];
  document.getElementById('symptom-condition').textContent = current.condition;
  const feedback = document.getElementById('symptom-feedback');
  feedback.classList.add('hidden');
  feedback.classList.remove('error');
  document.getElementById('symptom-next').classList.add('hidden');
  const answersEl = document.getElementById('symptom-answers');
  quizState.markedBtns.forEach((b) => b.classList.remove('correct', 'incorrect'));
  quizState.markedBtns = [];
  answersEl.classList.remove('answered');
}
