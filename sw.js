/*
 * Root-scoped: browsers restrict SW scope to its directory and below.
 * GitHub Pages does not support Service-Worker-Allowed header.
 */
const CACHE_VERSION = 'v66';

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/tokens.css',
  './css/layout.css',
  './css/loading.css',
  './css/quiz-form.css',
  './css/resize-handle.css',
  './css/aic-chain.css',
  './css/anatomize.css',
  './css/decoder.css',
  './css/diagnose.css',
  './css/flashcards.css',
  './css/landing.css',
  './css/masterquiz.css',
  './css/nomenclature.css',
  './css/quiz-progress.css',
  './css/abbr-popover.css',
  './css/patterns.css',
  './scripts/abbr-expand.js',
  './scripts/abbr-popover.js',
  './scripts/aic-chain.js',
  './scripts/anatomize.js',
  './scripts/anatomize-progress.js',
  './scripts/decoder.js',
  './scripts/diagnose-case-studies.js',
  './scripts/diagnose-causal-chains.js',
  './scripts/diagnose-decision-tree.js',
  './scripts/diagnose-game.js',
  './scripts/diagnose-muscle-map.js',
  './scripts/equivalence.js',
  './scripts/equivalence-answers.js',
  './scripts/equivalence-quiz.js',
  './scripts/load.js',
  './scripts/error-ui.js',
  './scripts/flashcard-storage.js',
  './scripts/flashcards.js',
  './scripts/masterquiz.js',
  './scripts/navigation-tabs.js',
  './scripts/nomenclature-joints.js',
  './scripts/nomenclature-translation.js',
  './scripts/patterns-cheat-sheet.js',
  './scripts/patterns-concept-map.js',
  './scripts/patterns-symptom-quiz.js',
  './scripts/patterns-level-quiz.js',
  './scripts/level-quiz.js',
  './scripts/shuffle.js',
  './scripts/el-create.js',
  './scripts/test-profile.js',
  './scripts/quiz-form.js',
  './scripts/select-group.js',
  './scripts/resize-handle.js',
  './scripts/master-quiz-progress.js',
  './scripts/home.js',
  './data/aic-chain.json',
  './data/anatomize-data.json',
  './data/concept-map.json',
  './data/cheat-data.json',
  './data/equivalence-explanations.json',
  './data/flashcard-deck.json',
  './data/halt-levels.json',
  './data/master-quiz.json',
  './data/pelvic-joints.json',
  './data/squat-levels.json',
  './data/symptom-patterns.json',
  './data/diagnose-causal-chains.json',
  './data/diagnose-case-studies.json',
  './data/diagnose-decision-tree.json',
  './data/diagnose-game-scenarios.json',
  './data/diagnose-muscle-exercise-map.json',
  './data/nomenclature-translations.json',
  './img/PRI-1-glute-med--glute-max.png',
  './img/PRI-1-Pelvic-Inlet.png',
  './img/PRI-1-Pelvic-Outlet.jpg',
  './img/PRI-1-Pelvic-Outlet2.jpg',
  './img/PRI-1-Pelvic-Outlet-flipped.jpg',
  './img/left-aic.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function(cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(
          keys
            .filter(function(k) { return k !== CACHE_VERSION; })
            .map(function(k) { return caches.delete(k); })
        );
      })
      .then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request);
    })
  );
});
