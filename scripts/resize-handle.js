import {newEl} from './el-create.js';

function createResizeHandle({
  container,
  insertBefore,
  resizeTarget,
  cssProperty,
  minWidth = 120,
  maxRatio = .6,
  canDrag = () => true,
  onResize
}) {
  const handle = newEl('div', {
    className: 'resize-handle',
    children: [newEl('div', {className: 'resize-grip'})]
  });
  container.insertBefore(handle, insertBefore);

  function startDrag(e) {
    e.preventDefault();
    if (!canDrag()) return;

    handle.classList.add('dragging');
    document.documentElement.classList.add('is-column-resizing');

    const startX = e.type === 'touchstart' ?
        e.touches[0].clientX : e.clientX;
    const startW = resizeTarget.getBoundingClientRect().width;
    const maxW = container.clientWidth * maxRatio;

    const dragSession = new AbortController();
    const {signal} = dragSession;

    function updateDrag(ev) {
      ev.preventDefault();
      const clientX = ev.type === 'touchmove' ?
          ev.touches[0].clientX : ev.clientX;
      const delta = clientX - startX;
      const newW = Math.max(minWidth, Math.min(maxW, startW + delta));
      container.style.setProperty(cssProperty, Math.floor(newW) + 'px');
      onResize?.(newW);
    }

    function endDrag() {
      handle.classList.remove('dragging');
      document.documentElement.classList.remove('is-column-resizing');
      dragSession.abort();
    }

    document.addEventListener('mousemove', updateDrag, {signal});
    document.addEventListener('mouseup', endDrag, {signal});
    document.addEventListener('touchmove', updateDrag, {passive: false, signal});
    document.addEventListener('touchend', endDrag, {signal});
  }

  handle.addEventListener('mousedown', startDrag);
  handle.addEventListener('touchstart', startDrag, {passive: false});

  return handle;
}

export {createResizeHandle};
