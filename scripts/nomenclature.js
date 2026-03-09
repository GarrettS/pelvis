import { SI_SVG, HIP_SVG } from './equivalence.js';
import { showFetchError } from './fetch-feedback.js';

let JOINTS = [];
let DATA = {};
const KEYS = ['joint', 'type', 'motion', 'positions', 'role', 'scope'];

function buildJointsView() {
  const tbody = document.getElementById('joints-tbody');
  const cards = document.getElementById('joints-cards');
  const rowTpl = document.getElementById('joint-row-tpl').content;
  const cardTpl = document.getElementById('joint-card-tpl').content;

  for (var i = 0; i < JOINTS.length; i++) {
    var j = JOINTS[i];

    var row = rowTpl.cloneNode(true);
    var cells = row.querySelector('tr').cells;
    cells[0].firstElementChild.textContent = j.joint;
    cells[1].textContent = j.type;
    cells[2].textContent = j.motion;
    cells[3].textContent = j.positions;
    cells[4].textContent = j.role;
    cells[5].textContent = j.scope;
    tbody.appendChild(row);

    var card = cardTpl.cloneNode(true);
    var vals = card.querySelectorAll('.trc-val');
    for (var k = 0; k < KEYS.length; k++) {
      vals[k].textContent = j[KEYS[k]];
    }
    cards.appendChild(card);
  }

  var siSlot = document.getElementById('si-svg-slot');
  siSlot.innerHTML = SI_SVG + '<p class="text-dim joint-schematic-caption">Sacroiliac joint</p>';

  var hipSlot = document.getElementById('hip-svg-slot');
  hipSlot.innerHTML = HIP_SVG + '<p class="text-dim joint-schematic-caption">Hip joint (acetabulofemoral)</p>';
}

function buildTranslationTable() {
  var tbody = document.getElementById('translation-tbody');
  var cards = document.getElementById('translation-cards');
  var rowTpl = document.getElementById('translation-row-tpl').content;
  var cardTpl = document.getElementById('translation-card-tpl').content;
  var rows = DATA.translationMap;

  var ROW_KEYS = [
    'priTerm', 'realStructure', 'whatPriRenamed',
    'whatActuallyHappened', 'standardTerm', 'encodedTreatment'
  ];

  function renderRows(filtered) {
    tbody.innerHTML = '';
    cards.innerHTML = '';
    for (var i = 0; i < filtered.length; i++) {
      var d = filtered[i];

      var row = rowTpl.cloneNode(true);
      var cells = row.querySelector('tr').cells;
      for (var k = 0; k < ROW_KEYS.length; k++) {
        cells[k].textContent = d[ROW_KEYS[k]];
      }
      tbody.appendChild(row);

      var card = cardTpl.cloneNode(true);
      var vals = card.querySelectorAll('.trc-val');
      for (var k = 0; k < ROW_KEYS.length; k++) {
        vals[k].textContent = d[ROW_KEYS[k]];
      }
      cards.appendChild(card);
    }
  }

  renderRows(rows);

  var searchInput = document.getElementById('translation-search');
  searchInput.addEventListener('input', function() {
    var q = searchInput.value.toLowerCase();
    var filtered = q ? rows.filter(function(r) {
      return (r.priTerm + r.realStructure + r.whatPriRenamed +
        r.whatActuallyHappened + r.standardTerm + r.encodedTreatment
      ).toLowerCase().includes(q);
    }) : rows;
    renderRows(filtered);
  });
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') e.preventDefault();
  });
}

export async function initNomenclature() {
  try {
    const jointsResp = await fetch('data/pelvic-joints.json');
    const dataResp = await fetch('data/study-data.json');
    if (!jointsResp.ok || !dataResp.ok) {
      showFetchError('#tab-nomenclature', 'nomenclature data');
      return;
    }
    JOINTS = await jointsResp.json();
    DATA = await dataResp.json();
  } catch (_) {
    showFetchError('#tab-nomenclature', 'nomenclature data');
    return;
  }
  buildJointsView();
  buildTranslationTable();
}

document.addEventListener('DOMContentLoaded', function() {
  initNomenclature();
});
