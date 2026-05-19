import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';

const KEYS = ['joint', 'type', 'motion', 'positions', 'role'];

const container = document.getElementById('nomenclature-joints-content');

await attemptLoad({
  loader: () => loadJson('./data/pelvic-joints.json'),
  container,
  render: buildJointsView
});

function buildJointsView(joints) {
  const tbody = document.getElementById('joints-tbody');
  const cards = document.getElementById('joints-cards');
  const rowTpl = document.getElementById('joint-row-tpl').content;
  const cardTpl = document.getElementById('joint-card-tpl').content;

  for (let i = 0; i < joints.length; i++) {
    const j = joints[i];

    const row = rowTpl.cloneNode(true);
    const cells = row.querySelector('tr').cells;
    cells[0].firstElementChild.textContent = j.joint;
    cells[1].textContent = j.type;
    cells[2].textContent = j.motion;
    cells[3].innerHTML = expandAbbr(j.positions);
    cells[4].innerHTML = expandAbbr(j.role);
    tbody.appendChild(row);

    const card = cardTpl.cloneNode(true);
    const vals = card.querySelectorAll('.trc-val');
    for (let k = 0; k < KEYS.length; k++) {
      vals[k].innerHTML = expandAbbr(j[KEYS[k]]);
    }
    cards.appendChild(card);
  }
}
