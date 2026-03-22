import {initAnatomize, loadImageSet} from './anatomize.js';
import {showFetchError} from './fetch-feedback.js';
import {renderHomeProgress} from './home-progress.js';

const TAB_MAP = {
  home: 'tab-home',
  anatomy: 'tab-anatomy',
  nomenclature: 'tab-nomenclature',
  patterns: 'tab-patterns',
  diagnose: 'tab-diagnose',
  flashcards: 'tab-flashcards',
  equivalence: 'tab-equivalence',
  masterquiz: 'tab-masterquiz'
};

const SUBTAB_MAP = {
  anatomy: {
    anatomize: 'anatomy-anatomize',
    decoder: 'anatomy-decoder',
    aic: 'anatomy-aic'
  },
  nomenclature: {
    joints: 'nom-joints',
    translation: 'nom-translation'
  },
  patterns: {
    cheatsheet: 'patterns-cheatsheet',
    conceptmap: 'patterns-conceptmap',
    tests: 'patterns-tests'
  },
  diagnose: {
    patternid: 'diagnose-patternid',
    cases: 'diagnose-cases',
    chains: 'diagnose-chains',
    tree: 'diagnose-tree',
    exercises: 'diagnose-exercises'
  }
};

const REV_TAB = {};
Object.entries(TAB_MAP).forEach(([k, v]) => { REV_TAB[v] = k; });

const REV_SUBTAB = {};
Object.entries(SUBTAB_MAP).forEach(([tab, subs]) => {
  Object.entries(subs).forEach(([k, v]) => {
    REV_SUBTAB[v] = {tab, subtab: k};
  });
});

const lastSubtab = {};
let activeNavTab = document.querySelector('.nav-tab.active');
let activeSection = document.querySelector('section.tab.active');
let activeSubtabRow = document.querySelector('.subtab-row.active');
const activeSubtabLink = {};
const activeSubtabContent = {};

const initialized = new Set();

const LAZY_INIT = {
  'tab-nomenclature': {
    label: 'Nomenclature',
    load: () => import('./nomenclature.js').then((m) => m.initNomenclature)
  },
  'tab-patterns': {
    label: 'Patterns',
    load: () => import('./patterns.js').then((m) => m.initPatterns)
  },
  'tab-diagnose': {
    label: 'Diagnose',
    load: () => import('./diagnose.js').then((m) => m.initDiagnose)
  },
  'tab-flashcards': {
    label: 'Flashcards',
    load: () => import('./flashcards.js').then((m) => m.initFlashcards)
  },
  'tab-equivalence': {
    label: 'Equivalence',
    load: () => import('./equivalence-quiz.js').then((m) => m.initEquivalence)
  },
  'tab-masterquiz': {
    label: 'Master Quiz',
    load: () => import('./masterquiz.js').then((m) => m.initMasterQuiz)
  },
  'anatomy-anatomize': {
    label: 'Anatomize',
    load: () => Promise.resolve(initAnatomize)
  },
  'anatomy-decoder': {
    label: 'Decoder',
    load: () => import('./decoder.js').then((m) => m.initDecoder)
  },
  'anatomy-aic': {
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
    })
    .catch(() => {
      clearTabLoading(container);
      initialized.delete(key);
      showFetchError(container, entry.label);
    });
}

function getSubtabRow(sectionId) {
  return document.querySelector('.subtab-row[data-for-tab="' + sectionId + '"]');
}

