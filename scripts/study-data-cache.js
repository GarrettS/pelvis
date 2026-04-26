let cached = null;

function load() {
  if (cached) return cached;

  cached = fetch('data/study-data.json')
    .then((resp) => {
      if (!resp.ok) return Promise.reject(resp);
      return resp.json();
    })
    .catch((cause) => {
      // Reset after failure so the next tab visit can retry
      // instead of reusing a permanently rejected promise.
      cached = null;
      return Promise.reject(cause);
    });
  return cached;
}

export const getCausalChains      = async () => (await load()).causalChains;
export const getCaseStudies       = async () => (await load()).caseStudies;
export const getGameScenarios     = async () => (await load()).gameScenarios;
export const getDecisionTree      = async () => (await load()).decisionTree;
export const getMuscleExerciseMap = async () => (await load()).muscleExerciseMap;
export const getTranslations      = async () => (await load()).translationMap;
