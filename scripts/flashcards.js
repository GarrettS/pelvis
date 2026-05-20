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
const addForm = document.getElementById('fc-add-form');

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
  addForm.reset();
  document.getElementById('fc-detail-count').textContent = '0 / 380';
  document.getElementById('fc-form-preview').disabled = true;
}

function showEditStep() {
  document.getElementById('fc-edit-section').hidden = false;
  document.getElementById('fc-preview-section').hidden = true;
  document.getElementById('fc-form-title').textContent = 'New Card';
}

function bindFilterGroup(containerId, dataKey, onChange) {
  const container = document.getElementById(containerId);
  let activeBtn = container.querySelector(':scope > [aria-current]');
  container.addEventListener('click', e => {
    const btn = e.target.closest(`[data-${dataKey}]`);
    if (!btn || btn.parentElement !== container || btn === activeBtn) return;

    onChange(btn.dataset[dataKey]);
    activeBtn?.removeAttribute('aria-current');
    btn.setAttribute('aria-current', 'true');
    activeBtn = btn;
    resetDeck();
  });
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
  charCount.textContent = len + ' / 380';
  charCount.classList.toggle('warn', len > 340);
  if (len > 380) detail.value = detail.value.slice(0, 380);
}

function cancelAddForm() {
  addForm.hidden = true;
  showEditStep();
  clearForm();
}

function showPreview() {
  const previewCard = {
    front: document.getElementById('fc-input-front').value.trim(),
    frontHint: document.getElementById('fc-input-hint').value.trim() || null,
    back: document.getElementById('fc-input-back').value.trim(),
    backDetail: document.getElementById('fc-input-detail').value.trim() || null
  };
  document.getElementById('fc-preview-card')
      .replaceChildren(buildCard(previewCard));
  document.getElementById('fc-edit-section').hidden = true;
  document.getElementById('fc-preview-section').hidden = false;
  document.getElementById('fc-form-title').textContent = 'Preview';
}

function saveCard() {
  const front = document.getElementById('fc-input-front').value.trim();
  const back = document.getElementById('fc-input-back').value.trim();
  if (!front || !back) return;

  clearErrors(addForm);

  const newCard = {
    id: 'user-' + Date.now(),
    category: 'user_created',
    examWeight: 'high',
    front,
    frontHint: document.getElementById('fc-input-hint').value.trim() || null,
    back,
    backDetail: document.getElementById('fc-input-detail').value.trim() || null
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
  'fc-form-preview': showPreview,
  'fc-form-edit-back': showEditStep,
  'fc-form-save': saveCard
};

function setupAddForm() {
  addForm.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input, textarea')) e.preventDefault();
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
  bindFilterGroup('fc-cat-filters', 'cat', val => activeCat = val);
  bindFilterGroup('fc-weight-filters', 'weight', val => activeWeight = val);
  setupAddForm();

  new IntersectionObserver(refreshDeckIfUserCardsAdded).observe(containerEl);
}

await attemptLoad({
  loader: () => loadJson('./data/flashcard-deck.json'),
  container: containerEl,
  render: setupFlashcards
});
