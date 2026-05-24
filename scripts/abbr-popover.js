// Architecture: prd/architecture/abbr-popover.md

const ABBR_SELECTOR = 'abbr[data-title]';

function initAbbrPopover() {
  if (typeof document.body.showPopover !== 'function') return;

  const popover = document.getElementById('abbr-popover');
  const main = document.querySelector('main');
  let activeAbbr = null;
  let anchorCount = 0;

  // Suppress native tooltips on pre-existing static abbrs before any
  // hover can race with our popover.
  for (const abbr of main.querySelectorAll('abbr[title]')) {
    abbr.dataset.title = abbr.title;
    abbr.removeAttribute('title');
  }

  const showForAbbr = abbr => {
    // isOpen follows the Popover API state — false through the entire
    // exit fade. isReplacingMidFade catches a new actuator arriving
    // in that logically-closed, visually-still-fading window.
    const isOpen = popover.matches(':popover-open');
    const isReplacingMidFade = !isOpen && abbr !== activeAbbr;

    if (isReplacingMidFade) {
      popover.getAnimations().forEach(a => a.finish());
    }
    if (!abbr.style.anchorName) {
      abbr.style.anchorName = `--abbr-anchor-${anchorCount++}`;
    }
    activeAbbr = abbr;
    popover.style.positionAnchor = abbr.style.anchorName;
    popover.textContent = abbr.dataset.title;
    if (!isOpen) popover.showPopover();
  };

  const shouldShow = target =>
      target.matches(ABBR_SELECTOR)
      && (target !== activeAbbr || !popover.matches(':popover-open'));

  const hidePopover = ({target, relatedTarget}) =>
      target === activeAbbr
      && relatedTarget !== popover
      && popover.hidePopover();

  main.addEventListener('focusin', ({target}) =>
      shouldShow(target) && showForAbbr(target));
  main.addEventListener('focusout', hidePopover);

  if (matchMedia('(hover: hover)').matches) {
    main.addEventListener('mouseover', ({target}) =>
        shouldShow(target) && showForAbbr(target));
    main.addEventListener('mouseout', hidePopover);
    popover.addEventListener('mouseleave', ({relatedTarget}) =>
        relatedTarget !== activeAbbr && popover.hidePopover());
  }
}

initAbbrPopover();
