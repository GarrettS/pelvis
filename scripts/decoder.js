import { getAllEquivalent, getMuscles } from './equivalence.js';
import { showFetchError } from './fetch-feedback.js';

let REGIONS;

export async function init() {
  try {
    const resp = await fetch('data/regions.json');
    if (!resp.ok) {
      showFetchError('#anatomy-decoder-content', 'pelvis decoder regions');
      return;
    }
    REGIONS = await resp.json();
  } catch (fetchErr) {
    showFetchError('#anatomy-decoder-content', 'pelvis decoder regions');
    return;
  }
  const decoderState = { side: 'Left', region: 'IP', dir: 'ER' };

  function makeControlGroup(containerId, key) {
    const container = document.getElementById(containerId);
    let activeBtn = container.querySelector('.btn.active');
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      if (activeBtn) activeBtn.classList.remove('active');
      btn.classList.add('active');
      activeBtn = btn;
      decoderState[key] = btn.dataset.val;
      updateDecoder();
    });
  }

  makeControlGroup('decoder-side-btns', 'side');
  makeControlGroup('decoder-region-btns', 'region');
  makeControlGroup('decoder-dir-btns', 'dir');

  const tiltGroup = document.getElementById('pelvis-tilt-group');
  const asisLabel = document.getElementById('pelvis-asis-label');
  const sacralLabel = document.getElementById('pelvis-sacral-label');
  const motionAnt = document.getElementById('pelvis-motion-ant');
  const motionPost = document.getElementById('pelvis-motion-post');
  const inletStatus = document.getElementById('pelvis-inlet-status');
  const outletStatus = document.getElementById('pelvis-outlet-status');
  const floorStatus = document.getElementById('pelvis-floor-status');

  function updatePelvisSVG(equiv) {
    const isAnteriorTilt = (equiv.IP === 'ER');
    const tiltDeg = isAnteriorTilt ? 14 : -14;
    const outletOpen = (equiv.IsP === 'ER');

    tiltGroup.setAttribute('transform', 'rotate(' + tiltDeg + ', 200, 200)');
    asisLabel.setAttribute('y', isAnteriorTilt ? '105' : '130');
    sacralLabel.setAttribute('y', isAnteriorTilt ? '112' : '105');

    motionAnt.setAttribute('display', isAnteriorTilt ? 'inline' : 'none');
    motionPost.setAttribute('display', isAnteriorTilt ? 'none' : 'inline');

    inletStatus.textContent = isAnteriorTilt ? 'INLET OPENS' : 'INLET CLOSES';
    outletStatus.textContent = outletOpen ? 'OUTLET OPENS' : 'OUTLET CLOSES';
    floorStatus.textContent = outletOpen ? 'Pelvic floor ascending \u2191' : 'Pelvic floor descended \u2193';
  }

  function updateDecoder() {
    const { side, region, dir } = decoderState;
    const equiv = getAllEquivalent(region, dir);
    updatePelvisSVG(equiv);
    renderEquivChain(side, region, dir, equiv);
    renderMuscleList(side, region, dir);
  }

  updateDecoder();
}

function renderEquivChain(side, region, dir, equiv) {
  const el = document.getElementById('decoder-equiv');
  let html = '<div class="equiv-chain-label">EQUIVALENCE CHAIN for ' + side + ' ' + region + ' ' + dir + '</div>';
  let isFirst = true;
  Object.entries(equiv).forEach(([rid, d]) => {
    const outletClass = ['IsP', 'SI'].includes(rid) ? ' outlet' : '';
    html += '<div class="equiv-line' + (rid === region ? ' main' : '') + outletClass + '">' + (isFirst ? '' : '= ') + side + ' ' + rid + ' ' + d + '</div>';
    isFirst = false;
  });
  el.innerHTML = html;
}

function renderMuscleList(side, region, dir) {
  const muscles = getMuscles(side, region, dir);
  const el = document.getElementById('decoder-muscles');
  if (!muscles.length) {
    el.innerHTML = '<span class="decoder-muscles-empty">No primary PRI muscles listed for this position.</span>';
  } else {
    el.innerHTML = '<div class="decoder-muscles-label">MUSCLES THAT PRODUCE THIS MOTION</div>' +
      muscles.map(m => '<div class="decoder-muscle-item">' + m + '</div>').join('');
  }
}
