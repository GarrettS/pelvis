function initAbbrPopover() {
  if (!CSS.supports('anchor-name', '--x')) return;

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

  function hidePopover(abbr) {
    popover.hidePopover();
    abbr.style.anchorName = '';
  }

  main.addEventListener('mouseover', (e) => {
    const abbr = e.target.closest('abbr[title], abbr[data-title]');
    if (!abbr) return;

    showForAbbr(abbr);
  });

  main.addEventListener('mouseout', (e) => {
    const abbr = e.target.closest('abbr[data-title]');
    if (!abbr) return;

    if (abbr.contains(e.relatedTarget)) return;

    hidePopover(abbr);
  });

  main.addEventListener('click', (e) => {
    const abbr = e.target.closest('abbr[title], abbr[data-title]');
    if (!abbr) return;

    showForAbbr(abbr);
  });
}

document.addEventListener('DOMContentLoaded', initAbbrPopover);
