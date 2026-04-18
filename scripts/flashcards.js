import { appendErrorCallout, showFetchError } from "./load-errors.js";
import { expandAbbr } from './abbr-expand.js';
import { shuffle } from './shuffle.js';

let FLASHCARD_DECK = [];

function getUserCards() {
  const raw = localStorage.getItem('userFlashcards');
  return raw ? JSON.parse(raw) : [];
}

function tryGetUserCards() {
  try {
    return getUserCards();
  } catch (anyError) {
    // Background storage — not user-initiated. Flashcards
    // function without persistence; user loses custom cards only.
    return [];
  }
}

function withUserCard(cards, card) {
  return [...cards, card];
}

function showSaveFailure(container, message) {
  container.querySelector('.callout.error')?.remove();
  appendErrorCallout(container, message);
}

let allCards = [];
let activeCat = 'all';
let activeWeight = 'all';
let deck = [];
let currentIdx = 0;
let cardsRemaining = 0;

function getFilteredCards() {
  return allCards.filter(c => {
    const catOk = activeCat === 'all' || c.category === activeCat;
    const weightOk = activeWeight === 'all' || c.examWeight === activeWeight;
    return catOk && weightOk;
  });
}

function resetDeck() {
  deck = shuffle(getFilteredCards());
  currentIdx = 0;
  cardsRemaining = deck.length;
  renderCard();
}

function buildCardDOM(card) {
  const cardDiv = document.createElement('div');
  cardDiv.className = 'fc-card';

  const frontMain = document.createElement('div');
  frontMain.className = 'fc-front-main';
  frontMain.textContent = card.front;
  cardDiv.appendChild(frontMain);

  if (card.frontHint) {
    const hintEl = document.createElement('div');
    hintEl.className = 'fc-front-hint';
    hintEl.innerHTML = expandAbbr(card.frontHint);
    cardDiv.appendChild(hintEl);
  }

  const backArea = document.createElement('div');
  backArea.className = 'fc-back hidden';

  const backMain = document.createElement('div');
  backMain.className = 'fc-back-main';
  backMain.innerHTML = expandAbbr(card.back);
  backArea.appendChild(backMain);

  if (card.backDetail) {
    const showMoreBtn = document.createElement('button');
    showMoreBtn.className = 'btn fc-show-more';
    showMoreBtn.textContent = 'Show More';
    backArea.appendChild(showMoreBtn);

    const detailEl = document.createElement('div');
    detailEl.className = 'fc-detail hidden';
    detailEl.innerHTML = expandAbbr(card.backDetail);
    backArea.appendChild(detailEl);

    showMoreBtn.addEventListener('click', () => {
      detailEl.classList.remove('hidden');
      showMoreBtn.disabled = true;
      showMoreBtn.textContent = 'Detail shown';
    });
  }

  cardDiv.appendChild(backArea);

  const actions = document.createElement('div');
  actions.className = 'fc-actions';

  const flipBtn = document.createElement('button');
  flipBtn.className = 'btn primary';
  flipBtn.textContent = 'Flip';

  let isFlipped = false;
  flipBtn.addEventListener('click', () => {
    isFlipped = !isFlipped;
    backArea.classList.toggle('hidden', !isFlipped);
  });

  actions.appendChild(flipBtn);
  cardDiv.appendChild(actions);

  return { cardDiv, actions };
}

function clearForm() {
  document.getElementById('fc-add-form').reset();
  document.getElementById('fc-detail-count')
    .textContent = '0 / 380';
  document.getElementById('fc-form-preview')
    .disabled = true;
}

function showEditStep() {
  document.getElementById('fc-edit-section').classList.remove('hidden');
  document.getElementById('fc-preview-section').classList.add('hidden');
  document.getElementById('fc-form-title').textContent = 'New Card';
}

function renderCard() {
  const progressEl = document.getElementById('fc-progress');
  const wrap = document.getElementById('fc-card-wrap');

  progressEl.textContent = cardsRemaining + ' of ' + deck.length + ' remaining';

  if (!deck.length) {
    wrap.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'callout';
    msg.textContent = 'No cards match the current filters.';
    wrap.appendChild(msg);
    return;
  }

  const card = deck[currentIdx];
  const { cardDiv, actions } = buildCardDOM(card);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn';
  nextBtn.textContent = 'Next \u2192';
  nextBtn.addEventListener('click', () => {
    cardsRemaining--;
    currentIdx = (currentIdx + 1) % deck.length;
    if (currentIdx === 0) {
      cardsRemaining = deck.length;
    }
    renderCard();
  });

  actions.appendChild(nextBtn);

  wrap.innerHTML = '';
  wrap.appendChild(cardDiv);
}

