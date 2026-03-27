import {showFetchError} from './fetch-feedback.js';
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
    label: 'Nomenclature',
    load: () => import('./nomenclature.js').then((m) => m.initNomenclature)
  },
  'patterns-content': {
    label: 'Patterns',
    load: () => import('./patterns.js').then((m) => m.initPatterns)
  },
  'diagnose-content': {
    label: 'Diagnose',
    load: () => import('./diagnose.js').then((m) => m.initDiagnose)
  },
  'flashcards-content': {
    label: 'Flashcards',
    load: () => import('./flashcards.js').then((m) => m.initFlashcards)
  },
  'equivalence-content': {
    label: 'Equivalence',
    load: () => import('./equivalence-quiz.js').then((m) => m.initEquivalence)
  },
  'masterquiz-content': {
    label: 'Master Quiz',
    load: () => import('./masterquiz.js').then((m) => m.initMasterQuiz)
  },
  'anatomy-anatomize-content': {
    label: 'Anatomize',
    load: () => import('./anatomize.js').then((m) => m.initAnatomize)
  },
  'anatomy-decoder-content': {
    label: 'Decoder',
    load: () => import('./decoder.js').then((m) => m.initDecoder)
  },
  'anatomy-aic-content': {
    label: 'L AIC Chain',
    load: () => import('./aic-chain.js').then((m) => m.initLAIC)
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
  entry.load().then((initFn) => {
    clearTabLoading(container);
    return initFn();
  }).catch(() => {
    clearTabLoading(container);
    initialized.delete(key);
    showFetchError(container, entry.label);
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

function activateTab(tab) {
  const sectionId = tab + '-content';

  activeNavTab?.classList.remove('activeTab');
  activeSection?.classList.remove('activeTab');
  activeSubtabRow?.classList.remove('activeTab');

  activeNavTab = document.getElementById('nav:' + tab);
  activeSection = document.getElementById(sectionId);
  activeSubtabRow = document.getElementById(tab + '-subtabs');

  activeNavTab?.classList.add('activeTab');
  activeSection?.classList.add('activeTab');
  activeSubtabRow?.classList.add('activeTab');

  if (tab === 'home') renderHomeProgress();
  updateLocationBar();
  lazyInit(sectionId);
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
    const href = firstLink.getAttribute('href') || '';
    subtab = href.replace(/^#/, '').split('/')[1];
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
  const h = (location.hash || '').replace(/^#/, '');
  const [tab, subtab, subview] = h.split('/');

  const section = tab
    ? document.getElementById(tab + '-content')
    : null;
  if (!section || !section.classList.contains('content')) {
    activateTab('home');
    return;
  }

  activateTab(tab);
  activateSubtab(tab, subtab);
  if (subview) activateSubview(tab, subtab, subview);
}

function activateSubview(tab, subtab, subview) {
  const container = document.getElementById(
    tab + '-' + subtab + '-content');
  if (!container) return;

  const svTabs = container.querySelector('.subview-tabs');
  if (!svTabs) return;

  const svHref = '#' + tab + '/' + subtab + '/' + subview;
  const svLink = svTabs.querySelector('[href="' + svHref + '"]');
  if (svLink) svLink.click();
}

function handleNavClick(e) {
  const link = e.target.closest('.nav-tab, .subtab');
  if (!link) return;

  e.preventDefault();
  const href = link.getAttribute('href');
  if (href) location.hash = href.replace(/^#/, '');
}

function handleSubviewClick(e) {
  const link = e.target.closest('.subview-tab');
  if (!link) return;

  e.preventDefault();
  const href = link.getAttribute('href');
  if (href) location.hash = href.replace(/^#/, '');
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
