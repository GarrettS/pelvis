import { expandAbbr } from './abbr-expand.js';
import { loadJson } from './load.js';
import { attemptLoad } from './error-ui.js';
import { LevelQuiz } from './level-quiz.js';

const containerEl = document.getElementById('patterns-level-quiz-content');

await Promise.all([
  attemptLoad({
    loader: () => loadJson('./data/halt-levels.json'),
    container: containerEl,
    render: (data) => setupQuiz(new LevelQuiz(data), 'halt', haltPrompt, haltParts)
  }),
  attemptLoad({
    loader: () => loadJson('./data/squat-levels.json'),
    container: containerEl,
    render: (data) => setupQuiz(new LevelQuiz(data), 'squat', squatPrompt, squatParts)
  })
]);

function setupQuiz(quiz, prefix, promptFn, partsFn) {
  function render() {
    const level = quiz.current();
    document.getElementById(prefix + '-question').innerHTML =
      `<div class="quiz-badge-wrap">
        <span class="quiz-level-badge">
          ${prefix.toUpperCase()} Level
          ${level.level}</span></div>
      <div class="quiz-progress">
        (${quiz.position()} of ${quiz.count()})</div>
      <p class="quiz-prompt">
        ${promptFn(level)}</p>`;
    document.getElementById(prefix + '-next').textContent =
      quiz.isLast() ? 'Start Over' : 'Next Level';
  }

  function reveal() {
    if (quiz.isRevealed()) return;
    quiz.reveal();
    document.getElementById(prefix + '-reveal').disabled = true;
    const feedbackHtml = partsFn(quiz.current()).map(formatKeyValue).join('<br>');
    document.getElementById(prefix + '-question').innerHTML +=
      '<div class="feedback-box">' + feedbackHtml + '</div>';
  }

  function advance() {
    quiz.advance();
    document.getElementById(prefix + '-reveal').disabled = false;
    render();
  }

  render();
  document.getElementById(prefix + '-reveal').addEventListener('click', reveal);
  document.getElementById(prefix + '-next').addEventListener('click', advance);
}

function formatKeyValue([k, v]) {
  return '<strong>' + k + ':</strong> ' + expandAbbr(v);
}

function haltPrompt(level) {
  return 'What does failure at HALT Level ' + level.level
      + ' indicate, and what should you facilitate?';
}

function haltParts(level) {
  const parts = [
    ['Inability', level.inability],
    ['Muscles', level.muscles],
    ['Facilitate', level.facilitate]
  ];
  if (level.ability) parts.unshift(['Ability', level.ability]);
  if (level.also_reflects) parts.push(['Also reflects', level.also_reflects]);
  if (level.differentials) parts.push(['Differentials', level.differentials]);
  return parts;
}

function squatPrompt(level) {
  return 'What failure pattern and which muscles are hyperactive at Squat Level '
      + level.level + '?';
}

function squatParts(level) {
  const parts = [
    ['Ability', level.ability],
    ['Inability', level.inability]
  ];
  if (level.hyperactive) parts.push(['Hyperactive', level.hyperactive]);
  return parts;
}
