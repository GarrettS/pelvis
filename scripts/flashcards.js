import {expandAbbr} from './abbr-expand.js';
import {toShuffled} from './shuffle.js';
import {loadJson} from './load.js';
import {attemptLoad} from './error-ui.js';
import {getUserFlashcards, saveUserFlashcard} from './flashcard-storage.js';
import {newEl} from './el-create.js';
import {bindSelectGroup} from './select-group.js';

const DETAIL_WARN = 340;

let curatedCardsById = {};
let cardsById = {};
let loadedUserCardCount = 0;
let activeCat = 'all';
let activeWeight = 'all';
let pendingReviewIds = [];
let currentCardId = null;
let currentReviewSize = 0;

const containerEl = document.getElementById('flashcards-content');
const addForm = document.getElementById('fc-add-form');

const normalizeUserCard = c => ({
  ...c,
  category: c.category || 'user_created',
  examWeight: c.examWeight || 'high'
});

function rebuildCardsById() {
  const userCards = getUserFlashcards();
  loadedUserCardCount = userCards.length;
  cardsById = {
    ...curatedCardsById,
    ...Object.fromEntries(
        userCards.map(card => [card.id, normalizeUserCard(card)]))
  };
}

const getFilteredCardIds = () => Object.keys(cardsById).filter(id => {
  const c = cardsById[id];
  return (activeCat === 'all' || c.category === activeCat)
      && (activeWeight === 'all' || c.examWeight === activeWeight);
});

function dealFreshDeck() {
  const ids = toShuffled(getFilteredCardIds());
  currentReviewSize = ids.length;
  currentCardId = ids.shift() || null;
  pendingReviewIds = ids;
}

function resetDeck() {
  dealFreshDeck();
  renderCard();
}

function nextCard() {
  if (!currentCardId) return;

  if (pendingReviewIds.length) {
    currentCardId = pendingReviewIds.shift();
  } else {
    dealFreshDeck();
  }
  renderCard();
}

const flipCard = e => e.target.closest('.fc-card').classList.toggle('fc-flipped');

const CARD_ACTIONS = {
  flip: flipCard,
  next: nextCard
};

function cardActionHandler(e) {
  const action = e.target.closest('[data-action]')?.dataset.action;
  CARD_ACTIONS[action]?.(e);
}

function actionBtn(action, label, cls = '') {
  return newEl('button', {
    type: 'button',
    className: cls,
    textContent: label,
    attrs: {'data-action': action}
  });
}

function backChildren(card) {
  const main = newEl('div', {
    className: 'fc-back-main',
    innerHTML: expandAbbr(card.back)
  });
  if (!card.backDetail) return [main];

  return [main, newEl('details', {children: [
    newEl('summary', {className: 'fc-show-more', textContent: 'Show More'}),
    newEl('div', {
      className: 'fc-detail',
      innerHTML: expandAbbr(card.backDetail)
    })
  ]})];
}

function buildCard(card, actions) {
  const children = [
    newEl('div', {className: 'fc-front-main', textContent: card.front})
  ];
  if (card.frontHint) {
    children.push(newEl('div', {
      className: 'fc-front-hint',
      innerHTML: expandAbbr(card.frontHint)
    }));
  }
  children.push(
      newEl('div', {className: 'fc-back', children: backChildren(card)}),
      newEl('div', {className: 'fc-actions', children: actions})
  );
  return newEl('div', {className: 'fc-card', children});
}

function renderCard() {
  const progressEl = document.getElementById('fc-progress');
  const cardWrap = document.getElementById('fc-card-wrap');

  if (!currentCardId) {
    progressEl.textContent = '0 of 0 remaining';
    cardWrap.replaceChildren(newEl('div', {
      className: 'callout',
      textContent: 'No cards match the current filters.'
    }));
    return;
  }

  const remaining = pendingReviewIds.length + 1;
  progressEl.textContent = `${remaining} of ${currentReviewSize} remaining`;
  cardWrap.replaceChildren(buildCard(cardsById[currentCardId], [
    actionBtn('flip', 'Flip', 'primary'),
    actionBtn('next', 'Next →')
  ]));
}

