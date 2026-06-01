// Architecture: prd/architecture/diagnose-causal-chains.md

import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';
import {SortableListForm, bindContainer} from './sortable-list-form.js';

const containerEl = document.getElementById('diagnose-causal-chains-content');
const chainsWrap = document.getElementById('chains-wrap');

bindContainer(chainsWrap);

// Initial render is construction, not a measured layout change. Build detached;
// one replaceChildren attaches every form together so the row entrances run in
// sync — a single wrapper animationend then clears .entering for all of them.
// :where() in the CSS lowers the entrance rule's specificity below
// dropped/all-correct, so a lingering .entering can't suppress those.
const clearChainEntering = e => {
  if (e.animationName !== 'list-enter') return;
  e.currentTarget.classList.remove('entering');
  e.currentTarget.removeEventListener('animationend', clearChainEntering);
};

const renderChainForm = ({ title, start, end, infoBonus }) => `
  <h3 class="form-title">${expandAbbr(title)}</h3>
  <div class="form-subtitle">${expandAbbr(start)} → ${expandAbbr(end)}</div>
  <ol class="sortable-list"></ol>
  <div class="btn-row">
    <button name="checkResults" class="primary">Check Order</button>
    <button name="reshuffle">Reshuffle</button>
  </div>
  ${infoBonus ? `<details class="reveal-details">
    <summary>${expandAbbr(infoBonus.summary)}</summary>
    <ul>${infoBonus.points.map(p => `<li>${expandAbbr(p)}</li>`).join('')}</ul>
  </details>` : ''}
`;

function renderAll(chainDefinitions) {
  const forms = Object.entries(chainDefinitions).map(([id, def]) =>
    SortableListForm.getById(id, {
      ...def, renderFormHTML: renderChainForm, renderItemHTML: expandAbbr
    }).form);
  chainsWrap.classList.add('entering');
  chainsWrap.addEventListener('animationend', clearChainEntering);
  chainsWrap.replaceChildren(...forms);
}

await attemptLoad({
  loader: () => loadJson('./data/diagnose-causal-chains.json'),
  container: containerEl,
  render: renderAll
});
