import {showImportError} from "./load-errors.js";
import {renderHomeProgress} from './home-progress.js';

const lastSubtab = {};
let activeNavTab = document.querySelector('.nav-tab.activeTab');
let activeSection = document.querySelector('section.content.activeTab');
let activeSubtabRow = document.querySelector('.subtab-row.activeTab');
const activeSubtabLink = {};
const activeSubtabContent = {};

const initialized = new Set();

const LAZY_INIT = {
  'nomenclature-content': {
    path: './nomenclature.js'
  },
  'patterns-content': {
    path: './patterns.js'
  },
  'diagnose-content': {
    path: './diagnose.js'
  },
  'flashcards-content': {
    path: './flashcards.js'
  },
  'equivalence-content': {
    path: './equivalence-quiz.js'
  },
  'masterquiz-content': {
    path: './masterquiz.js'
  },
  'anatomy-anatomize-content': {
    path: './anatomize.js'
  },
  'anatomy-decoder-content': {
    path: './decoder.js'
  },
  'anatomy-aic-content': {
    path: './aic-chain.js'
  }
};

function showTabLoading(container) {
  const div = document.createElement('div');
  div.className = 'tab-loading';
  div.innerHTML =
    '<div class="skeleton skeleton-heading"></div>'
    + '<div class="skeleton skeleton-line"></div>'
    + '<div class="skeleton skeleton-line-short"></div>';
  container.appendChild(div);
}

function clearTabLoading(container) {
  container.querySelector('.tab-loading')?.remove();
}

function lazyInit(key) {
  if (initialized.has(key)) return;

  const entry = LAZY_INIT[key];
  if (!entry) return;

  initialized.add(key);
  const container = document.getElementById(key);
  if (!container) return;

  showTabLoading(container);
  import(entry.path).then((m) => {
    clearTabLoading(container);
    return m.init();
  }).catch((moduleError) => {
    clearTabLoading(container);
    initialized.delete(key);
    showImportError(container, entry.path, moduleError);
  });
}

function updateLocationBar() {
  const bar = document.getElementById('location-bar');
  if (!bar) return;

  const subtabLink = activeSubtabRow
    ? activeSubtabRow.querySelector('.subtab.activeTab')
    : null;

  if (!subtabLink || !activeNavTab) {
    bar.classList.add('hidden');
    return;
  }

  document.getElementById('location-tab').textContent =
    activeNavTab.textContent;
  document.getElementById('location-subtab').textContent =
    subtabLink.textContent;
  bar.classList.remove('hidden');
}

function activateTab(tab, subtab) {
  const sectionId = tab + '-content';
  const section = document.getElementById(sectionId);

  if (!section || !section.classList.contains('content')) {
    if (tab !== 'home') { activateTab('home'); return; }
    return;
  }

  activeNavTab?.classList.remove('activeTab');
  activeSection?.classList.remove('activeTab');
  activeSubtabRow?.classList.remove('activeTab');

  activeNavTab = document.getElementById('nav:' + tab);
  activeSection = section;
  activeSubtabRow = document.getElementById(tab + '-subtabs');

  activeNavTab?.classList.add('activeTab');
  activeSection.classList.add('activeTab');
  activeSubtabRow?.classList.add('activeTab');

  if (tab === 'home') renderHomeProgress();
  updateLocationBar();
  lazyInit(sectionId);

  if (activeSubtabRow) activateSubtab(tab, subtab);
}

function activateSubtab(tab, subtab) {
  const row = document.getElementById(tab + '-subtabs');
  if (!row) return;

  let link = subtab
    ? row.querySelector('[href="#' + tab + '/' + subtab + '"]')
    : null;
  if (!link && lastSubtab[tab]) {
    subtab = lastSubtab[tab];
    link = row.querySelector('[href="#' + tab + '/' + subtab + '"]');
  }
  if (!link) {
    const firstLink = row.querySelector('.subtab');
    if (!firstLink) return;
    
    subtab = firstLink.hash.substring(1).split('/')[1];
    if (!subtab) return;
    link = firstLink;
  }

  if (!activeSubtabLink[tab]) {
    activeSubtabLink[tab] = row.querySelector('.subtab.activeTab');
  }
  activeSubtabLink[tab]?.classList.remove('activeTab');
  link.classList.add('activeTab');
  activeSubtabLink[tab] = link;

  const section = document.getElementById(tab + '-content');
  if (!section) return;

  if (!activeSubtabContent[tab]) {
    activeSubtabContent[tab] =
      section.querySelector('.subtab-content.activeTab');
  }
  activeSubtabContent[tab]?.classList.remove('activeTab');

  const contentId = tab + '-' + subtab + '-content';
  const target = document.getElementById(contentId);
  if (target) {
    target.classList.add('activeTab');
    target.dispatchEvent(
      new CustomEvent('subtab-shown', {bubbles: true}));
  }
  activeSubtabContent[tab] = target;
  lastSubtab[tab] = subtab;

  updateLocationBar();
  lazyInit(contentId);
}

function applyHash() {
  const h = location.hash.substring(1);
  const [tab = 'home', subtab] = h.split('/');
  activateTab(tab, subtab);
}

function handleNavClick(e) {
  const link = e.target.closest('.nav-tab, .subtab');
  if (!link) return;

  e.preventDefault();
  if (link.hash) location.hash = link.hash;
}

function handleSubviewClick(e) {
  const link = e.target.closest('.subview-tab');
  if (!link) return;

  e.preventDefault();
  if (link.hash) location.hash = link.hash;
}

function initScrollAffordance() {
  const tabs = document.getElementById('nav-tabs');
  if (!tabs) return;

  function checkScroll() {
    const atEnd = tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 1;
    tabs.classList.toggle('scrolled-end', atEnd);
  }

  tabs.addEventListener('scroll', checkScroll, {passive: true});
  checkScroll();
}

function initNavigationTabs() {
  document.querySelector('nav').addEventListener('click', handleNavClick);
  document.querySelector('main').addEventListener('click', handleSubviewClick);
  window.addEventListener('hashchange', applyHash);
  applyHash();
  initScrollAffordance();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

export {initNavigationTabs};

document.addEventListener('DOMContentLoaded', initNavigationTabs);
