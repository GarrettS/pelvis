// Architecture: prd/architecture/diagnose-causal-chains.md

import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {expandAbbr} from './abbr-expand.js';
import {SortableListContainer} from './sortable-list-form.js';

const containerEl = document.getElementById('diagnose-causal-chains-content');
const chainsWrap = document.getElementById('chains-wrap');

const renderChainForm = ({ title, start, end, infoBonus }) => `
  <h3 class="form-title">${expandAbbr(title)}</h3>
  <div class="form-subtitle">${expandAbbr(start)} → ${expandAbbr(end)}</div>
  <div class="sortable-list-parent"><ol class="sortable-list"></ol></div>
  <div class="btn-row">
    <button name="checkResults" class="primary">Check Order</button>
    <button name="reshuffle">Reshuffle</button>
  </div>
  ${infoBonus ? `<details class="reveal-details">
    <summary>${expandAbbr(infoBonus.summary)}</summary>
    <ul>${infoBonus.points.map(p => `<li>${expandAbbr(p)}</li>`).join('')}</ul>
  </details>` : ''}
`;

function initSortableLists(chainDefinitions) {
  new SortableListContainer(chainsWrap, {
    definitions: chainDefinitions,
    getSteps: chain => chain.steps,
    renderFormHTML: renderChainForm,
    renderItemHTML: expandAbbr,
    flipDuration: parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--dur-normal'))
  });
}

await attemptLoad({
  loader: () => loadJson('./data/diagnose-causal-chains.json'),
  container: containerEl,
  render: initSortableLists
});
