import {expandAbbr} from './abbr-expand.js';
import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';

const containerEl = document.getElementById('patterns-cheat-sheet-content');

await attemptLoad({
  loader: () => loadJson('./data/cheat-data.json'),
  container: containerEl,
  render: buildCheatSheet
});

function buildCheatSheet(cheatData) {
  const grid = document.getElementById('cheat-sheet-grid');
  grid.innerHTML = '';
  const keyLabels = new Set();
  const colTemplate = document.createElement('div');
  colTemplate.classList.add('cheat-col');
  cheatData.forEach((col) => {
    const div = colTemplate.cloneNode(false);
    div.innerHTML = '<div class="cheat-col-header">'
      + expandAbbr(col.name) + '</div>'
      + col.rows.map((row) => {
        const keyCls = row.key ? ' key' : '';
        if (row.key) keyLabels.add(row.l);
        return '<div class="cheat-row'
          + keyCls + '">'
          + '<span>' + expandAbbr(row.l)
          + '</span>'
          + '<span>' + expandAbbr(row.v)
          + '</span></div>';
      }).join('');
    grid.appendChild(div);
  });
  const legendLabels = document.getElementById('cheat-legend-labels');
  if (keyLabels.size) {
    legendLabels.textContent = [...keyLabels].join(', ');
  }
}
