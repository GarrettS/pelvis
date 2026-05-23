// Architecture: prd/architecture/abbr-popover.md

const ABBR_SELECTOR = 'abbr[data-title]';

function initAbbrPopover() {
  if (typeof document.body.showPopover !== 'function') return;

  const popover = document.getElementById('abbr-popover');
  const main = document.querySelector('main');
  let activeAbbr = null;

  // Suppress native tooltips on pre-existing static abbrs before any
  // hover can race with our popover.
  for (const abbr of main.querySelectorAll('abbr[title]')) {
    abbr.dataset.title = abbr.title;
    abbr.removeAttribute('title');
  }

  const showForAbbr = (abbr) => {
    activeAbbr?.classList.remove('abbr-anchored');
    activeAbbr = abbr;
    abbr.classList.add('abbr-anchored');
    popover.textContent = abbr.dataset.title;
    if (!popover.matches(':popover-open')) popover.showPopover();
  };

  popover.addEventListener('toggle', (e) => {
    if (e.newState !== 'closed' || !activeAbbr) return;
    activeAbbr.classList.remove('abbr-anchored');
    activeAbbr = null;
  });

  const hidePopover = e =>
      e.target === activeAbbr
      && e.relatedTarget !== popover
      && popover.hidePopover();

  main.addEventListener('focusin', e =>
      e.target !== activeAbbr
      && e.target.matches(ABBR_SELECTOR)
      && showForAbbr(e.target));
  main.addEventListener('focusout', hidePopover);

  if (matchMedia('(hover: hover)').matches) {
    main.addEventListener('mouseover', e =>
        e.target !== activeAbbr
        && e.target.matches(ABBR_SELECTOR)
        && showForAbbr(e.target));
    main.addEventListener('mouseout', hidePopover);
    popover.addEventListener('mouseleave', e =>
        e.relatedTarget !== activeAbbr && popover.hidePopover());
  }
}

initAbbrPopover();
