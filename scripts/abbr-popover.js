// Architecture: prd/architecture/abbr-popover.md

const ABBR_SELECTOR = 'abbr[data-title]';

function initAbbrPopover() {
  if (typeof document.body.showPopover !== 'function') return;

  const popover = document.getElementById('abbr-popover');
  const main = document.querySelector('main');
  if (!popover || !main) return;

  let activeAbbr = null;
  let anchorCount = 0;

  // Prepare each static abbr: move title to data-title so the browser's own
  // tooltip cannot race ours, and make it focusable so keyboard and touch can
  // open the popover.
  for (const abbr of main.querySelectorAll('abbr[title]')) {
    abbr.dataset.title = abbr.title;
    abbr.removeAttribute('title');
    abbr.tabIndex = 0;
  }

  const describe = abbr => abbr.setAttribute('aria-describedby', popover.id);
  const undescribe = abbr => abbr?.removeAttribute('aria-describedby');

  const dismissPopover = () => {
    undescribe(activeAbbr);
    popover.hidePopover();
  };

  const finishAnimation = animation => animation.finish();

  const showForAbbr = abbr => {
    // isOpen follows the Popover API state — false through the entire exit
    // fade. isReplacingMidFade catches a new abbr arriving in that
    // logically-closed, visually-still-fading window.
    const isOpen = popover.matches(':popover-open');
    const isReplacingMidFade = !isOpen && abbr !== activeAbbr;

    if (isReplacingMidFade) {
      popover.getAnimations().forEach(finishAnimation);
    }
    if (!abbr.style.anchorName) {
      abbr.style.anchorName = `--abbr-anchor-${anchorCount++}`;
    }
    if (activeAbbr !== abbr) undescribe(activeAbbr);

    activeAbbr = abbr;
    popover.style.positionAnchor = abbr.style.anchorName;
    popover.textContent = abbr.dataset.title;
    describe(abbr);
    if (!isOpen) popover.showPopover();
  };

  const shouldShow = target =>
      target.matches(ABBR_SELECTOR)
      && (target !== activeAbbr || !popover.matches(':popover-open'));

  const abbrOutHandler = ({target, relatedTarget}) => {
    if (target !== activeAbbr || relatedTarget === popover) return;

    dismissPopover();
  };

  main.addEventListener('focusin', ({target}) =>
      shouldShow(target) && showForAbbr(target));
  main.addEventListener('focusout', abbrOutHandler);

  // An outside tap or Escape closes the popover without firing abbrOutHandler,
  // so clear the description on any close.
  popover.addEventListener('toggle', ({newState}) => {
    if (newState === 'closed') undescribe(activeAbbr);
  });

  if (matchMedia('(hover: hover)').matches) {
    main.addEventListener('mouseover', ({target}) =>
        shouldShow(target) && showForAbbr(target));
    main.addEventListener('mouseout', abbrOutHandler);
    popover.addEventListener('mouseleave', ({relatedTarget}) => {
      if (relatedTarget === activeAbbr) return;

      dismissPopover();
    });
  } else {
    // A tap does not focus an abbr on iOS, and pointer events are not subject
    // to the cursor-based clickable rule, so open on pointerup.
    main.addEventListener('pointerup', ({target}) =>
        shouldShow(target) && showForAbbr(target));
  }
}

initAbbrPopover();
