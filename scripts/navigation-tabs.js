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
  'nomenclature':           './nomenclature.js',
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

const importModule = path => import(path).then(
    ()    => ({ok: true,  path}),
    cause => ({ok: false, path, cause}));

function lazyInit(base, link) {
  if (initialized.has(base) || pending.has(base)) return;

  const entry = LAZY_INIT[base];
  if (!entry) return;

  const container = byId(tabKey.content(base));
  if (!container) return;

  pending.add(base);
  link?.classList.add('loading');
  container.classList.add('loading');

  const skeletonTimer = setTimeout(
      showTabLoading, SHOW_SKELETON_AFTER_MS, container);

  const path = failed.has(base) ? entry + '?r=' + Date.now() : entry;
  failed.delete(base);

  importModule(path).then((result) => {
    clearTimeout(skeletonTimer);
    clearTabLoading(container);
    pending.delete(base);
    link?.classList.remove('loading');
    container.classList.remove('loading');

    if (result.ok) {
      clearErrors(container);
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
  const base = subtabId && tabKey.subtab(tabId, subtabId);
  const subtabLink = base ? byId(tabKey.subtabLink(base)) : null;
  const show = navTab && subtabLink;

  byId('breadcrumb').classList.toggle('hidden', !show);
  if (!show) return;

  byId('breadcrumb-tab').textContent    = navTab.textContent;
  byId('breadcrumb-subtab').textContent = subtabLink.textContent;
}

// Shared Key: every nav id is derived from its route segments here, not inline.
const tabKey = {
  navLink:    base => 'nav-' + base,
  content:    base => base + '-content',
  subtabRow:  base => base + '-subtabs',
  subtabLink: base => base + '-subtab',
  subtab:     (base, subtabId) => base + '-' + subtabId
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

  updateBreadcrumb(tabId, subtabId);
  lazyInit(tabId, activeNavTab);

  if (activeSubtabRow) activateSubtab(tabId, subtabId);
}

function activateSubtab(tabId, subtabId) {
  const row = byId(tabKey.subtabRow(tabId));
  activeSubtabLink[tabId] ??= row.querySelector('.subtab[aria-current]');

  const requested = subtabId && tabKey.subtab(tabId, subtabId);
  const link = (requested && byId(tabKey.subtabLink(requested)))
            || activeSubtabLink[tabId]
            || row.querySelector('.subtab');

  subtabId = ROUTE_REGEX.exec(link.hash).groups.subtab;
  const base = tabKey.subtab(tabId, subtabId);

  activeSubtabLink[tabId] = swapAriaCurrent(activeSubtabLink[tabId], link);

  activeSubtabContent[tabId] ??=
    byId(tabKey.content(tabId)).querySelector('.subtab-content:not([hidden])');
  activeSubtabContent[tabId] =
    swapHidden(activeSubtabContent[tabId], byId(tabKey.content(base)));

  updateBreadcrumb(tabId, subtabId);
  lazyInit(base, link);
}

function applyHash() {
  let {tab: tabId = defaultTabId, subtab: subtabId} =
      ROUTE_REGEX.exec(location.hash)?.groups || {};
  if (!byId(tabKey.navLink(tabId))) { tabId = defaultTabId; subtabId = undefined; }
  activateTab(tabId, subtabId);
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
  document.querySelector('main').addEventListener('click', handleSubviewClick);
  window.addEventListener('hashchange', applyHash);
  applyHash();
  initScrollAffordance();
}

document.addEventListener('DOMContentLoaded', initNavigationTabs);
window.addEventListener('load', () => 
    navigator.serviceWorker?.register('./sw.js').catch(() => {})
);
