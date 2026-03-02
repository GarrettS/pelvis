window.AicChainModule = (function() {
  'use strict';

  const AIC_CHAIN = [
    {
      id: 'diaphragm',
      label: 'Diaphragm',
      connection: 'crural pull / ZOA loss',
      anchor: [25, 15]
    },
    {
      id: 'psoas',
      label: 'Psoas',
      connection: 'shortens, pulls ilium forward',
      anchor: [30, 28]
    },
    {
      id: 'iliacus',
      label: 'Iliacus',
      connection: 'anterior pelvic tilt (L IP ER)',
      anchor: [35, 40]
    },
    {
      id: 'tfl',
      label: 'TFL',
      connection: 'orientates femur',
      anchor: [33, 48]
    },
    {
      id: 'vastus_lateralis',
      label: 'Vastus Lateralis',
      connection: 'lateral knee tension',
      anchor: [35, 62]
    },
    {
      id: 'biceps_femoris',
      label: 'Biceps Femoris',
      connection: null,
      anchor: [58, 68]
    }
  ];

  const AIC_DETAIL = {
    diaphragm: {
      role: 'Drives respiration. In L AIC, the left diaphragm loses its Zone of Apposition (ZOA), flattening and pulling the crura downward.',
      pattern: 'L diaphragm descends \u2192 L crural pull \u2192 lumbar hyperextension bias. Loss of ZOA = loss of respiratory opposition.',
      correction: 'Restore L ZOA via 90-90 hip lift with balloon. Exhale to reposition diaphragm dome.'
    },
    psoas: {
      role: 'Primary hip flexor and lumbar spine stabilizer. In L AIC, the left psoas shortens, pulling the left ilium into anterior tilt.',
      pattern: 'L psoas shortens \u2192 L lumbar lordosis \u2192 L IP ER (anterior tilt). Feeds forward into iliacus.',
      correction: 'Inhibit through positioning (90-90). Not directly stretched \u2014 repositioned via pelvic correction.'
    },
    iliacus: {
      role: 'Hip flexor originating from iliac fossa. Works with psoas to anteriorly tilt the pelvis.',
      pattern: 'L iliacus pulls ilium forward \u2192 L IP ER \u2192 anterior pelvic tilt on left.',
      correction: 'Repositioned via L AF IR activities. Not directly targeted in isolation.'
    },
    tfl: {
      role: 'Tensor fasciae latae. Abducts, flexes, and internally rotates the femur. Orientates femoral position.',
      pattern: 'L TFL compensates for femoral orientation in L AIC pattern. Contributes to lateral knee tension.',
      correction: 'Addressed indirectly through femoral repositioning (L AF IR).'
    },
    vastus_lateralis: {
      role: 'Largest quadriceps component. Extends the knee with a lateral pull vector.',
      pattern: 'Lateral knee tension from TFL transmitted through IT band and vastus lateralis. Knee tracks laterally.',
      correction: 'Corrected by restoring femoral IR and addressing proximal chain (hip/pelvis).'
    },
    biceps_femoris: {
      role: 'Long head: hip extension and knee flexion. Terminal muscle in L AIC chain.',
      pattern: 'L biceps femoris (long head) = terminal link. Compensatory ER of tibia on femur.',
      correction: 'Inhibited as compensator. Corrective hamstring work uses medial hamstrings (semimembranosus/semitendinosus).'
    }
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';

  let activeId = null;
  let containerEl = null;
  let panelEl = null;
  let overlayEl = null;
  let leaderEl = null;
  let imgEl = null;
  let detailEl = null;

  function init() {
    containerEl = document.querySelector('.aic-chain-container');
    if (!containerEl) return;

    panelEl = containerEl.querySelector('.aic-chain-panel');
    overlayEl = containerEl.querySelector('.aic-chain-overlay');
    imgEl = containerEl.querySelector('.aic-chain-img');
    leaderEl = containerEl.parentElement.querySelector('.aic-leader-svg');
    detailEl = containerEl.parentElement.querySelector('.aic-chain-detail');
    if (!detailEl) {
      detailEl = document.createElement('div');
      detailEl.className = 'aic-chain-detail';
      containerEl.parentElement.appendChild(detailEl);
    }

    buildPanel();
    setupOverlay();
    attachListeners();

    window.addEventListener('resize', handleResize);
  }

  function buildPanel() {
    const frag = document.createDocumentFragment();

    AIC_CHAIN.forEach(function(muscle, i) {
      const row = document.createElement('div');
      row.className = 'aic-chain-row';
      row.dataset.muscleId = muscle.id;
      row.textContent = muscle.label;
      frag.appendChild(row);

      if (i < AIC_CHAIN.length - 1 && muscle.connection) {
        const conn = document.createElement('div');
        conn.className = 'aic-chain-connection';
        conn.textContent = '\u2193 ' + muscle.connection;
        frag.appendChild(conn);
      }

      if (i === AIC_CHAIN.length - 1) {
        const terminal = document.createElement('div');
        terminal.className = 'aic-chain-connection aic-chain-terminal';
        terminal.textContent = '(long head \u2014 terminal)';
        frag.appendChild(terminal);
      }
    });

    panelEl.appendChild(frag);
  }

  function setupOverlay() {
    overlayEl.setAttribute('viewBox', '0 0 100 100');
    overlayEl.setAttribute('preserveAspectRatio', 'none');

    AIC_CHAIN.forEach(function(muscle) {
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', String(muscle.anchor[0]));
      circle.setAttribute('cy', String(muscle.anchor[1]));
      circle.setAttribute('r', '3');
      circle.setAttribute('fill', 'var(--accent)');
      circle.setAttribute('fill-opacity', '0.4');
      circle.setAttribute('stroke', 'var(--accent)');
      circle.setAttribute('stroke-width', '0.5');
      circle.setAttribute('data-muscle-id', muscle.id);
      circle.style.cursor = 'pointer';
      circle.style.pointerEvents = 'all';
      overlayEl.appendChild(circle);
    });
  }

  function attachListeners() {
    panelEl.addEventListener('click', function(e) {
      const row = e.target.closest('.aic-chain-row');
      if (!row) return;
      e.stopPropagation();
      activateMuscle(row.dataset.muscleId);
    });

    overlayEl.addEventListener('click', function(e) {
      const circle = e.target.closest('circle[data-muscle-id]');
      if (!circle) return;
      e.stopPropagation();
      activateMuscle(circle.dataset.muscleId);
    });

    containerEl.parentElement.addEventListener('click', function(e) {
      if (e.target.closest('.aic-chain-row')) return;
      if (e.target.closest('circle[data-muscle-id]')) return;
      deactivateAll();
    });
  }

  function activateMuscle(id) {
    if (activeId === id) {
      deactivateAll();
      return;
    }

    deactivateAll();
    activeId = id;

    const entry = AIC_CHAIN.find(function(m) { return m.id === id; });
    if (!entry) return;

    const row = panelEl.querySelector(
        '.aic-chain-row[data-muscle-id="' + id + '"]');
    if (row) {
      row.classList.add('active');
      row.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    }

    showPulseCircle(entry);
    drawLeaderLine(row, entry);
    showDetail(entry);
  }

  function deactivateAll() {
    activeId = null;

    const rows = panelEl.querySelectorAll('.aic-chain-row');
    rows.forEach(function(r) { r.classList.remove('active'); });

    clearSvg(leaderEl);
    removePulseCircle();
    if (detailEl) detailEl.textContent = '';
  }

  function showDetail(entry) {
    if (!detailEl) return;
    detailEl.textContent = '';
    var info = AIC_DETAIL[entry.id];
    if (!info) return;

    var panel = document.createElement('div');
    panel.className = 'detail-panel';
    panel.style.borderLeft = '4px solid var(--accent)';

    var heading = document.createElement('h3');
    heading.textContent = entry.label;
    panel.appendChild(heading);

    var fields = [
      {label: 'Role', value: info.role},
      {label: 'L AIC Pattern', value: info.pattern},
      {label: 'Correction', value: info.correction}
    ];
    fields.forEach(function(f) {
      var row = document.createElement('div');
      row.className = 'detail-row';
      var labelEl = document.createElement('span');
      labelEl.className = 'detail-label';
      labelEl.textContent = f.label;
      row.appendChild(labelEl);
      var valEl = document.createElement('span');
      valEl.style.fontSize = 'var(--text-sm)';
      valEl.textContent = f.value;
      row.appendChild(valEl);
      panel.appendChild(row);
    });

    detailEl.appendChild(panel);
  }

  function showPulseCircle(entry) {
    removePulseCircle();

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(entry.anchor[0]));
    circle.setAttribute('cy', String(entry.anchor[1]));
    circle.setAttribute('r', '2');
    circle.setAttribute('class', 'aic-anchor-pulse');
    circle.style.pointerEvents = 'none';
    overlayEl.appendChild(circle);
  }

  function removePulseCircle() {
    const existing = overlayEl.querySelector('.aic-anchor-pulse');
    if (existing) existing.remove();
  }

  function drawLeaderLine(rowEl, entry) {
    clearSvg(leaderEl);
    if (!rowEl || !entry) return;

    const tabSection = containerEl.parentElement;
    const sectionRect = tabSection.getBoundingClientRect();

    const leaderW = sectionRect.width;
    const leaderH = sectionRect.height;
    leaderEl.setAttribute('viewBox',
        '0 0 ' + leaderW + ' ' + leaderH);
    leaderEl.style.width = leaderW + 'px';
    leaderEl.style.height = leaderH + 'px';

    const rowRect = rowEl.getBoundingClientRect();
    const startX = rowRect.right - sectionRect.left;
    const startY = rowRect.top + rowRect.height / 2 - sectionRect.top;

    const imgRect = imgEl.getBoundingClientRect();
    const endX = imgRect.left + (entry.anchor[0] / 100) * imgRect.width -
        sectionRect.left;
    const endY = imgRect.top + (entry.anchor[1] / 100) * imgRect.height -
        sectionRect.top;

    const midX = startX + (endX - startX) * 0.5;

    const pathD = 'M ' + startX + ' ' + startY +
        ' Q ' + midX + ' ' + startY + ' ' + endX + ' ' + endY;

    const defs = document.createElementNS(SVG_NS, 'defs');
    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', 'aic-arrowhead');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');

    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', '0 0, 8 3, 0 6');
    polygon.setAttribute('fill', 'var(--accent)');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    leaderEl.appendChild(defs);

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--accent)');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('marker-end', 'url(#aic-arrowhead)');
    path.classList.add('aic-leader-path');

    const totalLength = approximateQuadLength(
        startX, startY, midX, startY, endX, endY);
    path.style.strokeDasharray = String(totalLength);
    path.style.strokeDashoffset = String(totalLength);

    leaderEl.appendChild(path);

    requestAnimationFrame(function() {
      path.style.transition = 'stroke-dashoffset 200ms ease-out';
      path.style.strokeDashoffset = '0';
    });
  }

  function approximateQuadLength(x0, y0, cx, cy, x1, y1) {
    let length = 0;
    let prevX = x0;
    let prevY = y0;
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const invT = 1 - t;
      const px = invT * invT * x0 + 2 * invT * t * cx + t * t * x1;
      const py = invT * invT * y0 + 2 * invT * t * cy + t * t * y1;
      const dx = px - prevX;
      const dy = py - prevY;
      length += Math.sqrt(dx * dx + dy * dy);
      prevX = px;
      prevY = py;
    }
    return length;
  }

  function clearSvg(svg) {
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }
  }

  function handleResize() {
    if (!activeId) return;
    const entry = AIC_CHAIN.find(function(m) { return m.id === activeId; });
    const row = panelEl.querySelector(
        '.aic-chain-row[data-muscle-id="' + activeId + '"]');
    if (entry && row) {
      drawLeaderLine(row, entry);
    }
  }

  return {init: init};
})();

document.addEventListener('DOMContentLoaded', function() {
  window.AicChainModule.init();
});
