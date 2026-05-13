import {getAllEquivalent, getMuscles} from './equivalence.js';
import {newEl} from './el-create.js';

const REGIONS_WITH_OUTLET = new Set(['IsP', 'SI']);

const decoderState = {side: 'Left', region: 'IP', dir: 'ER'};
let equiv = getAllEquivalent(decoderState.region, decoderState.dir);

const pelvisSvg = document.getElementById('pelvis-svg');
const tiltGroup = document.getElementById('pelvis-tilt-group');
const asisLabel = document.getElementById('pelvis-asis-label');
const sacralLabel = document.getElementById('pelvis-sacral-label');
const inletStatus = document.getElementById('pelvis-inlet-status');
const outletStatus = document.getElementById('pelvis-outlet-status');
const floorStatus = document.getElementById('pelvis-floor-status');
const equivEl = document.getElementById('decoder-equiv');
const musclesEl = document.getElementById('decoder-muscles');

function bindControlGroup(containerId, key) {
  const container = document.getElementById(containerId);
  let activeBtn = container.querySelector('button.active');
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (activeBtn) activeBtn.classList.remove('active');
    btn.classList.add('active');
    activeBtn = btn;
    decoderState[key] = btn.dataset.val;
    updateDecoder();
  });
}

function updateDecoder() {
  equiv = getAllEquivalent(decoderState.region, decoderState.dir);
  updatePelvisSvg();
  renderEquivChain();
  renderMuscleList();
}

function updatePelvisSvg() {
  const isAnteriorTilt = equiv.IP === 'ER';
  const outletOpen = equiv.IsP === 'ER';

  pelvisSvg.classList.toggle('tilt-anterior', isAnteriorTilt);
  pelvisSvg.classList.toggle('tilt-posterior', !isAnteriorTilt);
  tiltGroup.setAttribute(
      'transform',
      `rotate(${isAnteriorTilt ? 14 : -14}, 200, 200)`);
  asisLabel.setAttribute('y', isAnteriorTilt ? '105' : '130');
  sacralLabel.setAttribute('y', isAnteriorTilt ? '112' : '105');

  inletStatus.textContent = isAnteriorTilt ? 'INLET OPENS' : 'INLET CLOSES';
  outletStatus.textContent = outletOpen ? 'OUTLET OPENS' : 'OUTLET CLOSES';
  floorStatus.textContent = outletOpen
      ? 'Pelvic floor ascending ↑'
      : 'Pelvic floor descended ↓';
}

function equivLineClass(rid) {
  const classes = ['equiv-line'];
  if (rid === decoderState.region) classes.push('main');
  if (REGIONS_WITH_OUTLET.has(rid)) classes.push('outlet');
  return classes.join(' ');
}

function renderEquivChain() {
  const {side, region, dir} = decoderState;
  equivEl.replaceChildren(
      newEl('div', {
        className: 'equiv-chain-label',
        textContent: `EQUIVALENCE CHAIN for ${side} ${region} ${dir}`
      }),
      ...Object.entries(equiv).map(([rid, d], i) => newEl('div', {
        className: equivLineClass(rid),
        textContent: `${i === 0 ? '' : '= '}${side} ${rid} ${d}`
      }))
  );
}

function renderMuscleList() {
  const {side, region, dir} = decoderState;
  const muscles = getMuscles(side, region, dir);
  if (!muscles.length) {
    musclesEl.replaceChildren(newEl('span', {
      className: 'decoder-muscles-empty',
      textContent: 'No primary PRI muscles listed for this position.'
    }));
    return;
  }

  musclesEl.replaceChildren(
      newEl('div', {
        className: 'decoder-muscles-label',
        textContent: 'MUSCLES THAT PRODUCE THIS MOTION'
      }),
      ...muscles.map((m) => newEl('div', {
        className: 'decoder-muscle-item',
        textContent: m
      }))
  );
}

bindControlGroup('decoder-side-btns', 'side');
bindControlGroup('decoder-region-btns', 'region');
bindControlGroup('decoder-dir-btns', 'dir');
updateDecoder();
