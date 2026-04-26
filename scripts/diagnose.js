import {showFetchError} from "./load-errors.js";
import {prefetchStudyData} from './study-data-cache.js';
import {setupGame} from './diagnose-game.js';
import {setupCaseStudies} from './diagnose-case-studies.js';
import {setupCausalChains} from './diagnose-causal-chains.js';
import {setupDecisionTree} from './diagnose-decision-tree.js';
import {setupMuscleMap} from './diagnose-muscle-map.js';

export async function init() {
  const container = document.getElementById('diagnose-content');
  if (!container) return;

  // Gate on data load so fetch/parse failures surface as a fetch
  // error and setup bugs propagate as bugs (not misclassified as
  // study-data.json failures, which would also mask the bug AND
  // mark the tab initialized so revisit cannot retry).
  try {
    await prefetchStudyData();
  } catch (cause) {
    showFetchError(container, 'study-data.json', cause);
    return;
  }

  await Promise.all([
    setupGame(),
    setupCaseStudies(),
    setupCausalChains(),
    setupDecisionTree(),
    setupMuscleMap()
  ]);
}
