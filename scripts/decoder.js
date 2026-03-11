import { getAllEquivalent, getMuscles } from './equivalence.js';
import { showFetchError } from './fetch-feedback.js';

let REGIONS;

export async function initDecoder() {
  try {
    const resp = await fetch('data/regions.json');
    if (!resp.ok) {
      showFetchError('#anatomy-decoder', 'pelvis decoder regions');
      return;
    }
    REGIONS = await resp.json();
  } catch (fetchErr) {
    showFetchError('#anatomy-decoder', 'pelvis decoder regions');
    return;
  }
  let decoderState = { side: 'Left', region: 'ip', dir: 'er' };

  function makeControlGroup(containerId, key) {
    const container = document.getElementById(containerId);
    container.addEventListener('click', function(e) {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const active = container.querySelector('.btn.active');
      if (active) active.classList.remove('active');
      btn.classList.add('active');
      decoderState[key] = btn.dataset.val;
      updateDecoder();
    });
  }

  makeControlGroup('decoder-side-btns', 'side');
  makeControlGroup('decoder-region-btns', 'region');
  makeControlGroup('decoder-dir-btns', 'dir');

  function updateDecoder() {
    const { side, region, dir } = decoderState;
    renderPelvisSVG(side, region, dir);
    renderEquivChain(side, region, dir);
    renderMuscleList(side, region, dir);
  }

  updateDecoder();
}

function renderEquivChain(side, region, dir) {
  const equiv = getAllEquivalent(region, dir);
  const regionInfo = REGIONS.find(function(r) { return r.id === region; });
  const dirLabel = dir.toUpperCase();
  const el = document.getElementById('decoder-equiv');
  const regionLabels = { ip:'IP', is:'IS', isp:'IsP', si:'SI', af:'AF', fa:'FA' };
  let html = '<div style="font-family:var(--mono);font-size:var(--text-xs);color:var(--text-dim);margin-bottom:.4rem;">EQUIVALENCE CHAIN for ' + side + ' ' + (regionInfo ? regionInfo.label : region.toUpperCase()) + ' ' + dirLabel + '</div>';
  let first = true;
  Object.entries(equiv).forEach(function([rid, d]) {
    const label = regionLabels[rid] || rid.toUpperCase();
    const isCurrentRegion = rid === region;
    const prefix = first ? '' : '= ';
    const outletStyle = ['isp','si'].includes(rid) ? 'color:var(--outlet)' : '';
    html += '<div class="equiv-line' + (isCurrentRegion ? ' main' : '') + '" style="' + outletStyle + '">' + prefix + side + ' ' + label + ' ' + d + '</div>';
    first = false;
  });
  el.innerHTML = html;
}

function renderMuscleList(side, region, dir) {
  const muscles = getMuscles(side, region, dir);
  const el = document.getElementById('decoder-muscles');
  if (!muscles.length) {
    el.innerHTML = '<span class="text-dim" style="font-size:var(--text-sm);">No primary PRI muscles listed for this position.</span>';
  } else {
    el.innerHTML = '<div style="font-family:var(--mono);font-size:var(--text-xs);color:var(--text-dim);margin-bottom:.35rem;">MUSCLES THAT PRODUCE THIS MOTION</div>' +
      muscles.map(function(m) { return '<div style="font-size:var(--text-sm);padding:.2rem 0;">' + m + '</div>'; }).join('');
  }
}

