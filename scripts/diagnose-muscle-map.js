import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';
import {newEl} from './el-create.js';

// Structural: third hash segment is the subview — no positional [2],
// no '#diagnose/muscle-map/' literal duplicating the route shape.
const SUBVIEW_REGEX = /^#[^/]+\/[^/]+\/(?<view>[^/]+)/;
const subviewId = view => 'muscle-view-' + view;
const subviewFromHash = hash => SUBVIEW_REGEX.exec(hash)?.groups.view;

// expandAbbr returns pre-escaped HTML (<abbr>); innerHTML is its
// documented, sanctioned sink. Structure is built as nodes, not strings.
const abbrDiv = (className, text) =>
  newEl('div', {className, innerHTML: expandAbbr(text)});

let muscleExerciseMap = {};
let viewTabs;
let search;
let activeViewTab;
let currentMView;

const containerEl = document.getElementById('diagnose-muscle-map-content');
const mapWrap = document.getElementById('muscle-map-wrap');

await attemptLoad({
  loader: () => loadJson('./data/diagnose-muscle-exercise-map.json'),
  container: containerEl,
  render: (data) => {
    muscleExerciseMap = data;
    viewTabs = document.getElementById('muscle-view-tabs');
    search = document.getElementById('muscle-search');
    activeViewTab = viewTabs.querySelector('.subview-tab[aria-current]');

    window.addEventListener('hashchange', applySubview);
    const runSearch = () =>
      renderMuscleView(currentMView, search.value.trim().toLowerCase());
    search.addEventListener('input', runSearch);
    search.form.addEventListener('submit', (e) => {
      e.preventDefault();   // intent: run the search in place, no navigation
      runSearch();
    });

    applySubview();
  }
});

export function doesEntryMatchQuery(entry, query) {
  const fields = [
    entry.muscle, entry.finding,
    entry.action, entry.meaning,
    entry.pattern, entry.hierarchyStep, entry.muscles,
    ...(entry.exercises || [])
  ];
  return fields.some((field) => field
    && expandAbbr(String(field)).toLowerCase().includes(query));
}

function resolveSubviewLink() {
  const view = subviewFromHash(location.hash);
  return (view && document.getElementById(subviewId(view)))
    || viewTabs.querySelector('.subview-tab[aria-current]')
    || viewTabs.querySelector('.subview-tab');
}

function applySubview() {
  const link = resolveSubviewLink();
  if (!link) return;

  const view = subviewFromHash(link.hash);
  if (link !== activeViewTab) {
    activeViewTab?.removeAttribute('aria-current');
    link.setAttribute('aria-current', 'true');
    activeViewTab = link;
  }
  if (view !== currentMView) {
    currentMView = view;
    renderMuscleView(currentMView, search.value.trim().toLowerCase());
  }
}

function createEntryCard(entry) {
  const meta = [
    ['Pattern',   entry.pattern],
    ['Hierarchy', entry.hierarchyStep],
    ['Muscles',   entry.muscles]
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => abbrDiv('muscle-meta', label + ': ' + value));

  const exerciseTags = (entry.exercises || []).map((ex) =>
    newEl('span', {className: 'exercise-tag', textContent: ex}));

  return newEl('div', {
    className: 'muscle-entry',
    children: [
      abbrDiv('muscle-name', entry.muscle || entry.finding || ''),
      abbrDiv('muscle-meta', entry.action || entry.meaning || ''),
      ...meta,
      newEl('div', {className: 'exercise-tags', children: exerciseTags})
    ]
  });
}

function renderMuscleView(view, query = '') {
  const entries = muscleExerciseMap[view] || [];
  const fragment = document.createDocumentFragment();

  for (const entry of entries) {
    if (query && !doesEntryMatchQuery(entry, query)) continue;
    fragment.append(createEntryCard(entry));
  }
  if (!fragment.childNodes.length) {
    fragment.append(newEl('div', {
      className: 'empty-message', textContent: 'No entries match.'
    }));
  }
  mapWrap.replaceChildren(fragment);
}
