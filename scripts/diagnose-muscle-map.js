import {loadJson} from './load.js';
import {loadAndRender} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';

let muscleExerciseMap = {};
let viewTabs;
let search;
let activeViewTab;
let currentMView;

const containerEl = document.getElementById('diagnose-muscle-map-content');
const mapWrap = document.getElementById('muscle-map-wrap');

await loadAndRender({
  load: () => loadJson('./data/diagnose-muscle-exercise-map.json'),
  container: containerEl,
  render: (data) => {
    muscleExerciseMap = data;
    viewTabs = document.getElementById('muscle-view-tabs');
    search = document.getElementById('muscle-search');
    activeViewTab = viewTabs.querySelector('.subview-tab.activeTab');

    window.addEventListener('hashchange', applySubview);
    search.addEventListener('input', () =>
      renderMuscleView(currentMView, search.value.toLowerCase())
    );
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.preventDefault();
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

function applySubview() {
  const link = resolveSubviewLink(viewTabs);
  if (!link) return;

  const view = getSubviewFromHash(link.hash);
  if (link !== activeViewTab) {
    activeViewTab?.classList.remove('activeTab');
    link.classList.add('activeTab');
    activeViewTab = link;
  }
  if (view !== currentMView) {
    currentMView = view;
    renderMuscleView(currentMView, search.value.toLowerCase());
  }
}

function getSubviewFromHash(url) {
  return url.substring(1).split('/')[2];
}

function resolveSubviewLink(viewTabs) {
  const hashView = getSubviewFromHash(location.hash);
  if (hashView) {
    const link = viewTabs.querySelector('[href="#diagnose/muscle-map/' + hashView + '"]');
    if (link) return link;
  }
  return viewTabs.querySelector('.subview-tab.activeTab')
    || viewTabs.querySelector('.subview-tab');
}

function renderMuscleView(view, query = '') {
  const entries = muscleExerciseMap[view] || [];
  mapWrap.innerHTML = '';
  entries.forEach((entry) => {
    const nameKey = entry.muscle || entry.finding || '';
    if (query && !doesEntryMatchQuery(entry, query)) return;
    const div = document.createElement('div');
    div.className = 'muscle-entry';
    const exercises = (entry.exercises || []).map((e) =>
      `<span class="exercise-tag">${e}</span>`).join('');
    const meta = entry.action || entry.meaning || '';
    const patternLine = entry.pattern
      ? '<div class="muscle-meta">Pattern: '
        + expandAbbr(entry.pattern) + '</div>'
      : '';
    const hierarchyLine = entry.hierarchyStep
      ? '<div class="muscle-meta">Hierarchy: '
        + expandAbbr(entry.hierarchyStep) + '</div>'
      : '';
    const musclesLine = entry.muscles
      ? '<div class="muscle-meta">Muscles: '
        + expandAbbr(entry.muscles) + '</div>'
      : '';
    div.innerHTML =
      '<div class="muscle-name">'
        + expandAbbr(nameKey) + '</div>'
      + '<div class="muscle-meta">'
        + expandAbbr(meta) + '</div>'
      + patternLine + hierarchyLine + musclesLine
      + '<div class="exercise-tags">'
        + exercises + '</div>';
    mapWrap.appendChild(div);
  });
  if (!mapWrap.children.length) {
    mapWrap.innerHTML =
      '<div class="empty-message">No entries match.</div>';
  }
}