function clearForm() {
  addForm.reset();
  setFormError();
  const detail = document.getElementById('fc-input-detail');
  document.getElementById('fc-detail-count').textContent = `0 / ${detail.maxLength}`;
  document.getElementById('fc-form-preview').disabled = true;
}

function showEditStep() {
  document.getElementById('fc-edit-section').hidden = false;
  document.getElementById('fc-preview-section').hidden = true;
  document.getElementById('fc-form-title').textContent = 'New Card';
}

function syncPreviewBtn() {
  const front = document.getElementById('fc-input-front').value.trim();
  const back = document.getElementById('fc-input-back').value.trim();
  document.getElementById('fc-form-preview').disabled = !(front && back);
}

function updateDetailCharCount(e) {
  const detail = e.target;
  const charCount = document.getElementById('fc-detail-count');
  const len = detail.value.length;
  charCount.textContent = `${len} / ${detail.maxLength}`;
  charCount.classList.toggle('warn', len > DETAIL_WARN);
}

function cancelAddForm() {
  addForm.hidden = true;
  showEditStep();
  clearForm();
}

const readCardForm = () => ({
  front: document.getElementById('fc-input-front').value.trim(),
  frontHint: document.getElementById('fc-input-hint').value.trim(),
  back: document.getElementById('fc-input-back').value.trim(),
  backDetail: document.getElementById('fc-input-detail').value.trim()
});

const setFormError = (message = '') =>
    document.getElementById('fc-form-error').textContent = message;

function showPreview() {
  document.getElementById('fc-preview-card').replaceChildren(buildCard(
      readCardForm(), [actionBtn('flip', 'Flip', 'primary')]));
  document.getElementById('fc-edit-section').hidden = true;
  document.getElementById('fc-preview-section').hidden = false;
  document.getElementById('fc-form-title').textContent = 'Preview';
}

function saveCard() {
  const card = readCardForm();
  if (!card.front || !card.back) return;

  const id = 'user-' + Date.now();
  const newCard = {id, category: 'user_created', examWeight: 'high', ...card};

  const saveResult = saveUserFlashcard(newCard);
  if (!saveResult.ok) {
    setFormError(saveResult.message);
    return;
  }

  cardsById[id] = newCard;
  loadedUserCardCount = getUserFlashcards().length;
  currentCardId = id;
  currentReviewSize = pendingReviewIds.length + 1;

  addForm.hidden = true;
  showEditStep();
  clearForm();
  renderCard();
}

const INPUT_DISPATCH = {
  'fc-input-front': syncPreviewBtn,
  'fc-input-back': syncPreviewBtn,
  'fc-input-detail': updateDetailCharCount
};

const CLICK_DISPATCH = {
  'fc-form-cancel': cancelAddForm,
  'fc-form-edit-back': showEditStep,
  'fc-form-save': saveCard
};

function setupAddForm() {
  addForm.addEventListener('submit', e => {
    e.preventDefault();
    showPreview();
  });
  addForm.addEventListener('input', e => INPUT_DISPATCH[e.target.id]?.(e));
  addForm.addEventListener('click',
      e => CLICK_DISPATCH[e.target.closest('button[id]')?.id]?.());
  document.getElementById('fc-add-btn')
      .addEventListener('click', () => addForm.hidden = !addForm.hidden);
}

function refreshDeckIfUserCardsAdded([entry]) {
  if (!entry.isIntersecting) return;
  if (getUserFlashcards().length === loadedUserCardCount) return;

  rebuildCardsById();
  resetDeck();
}

function setupFlashcards(deckData) {
  curatedCardsById = deckData;
  rebuildCardsById();
  resetDeck();

  containerEl.addEventListener('click', cardActionHandler);
  document.getElementById('fc-reset').addEventListener('click', resetDeck);
  bindSelectGroup('fc-cat-filters', btn => {
    activeCat = btn.dataset.val;
    resetDeck();
  });
  bindSelectGroup('fc-weight-filters', btn => {
    activeWeight = btn.dataset.val;
    resetDeck();
  });
  setupAddForm();

  new IntersectionObserver(refreshDeckIfUserCardsAdded).observe(containerEl);
}

await attemptLoad({
  loader: () => loadJson('./data/flashcard-deck.json'),
  container: containerEl,
  render: setupFlashcards
});
