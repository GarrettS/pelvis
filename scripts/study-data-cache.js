let cached = null;

export function getStudyData() {
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
