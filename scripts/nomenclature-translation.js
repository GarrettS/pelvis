import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';

const ROW_KEYS = [
  'priTerm', 'realStructure', 'whatPriRenamed',
  'whatActuallyHappened', 'standardTerm', 'encodedTreatment'
];

const container = document.getElementById('nomenclature-translation-content');

await attemptLoad({
  loader: () => loadJson('./data/nomenclature-translations.json'),
  container,
  render: buildTranslationTable
});

function buildTranslationTable(rows) {
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

function renderRows(filtered) {
  const tbody = document.getElementById('translation-tbody');
  const cards = document.getElementById('translation-cards');
  const rowTpl = document.getElementById('translation-row-tpl').content;
  const cardTpl = document.getElementById('translation-card-tpl').content;

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
