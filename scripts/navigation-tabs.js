// Contract for loading and recovery: prd/architecture/navigation-tabs.md

import {handleImportError} from "./load.js";
import {clearErrors, renderError} from "./error-ui.js";
import {renderHomeProgress} from './home-progress.js';
import {newEl} from './el-create.js';

const lastSubtab = {};
let activeNavTab = document.querySelector('.nav-tab.activeTab');
let activeSection = document.querySelector('section.content.activeTab');
let activeSubtabRow = document.querySelector('.subtab-row.activeTab');
const activeSubtabLink = {};
const activeSubtabContent = {};

const initialized = new Set();
const pending = new Set();
const failed = new Set();

const LAZY_INIT = {
  'nomenclature-content':      './nomenclature.js',
  'patterns-cheat-sheet-content': './patterns-cheat-sheet.js',
  'patterns-concept-map-content': './patterns-concept-map.js',
  'patterns-level-quiz-content': './patterns-level-quiz.js',
  'diagnose-game-content':          './diagnose-game.js',
  'diagnose-case-studies-content':  './diagnose-case-studies.js',
  'diagnose-causal-chains-content': './diagnose-causal-chains.js',
  'diagnose-decision-tree-content': './diagnose-decision-tree.js',
  'diagnose-muscle-map-content':    './diagnose-muscle-map.js',
  'flashcards-content':        './flashcards.js',
  'equivalence-content':       './equivalence-quiz.js',
  'masterquiz-content':        './masterquiz.js',
  'anatomy-anatomize-content': './anatomize.js',
  'anatomy-decoder-content':   './decoder.js',
  'anatomy-aic-content':       './aic-chain.js'
};

function showTabLoading(container) {
  container.append(newEl('div', {
    className: 'tab-loading skeleton',
    children: [
      newEl('div', {className: 'skeleton-heading'}),
      newEl('div', {className: 'skeleton-line'}),
      newEl('div', {className: 'skeleton-line-short'})
    ]
  }));
}

function clearTabLoading(container) {
  container.querySelector('.tab-loading')?.remove();
}

const SHOW_SKELETON_AFTER_MS = 250;

const importModule = path => import(path).then(
    ()    => ({ok: true,  path}),
    cause => ({ok: false, path, cause}));

function lazyInit(contentId, link) {
  if (initialized.has(contentId) || pending.has(contentId)) return;

  const entry = LAZY_INIT[contentId];
  if (!entry) return;

  const container = document.getElementById(contentId);
  if (!container) return;

  pending.add(contentId);
  link?.classList.add('loading');
  container.classList.add('loading');

  const skeletonTimer = setTimeout(
      showTabLoading, SHOW_SKELETON_AFTER_MS, container);

  const path = failed.has(contentId) ? entry + '?r=' + Date.now() : entry;
  failed.delete(contentId);

  importModule(path).then((result) => {
    clearTimeout(skeletonTimer);
    clearTabLoading(container);
    pending.delete(contentId);
    link?.classList.remove('loading');
    container.classList.remove('loading');
    clearErrors(container);

    if (result.ok) {
      initialized.add(contentId);
      return;
    }

    failed.add(contentId);
    handleImportError(result, {
      render: (message, retry) => renderError(container, message, retry),
      onRetry: () => lazyInit(contentId, link)
    });
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
  lazyInit(sectionId, activeNavTab);

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
  }
  activeSubtabContent[tab] = target;
  lastSubtab[tab] = subtab;

  updateLocationBar();
  lazyInit(contentId, link);
}

function applyHash() {
  const h = location.hash.substring(1);
  const [tab = 'home', subtab] = h.split('/');
  activateTab(tab, subtab);
}

function handleNavClick(e) {
  const link = e.target.closest('.nav-tab, .subtab');
  if (!link?.hash) return;

  e.preventDefault();
  if (link.hash === location.hash) return applyHash();

  location.hash = link.hash;
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
}

document.addEventListener('DOMContentLoaded', initNavigationTabs);
window.addEventListener('load', () => 
    navigator.serviceWorker?.register('./sw.js').catch(() => {})
);
