export function bindSelectGroup(container, onChange) {
  let activeBtn = container.querySelector(':scope > [aria-current]');
  container.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn || btn.parentElement !== container || btn === activeBtn) return;

    activeBtn?.removeAttribute('aria-current');
    btn.setAttribute('aria-current', 'true');
    activeBtn = btn;
    onChange(btn);
  });
}
