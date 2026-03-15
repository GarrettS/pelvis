/*
 * Progressive enhancement for <abbr> elements. Requires Popover API.
 * CSS Anchor Positioning (where supported) handles placement; without
 * it the popover appears centered in the viewport.
 *
 * Desktop (hover: hover): mouseover/mouseout, no click handler.
 * Mobile (no hover): click to show, popover light-dismiss to hide.
 * Title is swapped to data-title on first interaction to suppress
 * the native tooltip.
 */
function initAbbrPopover() {
  if (typeof document.documentElement.showPopover !== 'function') return;

  const popover = document.getElementById('abbr-popover');
  const main = document.querySelector('main');

  function showForAbbr(abbr) {
    if (abbr.title) {
      abbr.dataset.title = abbr.title;
      abbr.removeAttribute('title');
    }
    abbr.style.anchorName = '--abbr-active';
    popover.textContent = abbr.dataset.title;
    popover.showPopover();
  }

  if (matchMedia('(hover: hover)').matches) {
    main.addEventListener('mouseover', (e) => {
      const abbr = e.target.closest('abbr[title], abbr[data-title]');
      if (!abbr) return;

      showForAbbr(abbr);
    });

    main.addEventListener('mouseout', (e) => {
      const abbr = e.target.closest('abbr[data-title]');
      if (!abbr) return;

      if (abbr.contains(e.relatedTarget)) return;

      popover.hidePopover();
      abbr.style.anchorName = '';
    });
  } else {
    main.addEventListener('click', (e) => {
      const abbr = e.target.closest('abbr[title], abbr[data-title]');
      if (!abbr) return;

      showForAbbr(abbr);
    });
  }
}

document.addEventListener('DOMContentLoaded', initAbbrPopover);
