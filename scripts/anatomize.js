window.AnatomizeModule = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let state = {
    imageId: null,
    mechanic: null,
    structures: [],
    queue: [],
    current: null,
    score: 0,
    identified: new Set(),
    firstAttempt: new Set(),
    attempts: 0,
    mode: 'standard',
    filter: 'all',
    timer: null,
    startTime: null,
    speedResults: [],
    reviewing: false
  };

  let dom = {};
  let isMobile = false;
  let initialized = false;
  let attemptedOnCurrent = false;

  function init() {
    const container = document.querySelector(
        '#anatomy-anatomize .tab-section');
    if (!container) return;

    dom.container = container;
    dom.imageSelector = container.querySelector('.anatomize-image-selector');
    dom.filterRow = container.querySelector('.anatomize-filter');
    dom.modeToggle = container.querySelector('.anatomize-mode-toggle');
    dom.resetBtn = container.querySelector('.anatomize-reset');
    dom.prompt = container.querySelector('.anatomize-prompt');
    dom.arena = container.querySelector('.anatomize-arena');
    dom.scoreDisplay = container.querySelector('.anatomize-score');
    dom.detail = container.querySelector('.anatomize-detail');
    dom.imageTitle = container.parentElement.querySelector('.anatomize-image-title');

    isMobile = window.matchMedia('(max-width: 600px)').matches;
    window.matchMedia('(max-width: 600px)').addEventListener(
        'change', (e) => {
          isMobile = e.matches;
          if (state.imageId) {
            resetSession();
          }
        });

    renderImageSelector();
    renderControls();

    dom.resetBtn.addEventListener('click', () => {
      resetSession();
    });

    const anatomizePanel = document.getElementById('anatomy-anatomize');
    if (anatomizePanel) {
      anatomizePanel.addEventListener('subtab-shown', () => {
        if (!initialized && window.ANATOMIZE_IMAGES &&
            window.ANATOMIZE_IMAGES.length > 0) {
          loadImageSet(window.ANATOMIZE_IMAGES[0].id);
          initialized = true;
        }
      });
    }

    if (window.ANATOMIZE_IMAGES && window.ANATOMIZE_IMAGES.length > 0) {
      loadImageSet(window.ANATOMIZE_IMAGES[0].id);
      initialized = true;
    }
  }

  function reset() {
    resetState();
    dom.arena.textContent = '';
    dom.prompt.textContent = '';
    dom.scoreDisplay.textContent = '';
    dom.detail.textContent = '';
  }

  function resetState() {
    state.imageId = null;
    state.mechanic = null;
    state.structures = [];
    state.queue = [];
    state.current = null;
    state.score = 0;
    state.identified = new Set();
    state.firstAttempt = new Set();
    state.attempts = 0;
    state.timer = null;
    state.startTime = null;
    state.speedResults = [];
    state.reviewing = false;
    attemptedOnCurrent = false;
  }

  function renderImageSelector() {
    dom.imageSelector.textContent = '';
    if (!window.ANATOMIZE_IMAGES) return;

    window.ANATOMIZE_IMAGES.forEach((imgSet) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = imgSet.label;
      btn.dataset.imageId = imgSet.id;
      dom.imageSelector.appendChild(btn);
    });

    dom.imageSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-image-id]');
      if (!btn) return;
      loadImageSet(btn.dataset.imageId);
    });
  }

  function renderControls() {
    dom.filterRow.textContent = '';
    const filters = [
      {key: 'all', label: 'All'},
      {key: 'muscles', label: 'Muscles'},
      {key: 'landmarks', label: 'Landmarks'}
    ];
    filters.forEach((f) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = f.label;
      btn.dataset.filter = f.key;
      if (f.key === state.filter) {
        btn.classList.add('active');
      }
      dom.filterRow.appendChild(btn);
    });
    dom.filterRow.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-filter]');
      if (!btn || btn.disabled) return;
      state.filter = btn.dataset.filter;
      updateFilterButtons();
      resetSession();
    });

    dom.modeToggle.textContent = '';
    const modes = [
      {key: 'standard', label: 'Standard'},
      {key: 'speed', label: 'Speed Round'}
    ];
    modes.forEach((m) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = m.label;
      btn.dataset.mode = m.key;
      if (m.key === state.mode) {
        btn.classList.add('active');
      }
      dom.modeToggle.appendChild(btn);
    });
    dom.modeToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-mode]');
      if (!btn) return;
      state.mode = btn.dataset.mode;
      updateModeButtons();
      resetSession();
    });
  }

  function updateFilterButtons() {
    dom.filterRow.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === state.filter);
    });
    updateFilterDisabled();
  }

  function updateModeButtons() {
    dom.modeToggle.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });
  }

  function updateFilterDisabled() {
    const imgSet = getImageSet(state.imageId);
    if (!imgSet) return;
    dom.filterRow.querySelectorAll('button').forEach((btn) => {
      const filter = btn.dataset.filter;
      if (filter === 'all') {
        btn.disabled = false;
        return;
      }
      const count = imgSet.structures.filter(
          (s) => matchesFilter(s, filter)).length;
      btn.disabled = count < 4;
    });
  }

  function matchesFilter(structure, filter) {
    if (filter === 'all') return true;
    if (filter === 'muscles') {
      return structure.type === 'muscle' || structure.type === 'ligament';
    }
    if (filter === 'landmarks') return structure.type === 'landmark';
    return true;
  }

  function getImageSet(imageId) {
    if (!window.ANATOMIZE_IMAGES) return null;
    return window.ANATOMIZE_IMAGES.find((img) => img.id === imageId) || null;
  }

  function loadImageSet(imageId) {
    const imgSet = getImageSet(imageId);
    if (!imgSet) return;

    state.imageId = imageId;
    state.mechanic = imgSet.mechanic;

    if (dom.imageTitle) {
      dom.imageTitle.textContent = imgSet.label;
    }

    dom.imageSelector.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.imageId === imageId);
    });

    updateFilterDisabled();
    resetSession();
  }

  function resetSession() {
    const imgSet = getImageSet(state.imageId);
    if (!imgSet) return;

    state.score = 0;
    state.identified = new Set();
    state.firstAttempt = new Set();
    state.attempts = 0;
    state.current = null;
    state.timer = null;
    state.startTime = null;
    state.speedResults = [];
    state.reviewing = false;
    attemptedOnCurrent = false;

    state.structures = imgSet.structures.filter(
        (s) => matchesFilter(s, state.filter));
    state.queue = shuffle(state.structures.map((s) => s.id));

    dom.detail.textContent = '';

    if (isMobile) {
      renderMobile(imgSet);
    } else if (state.mechanic === 'blank_panels') {
      renderBlankPanels(imgSet);
    } else if (state.mechanic === 'label_hunt') {
      renderLabelHunt(imgSet);
    }

    updateScore();
    promptNext();
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function renderBlankPanels(imgSet) {
    dom.arena.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'anatomize-arena-wrap';

    const img = document.createElement('img');
    img.src = imgSet.imageSrc;
    img.alt = imgSet.label;
    img.draggable = false;
    wrap.appendChild(img);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('anatomize-svg-overlay');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';

    state.structures.forEach((s) => {
      const group = document.createElementNS(SVG_NS, 'g');
      group.dataset.structureId = s.id;

      if (s.polygon) {
        const poly = document.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute('points',
            s.polygon.map((p) => p.join(',')).join(' '));
        poly.classList.add('anatomize-polygon');
        poly.style.opacity = '0';
        poly.style.transition = 'opacity 300ms ease';
        const color = resolvePriColor(s.priColor);
        poly.style.fill = withAlpha(color, 0.25);
        poly.style.stroke = withAlpha(color, 0.6);
        poly.style.strokeWidth = '0.3';
        group.appendChild(poly);
      }

      if (s.landmarkMarker) {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', s.landmarkMarker.x);
        circle.setAttribute('cy', s.landmarkMarker.y);
        circle.setAttribute('r', '2');
        circle.classList.add('anatomize-landmark-circle');
        circle.style.opacity = '0';
        circle.style.transition = 'opacity 300ms ease';
        const color = resolvePriColor(s.priColor);
        circle.style.fill = withAlpha(color, 0.25);
        circle.style.stroke = withAlpha(color, 0.6);
        circle.style.strokeWidth = '0.3';
        group.appendChild(circle);
      }

      if (s.panelBox) {
        const pb = s.panelBox;
        const centerX = pb.x + pb.w / 2;
        const centerY = pb.y + pb.h / 2;

        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', centerX);
        line.setAttribute('y1', centerY);
        line.setAttribute('x2', s.arrowTo.x);
        line.setAttribute('y2', s.arrowTo.y);
        line.classList.add('anatomize-arrow-line');
        line.style.stroke = 'var(--text-dim)';
        line.style.strokeWidth = '0.3';
        group.appendChild(line);

        const arrowHead = createArrowHead(
            centerX, centerY, s.arrowTo.x, s.arrowTo.y);
        arrowHead.style.fill = 'var(--text-dim)';
        group.appendChild(arrowHead);

        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', pb.x);
        rect.setAttribute('y', pb.y);
        rect.setAttribute('width', pb.w);
        rect.setAttribute('height', pb.h);
        rect.classList.add('anatomize-panel-rect');
        rect.style.fill = 'transparent';
        rect.style.stroke = 'var(--border)';
        rect.style.strokeWidth = '0.3';
        rect.style.cursor = 'pointer';
        rect.dataset.structureId = s.id;
        group.appendChild(rect);

        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', pb.x + pb.w / 2);
        text.setAttribute('y', pb.y + pb.h / 2 + 0.5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.classList.add('anatomize-panel-label');
        text.style.fontSize = '1.8px';
        text.style.fontFamily = 'var(--mono)';
        text.style.fill = 'var(--text)';
        text.style.display = 'none';
        text.textContent = s.label;
        group.appendChild(text);
      }

      svg.appendChild(group);
    });

    wrap.appendChild(svg);
    dom.arena.appendChild(wrap);

    svg.addEventListener('click', (e) => {
      const rect = e.target.closest('.anatomize-panel-rect');
      if (!rect) return;
      const structureId = rect.dataset.structureId;
      if (structureId) {
        handleClick(structureId);
      }
    });
  }

  function createArrowHead(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) {
      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', `${x2},${y2}`);
      return poly;
    }
    const ux = dx / len;
    const uy = dy / len;
    const size = 1.0;
    const px = -uy;
    const py = ux;
    const tipX = x2;
    const tipY = y2;
    const baseX1 = x2 - ux * size + px * size * 0.4;
    const baseY1 = y2 - uy * size + py * size * 0.4;
    const baseX2 = x2 - ux * size - px * size * 0.4;
    const baseY2 = y2 - uy * size - py * size * 0.4;
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points',
        `${tipX},${tipY} ${baseX1},${baseY1} ${baseX2},${baseY2}`);
    return poly;
  }

  function renderLabelHunt(imgSet) {
    dom.arena.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'anatomize-arena-wrap';

    const img = document.createElement('img');
    img.src = imgSet.imageSrc;
    img.alt = imgSet.label;
    img.draggable = false;
    wrap.appendChild(img);

    state.structures.forEach((s) => {
      if (!s.hitbox) return;
      const hitbox = document.createElement('div');
      hitbox.className = 'anatomize-hitbox';
      hitbox.dataset.structureId = s.id;
      hitbox.style.position = 'absolute';
      hitbox.style.left = s.hitbox.x + '%';
      hitbox.style.top = s.hitbox.y + '%';
      hitbox.style.width = s.hitbox.w + '%';
      hitbox.style.height = s.hitbox.h + '%';
      hitbox.style.cursor = 'pointer';
      hitbox.style.background = 'transparent';
      hitbox.style.borderBottom = '2px solid transparent';
      hitbox.style.transition =
          'border-color 0.15s, background-color 0.15s';
      hitbox.setAttribute('role', 'button');
      hitbox.setAttribute('tabindex', '0');
      hitbox.setAttribute('aria-label', s.label);
      wrap.appendChild(hitbox);
    });

    wrap.addEventListener('mouseenter', (e) => {
      if (e.target.classList.contains('anatomize-hitbox') &&
          !e.target.dataset.answered) {
        e.target.style.borderBottomColor = 'var(--text-dim)';
      }
    }, true);

    wrap.addEventListener('mouseleave', (e) => {
      if (e.target.classList.contains('anatomize-hitbox') &&
          !e.target.dataset.answered) {
        e.target.style.borderBottomColor = 'transparent';
      }
    }, true);

    wrap.addEventListener('click', (e) => {
      const hitbox = e.target.closest('.anatomize-hitbox');
      if (!hitbox) return;
      const structureId = hitbox.dataset.structureId;
      if (structureId) {
        handleClick(structureId);
      }
    });

    dom.arena.appendChild(wrap);
  }

  function renderMobile(imgSet) {
    dom.arena.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'anatomize-arena-wrap';

    const img = document.createElement('img');
    img.src = imgSet.imageSrc;
    img.alt = imgSet.label;
    img.draggable = false;
    wrap.appendChild(img);

    dom.arena.appendChild(wrap);

    const list = document.createElement('div');
    list.className = 'anatomize-mobile-list';

    const shuffledStructures = shuffle(state.structures.slice());
    shuffledStructures.forEach((s) => {
      const btn = document.createElement('button');
      btn.className = 'btn anatomize-mobile-btn';
      btn.dataset.structureId = s.id;
      if (state.mechanic === 'label_hunt') {
        btn.textContent = s.label;
      } else {
        btn.textContent = '\u00A0';
      }
      list.appendChild(btn);
    });

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('.anatomize-mobile-btn');
      if (!btn) return;
      const structureId = btn.dataset.structureId;
      if (structureId) {
        handleClick(structureId);
      }
    });

    dom.arena.appendChild(list);
  }

  function promptNext() {
    if (state.queue.length === 0) {
      endSession();
      return;
    }
    state.current = state.queue.shift();
    attemptedOnCurrent = false;

    const structure = state.structures.find((s) => s.id === state.current);
    dom.prompt.textContent = '';
    const promptText = document.createElement('span');
    promptText.className = 'anatomize-prompt-text';
    promptText.style.fontSize = 'var(--text-2xl)';
    promptText.style.fontWeight = '700';
    promptText.textContent = structure ? structure.label : '';
    dom.prompt.appendChild(promptText);

    if (state.mode === 'speed' && state.startTime) {
      updateTimerDisplay();
    }
  }

  function handleClick(structureId) {
    if (state.reviewing) {
      const structure = state.structures.find((s) => s.id === structureId);
      if (structure) {
        renderDetailPanel(structure);
      }
      return;
    }

    if (!state.current) return;
    if (state.mode === 'standard' &&
        state.identified.has(structureId)) return;

    const correct = structureId === state.current;

    if (state.mode === 'standard') {
      handleStandardClick(structureId, correct);
    } else {
      handleSpeedClick(structureId, correct);
    }
  }

  function handleStandardClick(structureId, correct) {
    state.attempts++;
    if (correct) {
      state.score++;
      state.identified.add(structureId);
      if (!attemptedOnCurrent) {
        state.firstAttempt.add(structureId);
      }
      renderVisualFeedback(structureId, true);
      updateScore();

      const structure = state.structures.find(
          (s) => s.id === structureId);
      if (structure) {
        renderDetailPanel(structure);
      }

      setTimeout(() => {
        promptNext();
      }, 600);
    } else {
      state.score--;
      attemptedOnCurrent = true;
      renderVisualFeedback(structureId, false);
      updateScore();
    }
  }

  function handleSpeedClick(structureId, correct) {
    if (!state.startTime) {
      state.startTime = Date.now();
      state.timer = setInterval(updateTimerDisplay, 100);
    }

    state.attempts++;
    const structure = state.structures.find(
        (s) => s.id === state.current);
    state.speedResults.push({
      structureId: state.current,
      clicked: structureId,
      correct: correct,
      label: structure ? structure.label : ''
    });

    if (correct) {
      state.score++;
      state.identified.add(state.current);
      state.firstAttempt.add(state.current);
    }

    updateScore();
    promptNext();
  }

  function renderVisualFeedback(structureId, correct) {
    if (isMobile) {
      renderMobileFeedback(structureId, correct);
      return;
    }

    if (state.mechanic === 'blank_panels') {
      renderBlankPanelsFeedback(structureId, correct);
    } else if (state.mechanic === 'label_hunt') {
      renderLabelHuntFeedback(structureId, correct);
    }
  }

  function renderBlankPanelsFeedback(structureId, correct) {
    const svg = dom.arena.querySelector('.anatomize-svg-overlay');
    if (!svg) return;
    const group = svg.querySelector(`g[data-structure-id="${structureId}"]`);
    if (!group) return;
    const structure = state.structures.find((s) => s.id === structureId);
    if (!structure) return;

    const rect = group.querySelector('.anatomize-panel-rect');
    const label = group.querySelector('.anatomize-panel-label');
    const line = group.querySelector('.anatomize-arrow-line');
    const arrowHead = group.querySelector('polygon:not(.anatomize-polygon)');
    const polygon = group.querySelector('.anatomize-polygon');
    const landmark = group.querySelector('.anatomize-landmark-circle');
    const pb = structure.panelBox;

    if (correct) {
      const color = resolvePriColor(structure.priColor);
      const bgColor = resolvePriBgColor(structure.priColor);

      if (rect) {
        rect.style.stroke = color;
        rect.style.fill = bgColor;
        rect.style.strokeWidth = '0.5';
      }
      if (label) {
        label.style.display = '';
      }
      if (line) {
        line.style.stroke = color;
      }
      if (arrowHead) {
        arrowHead.style.fill = color;
      }
      if (polygon) {
        polygon.style.opacity = '1';
      }
      if (landmark) {
        landmark.style.opacity = '1';
      }

      if (pb) {
        const check = document.createElementNS(SVG_NS, 'text');
        check.setAttribute('x', pb.x + pb.w - 1.5);
        check.setAttribute('y', pb.y + 2.5);
        check.classList.add('anatomize-check');
        check.style.fontSize = '2.5px';
        check.style.fill = 'var(--green)';
        check.textContent = '\u2713';
        group.appendChild(check);
      }
    } else {
      if (rect) {
        const origStroke = rect.style.stroke;
        rect.style.stroke = 'var(--red)';
        setTimeout(() => {
          if (!state.identified.has(structureId)) {
            rect.style.stroke = origStroke || 'var(--border)';
          }
        }, 1000);
      }

      if (pb) {
        const xMark = document.createElementNS(SVG_NS, 'text');
        xMark.setAttribute('x', pb.x + pb.w - 1.5);
        xMark.setAttribute('y', pb.y + 2.5);
        xMark.classList.add('anatomize-x');
        xMark.style.fontSize = '2.5px';
        xMark.style.fill = 'var(--red)';
        xMark.textContent = '\u2717';
        group.appendChild(xMark);
        setTimeout(() => {
          xMark.remove();
        }, 1000);
      }
    }
  }

  function renderLabelHuntFeedback(structureId, correct) {
    const hitbox = dom.arena.querySelector(
        `.anatomize-hitbox[data-structure-id="${structureId}"]`);
    if (!hitbox) return;
    const structure = state.structures.find((s) => s.id === structureId);
    if (!structure) return;

    if (correct) {
      const color = resolvePriColor(structure.priColor);
      const bgColor = resolvePriBgColor(structure.priColor);
      hitbox.style.borderBottomColor = color;
      hitbox.style.backgroundColor = withAlpha(color, 0.10);
      hitbox.dataset.answered = 'true';

      const check = document.createElement('span');
      check.className = 'anatomize-check';
      check.textContent = '\u2713';
      check.style.position = 'absolute';
      check.style.top = '0';
      check.style.right = '0';
      check.style.color = 'var(--green)';
      check.style.fontSize = 'var(--text-xs)';
      check.style.fontWeight = '700';
      check.style.lineHeight = '1';
      hitbox.appendChild(check);
    } else {
      hitbox.style.borderBottomColor = 'var(--red)';

      const xMark = document.createElement('span');
      xMark.className = 'anatomize-x';
      xMark.textContent = '\u2717';
      xMark.style.position = 'absolute';
      xMark.style.top = '0';
      xMark.style.right = '0';
      xMark.style.color = 'var(--red)';
      xMark.style.fontSize = 'var(--text-xs)';
      xMark.style.fontWeight = '700';
      xMark.style.lineHeight = '1';
      hitbox.appendChild(xMark);

      setTimeout(() => {
        xMark.remove();
        if (!hitbox.dataset.answered) {
          hitbox.style.borderBottomColor = 'transparent';
        }
      }, 1000);
    }
  }

  function renderMobileFeedback(structureId, correct) {
    const btn = dom.arena.querySelector(
        `.anatomize-mobile-btn[data-structure-id="${structureId}"]`);
    if (!btn) return;
    const structure = state.structures.find((s) => s.id === structureId);
    if (!structure) return;

    if (correct) {
      const color = resolvePriColor(structure.priColor);
      btn.style.borderColor = color;
      btn.style.backgroundColor = resolvePriBgColor(structure.priColor);
      btn.style.color = color;
      btn.textContent = structure.label + ' \u2713';
      btn.disabled = true;
    } else {
      btn.style.borderColor = 'var(--red)';
      btn.style.backgroundColor = 'var(--error-bg)';
      setTimeout(() => {
        if (!btn.disabled) {
          btn.style.borderColor = '';
          btn.style.backgroundColor = '';
        }
      }, 1000);
    }
  }

  function renderDetailPanel(structure) {
    dom.detail.textContent = '';

    const panel = document.createElement('div');
    panel.className = 'anatomize-detail-panel';
    const color = resolvePriColor(structure.priColor);
    panel.style.borderLeft = '4px solid ' + color;
    panel.style.maxHeight = '0';
    panel.style.overflow = 'hidden';
    panel.style.transition = 'max-height 200ms ease';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn';
    closeBtn.textContent = 'Close';
    closeBtn.style.float = 'right';
    closeBtn.addEventListener('click', () => {
      panel.style.maxHeight = '0';
      setTimeout(() => {
        dom.detail.textContent = '';
      }, 200);
    });
    panel.appendChild(closeBtn);

    const priDetail = structure.priDetail;
    const hasLayers = priDetail && (priDetail.layer2 || priDetail.layer3);

    const layer1 = document.createElement('div');
    layer1.className = 'anatomize-detail-layer';

    const nameRow = document.createElement('div');
    nameRow.style.display = 'flex';
    nameRow.style.alignItems = 'center';
    nameRow.style.gap = '0.5rem';
    nameRow.style.marginBottom = '0.5rem';

    const bullet = document.createElement('span');
    bullet.className = 'anatomize-detail-bullet';
    bullet.style.display = 'inline-block';
    bullet.style.width = '10px';
    bullet.style.height = '10px';
    bullet.style.borderRadius = '50%';
    bullet.style.backgroundColor = color;
    bullet.style.flexShrink = '0';
    nameRow.appendChild(bullet);

    const nameText = document.createElement('span');
    nameText.style.fontWeight = '700';
    nameText.style.color = 'var(--accent)';
    nameText.style.fontFamily = 'var(--mono)';
    nameText.style.fontSize = 'var(--text-sm)';
    nameText.textContent = structure.label;
    nameRow.appendChild(nameText);
    layer1.appendChild(nameRow);

    if (priDetail && priDetail.layer1) {
      if (priDetail.layer1.standard) {
        const row = createDetailRow('Standard', priDetail.layer1.standard);
        layer1.appendChild(row);
      }
      if (priDetail.layer1.pri) {
        const row = createDetailRow('PRI', priDetail.layer1.pri);
        layer1.appendChild(row);
      }
      if (priDetail.layer1.chain) {
        const row = createDetailRow('Chain', priDetail.layer1.chain);
        layer1.appendChild(row);
      }
    }

    if (!hasLayers && priDetail && priDetail.layer1 &&
        !priDetail.layer1.pri) {
      const note = document.createElement('p');
      note.style.fontSize = 'var(--text-xs)';
      note.style.color = 'var(--text-dim)';
      note.style.fontStyle = 'italic';
      note.style.marginTop = '0.5rem';
      if (structure.type === 'landmark') {
        note.textContent = 'Bony landmark — no PRI color assignment.';
      } else {
        note.textContent = 'Not a primary PRI muscle.';
      }
      layer1.appendChild(note);
    }

    panel.appendChild(layer1);

    if (priDetail && priDetail.layer2) {
      const layer2Wrapper = document.createElement('div');
      layer2Wrapper.className = 'anatomize-detail-layer';
      layer2Wrapper.style.display = 'none';

      if (priDetail.layer2.laic) {
        const row = createDetailRow('Pattern Role', priDetail.layer2.laic);
        layer2Wrapper.appendChild(row);
      }

      const l2Btn = document.createElement('button');
      l2Btn.className = 'btn anatomize-detail-btn';
      l2Btn.textContent = 'Show Pattern Role';
      l2Btn.addEventListener('click', () => {
        layer2Wrapper.style.display = '';
        l2Btn.style.display = 'none';
      });
      panel.appendChild(l2Btn);
      panel.appendChild(layer2Wrapper);
    }

    if (priDetail && priDetail.layer3) {
      const layer3Wrapper = document.createElement('div');
      layer3Wrapper.className = 'anatomize-detail-layer';
      layer3Wrapper.style.display = 'none';

      if (priDetail.layer3.treatment) {
        const row = createDetailRow(
            'Treatment', priDetail.layer3.treatment);
        layer3Wrapper.appendChild(row);
      }

      const l3Btn = document.createElement('button');
      l3Btn.className = 'btn anatomize-detail-btn';
      l3Btn.textContent = 'Show Treatment';
      l3Btn.addEventListener('click', () => {
        layer3Wrapper.style.display = '';
        l3Btn.style.display = 'none';
      });
      panel.appendChild(l3Btn);
      panel.appendChild(layer3Wrapper);
    }

    dom.detail.appendChild(panel);

    requestAnimationFrame(() => {
      panel.style.maxHeight = panel.scrollHeight + 'px';
    });
  }

  function createDetailRow(label, value) {
    const row = document.createElement('div');
    row.className = 'detail-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'detail-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const valEl = document.createElement('span');
    valEl.style.fontSize = 'var(--text-sm)';
    valEl.textContent = value;
    row.appendChild(valEl);

    return row;
  }

  function endSession() {
    state.current = null;
    dom.prompt.textContent = '';

    if (state.mode === 'speed') {
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
      }
      const elapsed = state.startTime ?
          ((Date.now() - state.startTime) / 1000).toFixed(1) : '0.0';
      revealSpeedResults();
      state.reviewing = true;

      const total = state.speedResults.length;
      const correctCount = state.speedResults.filter(
          (r) => r.correct).length;
      const accuracy = total > 0 ?
          Math.round((correctCount / total) * 100) : 0;

      const summary = document.createElement('div');
      summary.className = 'anatomize-end-summary';
      summary.style.fontSize = 'var(--text-base)';
      summary.style.fontFamily = 'var(--mono)';
      summary.style.marginTop = '1rem';
      summary.style.padding = '1rem';
      summary.style.background = 'var(--surface)';
      summary.style.border = '1px solid var(--border)';
      summary.style.borderRadius = '6px';
      summary.textContent =
          `Session complete. Score: ${state.score}. ` +
          `Accuracy: ${accuracy}%. Time: ${elapsed}s.`;
      dom.prompt.appendChild(summary);
    } else {
      const total = state.structures.length;
      const accuracy = total > 0 ?
          Math.round((state.firstAttempt.size / total) * 100) : 0;

      const summary = document.createElement('div');
      summary.className = 'anatomize-end-summary';
      summary.style.fontSize = 'var(--text-base)';
      summary.style.fontFamily = 'var(--mono)';
      summary.style.marginTop = '1rem';
      summary.style.padding = '1rem';
      summary.style.background = 'var(--surface)';
      summary.style.border = '1px solid var(--border)';
      summary.style.borderRadius = '6px';
      summary.textContent =
          `Session complete. Score: ${state.score}. Accuracy: ${accuracy}%.`;
      dom.prompt.appendChild(summary);
    }
  }

  function revealSpeedResults() {
    state.speedResults.forEach((result) => {
      const structure = state.structures.find(
          (s) => s.id === result.structureId);
      if (!structure) return;

      if (isMobile) {
        revealSpeedMobile(result, structure);
      } else if (state.mechanic === 'blank_panels') {
        revealSpeedBlankPanels(result, structure);
      } else if (state.mechanic === 'label_hunt') {
        revealSpeedLabelHunt(result, structure);
      }
    });
  }

  function revealSpeedBlankPanels(result, structure) {
    const svg = dom.arena.querySelector('.anatomize-svg-overlay');
    if (!svg) return;
    const group = svg.querySelector(
        `g[data-structure-id="${result.structureId}"]`);
    if (!group) return;

    const rect = group.querySelector('.anatomize-panel-rect');
    const label = group.querySelector('.anatomize-panel-label');
    const line = group.querySelector('.anatomize-arrow-line');
    const arrowHead = group.querySelector(
        'polygon:not(.anatomize-polygon)');
    const polygon = group.querySelector('.anatomize-polygon');
    const landmark = group.querySelector('.anatomize-landmark-circle');
    const pb = structure.panelBox;

    const color = result.correct ?
        resolvePriColor(structure.priColor) : 'var(--red)';
    const bgColor = result.correct ?
        resolvePriBgColor(structure.priColor) : 'var(--error-bg)';

    if (rect) {
      rect.style.stroke = color;
      rect.style.fill = bgColor;
      rect.style.strokeWidth = '0.5';
    }
    if (label) {
      label.style.display = '';
    }
    if (line) {
      line.style.stroke = color;
    }
    if (arrowHead) {
      arrowHead.style.fill = color;
    }
    if (result.correct) {
      if (polygon) polygon.style.opacity = '1';
      if (landmark) landmark.style.opacity = '1';
    }

    if (pb) {
      const indicator = document.createElementNS(SVG_NS, 'text');
      indicator.setAttribute('x', pb.x + pb.w - 1.5);
      indicator.setAttribute('y', pb.y + 2.5);
      indicator.classList.add(
          result.correct ? 'anatomize-check' : 'anatomize-x');
      indicator.style.fontSize = '2.5px';
      indicator.style.fill = result.correct ? 'var(--green)' : 'var(--red)';
      indicator.textContent = result.correct ? '\u2713' : '\u2717';
      group.appendChild(indicator);
    }
  }

  function revealSpeedLabelHunt(result, structure) {
    const hitbox = dom.arena.querySelector(
        `.anatomize-hitbox[data-structure-id="${result.structureId}"]`);
    if (!hitbox) return;

    const color = result.correct ?
        resolvePriColor(structure.priColor) : 'var(--red)';

    hitbox.style.borderBottomColor = color;
    if (result.correct) {
      hitbox.style.backgroundColor = withAlpha(
          resolvePriColor(structure.priColor), 0.10);
    } else {
      hitbox.style.backgroundColor = 'var(--error-bg)';
    }
    hitbox.dataset.answered = 'true';

    const indicator = document.createElement('span');
    indicator.className = result.correct ?
        'anatomize-check' : 'anatomize-x';
    indicator.textContent = result.correct ? '\u2713' : '\u2717';
    indicator.style.position = 'absolute';
    indicator.style.top = '0';
    indicator.style.right = '0';
    indicator.style.color = result.correct ? 'var(--green)' : 'var(--red)';
    indicator.style.fontSize = 'var(--text-xs)';
    indicator.style.fontWeight = '700';
    indicator.style.lineHeight = '1';
    hitbox.appendChild(indicator);
  }

  function revealSpeedMobile(result, structure) {
    const btn = dom.arena.querySelector(
        `.anatomize-mobile-btn[data-structure-id="${result.structureId}"]`);
    if (!btn) return;

    const color = result.correct ?
        resolvePriColor(structure.priColor) : 'var(--red)';

    btn.textContent = structure.label +
        (result.correct ? ' \u2713' : ' \u2717');
    btn.style.borderColor = color;
    btn.style.backgroundColor = result.correct ?
        resolvePriBgColor(structure.priColor) : 'var(--error-bg)';
    if (result.correct) {
      btn.style.color = color;
    }
  }

  function updateScore() {
    dom.scoreDisplay.textContent = '';
    const scoreText = document.createElement('span');
    scoreText.className = 'score-display';

    let text = `Score: ${state.score} \u00b7 ` +
        `${state.identified.size} of ${state.structures.length} identified`;

    if (state.mode === 'speed' && state.startTime) {
      const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
      text += ` \u00b7 ${elapsed}s`;
    }

    scoreText.textContent = text;
    dom.scoreDisplay.appendChild(scoreText);
  }

  function updateTimerDisplay() {
    if (!state.startTime) return;
    updateScore();
  }

  function resolvePriColor(priColor) {
    if (!priColor) return 'var(--pri-neutral)';
    return getComputedStyle(document.documentElement)
        .getPropertyValue(priColor).trim() || 'var(--pri-neutral)';
  }

  function resolvePriBgColor(priColor) {
    if (!priColor) return 'var(--pri-neutral-bg)';
    const bgVar = priColor + '-bg';
    return getComputedStyle(document.documentElement)
        .getPropertyValue(bgVar).trim() || 'var(--pri-neutral-bg)';
  }

  function withAlpha(color, alpha) {
    if (!color || color.startsWith('var(')) return color;
    if (color.startsWith('hsl(')) {
      return color.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
    }
    if (color.startsWith('hsla(')) {
      return color.replace(
          /,\s*[\d.]+\)$/, `, ${alpha})`);
    }
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    return color;
  }

  return {init, reset};
})();

document.addEventListener('DOMContentLoaded', () => {
  window.AnatomizeModule.init();
});
