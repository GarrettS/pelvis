// Sole owner of the 'userFlashcards' localStorage bucket. flashcards.js and
// masterquiz.js are both consumers; neither reads or writes the key directly.
//
// Single source of truth within a page: the bucket is read and parsed once,
// then held in memory. saveUserFlashcard mutates the in-memory copy and writes
// through to localStorage. There is no delete path, so the cache only grows and
// the in-memory copy can never fall behind the disk within one page.
//
// Cross-tab assumption: a second browser tab on the same origin shares this
// key but not this module instance. Its writes are not reflected here until
// reload. Accepted: a study tool is used in one tab; the prior read-modify-
// write code already had a cross-tab lost-update race regardless.

const USER_FLASHCARDS_KEY = 'userFlashcards';

// Memoized load outcome: null until first access, then one of
// {kind: 'ok', cards} | {kind: 'unavailable', detail} | {kind: 'corrupt', detail}.
// A storage or parse failure is permanent for the page (private mode, disabled
// storage, corrupt JSON do not heal mid-session), so the outcome is cached too.
let cacheState = null;

function loadCache() {
  if (cacheState) return cacheState;

  let raw;
  try {
    raw = localStorage.getItem(USER_FLASHCARDS_KEY);
  } catch (storageReadError) {
    cacheState = {kind: 'unavailable', detail: storageReadError.message};
    return cacheState;
  }

  let cards;
  try {
    cards = raw ? JSON.parse(raw) : [];
  } catch (parseError) {
    cacheState = {kind: 'corrupt', detail: parseError.message};
    return cacheState;
  }

  cacheState = {kind: 'ok', cards};
  return cacheState;
}

// Background read: callers render their deck without persistence when storage
// is unavailable or corrupt. The user loses visibility of custom cards only;
// nothing is written here, so degraded data is never clobbered.
export function getUserFlashcards() {
  const state = loadCache();
  return state.kind === 'ok' ? state.cards : [];
}

export function hasSavedFlashcard(cardId) {
  const state = loadCache();
  return state.kind === 'ok' && state.cards.some((c) => c.id === cardId);
}

// User-initiated: the caller shows the message on failure. A degraded bucket
// (unavailable or corrupt) is reported and left intact rather than overwritten,
// so existing saved cards survive for a later recovery.
export function saveUserFlashcard(card) {
  const state = loadCache();

  if (state.kind === 'unavailable') {
    return {
      ok: false,
      message: "Couldn't save flashcard: browser storage is unavailable: "
        + state.detail
    };
  }

  if (state.kind === 'corrupt') {
    return {
      ok: false,
      message: "Couldn't save flashcard: saved card data is corrupt: "
        + state.detail
    };
  }

  if (state.cards.some((c) => c.id === card.id)) {
    return {ok: true, duplicate: true};
  }

  let serializedCards;
  try {
    serializedCards = JSON.stringify([...state.cards, card]);
  } catch (stringifyError) {
    return {
      ok: false,
      message: "Couldn't save flashcard: saved card data couldn't be prepared: "
        + stringifyError.message
    };
  }

  try {
    localStorage.setItem(USER_FLASHCARDS_KEY, serializedCards);
  } catch (storageWriteError) {
    return {
      ok: false,
      message: "Couldn't save flashcard: browser storage is unavailable: "
        + storageWriteError.message
    };
  }

  state.cards.push(card);
  return {ok: true, duplicate: false};
}
