window.AnatomizeModule = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let state = {
    imageId: null,
    mechanic: null,
    flipped: false,
    structures: [],
    queue: [],
    current: null,
    score: 0,
    identified: new Set(),
    firstAttempt: new Set(),
    attempts: 0,
    filter: 'all'
  };

  const INFO_MIN_W = 340;
  const SHRINK_STEP = 20;
  const MIN_H_RATIO = 0.4;

  let dom = {};
  let isMobile = false;
  let initialized = false;
  let attemptedOnCurrent = false;
  let layoutObserver = null;
  let lastLayoutInputs = '';
  let reviewMode = false;

  let anatomizeData = null;

  async function loadAnatomizeData() {
    if (anatomizeData) return anatomizeData;
    const resp = await fetch('data/anatomize-data.json');
    anatomizeData = await resp.json();
    return anatomizeData;
  }

  function priColorClass(priColor) {
    return priColor ? priColor.replace('--', '') : 'pri-neutral';
  }

  function resolveStructures(imgEntry, shared) {
    if (imgEntry.structures) return imgEntry.structures;
    if (imgEntry.structuresRef && shared[imgEntry.structuresRef]) {
      return shared[imgEntry.structuresRef];
    }
    return [];
  }

  /**
   * Returns the point on the edge of `box` closest to `target`.
   * All values in the 0-100 SVG coordinate space.
   */
  function edgePoint(box, target) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const dx = target.x - cx;
    const dy = target.y - cy;
    if (dx === 0 && dy === 0) return {x: cx, y: cy};
    const hw = box.w / 2;
    const hh = box.h / 2;
    const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
    const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
    const s = Math.min(sx, sy);
    return {x: cx + dx * s, y: cy + dy * s};
  }

  async function init() {
    const container = document.querySelector(
        '#anatomy-anatomize .tab-section');
    if (!container) return;

    await loadAnatomizeData();

    dom.container = container;
    dom.imageSelector = container.querySelector('.anatomize-image-selector');
    dom.filterRow = container.querySelector('.anatomize-filter');
    dom.resetBtn = container.querySelector('.anatomize-reset');
    dom.nextBtn = container.querySelector('.anatomize-next');
    dom.arena = container.querySelector('.anatomize-arena');
    dom.scoreDisplay = container.querySelector('.anatomize-score');
    dom.detail = container.querySelector('.anatomize-detail');

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

    dom.nextBtn.addEventListener('click', () => {
      if (dom.nextBtn.classList.contains('disabled')) return;
      if (dom.nextBtn.dataset.action === 'reset') {
        resetSession();
        return;
      }
      dom.nextBtn.classList.add('disabled');
      promptNext();
    });
    dom.nextBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dom.nextBtn.click();
      }
    });

    const anatomizePanel = document.getElementById('anatomy-anatomize');
    if (anatomizePanel) {
      anatomizePanel.addEventListener('subtab-shown', () => {
        if (!initialized && anatomizeData &&
            anatomizeData.images.length > 0) {
          const hashParts = location.hash.replace(/^#/, '').split('/');
          const hashImageId = (hashParts[0] === 'anatomy' &&
              hashParts[1] === 'anatomize' && hashParts[2]) ?
              hashParts[2] : null;
          const startId = (hashImageId && getImageSet(hashImageId)) ?
              hashImageId : anatomizeData.images[0].id;
          loadImageSet(startId, true);
          initialized = true;
        } else if (initialized) {
          drawArrows();
          computeLayout();
        }
      });
    }

    initResizeHandle();
    hookLayout();

    if (anatomizeData && anatomizeData.images.length > 0) {
      const hashParts = location.hash.replace(/^#/, '').split('/');
      const hashImageId = (hashParts[0] === 'anatomy' &&
          hashParts[1] === 'anatomize' && hashParts[2]) ?
          hashParts[2] : null;
      const startId = (hashImageId && getImageSet(hashImageId)) ?
          hashImageId : anatomizeData.images[0].id;
      loadImageSet(startId, true);
      initialized = true;
    }
  }

  function reset() {
    resetState();
    reviewMode = false;
    dom.arena.textContent = '';
    dom.nextBtn.textContent = 'Next \u2192';
    delete dom.nextBtn.dataset.action;
    dom.nextBtn.classList.add('disabled');
    dom.scoreDisplay.textContent = '';
    dom.detail.textContent = '';
  }

  function resetState() {
    state.imageId = null;
    state.mechanic = null;
    state.flipped = false;
    state.structures = [];
    state.queue = [];
    state.current = null;
    state.score = 0;
    state.identified = new Set();
    state.firstAttempt = new Set();
    state.attempts = 0;
    attemptedOnCurrent = false;
  }

  function renderImageSelector() {
    dom.imageSelector.textContent = '';
    if (!anatomizeData) return;

    anatomizeData.images.forEach((imgSet) => {
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
  }

  function updateFilterButtons() {
    dom.filterRow.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === state.filter);
    });
    updateFilterDisabled();
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
      return structure.type === 'muscle' || structure.type === 'ligament' ||
          structure.type === 'connective';
    }
    if (filter === 'landmarks') return structure.type === 'landmark';
    return true;
  }

  function getImageSet(imageId) {
    if (!anatomizeData) return null;
    const entry = anatomizeData.images.find((img) => img.id === imageId);
    if (!entry) return null;
    return Object.assign({}, entry, {
      structures: resolveStructures(entry, anatomizeData.sharedStructures)
    });
  }

  function loadImageSet(imageId, skipHash) {
    if (!dom.container) return;
    const imgSet = getImageSet(imageId);
    if (!imgSet) return;

    state.imageId = imageId;
    state.mechanic = imgSet.mechanic;
    state.flipped = imgSet.flipped || false;
    lastLayoutInputs = '';
    dom.arena.classList.toggle('anatomize-dark-bg',
        imgSet.theme === 'dark');

    if (!skipHash) {
      const hash = 'anatomy/anatomize/' + imageId;
      if (location.hash.replace(/^#/, '') !== hash) {
        location.hash = hash;
      }
    }

    dom.imageSelector.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.imageId === imageId);
    });

    const hasMuscles = imgSet.structures.some(
        (s) => s.type === 'muscle' || s.type === 'ligament');
    const hasLandmarks = imgSet.structures.some(
        (s) => s.type === 'landmark');
    const showFilter = hasMuscles && hasLandmarks;
    dom.filterRow.style.display = showFilter ? '' : 'none';
    dom.resetBtn.style.display = showFilter ? '' : 'none';

    if (!showFilter) {
      state.filter = 'all';
    }
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
    attemptedOnCurrent = false;
    reviewMode = false;
    dom.nextBtn.textContent = 'Next \u2192';
    delete dom.nextBtn.dataset.action;

    state.structures = imgSet.structures.filter(
        (s) => matchesFilter(s, state.filter));
    state.queue = shuffle(state.structures.map((s) => s.id));

    dom.detail.textContent = '';
    dom.nextBtn.classList.add('disabled');

    if (state.mechanic === 'blank_panels') {
      renderBlankPanels(imgSet);
    } else if (isMobile) {
      renderMobile(imgSet);
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
    if (imgSet.flipped) {
      wrap.classList.add('anatomize-flipped');
    }

    const img = document.createElement('img');
    img.src = imgSet.imageSrc;
    img.alt = imgSet.label;
    img.draggable = false;

    wrap.appendChild(img);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('anatomize-svg-overlay');

    if (imgSet.sideLabels) {
      const sl = imgSet.sideLabels;
      const labelFontSize = 3;
      [
        {text: sl.left, x: 8, anchor: 'start'},
        {text: sl.right, x: 92, anchor: 'end'}
      ].forEach((cfg) => {
        const shadow = document.createElementNS(SVG_NS, 'text');
        shadow.setAttribute('x', cfg.x);
        shadow.setAttribute('y', 5);
        shadow.setAttribute('text-anchor', cfg.anchor);
        shadow.classList.add('anatomize-side-label');
        shadow.style.fontSize = labelFontSize;
        shadow.style.fontFamily = 'var(--mono)';
        shadow.style.fill = 'rgba(0,0,0,0.6)';
        shadow.style.stroke = 'rgba(0,0,0,0.6)';
        shadow.style.strokeWidth = '0.6';
        shadow.style.pointerEvents = 'none';
        shadow.textContent = cfg.text;
        if (imgSet.flipped) {
          shadow.setAttribute('transform',
              `translate(${cfg.x},5) scale(-1,1) translate(${-cfg.x},-5)`);
        }
        svg.appendChild(shadow);

        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('x', cfg.x);
        label.setAttribute('y', 5);
        label.setAttribute('text-anchor', cfg.anchor);
        label.classList.add('anatomize-side-label');
        label.style.fontSize = labelFontSize;
        label.style.fontFamily = 'var(--mono)';
        label.style.fill = 'rgba(255,255,255,0.9)';
        label.style.pointerEvents = 'none';
        label.textContent = cfg.text;
        if (imgSet.flipped) {
          label.setAttribute('transform',
              `translate(${cfg.x},5) scale(-1,1) translate(${-cfg.x},-5)`);
        }
        svg.appendChild(label);
      });
    }

    state.structures.forEach((s) => {
      const group = document.createElementNS(SVG_NS, 'g');
      group.dataset.structureId = s.id;
      group.classList.add(priColorClass(s.priColor));

      const marker = document.createElementNS(SVG_NS, 'circle');
      marker.setAttribute('cx', s.arrowTo.x);
      marker.setAttribute('cy', s.arrowTo.y);
      marker.setAttribute('r', '1.8');
      marker.classList.add('anatomize-target-circle');
      marker.style.opacity = '0';
      group.appendChild(marker);

      if (s.panelBox) {
        const pb = s.panelBox;
        const labelDiv = document.createElement('div');
        labelDiv.className = 'anatomize-label';
        labelDiv.classList.add(priColorClass(s.priColor));
        labelDiv.dataset.structureId = s.id;
        labelDiv.style.left = pb.x + '%';
        labelDiv.style.top = pb.y + '%';
        labelDiv.style.width = pb.w + '%';
        labelDiv.style.height = pb.h + '%';
        if (imgSet.flipped) {
          labelDiv.style.transform = 'scaleX(-1)';
        }
        const labelText = document.createElement('span');
        labelText.className = 'anatomize-label-text';
        labelText.textContent = s.label;
        labelDiv.appendChild(labelText);
        wrap.appendChild(labelDiv);
      }

      svg.appendChild(group);
    });

    wrap.appendChild(svg);
    dom.arena.appendChild(wrap);

    wrap.addEventListener('click', (e) => {
      const label = e.target.closest('.anatomize-label');
      if (!label) return;
      const structureId = label.dataset.structureId;
      if (structureId) handleClick(structureId);
    });

    hookImageLoad();
  }

  function drawArrows() {
    const wrap = dom.arena.querySelector('.anatomize-arena-wrap');
    const svg = wrap ? wrap.querySelector('.anatomize-svg-overlay') : null;
    if (!wrap || !svg) return;
    const wrapRect = wrap.getBoundingClientRect();
    if (wrapRect.width === 0 || wrapRect.height === 0) return;

    state.structures.forEach((s) => {
      if (!s.panelBox) return;
      const group = svg.querySelector(`g[data-structure-id="${s.id}"]`);
      const labelDiv = wrap.querySelector(
          `.anatomize-label[data-structure-id="${s.id}"]`);
      if (!group || !labelDiv) return;
      if (group.querySelector('.anatomize-arrow-line')) return;

      const labelRect = labelDiv.getBoundingClientRect();
      const box = {
        x: (labelRect.left - wrapRect.left) / wrapRect.width * 100,
        y: (labelRect.top - wrapRect.top) / wrapRect.height * 100,
        w: labelRect.width / wrapRect.width * 100,
        h: labelRect.height / wrapRect.height * 100
      };
      const ep = edgePoint(box, s.arrowTo);

      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', ep.x);
      line.setAttribute('y1', ep.y);
      line.setAttribute('x2', s.arrowTo.x);
      line.setAttribute('y2', s.arrowTo.y);
      line.classList.add('anatomize-arrow-line');
      group.appendChild(line);

      const arrowHead = createArrowHead(
          ep.x, ep.y, s.arrowTo.x, s.arrowTo.y);
      arrowHead.classList.add('anatomize-arrowhead');
      group.appendChild(arrowHead);
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
    const size = 1.3;
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

    hookImageLoad();
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
    dom.nextBtn.classList.add('disabled');

    const structure = state.structures.find((s) => s.id === state.current);
    if (structure) {
      renderPromptPanel(structure);
    }
  }

  function renderPromptPanel(structure) {
    dom.detail.textContent = '';
    const panel = document.createElement('div');
    panel.className = 'anatomize-detail-panel';
    panel.classList.add(priColorClass(structure.priColor));

    const nameRow = document.createElement('div');
    nameRow.style.display = 'flex';
    nameRow.style.alignItems = 'center';
    nameRow.style.gap = '0.5rem';

    const bullet = document.createElement('span');
    bullet.className = 'anatomize-detail-bullet';
    nameRow.appendChild(bullet);

    const nameText = document.createElement('span');
    nameText.classList.add('anatomize-detail-name');
    nameText.style.fontWeight = '700';
    nameText.style.fontFamily = 'var(--mono)';
    nameText.style.fontSize = 'var(--text-sm)';
    nameText.textContent = structure.label;
    nameRow.appendChild(nameText);
    panel.appendChild(nameRow);

    const hint = document.createElement('p');
    hint.style.fontSize = 'var(--text-xs)';
    hint.style.color = 'var(--text-dim)';
    hint.style.fontStyle = 'italic';
    hint.style.marginTop = '0.5rem';
    hint.textContent = 'Identify on image';
    panel.appendChild(hint);

    dom.detail.appendChild(panel);
  }

  function handleClick(structureId) {
    if (reviewMode) {
      const structure = state.structures.find((s) => s.id === structureId);
      if (structure) {
        renderDetailPanel(structure);
      }
      return;
    }
    if (!state.current) return;
    if (state.identified.has(structureId)) return;

    const correct = structureId === state.current;
    handleStandardClick(structureId, correct);
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

      showNextButton();
    } else {
      state.score--;
      attemptedOnCurrent = true;
      renderVisualFeedback(structureId, false);
      updateScore();
    }
  }

  function showNextButton() {
    dom.nextBtn.classList.remove('disabled');
    if (state.queue.length === 0) {
      dom.nextBtn.textContent = 'Finish';
    }
  }

  function renderVisualFeedback(structureId, correct) {
    if (state.mechanic === 'blank_panels') {
      renderBlankPanelsFeedback(structureId, correct);
    } else if (isMobile) {
      renderMobileFeedback(structureId, correct);
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

    const targetCircle = group.querySelector('.anatomize-target-circle');
    const htmlLabel = dom.arena.querySelector(
        `.anatomize-label[data-structure-id="${structureId}"]`);
    if (!htmlLabel) return;

    if (correct) {
      group.classList.add('correct');
      if (targetCircle) targetCircle.style.opacity = '1';
      htmlLabel.classList.add('correct');
      const check = document.createElement('span');
      check.className = 'anatomize-check';
      check.textContent = '\u2713';
      htmlLabel.appendChild(check);
    } else {
      htmlLabel.classList.add('wrong');
      const xMark = document.createElement('span');
      xMark.className = 'anatomize-x';
      xMark.textContent = '\u2717';
      htmlLabel.appendChild(xMark);
      setTimeout(() => {
        xMark.remove();
        if (!htmlLabel.classList.contains('correct')) {
          htmlLabel.classList.remove('wrong');
        }
      }, 1000);
    }
  }

  function renderLabelHuntFeedback(structureId, correct) {
    const hitbox = dom.arena.querySelector(
        `.anatomize-hitbox[data-structure-id="${structureId}"]`);
    if (!hitbox) return;
    const structure = state.structures.find((s) => s.id === structureId);
    if (!structure) return;

    if (correct) {
      hitbox.classList.add(priColorClass(structure.priColor));
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
      btn.classList.add(priColorClass(structure.priColor), 'correct');
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
    panel.classList.add(priColorClass(structure.priColor));

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
    nameRow.appendChild(bullet);

    const nameText = document.createElement('span');
    nameText.classList.add('anatomize-detail-name');
    nameText.style.fontWeight = '700';
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
      if (priDetail.layer1.attachments) {
        const row = createDetailRow(
            'Attachments', priDetail.layer1.attachments);
        layer1.appendChild(row);
      }
      if (priDetail.layer1.actions) {
        const row = createDetailRow('Actions', priDetail.layer1.actions);
        layer1.appendChild(row);
      }
      if (priDetail.layer1.movements) {
        const row = createDetailRow('Movements', priDetail.layer1.movements);
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
        note.textContent = 'Bony landmark \u2014 no PRI color assignment.';
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
      if (priDetail.layer2.pathology) {
        const row = createDetailRow(
            'Pathology', priDetail.layer2.pathology);
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
  }

  function formatAttachments(obj) {
    const prox = (obj.proximal || []).join(', ');
    const dist = (obj.distal || []).join(', ');
    return prox + ' \u2192 ' + dist;
  }

  function createDetailRow(label, value) {
    const row = document.createElement('div');
    row.className = 'detail-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'detail-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const display = (typeof value === 'object' && value !== null &&
        (value.proximal || value.distal)) ?
        formatAttachments(value) : value;

    const valEl = document.createElement('span');
    valEl.style.fontSize = 'var(--text-sm)';
    valEl.textContent = display;
    row.appendChild(valEl);

    return row;
  }

  function endSession() {
    state.current = null;
    reviewMode = true;

    dom.nextBtn.textContent = 'Reset';
    dom.nextBtn.classList.remove('disabled');
    dom.nextBtn.dataset.action = 'reset';

    if (isMobile) {
      dom.arena.querySelectorAll('.anatomize-mobile-btn').forEach((btn) => {
        btn.disabled = false;
      });
    }

    const total = state.structures.length;
    const accuracy = total > 0 ?
        Math.round((state.firstAttempt.size / total) * 100) : 0;

    const summary = document.createElement('div');
    summary.className = 'anatomize-end-summary';
    summary.textContent =
        `Complete. Score: ${state.score}. Accuracy: ${accuracy}%.`;
    dom.detail.appendChild(summary);
  }

  function updateScore() {
    dom.scoreDisplay.textContent = '';
    const scoreText = document.createElement('span');
    scoreText.className = 'score-display';
    scoreText.textContent = `Score: ${state.score} \u00b7 ` +
        `${state.identified.size} of ${state.structures.length}`;
    dom.scoreDisplay.appendChild(scoreText);
  }

  function initResizeHandle() {
    const body = dom.container.querySelector('.anatomize-body');
    if (!body) return;
    const imageCol = body.querySelector('.anatomize-image-col');
    if (!imageCol) return;

    const handle = document.createElement('div');
    handle.className = 'anatomize-resize-handle';
    const grip = document.createElement('div');
    grip.className = 'anatomize-resize-grip';
    handle.appendChild(grip);
    body.insertBefore(handle, imageCol);

    function onDown(e) {
      e.preventDefault();
      const infoCol = body.querySelector('.anatomize-info-col');
      if (!infoCol || !body.classList.contains('two-col')) return;

      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const startX = e.type === 'touchstart' ?
          e.touches[0].clientX : e.clientX;
      const startW = infoCol.getBoundingClientRect().width;
      const maxW = body.clientWidth * 0.6;

      function onMove(ev) {
        ev.preventDefault();
        const clientX = ev.type === 'touchmove' ?
            ev.touches[0].clientX : ev.clientX;
        const delta = clientX - startX;
        const newW = Math.max(200, Math.min(maxW, startW + delta));
        body.style.setProperty('--info-w', Math.floor(newW) + 'px');
      }

      function onUp() {
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, {passive: false});
      document.addEventListener('touchend', onUp);
    }

    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, {passive: false});
  }

  // ---- Two-column layout algorithm ----

  function isTwoCol() {
    return window.innerWidth >= 1024 &&
        window.innerWidth > window.innerHeight;
  }

  function findWorstCaseStructure() {
    let longest = null;
    let maxLen = 0;
    state.structures.forEach((s) => {
      let len = s.label.length;
      const pd = s.priDetail;
      if (pd && pd.layer1) {
        len += (pd.layer1.standard || '').length;
        const att = pd.layer1.attachments;
        len += (typeof att === 'object' && att !== null) ?
            (att.proximal || []).join().length +
            (att.distal || []).join().length :
            (att || '').length;
        len += (pd.layer1.actions || '').length;
        len += (pd.layer1.movements || '').length;
        len += (pd.layer1.pri || '').length;
        len += (pd.layer1.chain || '').length;
      }
      if (len > maxLen) {
        maxLen = len;
        longest = s;
      }
    });
    return longest;
  }

  function buildMeasurePanel(structure) {
    const frag = document.createDocumentFragment();

    const panel = document.createElement('div');
    panel.className = 'anatomize-detail-panel';
    panel.classList.add(priColorClass(structure.priColor));
    const priDetail = structure.priDetail;

    const layer1 = document.createElement('div');
    layer1.className = 'anatomize-detail-layer';
    const nameRow = document.createElement('div');
    nameRow.style.cssText =
        'display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem';
    const bullet = document.createElement('span');
    bullet.className = 'anatomize-detail-bullet';
    nameRow.appendChild(bullet);
    const nameText = document.createElement('span');
    nameText.classList.add('anatomize-detail-name');
    nameText.style.cssText =
        'font-weight:700;font-family:var(--mono);font-size:var(--text-sm)';
    nameText.textContent = structure.label;
    nameRow.appendChild(nameText);
    layer1.appendChild(nameRow);

    if (priDetail && priDetail.layer1) {
      const keys = [
        ['standard', 'Standard'], ['attachments', 'Attachments'],
        ['actions', 'Actions'], ['movements', 'Movements'],
        ['pri', 'PRI'], ['chain', 'Chain']
      ];
      keys.forEach((pair) => {
        if (priDetail.layer1[pair[0]]) {
          layer1.appendChild(
              createDetailRow(pair[1], priDetail.layer1[pair[0]]));
        }
      });
    }
    panel.appendChild(layer1);

    frag.appendChild(panel);
    return frag;
  }

  function measureWorstCaseHeight(infoW) {
    const worst = findWorstCaseStructure();
    if (!worst) return 0;

    let measurer = dom.container.querySelector('.anatomize-measure');
    if (!measurer) {
      measurer = document.createElement('div');
      measurer.className = 'anatomize-measure';
      measurer.style.cssText =
          'position:absolute;visibility:hidden;left:-9999px;top:0';
      dom.container.appendChild(measurer);
    }
    measurer.style.width = infoW + 'px';
    measurer.textContent = '';
    measurer.appendChild(buildMeasurePanel(worst));
    const h = measurer.scrollHeight;
    measurer.remove();
    return h;
  }

  function computeLayout() {
    const key = window.innerWidth + ',' + window.innerHeight + ',' +
        state.imageId;
    if (key === lastLayoutInputs) return;

    const body = dom.container.querySelector('.anatomize-body');
    if (!body) return;

    const mainEl = document.querySelector('main');

    const infoColReset = body.querySelector('.anatomize-info-col');

    body.classList.remove('two-col');
    body.style.removeProperty('--body-h');
    body.style.removeProperty('--image-h');
    body.style.removeProperty('--info-h');
    body.style.removeProperty('--info-w');
    body.style.removeProperty('--image-w');
    if (infoColReset) infoColReset.style.height = '';
    mainEl.style.paddingBottom = '';
    mainEl.style.paddingRight = '';
    dom.container.style.marginBottom = '';
    const resetImg = dom.arena.querySelector('img');
    if (resetImg) {
      resetImg.style.maxWidth = '';
      resetImg.style.maxHeight = '';
    }
    if (!isTwoCol()) {
      lastLayoutInputs = key;
      return;
    }

    const img = dom.arena.querySelector('img');
    if (!img || !img.naturalWidth) return;
    const R = img.naturalWidth / img.naturalHeight;

    const bodyRect = body.getBoundingClientRect();
    let availH = window.innerHeight - bodyRect.top - 8;
    if (availH <= 100) {
      lastLayoutInputs = key;
      return;
    }

    mainEl.style.paddingBottom = '0';
    mainEl.style.paddingRight = '0';
    dom.container.style.marginBottom = '0';

    const gap = 8;
    const availW = body.clientWidth - gap;

    const infoHeader = body.querySelector('.anatomize-info-header');
    const headerH = infoHeader ?
        infoHeader.getBoundingClientRect().height +
        parseFloat(getComputedStyle(infoHeader).marginBottom || 0) : 0;
    const imageMaxH = Math.min(availH - headerH, img.naturalHeight);
    const imageMinH = availH * MIN_H_RATIO;

    let imageH = imageMaxH;
    let imageW = imageH * R;
    let infoW = availW - imageW;

    if (infoW < INFO_MIN_W) {
      infoW = INFO_MIN_W;
      imageW = availW - infoW;
      imageH = imageW / R;
    }

    let scrollH = measureWorstCaseHeight(infoW);

    let fallback = false;
    if (scrollH > availH) {
      const maxInfoW = availW - (imageMinH * R);
      const minScrollH = measureWorstCaseHeight(
          Math.max(maxInfoW, INFO_MIN_W));
      if (minScrollH > availH) {
        fallback = true;
      } else {
        while (scrollH > availH && imageH > imageMinH) {
          imageH = Math.max(imageH - SHRINK_STEP, imageMinH);
          imageW = imageH * R;
          infoW = availW - imageW;
          if (infoW < INFO_MIN_W) {
            infoW = INFO_MIN_W;
            imageW = availW - infoW;
            imageH = imageW / R;
            break;
          }
          scrollH = measureWorstCaseHeight(infoW);
        }
        if (scrollH > availH) {
          fallback = true;
        }
      }
    }

    if (fallback) {
      imageH = imageMaxH;
      imageW = imageH * R;
      infoW = availW - imageW;
      if (infoW < INFO_MIN_W) {
        infoW = INFO_MIN_W;
        imageW = availW - infoW;
        imageH = imageW / R;
      }
    }

    const infoCol = body.querySelector('.anatomize-info-col');
    const imageColH = imageH + headerH;
    const infoH = scrollH > imageColH ? availH : imageColH;

    img.style.maxWidth = Math.floor(imageW) + 'px';
    img.style.maxHeight = Math.floor(imageH) + 'px';

    body.classList.add('two-col');
    body.style.setProperty('--body-h', Math.floor(availH) + 'px');
    body.style.setProperty('--image-h', Math.floor(imageH) + 'px');
    body.style.setProperty('--info-h', Math.floor(infoH) + 'px');
    body.style.setProperty('--info-w', Math.floor(infoW) + 'px');
    body.style.setProperty('--image-w', Math.floor(imageW) + 'px');
    if (infoCol) {
      infoCol.style.height = Math.floor(infoH) + 'px';
    }

    lastLayoutInputs = key;
  }

  function hookLayout() {
    if (layoutObserver) {
      layoutObserver.disconnect();
    }
    layoutObserver = new ResizeObserver(() => {
      computeLayout();
    });
    layoutObserver.observe(dom.container);
  }

  function hookImageLoad() {
    const img = dom.arena.querySelector('img');
    if (!img) return;
    if (img.complete && img.naturalWidth) {
      drawArrows();
      computeLayout();
    } else {
      img.addEventListener('load', () => {
        drawArrows();
        computeLayout();
      }, {once: true});
    }
  }

  return {init, reset, loadImageSet};
})();

document.addEventListener('DOMContentLoaded', () => {
  window.AnatomizeModule.init();
});
