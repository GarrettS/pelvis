import {showFetchError} from "./load-errors.js";
import {setupGame} from './diagnose-game.js';
import {setupCaseStudies} from './diagnose-case-studies.js';
import {setupCausalChains} from './diagnose-causal-chains.js';
import {setupDecisionTree} from './diagnose-decision-tree.js';
import {setupMuscleMap} from './diagnose-muscle-map.js';

export async function init() {
  const container = document.getElementById('diagnose-content');
  if (!container) return;

  try {
    await Promise.all([
      setupGame(),
      setupCaseStudies(),
      setupCausalChains(),
      setupDecisionTree(),
      setupMuscleMap()
    ]);
  } catch (cause) {
    showFetchError(container, 'study-data.json', cause);
  }
}