function renderPelvisSVG(side, region, dir) {
  const wrap = document.getElementById('pelvis-svg-wrap');
  const equiv = getAllEquivalent(region, dir);
  const isAnteriorTilt = (equiv.ip === 'ER');
  const tiltDeg = isAnteriorTilt ? 14 : -14;
  const outletOpen = (equiv.isp === 'ER');
  const CX = 200, CY = 200;

  const inletColor = 'var(--inlet)';
  const outletColor = 'var(--outlet)';

  const inletOpen = (equiv.ip === 'ER');
  const inletStatus = inletOpen ? 'INLET OPENS' : 'INLET CLOSES';
  const outletStatus = outletOpen ? 'OUTLET OPENS' : 'OUTLET CLOSES';
  const floorStatus = outletOpen ? 'Pelvic floor ascending \u2191' : 'Pelvic floor descended \u2193';

  const motionArrows = isAnteriorTilt
    ? '<path d="M148,125 Q130,145 120,170" fill="none" stroke="' + inletColor + '" stroke-width="1.8" marker-end="url(#arr-in)"/>'
      + '<text x="88" y="165" font-family="monospace" font-size="9" fill="' + inletColor + '" text-anchor="middle">ASIS drops</text>'
      + '<text x="88" y="175" font-family="monospace" font-size="9" fill="' + inletColor + '" text-anchor="middle">forward</text>'
    : '<path d="M148,125 Q130,105 125,85" fill="none" stroke="' + inletColor + '" stroke-width="1.8" marker-end="url(#arr-in)"/>'
      + '<text x="90" y="82" font-family="monospace" font-size="9" fill="' + inletColor + '" text-anchor="middle">ASIS rises</text>'
      + '<text x="90" y="92" font-family="monospace" font-size="9" fill="' + inletColor + '" text-anchor="middle">backward</text>';

  const asisY = isAnteriorTilt ? 105 : 130;
  const sacralY = isAnteriorTilt ? 112 : 105;

  const svg = '<svg viewBox="0 0 420 380" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">'
    + '<defs>'
    + '<marker id="arr-sv" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0, 7 2.5, 0 5" fill="var(--text-dim)"/></marker>'
    + '<marker id="arr-in" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0, 7 2.5, 0 5" fill="' + inletColor + '"/></marker>'
    + '<marker id="arr-out" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto"><polygon points="0 0, 7 2.5, 0 5" fill="' + outletColor + '"/></marker>'
    + '</defs>'
    + '<g opacity="0.1" stroke="var(--text)" fill="var(--text)">'
    + '<path d="M200,80 Q260,70 290,110 Q310,135 295,175 Q280,200 200,200 Q140,200 130,175 Q118,140 140,110 Q165,75 200,80 Z" fill="var(--surface2)" stroke="var(--text)" stroke-width="1.5"/>'
    + '<path d="M200,200 Q240,220 250,260 Q255,285 230,295 Q200,305 175,295 Q152,285 155,260 Q160,220 200,200 Z" fill="var(--surface2)" stroke="var(--text)" stroke-width="1.5"/>'
    + '</g>'
    + '<g transform="rotate(' + tiltDeg + ', ' + CX + ', ' + CY + ')">'
    + '<path d="M200,80 Q265,68 295,112 Q318,138 300,178 Q283,204 200,204 Q138,204 126,178 Q112,138 140,110 Q165,73 200,80 Z" fill="var(--surface)" stroke="var(--text)" stroke-width="1.8"/>'
    + '<path d="M200,204 Q244,224 254,265 Q260,290 232,300 Q200,310 172,300 Q147,290 150,265 Q158,224 200,204 Z" fill="var(--surface)" stroke="var(--text)" stroke-width="1.8"/>'
    + '<ellipse cx="200" cy="290" rx="28" ry="18" fill="var(--surface2)" stroke="var(--text)" stroke-width="1.5"/>'
    + '<circle cx="200" cy="200" r="28" fill="var(--surface2)" stroke="var(--warn)" stroke-width="2.2"/>'
    + '<circle cx="200" cy="200" r="4" fill="var(--warn)"/>'
    + '<path d="M148,118 Q170,90 200,82 Q230,90 252,118" fill="none" stroke="' + inletColor + '" stroke-width="3" stroke-linecap="round"/>'
    + '<path d="M165,280 Q200,310 235,280" fill="none" stroke="' + outletColor + '" stroke-width="3" stroke-linecap="round"/>'
    + '<circle cx="148" cy="118" r="5" fill="' + inletColor + '" opacity="0.9"/>'
    + '<circle cx="262" cy="125" r="5" fill="' + inletColor + '" opacity="0.7"/>'
    + '<circle cx="200" cy="295" r="5" fill="' + outletColor + '" opacity="0.9"/>'
    + '<circle cx="165" cy="280" r="5" fill="' + outletColor + '" opacity="0.8"/>'
    + '<circle cx="235" cy="280" r="5" fill="' + outletColor + '" opacity="0.8"/>'
    + '<circle cx="265" cy="275" r="4" fill="' + outletColor + '" opacity="0.6"/>'
    + '</g>'
    + '<text x="118" y="' + asisY + '" font-family="monospace" font-size="10" fill="' + inletColor + '" text-anchor="end">ASIS</text>'
    + '<text x="330" y="' + sacralY + '" font-family="monospace" font-size="10" fill="' + inletColor + '">Sacral base</text>'
    + '<text x="210" y="320" font-family="monospace" font-size="10" fill="' + outletColor + '">Pubic symphysis</text>'
    + '<text x="344" y="200" font-family="monospace" font-size="10" fill="var(--warn)" text-anchor="middle">Acetabulum</text>'
    + '<text x="118" y="285" font-family="monospace" font-size="10" fill="' + outletColor + '" text-anchor="end">Ischial tub.</text>'
    + '<text x="330" y="278" font-family="monospace" font-size="10" fill="' + outletColor + '">Coccyx</text>'
    + motionArrows
    + '<rect x="10" y="10" width="115" height="36" rx="4" fill="var(--surface)" stroke="' + inletColor + '" stroke-width="1.5"/>'
    + '<text x="67" y="26" text-anchor="middle" font-family="monospace" font-size="9" fill="' + inletColor + '" font-weight="700">' + inletStatus + '</text>'
    + '<text x="67" y="38" text-anchor="middle" font-family="monospace" font-size="8" fill="var(--text-dim)">(inlet ring)</text>'
    + '<rect x="10" y="52" width="115" height="36" rx="4" fill="var(--surface)" stroke="' + outletColor + '" stroke-width="1.5"/>'
    + '<text x="67" y="68" text-anchor="middle" font-family="monospace" font-size="9" fill="' + outletColor + '" font-weight="700">' + outletStatus + '</text>'
    + '<text x="67" y="80" text-anchor="middle" font-family="monospace" font-size="8" fill="var(--text-dim)">(outlet ring)</text>'
    + '<text x="210" y="350" text-anchor="middle" font-family="monospace" font-size="10" fill="var(--text-dim)">' + floorStatus + '</text>'
    + '</svg>';
  wrap.innerHTML = svg;
}
