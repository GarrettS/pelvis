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
  'home-content':              './home.js',
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

  const container = byId(contentId);
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

function updateBreadcrumb(tabId, subtabId) {
  const navTab = byId(tabKey.navLink(tabId));
  const subtabLink = subtabId ? byId(tabKey.subtabLink(tabId, subtabId)) : null;
  const show = navTab && subtabLink;

  byId('breadcrumb').classList.toggle('hidden', !show);
  if (!show) return;

  byId('breadcrumb-tab').textContent    = navTab.textContent;
  byId('breadcrumb-subtab').textContent = subtabLink.textContent;
}

// Shared Key: tab-related element id is derived from tabId — derive here, not inline.
const tabKey = {
  navLink:       tabId             => 'nav-' + tabId,
  section:       tabId             => tabId + '-content',
  subtabRow:     tabId             => tabId + '-subtabs',
  subtabContent: (tabId, subtabId) => tabId + '-' + subtabId + '-content',
  subtabLink:    (tabId, subtabId) => tabId + '-' + subtabId + '-subtab'
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
  activeSection   = swapHidden(activeSection, byId(tabKey.section(tabId)));
  activeSubtabRow = swapHidden(activeSubtabRow, byId(tabKey.subtabRow(tabId)));

  updateBreadcrumb(tabId, subtabId);
  lazyInit(tabKey.section(tabId), activeNavTab);

  if (activeSubtabRow) activateSubtab(tabId, subtabId);
}

function activateSubtab(tabId, subtabId) {
  const row = byId(tabKey.subtabRow(tabId));
  activeSubtabLink[tabId] ??= row.querySelector('.subtab[aria-current]');

  const link = (subtabId && byId(tabKey.subtabLink(tabId, subtabId)))
            || activeSubtabLink[tabId]
            || row.querySelector('.subtab');

  subtabId = ROUTE_REGEX.exec(link.hash).groups.subtab;

  activeSubtabLink[tabId] = swapAriaCurrent(activeSubtabLink[tabId], link);

  activeSubtabContent[tabId] ??=
    byId(tabKey.section(tabId)).querySelector('.subtab-content:not([hidden])');
  activeSubtabContent[tabId] =
    swapHidden(activeSubtabContent[tabId], byId(tabKey.subtabContent(tabId, subtabId)));

  updateBreadcrumb(tabId, subtabId);
  lazyInit(tabKey.subtabContent(tabId, subtabId), link);
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
