import { SI_SVG, HIP_SVG } from './equivalence.js';
import { showFetchError } from './fetch-feedback.js';
import { getStudyData } from './study-data-cache.js';

let JOINTS = [];
let DATA = {};
const KEYS = ['joint', 'type', 'motion', 'positions', 'role', 'scope'];

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
    cells[3].textContent = j.positions;
    cells[4].textContent = j.role;
    cells[5].textContent = j.scope;
    tbody.appendChild(row);

    const card = cardTpl.cloneNode(true);
    const vals = card.querySelectorAll('.trc-val');
    for (let k = 0; k < KEYS.length; k++) {
      vals[k].textContent = j[KEYS[k]];
    }
    cards.appendChild(card);
  }

  const siSlot = document.getElementById('si-svg-slot');
  siSlot.innerHTML = SI_SVG + '<p class="text-dim joint-schematic-caption">Sacroiliac joint</p>';

  const hipSlot = document.getElementById('hip-svg-slot');
  hipSlot.innerHTML = HIP_SVG + '<p class="text-dim joint-schematic-caption">Hip joint (acetabulofemoral)</p>';
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
        cells[k].textContent = d[ROW_KEYS[k]];
      }
      tbody.appendChild(row);

      const card = cardTpl.cloneNode(true);
      const vals = card.querySelectorAll('.trc-val');
      for (let k = 0; k < ROW_KEYS.length; k++) {
        vals[k].textContent = d[ROW_KEYS[k]];
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

export async function initNomenclature() {
  try {
    const jointsResp = await fetch('data/pelvic-joints.json');
    if (!jointsResp.ok) {
      showFetchError('#tab-nomenclature', 'nomenclature data');
      return;
    }
    JOINTS = await jointsResp.json();
  } catch (fetchErr) {
    showFetchError('#tab-nomenclature', 'nomenclature data');
    return;
  }
  DATA = await getStudyData();
  if (!DATA) {
    showFetchError('#tab-nomenclature', 'study data');
    return;
  }
  buildJointsView();
  buildTranslationTable();
}
