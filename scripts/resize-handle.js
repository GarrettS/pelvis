/**
 * Creates a draggable column-resize handle between two siblings.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.container - Parent element that receives the CSS variable.
 * @param {HTMLElement} opts.insertBefore - The handle is inserted before this element.
 * @param {HTMLElement} opts.resizeTarget - The element whose width is tracked/changed.
 * @param {string} opts.cssProperty - CSS custom property name set on container.
 * @param {number} [opts.minWidth=120] - Minimum width in px.
 * @param {number} [opts.maxRatio=0.6] - Maximum width as ratio of container width.
 * @param {function} [opts.canDrag] - Optional guard; drag starts only if it returns true.
 * @param {function} [opts.onResize] - Optional callback fired after each resize.
 */
function createResizeHandle(opts) {
  const container = opts.container;
  const insertBefore = opts.insertBefore;
  const resizeTarget = opts.resizeTarget;
  const cssProperty = opts.cssProperty;
  const minWidth = opts.minWidth || 120;
  const maxRatio = opts.maxRatio || 0.6;
  const canDrag = opts.canDrag || null;
  const onResize = opts.onResize || null;

  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  const grip = document.createElement('div');
  grip.className = 'resize-grip';
  handle.appendChild(grip);
  container.insertBefore(handle, insertBefore);

  function onDown(e) {
    e.preventDefault();
    if (canDrag && !canDrag()) return;

    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const startX = e.type === 'touchstart' ?
        e.touches[0].clientX : e.clientX;
    const startW = resizeTarget.getBoundingClientRect().width;
    const maxW = container.clientWidth * maxRatio;

    function onMove(ev) {
      ev.preventDefault();
      const clientX = ev.type === 'touchmove' ?
          ev.touches[0].clientX : ev.clientX;
      const delta = clientX - startX;
      const newW = Math.max(minWidth, Math.min(maxW, startW + delta));
      container.style.setProperty(cssProperty, Math.floor(newW) + 'px');
      if (onResize) onResize(newW);
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

  return handle;
}

export {createResizeHandle};
