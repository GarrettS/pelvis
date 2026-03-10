import {initAnatomize, loadImageSet} from './anatomize.js';
import {showFetchError} from './fetch-feedback.js';

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
Object.entries(TAB_MAP).forEach(function([k, v]) { REV_TAB[v] = k; });

const REV_SUBTAB = {};
Object.entries(SUBTAB_MAP).forEach(function([tab, subs]) {
  Object.entries(subs).forEach(function([k, v]) {
    REV_SUBTAB[v] = {tab: tab, subtab: k};
  });
});

const lastSubtab = {};
let activeNavTab = document.querySelector('.nav-tab.active');
let activeSection = document.querySelector('section.tab.active');
let activeSubtabRow = document.querySelector('.subtab-row.active');

/* ── Lazy-init infrastructure ── */

const initialized = new Set();

const LAZY_INIT = {
  'tab-nomenclature': {
    label: 'Nomenclature',
    load: function() { return import('./nomenclature.js').then(function(m) { return m.initNomenclature; }); }
  },
  'tab-patterns': {
    label: 'Patterns',
    load: function() { return import('./patterns.js').then(function(m) { return m.initPatterns; }); }
  },
  'tab-diagnose': {
    label: 'Diagnose',
    load: function() { return import('./diagnose.js').then(function(m) { return m.initDiagnose; }); }
  },
  'tab-flashcards': {
    label: 'Flashcards',
    load: function() { return import('./flashcards.js').then(function(m) { return m.initFlashcards; }); }
  },
  'tab-equivalence': {
    label: 'Equivalence',
    load: function() { return import('./equivalence-quiz.js').then(function(m) { return m.initEquivalence; }); }
  },
  'tab-masterquiz': {
    label: 'Master Quiz',
    load: function() { return import('./masterquiz.js').then(function(m) { return m.initMasterQuiz; }); }
  },
  'anatomy-anatomize': {
    label: 'Anatomize',
    load: function() { return Promise.resolve(initAnatomize); }
  },
  'anatomy-decoder': {
    label: 'Decoder',
    load: function() { return import('./decoder.js').then(function(m) { return m.initDecoder; }); }
  },
  'anatomy-aic': {
    label: 'L AIC Chain',
    load: function() { return import('./aic-chain.js').then(function(m) { return m.initLAIC; }); }
  }
};

function showTabLoading(container, label) {
  const div = document.createElement('div');
  div.className = 'tab-loading callout';
  div.textContent = 'Loading ' + label + '\u2026';
  container.appendChild(div);
}

function clearTabLoading(container) {
  const el = container.querySelector('.tab-loading');
  if (el) el.remove();
}

function lazyInit(key) {
  if (initialized.has(key)) return;
  const entry = LAZY_INIT[key];
  if (!entry) return;
  initialized.add(key);
  const container = document.getElementById(key);
  if (!container) return;
  showTabLoading(container, entry.label);
  entry.load()
    .then(function(initFn) {
      clearTabLoading(container);
      return initFn();
    })
    .catch(function() {
      clearTabLoading(container);
      initialized.delete(key);
      showFetchError(container, entry.label);
    });
}

/* ── Navigation ── */

function getSubtabRow(sectionId) {
  return document.querySelector('.subtab-row[data-for-tab="' + sectionId + '"]');
}

function activateTab(sectionId) {
  if (activeNavTab) activeNavTab.classList.remove('active');
  if (activeSection) activeSection.classList.remove('active');
  if (activeSubtabRow) activeSubtabRow.classList.remove('active');

  activeNavTab = document.querySelector('.nav-tab[data-tab="' + sectionId + '"]');
  activeSection = document.getElementById(sectionId);
  activeSubtabRow = getSubtabRow(sectionId);

  if (activeNavTab) activeNavTab.classList.add('active');
  if (activeSection) activeSection.classList.add('active');
  if (activeSubtabRow) activeSubtabRow.classList.add('active');

  lazyInit(sectionId);
}

function activateSubtab(sectionId, subtabContentId) {
  const row = getSubtabRow(sectionId);
  if (!row) return;
  const link = row.querySelector('.subtab[data-subtab="' + subtabContentId + '"]');
  if (!link) return;
  row.querySelectorAll('.subtab').forEach(function(b) {
    b.classList.remove('active');
  });
  link.classList.add('active');
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.querySelectorAll('.subtab-content').forEach(function(c) {
    c.classList.remove('active');
  });
  const target = document.getElementById(subtabContentId);
  if (target) {
    target.classList.add('active');
    target.dispatchEvent(new CustomEvent('subtab-shown', {bubbles: true}));
  }
  const tabName = REV_TAB[sectionId];
  if (tabName) lastSubtab[tabName] = subtabContentId;

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

function initNavigationTabs() {
  document.querySelector('nav').addEventListener('click', handleNavTabClick);
  document.addEventListener('click', handleSubtabClick);
  document.addEventListener('click', handleSubviewTabClick);
  window.addEventListener('hashchange', applyHash);
  applyHash();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function() {});
  }
}

export {initNavigationTabs};

document.addEventListener('DOMContentLoaded', initNavigationTabs);