export async function init() {
  const wrap = document.getElementById('fc-card-wrap');
  if (!wrap) return;

  try {
    const resp = await fetch('data/flashcard-deck.json');
    if (!resp.ok) {
      showFetchError(wrap, 'flashcard-deck.json', resp);
      return;
    }
    FLASHCARD_DECK = await resp.json();
  } catch (cause) {
    showFetchError(wrap, 'flashcard-deck.json', cause);
    return;
  }
  const userCards = tryGetUserCards().map(c => ({
    ...c,
    category: c.category || 'user_created',
    examWeight: c.examWeight || 'high',
  }));
  allCards = [...FLASHCARD_DECK, ...userCards];
  deck = shuffle([...allCards]);
  currentIdx = 0;
  cardsRemaining = deck.length;
  renderCard();

  document.getElementById('fc-reset').addEventListener('click', resetDeck);

  let activeCatBtn = document.querySelector('#fc-cat-filters .fc-filter-btn.active');
  let activeWeightBtn = document.querySelector(
    '#fc-weight-filters .fc-filter-btn.active'
  );

  document.getElementById('fc-cat-filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;

    activeCat = btn.dataset.cat;
    activeCatBtn?.classList.remove('active');
    btn.classList.add('active');
    activeCatBtn = btn;
    resetDeck();
  });

  document.getElementById('fc-weight-filters').addEventListener('click', e => {
    const btn = e.target.closest('[data-weight]');
    if (!btn) return;

    activeWeight = btn.dataset.weight;
    activeWeightBtn?.classList.remove('active');
    btn.classList.add('active');
    activeWeightBtn = btn;
    resetDeck();
  });

  const addBtn = document.getElementById('fc-add-btn');
  const addForm = document.getElementById('fc-add-form');
  const frontInput = document.getElementById('fc-input-front');
  const hintInput = document.getElementById('fc-input-hint');
  const backInput = document.getElementById('fc-input-back');
  const detailInput = document.getElementById('fc-input-detail');
  const charCount = document.getElementById('fc-detail-count');
  const previewBtn = document.getElementById('fc-form-preview');

  [frontInput, hintInput, backInput, detailInput].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  });

  function syncPreviewBtn() {
    previewBtn.disabled = !(frontInput.value.trim() && backInput.value.trim());
  }
  frontInput.addEventListener('input', syncPreviewBtn);
  backInput.addEventListener('input', syncPreviewBtn);

  detailInput.addEventListener('input', () => {
    const len = detailInput.value.length;
    charCount.textContent = len + ' / 380';
    charCount.classList.toggle('warn', len > 340);
    if (len > 380) detailInput.value = detailInput.value.slice(0, 380);
  });

  addBtn.addEventListener('click', () => addForm.classList.toggle('hidden'));

  document.getElementById('fc-form-cancel').addEventListener('click', () => {
    addForm.classList.add('hidden');
    showEditStep();
    clearForm();
  });

  previewBtn.addEventListener('click', () => {
    const previewCard = {
      front: frontInput.value.trim(),
      frontHint: hintInput.value.trim() || null,
      back: backInput.value.trim(),
      backDetail: detailInput.value.trim() || null,
    };
    const container = document.getElementById('fc-preview-card');
    container.innerHTML = '';
    container.appendChild(buildCardDOM(previewCard).cardDiv);

    document.getElementById('fc-edit-section').classList.add('hidden');
    document.getElementById('fc-preview-section').classList.remove('hidden');
    document.getElementById('fc-form-title').textContent = 'Preview';
  });

  document.getElementById('fc-form-edit-back').addEventListener('click', showEditStep);

  document.getElementById('fc-form-save').addEventListener('click', () => {
    const front = frontInput.value.trim();
    const back = backInput.value.trim();
    if (!front || !back) return;
    addForm.querySelector('.callout.error')?.remove();

    const newCard = {
      id: 'user-' + Date.now(),
      category: 'user_created',
      examWeight: 'high',
      front,
      frontHint: hintInput.value.trim() || null,
      back,
      backDetail: detailInput.value.trim() || null,
    };

    let savedCards;
    let rawCards;
    try {
      rawCards = localStorage.getItem('userFlashcards');
    } catch (storageReadError) {
      showSaveFailure(
        addForm,
        "Couldn't save flashcard: browser storage is unavailable: "
          + storageReadError.message
      );
      return;
    }

    try {
      savedCards = rawCards ? JSON.parse(rawCards) : [];
    } catch (parseError) {
      showSaveFailure(
        addForm,
        "Couldn't save flashcard: saved card data is corrupt: "
          + parseError.message
      );
      return;
    }

    let serializedCards;
    try {
      serializedCards = JSON.stringify(withUserCard(savedCards, newCard));
    } catch (stringifyError) {
      showSaveFailure(
        addForm,
        "Couldn't save flashcard: saved card data couldn't be prepared: "
          + stringifyError.message
      );
      return;
    }

    try {
      localStorage.setItem('userFlashcards', serializedCards);
    } catch (storageWriteError) {
      showSaveFailure(
        addForm,
        "Couldn't save flashcard: browser storage is unavailable: "
          + storageWriteError.message
      );
      return;
    }

    allCards.push(newCard);

    deck.unshift(newCard);
    currentIdx = 0;
    cardsRemaining = deck.length;

    addForm.classList.add('hidden');
    showEditStep();
    clearForm();
    renderCard();
  });
}
