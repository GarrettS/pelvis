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

  let dom = {};
  let isMobile = false;
  let initialized = false;
  let attemptedOnCurrent = false;

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

  function init() {
    const container = document.querySelector(
        '#anatomy-anatomize .tab-section');
    if (!container) return;

    dom.container = container;
    dom.imageSelector = container.querySelector('.anatomize-image-selector');
    dom.filterRow = container.querySelector('.anatomize-filter');
    dom.resetBtn = container.querySelector('.anatomize-reset');
    dom.prompt = container.querySelector('.anatomize-prompt');
    dom.nextSlot = container.querySelector('.anatomize-next-slot');
    dom.arena = container.querySelector('.anatomize-arena');
    dom.scoreDisplay = container.querySelector('.anatomize-score');
    dom.detail = container.querySelector('.anatomize-detail');
    dom.imageTitle = container.querySelector('.anatomize-image-title');

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
    dom.nextSlot.textContent = '';
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
    state.flipped = imgSet.flipped || false;

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
    attemptedOnCurrent = false;

    state.structures = imgSet.structures.filter(
        (s) => matchesFilter(s, state.filter));
    state.queue = shuffle(state.structures.map((s) => s.id));

    dom.detail.textContent = '';
    dom.nextSlot.textContent = '';

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

    state.structures.forEach((s) => {
      const group = document.createElementNS(SVG_NS, 'g');
      group.dataset.structureId = s.id;
      const color = resolvePriColor(s.priColor);

      const marker = document.createElementNS(SVG_NS, 'circle');
      marker.setAttribute('cx', s.arrowTo.x);
      marker.setAttribute('cy', s.arrowTo.y);
      marker.setAttribute('r', '1.8');
      marker.classList.add('anatomize-target-circle');
      marker.style.opacity = '0';
      marker.style.transition = 'opacity 300ms ease';
      marker.style.fill = withAlpha(color, 0.35);
      marker.style.stroke = withAlpha(color, 0.7);
      marker.style.strokeWidth = '0.4';
      group.appendChild(marker);

      if (s.panelBox) {
        const pb = s.panelBox;
        const ep = edgePoint(pb, s.arrowTo);

        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', ep.x);
        line.setAttribute('y1', ep.y);
        line.setAttribute('x2', s.arrowTo.x);
        line.setAttribute('y2', s.arrowTo.y);
        line.classList.add('anatomize-arrow-line');
        line.style.stroke = withAlpha(color, 0.6);
        line.style.strokeWidth = '0.3';
        group.appendChild(line);

        const arrowHead = createArrowHead(
            ep.x, ep.y, s.arrowTo.x, s.arrowTo.y);
        arrowHead.style.fill = withAlpha(color, 0.6);
        arrowHead.classList.add('anatomize-arrowhead');
        group.appendChild(arrowHead);

        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', pb.x);
        rect.setAttribute('y', pb.y);
        rect.setAttribute('width', pb.w);
        rect.setAttribute('height', pb.h);
        rect.classList.add('anatomize-panel-rect');
        rect.style.fill = 'transparent';
        rect.style.stroke = withAlpha(color, 0.5);
        rect.style.strokeWidth = '0.3';
        rect.style.cursor = 'pointer';
        rect.dataset.structureId = s.id;
        group.appendChild(rect);

        const fontSize = Math.min(1.6, pb.w / (s.label.length * 0.55));
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', pb.x + pb.w / 2);
        text.setAttribute('y', pb.y + pb.h / 2 + 0.5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.classList.add('anatomize-panel-label');
        text.style.fontSize = fontSize + 'px';
        text.style.fontFamily = 'var(--mono)';
        text.style.fill = 'var(--text)';
        text.style.display = 'none';
        text.textContent = s.label;
        if (imgSet.flipped) {
          const tx = pb.x + pb.w / 2;
          const ty = pb.y + pb.h / 2 + 0.5;
          text.setAttribute('transform',
              `translate(${tx},${ty}) scale(-1,1) translate(${-tx},${-ty})`);
        }
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
    dom.nextSlot.textContent = '';

    const promptText = document.createElement('span');
    promptText.className = 'anatomize-prompt-text';
    promptText.textContent = structure ? structure.label : '';
    if (structure) {
      const color = resolvePriColor(structure.priColor);
      promptText.style.color = color;
    }
    dom.prompt.appendChild(promptText);
  }

  function handleClick(structureId) {
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
    dom.nextSlot.textContent = '';
    const btn = document.createElement('button');
    btn.className = 'btn anatomize-next-btn';
    btn.textContent = 'Next \u2192';
    btn.addEventListener('click', () => {
      btn.remove();
      promptNext();
    });
    dom.nextSlot.appendChild(btn);
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
    const arrowHead = group.querySelector('.anatomize-arrowhead');
    const targetCircle = group.querySelector('.anatomize-target-circle');
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
      if (targetCircle) {
        targetCircle.style.opacity = '1';
      }

      if (pb) {
        const cx = pb.x + pb.w - 1.5;
        const cy = pb.y + 2.5;
        const check = document.createElementNS(SVG_NS, 'text');
        check.setAttribute('x', cx);
        check.setAttribute('y', cy);
        check.classList.add('anatomize-check');
        check.style.fontSize = '2.5px';
        check.style.fill = 'var(--green)';
        check.textContent = '\u2713';
        if (state.flipped) {
          check.setAttribute('transform',
              `translate(${cx},${cy}) scale(-1,1) translate(${-cx},${-cy})`);
        }
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
        const mx = pb.x + pb.w - 1.5;
        const my = pb.y + 2.5;
        const xMark = document.createElementNS(SVG_NS, 'text');
        xMark.setAttribute('x', mx);
        xMark.setAttribute('y', my);
        xMark.classList.add('anatomize-x');
        xMark.style.fontSize = '2.5px';
        xMark.style.fill = 'var(--red)';
        xMark.textContent = '\u2717';
        if (state.flipped) {
          xMark.setAttribute('transform',
              `translate(${mx},${my}) scale(-1,1) translate(${-mx},${-my})`);
        }
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
    bullet.style.backgroundColor = color;
    nameRow.appendChild(bullet);

    const nameText = document.createElement('span');
    nameText.style.fontWeight = '700';
    nameText.style.color = color;
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
    dom.nextSlot.textContent = '';

    const total = state.structures.length;
    const accuracy = total > 0 ?
        Math.round((state.firstAttempt.size / total) * 100) : 0;

    const summary = document.createElement('div');
    summary.className = 'anatomize-end-summary';
    summary.textContent =
        `Session complete. Score: ${state.score}. Accuracy: ${accuracy}%.`;
    dom.prompt.appendChild(summary);
  }

  function updateScore() {
    dom.scoreDisplay.textContent = '';
    const scoreText = document.createElement('span');
    scoreText.className = 'score-display';
    scoreText.textContent = `Score: ${state.score} \u00b7 ` +
        `${state.identified.size} of ${state.structures.length} identified`;
    dom.scoreDisplay.appendChild(scoreText);
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
