/*
 * Root-scoped: browsers restrict SW scope to its directory and below.
 * GitHub Pages does not support Service-Worker-Allowed header.
 */
const CACHE_VERSION = 'v83';

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/tokens.css',
  './css/layout.css',
  './css/details.css',
  './css/loading.css',
  './css/quiz-form.css',
  './css/resize-handle.css',
  './css/aic-chain.css',
  './css/anatomize.css',
  './css/decoder.css',
  './css/diagnose.css',
  './css/sortable-list-form.css',
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
  './scripts/sortable-list-form.js',
  './scripts/escape-html.js',
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
  './img/PRI-1-glute-med--glute-max.webp',
  './img/PRI-1-Pelvic-Inlet.png',
  './img/PRI-1-Pelvic-Outlet.webp',
  './img/PRI-1-Pelvic-Outlet2.webp',
  './img/PRI-1-Pelvic-Outlet-flipped.webp',
  './img/left-aic.webp'
];

self.addEventListener('install', event => event.waitUntil(
  (async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })()
));

self.addEventListener('activate', event => event.waitUntil(
  (async () => {
    for (const key of await caches.keys())
      if (key !== CACHE_VERSION) await caches.delete(key);
    await self.clients.claim();
  })()
));

// The handler serves navigations and sub-resources alike with stale-while-revalidate.
// A reload re-requests the shell (the hash never reaches the network). The
// router then lazy-imports the current route's script as a second request. The
// two must come from one build, or one build's code runs against another
// build's DOM. Serving both from the cache keeps them on the same build. The
// background refresh and the next CACHE_VERSION precache deliver the new build
// one load later.
//
// Network-first navigation would instead serve a fresh shell against
// still-cached scripts -- one build's code on another's DOM again. Pure
// cache-first would freeze each asset until CACHE_VERSION changes.
self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;   // only GET responses are cacheable

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);

    // Revalidate on the network with a conditional request ({cache: 'no-cache'}),
    // then replace the cached copy on a good response (cloned before its body is
    // read). Default cache mode lets the browser's HTTP/memory cache answer this
    // with a stale copy -- the revalidate half of stale-while-revalidate then
    // rewrites stale over stale and never converges, so a new build only shows
    // after a hard reload. no-cache still lets an unchanged file answer with a
    // 304 (no body transfer). A 404/500 is left uncached so a transient error
    // can't evict a working copy.
    const refresh = fetch(request, {cache: 'no-cache'}).then(async response => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    });
    // Outlive respondWith so the background refresh finishes and updates the cache.
    event.waitUntil(refresh.catch(() => {
        /* offline: the cached copy was already served */ }));

    return cached || refresh;
  })());
});
