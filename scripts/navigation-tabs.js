// Contract for loading and recovery: prd/architecture/navigation-tabs.md

import {handleImportError} from "./load.js";
import {clearErrors, renderError} from "./error-ui.js";
import {newEl} from './el-create.js';

const byId = id => document.getElementById(id);

const ROUTE_REGEX = /^#(?<tab>[^/]+)(?:\/(?<subtab>[^/]+))?/;

let activeNavTab = document.querySelector('.nav-tab[aria-current]');
let activeSection = document.querySelector('section.content:not([hidden])');
let activeSubtabRow = document.querySelector('.subtab-row:not([hidden])');
const activeSubtabLink = {};
const activeSubtabContent = {};
const defaultTabId = ROUTE_REGEX.exec(activeNavTab.hash).groups.tab;

const initialized = new Set();
const pending = new Set();
const failed = new Set();

const LAZY_INIT = {
  'home':                   './home.js',
  'nomenclature-joints':    './nomenclature-joints.js',
  'nomenclature-translation': './nomenclature-translation.js',
  'patterns-cheat-sheet':   './patterns-cheat-sheet.js',
  'patterns-concept-map':   './patterns-concept-map.js',
  'patterns-level-quiz':    './patterns-level-quiz.js',
  'diagnose-game':          './diagnose-game.js',
  'diagnose-case-studies':  './diagnose-case-studies.js',
  'diagnose-causal-chains': './diagnose-causal-chains.js',
  'diagnose-decision-tree': './diagnose-decision-tree.js',
  'diagnose-muscle-map':    './diagnose-muscle-map.js',
  'flashcards':             './flashcards.js',
  'equivalence':            './equivalence-quiz.js',
  'masterquiz':             './masterquiz.js',
  'anatomy-anatomize':      './anatomize.js',
  'anatomy-decoder':        './decoder.js',
  'anatomy-aic':            './aic-chain.js'
};

const showTabLoading = container => container.append(newEl('div', {
  className: 'tab-loading skeleton',
  children: [
    newEl('div', {className: 'skeleton-heading'}),
    newEl('div', {className: 'skeleton-line'}),
    newEl('div', {className: 'skeleton-line-short'})
  ]
}));

const clearTabLoading = container => container.querySelector('.tab-loading')?.remove();

const SHOW_SKELETON_AFTER_MS = 250;

const startTabLoading = (link, container) => {
  link.classList.add('loading');
  container.classList.add('loading');
  return setTimeout(showTabLoading, SHOW_SKELETON_AFTER_MS, container);
};

const endTabLoading = (link, container, timer) => {
  clearTimeout(timer);
  clearTabLoading(container);
  link.classList.remove('loading');
  container.classList.remove('loading');
};

const importModule = path => import(path).then(
    ()    => ({ok: true,  path}),
    cause => ({ok: false, path, cause}));

function lazyInit(base, link) {
  if (initialized.has(base) || pending.has(base)) return;

  if (!Object.hasOwn(LAZY_INIT, base)) return;
  const entry = LAZY_INIT[base];

  const container = byId(tabKey.content(base));
  if (!container) return;

  pending.add(base);
  const loadingTimer = startTabLoading(link, container);

  const retryingImport = failed.has(base);
  const path = retryingImport ? entry + '?r=' + Date.now() : entry;
  if (retryingImport) {
    failed.delete(base);
    clearErrors(container);
  }

  importModule(path).then((result) => {
    endTabLoading(link, container, loadingTimer);
    pending.delete(base);

    if (result.ok) {
      initialized.add(base);
      return;
    }

    failed.add(base);
    handleImportError(result, {
      render: (message, retry) => renderError(container, message, retry),
      onRetry: () => lazyInit(base, link)
    });
  });
}

