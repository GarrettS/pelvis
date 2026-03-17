/*
 * Root-scoped: browsers restrict SW scope to its directory and below.
 * GitHub Pages does not support Service-Worker-Allowed header.
 */
const CACHE_VERSION = 'v10';

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/layout.css',
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
  './scripts/decoder.js',
  './scripts/diagnose.js',
  './scripts/equivalence.js',
  './scripts/equivalence-quiz.js',
  './scripts/fetch-feedback.js',
  './scripts/flashcards.js',
  './scripts/masterquiz.js',
  './scripts/navigation-tabs.js',
  './scripts/nomenclature.js',
  './scripts/patterns.js',
  './scripts/shuffle.js',
  './scripts/resize-handle.js',
  './scripts/study-data-cache.js',
  './data/aic-chain.json',
  './data/anatomize-data.json',
  './data/causal-map.json',
  './data/cheat-data.json',
  './data/equivalence-explanations.json',
  './data/flashcard-deck.json',
  './data/halt-levels.json',
  './data/master-quiz.json',
  './data/pelvic-joints.json',
  './data/regions.json',
  './data/squat-levels.json',
  './data/study-data.json',
  './data/symptom-patterns.json',
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
