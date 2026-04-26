import {getMuscleExerciseMap} from './study-data-cache.js';
import {expandAbbr} from './abbr-expand.js';

let muscleExerciseMap = {};

export async function setupMuscleMap() {
  muscleExerciseMap = await getMuscleExerciseMap();

  const viewTabs = document.getElementById('muscle-view-tabs');
  const search = document.getElementById('muscle-search');
  let activeViewTab = viewTabs.querySelector('.subview-tab.activeTab');
  let currentMView;

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

  applySubview();
  window.addEventListener('hashchange', applySubview);

  search.addEventListener('input', () =>
    renderMuscleView(currentMView, search.value.toLowerCase())
  );
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });
}

function getSubviewFromHash(url) {
  return url.substring(1).split('/')[2];
}

function resolveSubviewLink(viewTabs) {
  const hashView = getSubviewFromHash(location.hash);
  if (hashView) {
    const link = viewTabs.querySelector('[href="#diagnose/exercises/' + hashView + '"]');
    if (link) return link;
  }
  return viewTabs.querySelector('.subview-tab.activeTab')
    || viewTabs.querySelector('.subview-tab');
}

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

function renderMuscleView(view, query = '') {
  const wrap = document.getElementById('muscle-map-wrap');
  const entries = muscleExerciseMap[view] || [];
  wrap.innerHTML = '';
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
    wrap.appendChild(div);
  });
  if (!wrap.children.length) {
    wrap.innerHTML =
      '<div class="empty-message">No entries match.</div>';
  }
}
