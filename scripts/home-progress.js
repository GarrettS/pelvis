import {getSummary} from './master-quiz-progress.js';
import {newEl} from './el-create.js';

function renderHomeProgress() {
  const card = document.getElementById('home-card-masterquiz');
  card.querySelector('.home-card-progress')?.remove();

  const {attempted, mastered, total} = getSummary();
  if (!attempted || !total) return;

  const pct = Math.min(100, Math.round((attempted / total) * 100));
  card.append(newEl('span', {
    className: 'home-card-progress',
    children: [
      newEl('span', {
        className: 'home-progress-track',
        children: [newEl('span', {
          className: 'home-progress-fill',
          style: `width: ${pct}%`
        })]
      }),
      newEl('span', {
        className: 'home-progress-label',
        textContent: `${attempted} attempted · ${mastered} mastered`
      })
    ]
  }));
}

export { renderHomeProgress };