function updateBreadcrumb(tabId, subtabId) {
  const navTab = byId(tabKey.navLink(tabId));
  const subtabLink = subtabId
    ? byId(tabKey.subtabLink(tabId, subtabId))
    : null;
  const show = navTab && subtabLink;

  byId('breadcrumb').classList.toggle('hidden', !show);
  if (!show) return;

  byId('breadcrumb-tab').textContent    = navTab.textContent;
  byId('breadcrumb-subtab').textContent = subtabLink.textContent;
}

// Shared Key: every nav id is derived from its route segments here, not inline.
const tabKey = {
  navLink:    tabId => 'nav-' + tabId,
  content:    routeKey => routeKey + '-content',
  subtabRow:  tabId => tabId + '-subtabs',
  subtabLink: (tabId, subtabId) => tabKey.subtab(tabId, subtabId) + '-subtab',
  subtab:     (tabId, subtabId) => tabId + '-' + subtabId
};

function swapAriaCurrent(prev, next, value = 'true') {
  prev.removeAttribute('aria-current');
  next.setAttribute('aria-current', value);
  return next;
}

// prev is null at load (all subtab-rows hidden); next is null for
// row-less tabs (home, flashcards, equivalence, masterquiz).
function swapHidden(prev, next) {
  if (prev) prev.hidden = true;
  if (next) next.hidden = false;
  return next;
}

function activateTab(tabId, subtabId) {
  activeNavTab    = swapAriaCurrent(activeNavTab, byId(tabKey.navLink(tabId)), 'page');
  activeSection   = swapHidden(activeSection, byId(tabKey.content(tabId)));
  activeSubtabRow = swapHidden(activeSubtabRow, byId(tabKey.subtabRow(tabId)));

  if (activeSubtabRow) {
    activateSubtab(tabId, subtabId);
    return;
  }

  updateBreadcrumb(tabId, subtabId);
  lazyInit(tabId, activeNavTab);
}

function activateSubtab(tabId, subtabId) {
  const row = activeSubtabRow;
  activeSubtabLink[tabId] ??= row.querySelector('.subtab[aria-current]');

  const requested = subtabId && byId(tabKey.subtabLink(tabId, subtabId));
  const link = requested || activeSubtabLink[tabId] || row.querySelector('.subtab');

  subtabId = ROUTE_REGEX.exec(link.hash).groups.subtab;
  const base = tabKey.subtab(tabId, subtabId);

  activeSubtabLink[tabId] = swapAriaCurrent(activeSubtabLink[tabId], link);

  activeSubtabContent[tabId] ??=
    activeSection.querySelector('.subtab-content:not([hidden])');
  activeSubtabContent[tabId] =
    swapHidden(activeSubtabContent[tabId], byId(tabKey.content(base)));

  updateBreadcrumb(tabId, subtabId);
  lazyInit(base, link);
}

function applyHash() {
  let {tab: tabId = defaultTabId, subtab: subtabId} =
      ROUTE_REGEX.exec(location.hash)?.groups || {};
  if (!byId(tabKey.navLink(tabId))) { tabId = defaultTabId; subtabId = undefined; }

  const canonicalHash = '#' + tabId + (subtabId ? '/' + subtabId : '');
  if (location.hash !== canonicalHash) {
    window.history.replaceState(null, '', canonicalHash);
  }
  activateTab(tabId, subtabId);
}

function retryActiveLoad(link) {
  const {tab, subtab} = ROUTE_REGEX.exec(link.hash).groups;
  const base = subtab ? tabKey.subtab(tab, subtab) : tab;
  if (failed.has(base)) lazyInit(base, link);
}

function handleNavClick(e) {
  const link = e.target.closest('.nav-tab, .subtab');
  if (!link?.hash || link.hash !== location.hash) return;

  e.preventDefault();
  retryActiveLoad(link);
}

function initScrollAffordance() {
  const tabs = byId('nav-tabs');
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
  window.addEventListener('hashchange', applyHash);
  applyHash();
  initScrollAffordance();
}

document.addEventListener('DOMContentLoaded', initNavigationTabs);
navigator.serviceWorker?.register('./sw.js').catch(() => {});
