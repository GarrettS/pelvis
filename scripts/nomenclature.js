import { showFetchError } from "./load-errors.js";
import { getStudyData } from './study-data-cache.js';
import { expandAbbr } from './abbr-expand.js';

let JOINTS = [];
let DATA = {};
const KEYS = ['joint', 'type', 'motion', 'positions', 'role'];

function buildJointsView() {
  const tbody = document.getElementById('joints-tbody');
  const cards = document.getElementById('joints-cards');
  const rowTpl = document.getElementById('joint-row-tpl').content;
  const cardTpl = document.getElementById('joint-card-tpl').content;

  for (let i = 0; i < JOINTS.length; i++) {
    const j = JOINTS[i];

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

function buildTranslationTable() {
  const tbody = document.getElementById('translation-tbody');
  const cards = document.getElementById('translation-cards');
  const rowTpl = document.getElementById('translation-row-tpl').content;
  const cardTpl = document.getElementById('translation-card-tpl').content;
  const rows = DATA.translationMap;

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
      (r.priTerm + r.realStructure + r.whatPriRenamed +
        r.whatActuallyHappened + r.standardTerm + r.encodedTreatment
      ).toLowerCase().includes(q)
    ) : rows;
    renderRows(filtered);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });
}

export async function init() {
  const container = document.getElementById('nomenclature-content');
  if (!container) return;

  try {
    const jointsResp = await fetch('data/pelvic-joints.json');
    if (!jointsResp.ok) {
      showFetchError(container, 'pelvic-joints.json', jointsResp);
      return;
    }
    JOINTS = await jointsResp.json();
  } catch (cause) {
    showFetchError(container, 'pelvic-joints.json', cause);
    return;
  }
  try {
    DATA = await getStudyData();
  } catch (cause) {
    showFetchError(container, 'study-data.json', cause);
    return;
  }
  buildJointsView();
  buildTranslationTable();
}
