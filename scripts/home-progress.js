import { getSummary } from './master-quiz-progress.js';

function renderHomeProgress() {
  const card = document.getElementById('home-card-masterquiz');
  if (!card) return;

  const { attempted, mastered } = getSummary();
  if (attempted === 0) {
    card.querySelector('.home-card-progress')?.remove();
    return;
  }

  let wrap = card.querySelector('.home-card-progress');
  if (!wrap) {
    wrap = document.createElement('span');
    wrap.className = 'home-card-progress';
    card.appendChild(wrap);
  }

  const pct = Math.round((attempted / 175) * 100);
  wrap.innerHTML =
    '<span class="home-progress-track">'
    + '<span class="home-progress-fill" style="width:' + pct + '%"></span>'
    + '</span>'
    + '<span class="home-progress-label">'
    + attempted + ' attempted \u00b7 ' + mastered + ' mastered'
    + '</span>';
}

export { renderHomeProgress };
