let cached = null;

// Returns null on failure — each caller checks and calls showFetchError.
export function getStudyData() {
  if (!cached) {
    cached = fetch('data/study-data.json')
      .then((resp) => resp.ok ? resp.json() : (cached = null))
      .catch(() => cached = null);
  }
  return cached;
}
