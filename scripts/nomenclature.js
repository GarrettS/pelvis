import { loadJson } from './load.js';
import { loadAndRender } from './error-ui.js';
import { expandAbbr } from './abbr-expand.js';

const KEYS = ['joint', 'type', 'motion', 'positions', 'role'];

const container = document.getElementById('nomenclature-content');

await Promise.all([
  loadAndRender({
    load: () => loadJson('./data/pelvic-joints.json'),
    container,
    render: buildJointsView
  }),
  loadAndRender({
    load: () => loadJson('./data/nomenclature-translations.json'),
    container,
    render: buildTranslationTable
  })
]);

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

function buildTranslationTable(rows) {
  const tbody = document.getElementById('translation-tbody');
  const cards = document.getElementById('translation-cards');
  const rowTpl = document.getElementById('translation-row-tpl').content;
  const cardTpl = document.getElementById('translation-card-tpl').content;

  const ROW_KEYS = [
    'priTerm', 'realStructure', 'whatPriRenamed',
    'whatActuallyHappened', 'standardTerm', 'encodedTreatment'
  ];

  function renderRows(filtered) {
    tbody.textContent = '';
    cards.textContent = '';
    for (let i = 0; i < filtered.length; i++) {
      const d = filtered[i];

      const row = rowTpl.cloneNode(true);
      const cells = row.querySelector('tr').cells;
      for (let k = 0; k < ROW_KEYS.length; k++) {
        cells[k].innerHTML = expandAbbr(d[ROW_KEYS[k]]);
      }
      tbody.appendChild(row);

      const card = cardTpl.cloneNode(true);
      const vals = card.querySelectorAll('.trc-val');
      for (let k = 0; k < ROW_KEYS.length; k++) {
        vals[k].innerHTML = expandAbbr(d[ROW_KEYS[k]]);
      }
      cards.appendChild(card);
    }
  }

  renderRows(rows);

  const searchInput = document.getElementById('translation-search');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    const filtered = q ? rows.filter((r) =>
      ROW_KEYS.some((k) => r[k]
        && expandAbbr(r[k]).toLowerCase().includes(q))
    ) : rows;
    renderRows(filtered);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });
}
