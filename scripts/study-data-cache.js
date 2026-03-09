let cached = null;

export function getStudyData() {
  if (!cached) {
    cached = fetch('data/study-data.json')
      .then(function(resp) {
        if (!resp.ok) {
          cached = null;
          return null;
        }
        return resp.json();
      })
      .catch(function() {
        cached = null;
        return null;
      });
  }
  return cached;
}