function updateLocationBar() {
  const bar = document.getElementById('location-bar');
  if (!bar) return;

  const subtabLink = activeSubtabRow
    ? activeSubtabRow.querySelector('.subtab.active')
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

function activateTab(sectionId) {
  activeNavTab?.classList.remove('active');
  activeSection?.classList.remove('active');
  activeSubtabRow?.classList.remove('active');

  activeNavTab = document.querySelector('.nav-tab[data-tab="' + sectionId + '"]');
  activeSection = document.getElementById(sectionId);
  activeSubtabRow = getSubtabRow(sectionId);

  activeNavTab?.classList.add('active');
  activeSection?.classList.add('active');
  activeSubtabRow?.classList.add('active');

  if (sectionId === 'tab-home') renderHomeProgress();
  updateLocationBar();
  lazyInit(sectionId);
}

function activateSubtab(sectionId, subtabContentId) {
  const row = getSubtabRow(sectionId);
  if (!row) return;

  const link = row.querySelector('.subtab[data-subtab="' + subtabContentId + '"]');
  if (!link) return;

  if (!activeSubtabLink[sectionId]) {
    activeSubtabLink[sectionId] = row.querySelector('.subtab.active');
  }
  activeSubtabLink[sectionId]?.classList.remove('active');
  link.classList.add('active');
  activeSubtabLink[sectionId] = link;

  const section = document.getElementById(sectionId);
  if (!section) return;

  if (!activeSubtabContent[sectionId]) {
    activeSubtabContent[sectionId] = section.querySelector('.subtab-content.active');
  }
  activeSubtabContent[sectionId]?.classList.remove('active');

  const target = document.getElementById(subtabContentId);
  if (target) {
    target.classList.add('active');
    target.dispatchEvent(new CustomEvent('subtab-shown', {bubbles: true}));
  }
  activeSubtabContent[sectionId] = target;

  const tabName = REV_TAB[sectionId];
  if (tabName) lastSubtab[tabName] = subtabContentId;

  updateLocationBar();
  lazyInit(subtabContentId);
}

function activateFirstSubtab(sectionId) {
  const tabName = REV_TAB[sectionId];
  if (tabName && lastSubtab[tabName]) {
    activateSubtab(sectionId, lastSubtab[tabName]);
    return;
  }
  const row = getSubtabRow(sectionId);
  if (!row) return;

  const firstLink = row.querySelector('.subtab');
  if (!firstLink) return;

  activateSubtab(sectionId, firstLink.dataset.subtab);
}

function parseHash(hash) {
  const h = (hash || '').replace(/^#/, '');
  if (!h) return {tab: null, subtab: null, subview: null};

  const parts = h.split('/');
  return {
    tab: parts[0] || null,
    subtab: parts[1] || null,
    subview: parts[2] || null
  };
}

function applyHash() {
  const parsed = parseHash(location.hash);
  if (!parsed.tab || !TAB_MAP[parsed.tab]) {
    activateTab('tab-home');
    return;
  }

  const sectionId = TAB_MAP[parsed.tab];
  activateTab(sectionId);

  if (parsed.subtab && SUBTAB_MAP[parsed.tab] &&
      SUBTAB_MAP[parsed.tab][parsed.subtab]) {
    activateSubtab(sectionId, SUBTAB_MAP[parsed.tab][parsed.subtab]);
  } else {
    activateFirstSubtab(sectionId);
  }

  if (parsed.subview) {
    activateSubview(parsed.tab, parsed.subtab, parsed.subview);
  }
}

function activateSubview(tab, subtab, subview) {
  if (tab === 'anatomy' && subtab === 'anatomize') {
    loadImageSet(subview, true);
    return;
  }
  const subtabContentId = subtab && SUBTAB_MAP[tab] ?
      SUBTAB_MAP[tab][subtab] : null;
  if (!subtabContentId) return;

  const container = document.getElementById(subtabContentId);
  if (!container) return;

  const svTabs = container.querySelector('.subview-tabs');
  if (!svTabs) return;

  const svLink = svTabs.querySelector(
      '[data-view="' + subview + '"], [data-mview="' + subview + '"]');
  if (svLink) svLink.click();
}

function handleNavTabClick(e) {
  const link = e.target.closest('.nav-tab');
  if (!link) return;

  e.preventDefault();
  location.hash = link.getAttribute('href').replace(/^#/, '');
}

function handleSubtabClick(e) {
  const link = e.target.closest('.subtab');
  if (!link) return;

  e.preventDefault();
  const href = link.getAttribute('href');
  if (href) location.hash = href.replace(/^#/, '');
}

function handleSubviewTabClick(e) {
  const link = e.target.closest('.subview-tab');
  if (!link) return;

  e.preventDefault();
  const view = link.dataset.view || link.dataset.mview;
  if (!view) return;

  const parsed = parseHash(location.hash);
  if (parsed.tab && parsed.subtab) {
    location.hash = parsed.tab + '/' + parsed.subtab + '/' + view;
  }
}

function initScrollAffordance() {
  const tabs = document.getElementById('nav-tabs');
  if (!tabs) return;

  function checkScroll() {
    const atEnd = tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 1;
    tabs.classList.toggle('scrolled-end', atEnd);
  }

  tabs.addEventListener('scroll', checkScroll, { passive: true });
  checkScroll();
}

function initNavigationTabs() {
  document.querySelector('nav').addEventListener('click', handleNavTabClick);
  document.addEventListener('click', handleSubtabClick);
  document.addEventListener('click', handleSubviewTabClick);
  window.addEventListener('hashchange', applyHash);
  applyHash();
  initScrollAffordance();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

export {initNavigationTabs};

document.addEventListener('DOMContentLoaded', initNavigationTabs);
