import {expandAbbr} from './abbr-expand.js';
import {shuffle} from './shuffle.js';
import {loadJson} from './load.js';
import {replaceErrorCallout, clearErrors, attemptLoad} from './error-ui.js';
import {getUserFlashcards, saveUserFlashcard} from './flashcard-storage.js';
import {newEl} from './el-create.js';

let allCards = [];
let baseDeck = [];
let loadedUserCardCount = 0;
let activeCat = 'all';
let activeWeight = 'all';
let deck = [];
let currentIdx = 0;
let cardsRemaining = 0;

const containerEl = document.getElementById('flashcards-content');

function normalizeUserCard(c) {
  return {
    ...c,
    category: c.category || 'user_created',
    examWeight: c.examWeight || 'high'
  };
}

function rebuildAllCards() {
  const userCards = getUserFlashcards();
  loadedUserCardCount = userCards.length;
  allCards = [...baseDeck, ...userCards.map(normalizeUserCard)];
}

function getFilteredCards() {
  return allCards.filter((c) => {
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

function nextCard() {
  if (!deck.length) return;

  cardsRemaining--;
  currentIdx = (currentIdx + 1) % deck.length;
  if (currentIdx === 0) cardsRemaining = deck.length;
  renderCard();
}

function flipCard(e) {
  e.target.closest('.fc-card')?.classList.toggle('fc-flipped');
}

const CARD_ACTIONS = {
  flip: flipCard,
  next: nextCard
};

function cardActionHandler(e) {
  const action = e.target.closest('[data-action]')?.dataset.action;
  CARD_ACTIONS[action]?.(e);
}

function actionBtn(action, label, primary = false) {
  const btn = newEl('button', {
    type: 'button',
    className: primary ? 'primary' : '',
    textContent: label
  });
  btn.dataset.action = action;
  return btn;
}

function buildCard(card, includeNext = false) {
  const backChildren = [
    newEl('div', {
      className: 'fc-back-main',
      innerHTML: expandAbbr(card.back)
    })
  ];
  if (card.backDetail) {
    backChildren.push(newEl('details', {children: [
      newEl('summary', {
        className: 'fc-show-more',
        textContent: 'Show More'
      }),
      newEl('div', {
        className: 'fc-detail',
        innerHTML: expandAbbr(card.backDetail)
      })
    ]}));
  }

  const cardChildren = [
    newEl('div', {className: 'fc-front-main', textContent: card.front})
  ];
  if (card.frontHint) {
    cardChildren.push(newEl('div', {
      className: 'fc-front-hint',
      innerHTML: expandAbbr(card.frontHint)
    }));
  }
  cardChildren.push(
      newEl('div', {className: 'fc-back', children: backChildren}),
      newEl('div', {
        className: 'fc-actions',
        children: includeNext
            ? [actionBtn('flip', 'Flip', true), actionBtn('next', 'Next →')]
            : [actionBtn('flip', 'Flip', true)]
      })
  );

  return newEl('div', {className: 'fc-card', children: cardChildren});
}

function renderCard() {
  const progressEl = document.getElementById('fc-progress');
  const cardWrap = document.getElementById('fc-card-wrap');

  progressEl.textContent = `${cardsRemaining} of ${deck.length} remaining`;

  if (!deck.length) {
    cardWrap.replaceChildren(newEl('div', {
      className: 'callout',
      textContent: 'No cards match the current filters.'
    }));
    return;
  }

  cardWrap.replaceChildren(buildCard(deck[currentIdx], true));
}

function clearForm() {
  document.getElementById('fc-add-form').reset();
  document.getElementById('fc-detail-count').textContent = '0 / 380';
  document.getElementById('fc-form-preview').disabled = true;
}

function showEditStep() {
  document.getElementById('fc-edit-section').classList.remove('hidden');
  document.getElementById('fc-preview-section').classList.add('hidden');
  document.getElementById('fc-form-title').textContent = 'New Card';
}

function bindFilterGroup(containerId, dataKey, onChange) {
  const container = document.getElementById(containerId);
  let activeBtn = container.querySelector('.fc-filter-btn.active');
  container.addEventListener('click', (e) => {
    const btn = e.target.closest(`[data-${dataKey}]`);
    if (!btn || btn === activeBtn) return;

    onChange(btn.dataset[dataKey]);
    activeBtn?.classList.remove('active');
    btn.classList.add('active');
    activeBtn = btn;
    resetDeck();
  });
}

function setupAddForm() {
  const addForm = document.getElementById('fc-add-form');
  const frontInput = document.getElementById('fc-input-front');
  const hintInput = document.getElementById('fc-input-hint');
  const backInput = document.getElementById('fc-input-back');
  const detailInput = document.getElementById('fc-input-detail');
  const charCount = document.getElementById('fc-detail-count');
  const previewBtn = document.getElementById('fc-form-preview');

  addForm.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input, textarea')) {
      e.preventDefault();
    }
  });

  const syncPreviewBtn = () => {
    previewBtn.disabled = !(frontInput.value.trim() && backInput.value.trim());
  };
  frontInput.addEventListener('input', syncPreviewBtn);
  backInput.addEventListener('input', syncPreviewBtn);

  detailInput.addEventListener('input', () => {
    const len = detailInput.value.length;
    charCount.textContent = `${len} / 380`;
    charCount.classList.toggle('warn', len > 340);
    if (len > 380) detailInput.value = detailInput.value.slice(0, 380);
  });

  document.getElementById('fc-add-btn').addEventListener('click', () => {
    addForm.classList.toggle('hidden');
  });

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
      backDetail: detailInput.value.trim() || null
    };
    document.getElementById('fc-preview-card')
        .replaceChildren(buildCard(previewCard));
    document.getElementById('fc-edit-section').classList.add('hidden');
    document.getElementById('fc-preview-section').classList.remove('hidden');
    document.getElementById('fc-form-title').textContent = 'Preview';
  });

  document.getElementById('fc-form-edit-back')
      .addEventListener('click', showEditStep);

  document.getElementById('fc-form-save').addEventListener('click', () => {
    const front = frontInput.value.trim();
    const back = backInput.value.trim();
    if (!front || !back) return;

    clearErrors(addForm);

    const newCard = {
      id: 'user-' + Date.now(),
      category: 'user_created',
      examWeight: 'high',
      front,
      frontHint: hintInput.value.trim() || null,
      back,
      backDetail: detailInput.value.trim() || null
    };

    const saveResult = saveUserFlashcard(newCard);
    if (!saveResult.ok) {
      replaceErrorCallout(addForm, saveResult.message);
      return;
    }

    allCards.push(newCard);
    loadedUserCardCount = getUserFlashcards().length;
    deck.unshift(newCard);
    currentIdx = 0;
    cardsRemaining = deck.length;

    addForm.classList.add('hidden');
    showEditStep();
    clearForm();
    renderCard();
  });
}

function refreshDeckIfUserCardsAdded([entry]) {
  if (!entry.isIntersecting) return;
  if (getUserFlashcards().length === loadedUserCardCount) return;

  rebuildAllCards();
  resetDeck();
}

function setupFlashcards(deckData) {
  baseDeck = deckData;
  rebuildAllCards();
  deck = shuffle([...allCards]);
  cardsRemaining = deck.length;
  renderCard();

  containerEl.addEventListener('click', cardActionHandler);
  document.getElementById('fc-reset').addEventListener('click', resetDeck);
  bindFilterGroup('fc-cat-filters', 'cat', (val) => { activeCat = val; });
  bindFilterGroup('fc-weight-filters', 'weight', (val) => { activeWeight = val; });
  setupAddForm();

  new IntersectionObserver(refreshDeckIfUserCardsAdded).observe(containerEl);
}

await attemptLoad({
  loader: () => loadJson('./data/flashcard-deck.json'),
  container: containerEl,
  render: setupFlashcards
});
