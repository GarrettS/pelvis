import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

globalThis.navigator ??= { onLine: true };

async function importLocalModule(relativePath) {
  const moduleUrl = new URL(relativePath, import.meta.url);
  const source = await readFile(moduleUrl, 'utf8');
  return importSource(source);
}

function importSource(source) {
  const nonce = `\n// ${Date.now()}-${Math.random()}`;
  return import(
      `data:text/javascript;base64,${
        Buffer.from(source + nonce).toString('base64')}`);
}

class StubElement {
  constructor(id = '') {
    this.id = id;
    this.children = [];
    this.listeners = {};
    this.className = '';
    this.textContent = '';
    this.innerHTML = '';
    this.disabled = false;
    this.value = '';
    this.dataset = {};
    this.style = {};
    this.parentNode = null;
    this._classes = new Set();
    this.classList = {
      add: (...tokens) => tokens.forEach((token) => this._classes.add(token)),
      remove: (...tokens) => tokens.forEach((token) => this._classes.delete(token)),
      toggle: (token, force) => {
        if (force === undefined) {
          if (this._classes.has(token)) {
            this._classes.delete(token);
            return false;
          }
          this._classes.add(token);
          return true;
        }
        if (force) {
          this._classes.add(token);
        } else {
          this._classes.delete(token);
        }
        return force;
      },
      contains: (token) => this._classes.has(token),
    };
  }

  appendChild(node) {
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  append(...nodes) {
    nodes.forEach((node) => {
      const child = typeof node === 'string'
          ? Object.assign(new StubElement(), {textContent: node})
          : node;
      child.parentNode = this;
      this.children.push(child);
    });
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  addEventListener(type, handler) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(handler);
  }

  dispatch(type, event = {}) {
    const handlers = this.listeners[type] || [];
    handlers.forEach((handler) => handler({
      preventDefault() {},
      target: this,
      ...event,
    }));
  }

  querySelector(selector) {
    if (selector === '.callout.error') {
      return this.children.find((child) => child.className === 'callout error') || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector === '.callout.error') {
      return this.children.filter((child) => child.className === 'callout error');
    }
    return [];
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
  }

  reset() {
    this.value = '';
  }
}

function freshDataUrl(source) {
  const nonce = `\n// ${Date.now()}-${Math.random()}`;
  return `data:text/javascript;base64,${
    Buffer.from(source + nonce).toString('base64')}`;
}

async function importFlashcardsModule() {
  const [
    flashcardsSource,
    loadSource,
    elCreateSource,
    errorUiSource,
    abbrExpandSource,
    shuffleSource
  ] = await Promise.all([
    readFile(new URL('../scripts/flashcards.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/load.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/el-create.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/error-ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/abbr-expand.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/shuffle.js', import.meta.url), 'utf8')
  ]);
  const loadUrl = freshDataUrl(loadSource);
  const elCreateUrl = freshDataUrl(elCreateSource);
  const errorUiUrl = freshDataUrl(
      errorUiSource
          .replace("'./load.js'", `'${loadUrl}'`)
          .replace("'./el-create.js'", `'${elCreateUrl}'`));
  const rewrittenSource = flashcardsSource
    .replace("'./load.js'", `'${loadUrl}'`)
    .replace("'./error-ui.js'", `'${errorUiUrl}'`)
    .replace("'./el-create.js'", `'${elCreateUrl}'`)
    .replace("'./abbr-expand.js'", `'${freshDataUrl(abbrExpandSource)}'`)
    .replace("'./shuffle.js'", `'${freshDataUrl(shuffleSource)}'`);
  return importSource(rewrittenSource);
}

async function importMasterquizModule() {
  const [
    masterquizSource,
    equivalenceSource,
    loadSource,
    elCreateSource,
    errorUiSource,
    abbrExpandSource,
    shuffleSource,
    progressSource
  ] = await Promise.all([
    readFile(new URL('../scripts/masterquiz.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/equivalence.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/load.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/el-create.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/error-ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/abbr-expand.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/shuffle.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/master-quiz-progress.js', import.meta.url), 'utf8')
  ]);
  const loadUrl = freshDataUrl(loadSource);
  const elCreateUrl = freshDataUrl(elCreateSource);
  const errorUiUrl = freshDataUrl(
      errorUiSource
          .replace("'./load.js'", `'${loadUrl}'`)
          .replace("'./el-create.js'", `'${elCreateUrl}'`));
  const rewrittenSource = masterquizSource
    .replace("'./equivalence.js'", `'${freshDataUrl(equivalenceSource)}'`)
    .replace("'./load.js'", `'${loadUrl}'`)
    .replace("'./error-ui.js'", `'${errorUiUrl}'`)
    .replace("'./el-create.js'", `'${elCreateUrl}'`)
    .replace("'./abbr-expand.js'", `'${freshDataUrl(abbrExpandSource)}'`)
    .replace("'./shuffle.js'", `'${freshDataUrl(shuffleSource)}'`)
    .replace("'./master-quiz-progress.js'", `'${freshDataUrl(progressSource)}'`);
  return importSource(rewrittenSource + `
export { handleResetProgress, handleSaveFlashcard, handleResultSave };
export function __setMasterquizState(nextState) {
  if ('QUESTIONS' in nextState) QUESTIONS = nextState.QUESTIONS;
  if ('queue' in nextState) queue = nextState.queue;
  if ('qIdx' in nextState) qIdx = nextState.qIdx;
  if ('submitted' in nextState) submitted = nextState.submitted;
}
`);
}

async function importEquivalenceQuizModule(loadJsonSource) {
  const [
    equivalenceQuizSource,
    equivalenceSource,
    shuffleSource,
    equivalenceAnswersSource
  ] = await Promise.all([
    readFile(new URL('../scripts/equivalence-quiz.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/equivalence.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/shuffle.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/equivalence-answers.js', import.meta.url), 'utf8')
  ]);
  const rewrittenAnswersSource = equivalenceAnswersSource
    .replace("'./load.js'", `'${freshDataUrl(loadJsonSource)}'`);
  const rewrittenSource = equivalenceQuizSource
    .replace("'./equivalence.js'", `'${freshDataUrl(equivalenceSource)}'`)
    .replace("'./shuffle.js'", `'${freshDataUrl(shuffleSource)}'`)
    .replace("'./equivalence-answers.js'", `'${freshDataUrl(rewrittenAnswersSource)}'`);
  return importSource(rewrittenSource);
}

const MASTERQUIZ_QUESTION_ID = 'q1';
const MASTERQUIZ_QUEUE_CARD = {
  stem: 'Question stem',
  domain: 'anatomy',
  answer: 'A',
  explanation: 'Because.',
  options: [{key: 'A', text: 'Correct'}]
};
const MASTERQUIZ_QUEUE_REF = {
  questionId: MASTERQUIZ_QUESTION_ID,
  question: MASTERQUIZ_QUEUE_CARD
};

const FLASHCARDS_ELEMENT_IDS = [
  'flashcards-content', 'fc-card-wrap', 'fc-progress', 'fc-reset',
  'fc-cat-filters', 'fc-weight-filters', 'fc-add-btn', 'fc-add-form',
  'fc-input-front', 'fc-input-hint', 'fc-input-back', 'fc-input-detail',
  'fc-detail-count', 'fc-form-preview', 'fc-form-cancel', 'fc-preview-card',
  'fc-edit-section', 'fc-preview-section', 'fc-form-title',
  'fc-form-edit-back', 'fc-form-save'
];

function jsonResponse(body) {
  return new Response(body,
      {status: 200, headers: {'Content-Type': 'application/json'}});
}

async function withMasterquizEnv(
    {document: docHandler = {}, localStorage, confirm}, body) {
  const snapshot = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    localStorage: globalThis.localStorage,
    confirm: globalThis.confirm
  };
  const container = new StubElement('masterquiz-content');
  globalThis.document = {
    createElement: docHandler.createElement
        || ((tag) => new StubElement(tag)),
    getElementById(id) {
      if (id === 'masterquiz-content') return container;
      return docHandler.getElementById?.(id) ?? null;
    }
  };
  globalThis.fetch = () => Promise.resolve(new Response('', {status: 503}));
  globalThis.localStorage = localStorage;
  if (confirm) globalThis.confirm = confirm;
  try {
    const mod = await importMasterquizModule();
    await body({container, ...mod});
  } finally {
    globalThis.document = snapshot.document;
    globalThis.fetch = snapshot.fetch;
    globalThis.localStorage = snapshot.localStorage;
    globalThis.confirm = snapshot.confirm;
  }
}

async function withFlashcardsEnv(
    {localStorage, deck = [{front: 'Term', back: 'Definition'}]}, body) {
  const snapshot = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    localStorage: globalThis.localStorage
  };
  const elements = new Map(
      FLASHCARDS_ELEMENT_IDS.map((id) => [id, new StubElement(id)]));
  const activeCatBtn = new StubElement();
  const activeWeightBtn = new StubElement();
  globalThis.document = {
    createElement: (tag) => new StubElement(tag),
    getElementById: (id) => elements.get(id) ?? null,
    querySelector(selector) {
      if (selector === '#fc-cat-filters .fc-filter-btn.active') return activeCatBtn;
      if (selector === '#fc-weight-filters .fc-filter-btn.active') return activeWeightBtn;
      return null;
    }
  };
  globalThis.fetch = () => Promise.resolve(jsonResponse(JSON.stringify(deck)));
  globalThis.localStorage = localStorage;
  try {
    await importFlashcardsModule();
    await body({elements});
  } finally {
    globalThis.document = snapshot.document;
    globalThis.fetch = snapshot.fetch;
    globalThis.localStorage = snapshot.localStorage;
  }
}

class EquivalenceTestElement extends StubElement {
  constructor(id = '') {
    super(id);
    this.valueAsNumber = 0;
    this.defaultValue = '';
    this._innerHTML = '';
  }

  set className(value) {
    this._className = String(value);
    this._classes = new Set(this._className.split(/\s+/).filter(Boolean));
  }

  get className() {
    return this._className || '';
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
    parseEquivalenceHTML(this, value);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  closest(selector) {
    let element = this;
    while (element) {
      if (matchesEquivalenceSelector(element, selector)) return element;
      element = element.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return findEquivalenceElement(this, selector);
  }

  querySelectorAll(selector) {
    return findEquivalenceElements(this, selector);
  }

  cloneNode(deep = false) {
    const clone = new EquivalenceTestElement(this.id);
    clone.tagName = this.tagName;
    clone.className = this.className;
    clone.textContent = this.textContent;
    clone.value = this.value;
    clone.valueAsNumber = this.valueAsNumber;
    clone.defaultValue = this.defaultValue;
    clone.disabled = this.disabled;
    clone.dataset = {...this.dataset};
    if (deep) {
      this.children.forEach((child) => {
        clone.appendChild(child.cloneNode(true));
      });
    }
    return clone;
  }
}

function parseEquivalenceHTML(root, html) {
  const tokenRe = /<(\/?)(button|div|span|p|strong)\b([^>]*)>/g;
  const stack = [{ element: root, innerStart: 0 }];
  let cursor = 0;
  let match;
  while ((match = tokenRe.exec(html)) !== null) {
    const text = html.slice(cursor, match.index).replace(/\s+/g, ' ').trim();
    if (text) stack[stack.length - 1].element.textContent += text;
    cursor = tokenRe.lastIndex;

    const [, closing, tagName, attrs] = match;
    if (closing) {
      if (stack.length > 1) {
        const frame = stack.pop();
        frame.element._innerHTML = html.slice(frame.innerStart, match.index);
      }
      continue;
    }

    const element = new EquivalenceTestElement(
      getEquivalenceAttribute(attrs, 'id') || ''
    );
    element.tagName = tagName.toUpperCase();
    element.className = getEquivalenceAttribute(attrs, 'class') || '';
    element.disabled = /\bdisabled\b/.test(attrs);
    const dataOpt = getEquivalenceAttribute(attrs, 'data-opt');
    if (dataOpt) element.dataset.opt = dataOpt;
    stack[stack.length - 1].element.appendChild(element);
    stack.push({ element, innerStart: cursor });
  }
  const tail = html.slice(cursor).replace(/\s+/g, ' ').trim();
  if (tail) stack[stack.length - 1].element.textContent += tail;
}

function getEquivalenceAttribute(source, name) {
  const match = source.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : '';
}

function matchesEquivalenceSelector(element, selector) {
  if (selector === '[id]') return Boolean(element.id);
  if (selector.startsWith('#')) return element.id === selector.slice(1);
  if (!selector.startsWith('.')) return false;
  const classes = selector.slice(1).split('.');
  return classes.every((token) => element.classList.contains(token));
}

function findEquivalenceElement(root, selector) {
  for (const child of root.children) {
    if (matchesEquivalenceSelector(child, selector)) return child;
    const nested = findEquivalenceElement(child, selector);
    if (nested) return nested;
  }
  return null;
}

function findEquivalenceElements(root, selector, found = []) {
  for (const child of root.children) {
    if (matchesEquivalenceSelector(child, selector)) found.push(child);
    findEquivalenceElements(child, selector, found);
  }
  return found;
}

function makeEquivalenceDocument(sessionSize = 2) {
  const roots = [];
  const elements = new Map();
  function addElement(id) {
    const element = new EquivalenceTestElement(id);
    elements.set(id, element);
    roots.push(element);
    return element;
  }

  const container = addElement('equivalence-content');
  const count = addElement('equiv-count');
  count.valueAsNumber = sessionSize;
  count.defaultValue = String(sessionSize);
  addElement('equiv-quiz-wrap');
  addElement('equiv-progress-fill');
  addElement('equiv-progress-text');
  addElement('equiv-current-given');
  addElement('equiv-options');
  addElement('equiv-submit');
  addElement('equiv-feedback');
  addElement('equiv-results');
  addElement('equiv-result-score');
  addElement('equiv-incorrect-list');
  addElement('equiv-correct-list');
  addElement('equiv-incorrect-details');
  addElement('equiv-correct-details');

  return {
    container,
    document: {
      createElement() {
        return new EquivalenceTestElement();
      },
      getElementById(id) {
        if (elements.has(id)) return elements.get(id);
        for (const root of roots) {
          const found = findEquivalenceElement(root, '#' + id);
          if (found) return found;
        }
        return null;
      },
      querySelector(selector) {
        for (const root of roots) {
          const found = findEquivalenceElement(root, selector);
          if (found) return found;
        }
        return null;
      }
    }
  };
}

async function flushEquivalenceHandlers() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

function makeCompleteEquivalenceExplanations() {
  const regionIds = ['IP', 'IS', 'IsP', 'SI', 'AF'];
  const regions = {};
  for (const regionId of regionIds) {
    regions[regionId] = {
      name: regionId,
      anatomicalName: regionId + ' region',
      manualRef: 'Manual test ref',
      ER: {
        pri: regionId + ' ER explanation',
        biomechanics: regionId + ' ER note',
        equivalents: regionIds.filter((id) => id !== regionId).map((id) => id + ' IR')
      },
      IR: {
        pri: regionId + ' IR explanation',
        biomechanics: regionId + ' IR note',
        equivalents: regionIds.filter((id) => id !== regionId).map((id) => id + ' ER')
      }
    };
  }

  const links = [];
  for (let i = 0; i < regionIds.length; i++) {
    for (let j = i + 1; j < regionIds.length; j++) {
      links.push({
        from: regionIds[i],
        to: regionIds[j],
        priReasoning: 'Test relationship explanation.',
        biomechanics: 'Test relationship note.',
        couplingType: 'test-coupling'
      });
    }
  }

  return {
    couplingDisclaimer: 'Test coupling disclaimer.',
    regions,
    links
  };
}

test('handleFetchError renders HTTP and JSON failure messages', async () => {
  const {handleFetchError} = await importLocalModule(
      '../scripts/load.js');
  const messages = [];
  const capture = (message) => messages.push(message);

  handleFetchError(
      {path: 'study-data.json',
       cause: new Response('', {status: 404})},
      {render: capture});
  handleFetchError(
      {path: 'study-data.json',
       cause: new SyntaxError('Unexpected token < in JSON at position 0')},
      {render: capture});

  assert.equal(messages[0],
      "Couldn't load study-data.json: server returned 404.");
  assert.equal(messages[1],
      "Couldn't load study-data.json: response wasn't valid JSON.");
});

test('handleImportError distinguishes module parse failures', async () => {
  const {handleImportError} = await importLocalModule(
      '../scripts/load.js');
  let captured = null;

  handleImportError(
      {path: './diagnose-game.js',
       cause: new SyntaxError('Unexpected token export')},
      {render: (message) => { captured = message; }});

  assert.equal(captured,
      "Couldn't load ./diagnose-game.js: module failed to parse.");
});

test('loadJson returns ok:false with Response cause on HTTP error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response('', {status: 503}));

  const {loadJson} = await importLocalModule('../scripts/load.js');
  const result = await loadJson('./data/anything.json');

  assert.equal(result.ok, false);
  assert.equal(result.cause.status, 503);
  assert.equal(result.path, './data/anything.json');

  globalThis.fetch = originalFetch;
});

test('loadJson returns ok:false with SyntaxError cause on parse failure', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = () => Promise.resolve(
      new Response('<html>', {
        status: 200,
        headers: {'Content-Type': 'application/json'}
      }));

  const {loadJson} = await importLocalModule('../scripts/load.js');
  const result = await loadJson('./data/anything.json');

  assert.equal(result.ok, false);
  assert.equal(result.cause.name, 'SyntaxError');

  globalThis.fetch = originalFetch;
});

test('equivalence submit shows retry when explanations fail to load', async () => {
  const originalDocument = globalThis.document;
  const originalLoadJson = globalThis.__equivLoadJson;

  const {document, container} = makeEquivalenceDocument();
  globalThis.document = document;
  globalThis.__equivLoadJson = async (path) => {
    assert.equal(path, './data/equivalence-explanations.json');
    return {
      ok: false,
      path,
      cause: new Response('', {status: 503})
    };
  };

  const loadJsonSource = `
    export async function loadJson(path) {
      return globalThis.__equivLoadJson(path);
    }
  `;
  try {
    await importEquivalenceQuizModule(loadJsonSource);

    const submitButton = document.getElementById('equiv-submit');
    assert.ok(submitButton);
    container.dispatch('click', {target: submitButton});
    await flushEquivalenceHandlers();

    const feedback = document.getElementById('equiv-feedback');
    const failure = document.querySelector('.equiv-expl-failure');
    const retryButton = document.querySelector('.equiv-expl-retry');

    assert.equal(feedback.className, 'feedback-box error');
    assert.ok(failure);
    assert.equal(failure.textContent, "Couldn't load answers.");
    assert.ok(retryButton);
    assert.equal(retryButton.disabled, false);
    assert.equal(document.querySelector('.feedback-next') !== null, true);
    assert.equal(document.querySelector('.equiv-explanation'), null);
  } finally {
    globalThis.document = originalDocument;
    if (originalLoadJson === undefined) {
      delete globalThis.__equivLoadJson;
    } else {
      globalThis.__equivLoadJson = originalLoadJson;
    }
  }
});

test('equivalence retry disables button and renders explanations after success', async () => {
  const originalDocument = globalThis.document;
  const originalLoadJson = globalThis.__equivLoadJson;

  const {document, container} = makeEquivalenceDocument();
  let loadCount = 0;
  let finishRetry;
  const retryResult = new Promise((resolve) => {
    finishRetry = () => resolve({
      ok: true,
      data: makeCompleteEquivalenceExplanations()
    });
  });

  globalThis.document = document;
  globalThis.__equivLoadJson = async (path) => {
    assert.equal(path, './data/equivalence-explanations.json');
    loadCount++;
    if (loadCount === 1) {
      return {
        ok: false,
        path,
        cause: new Response('', {status: 503})
      };
    }
    return retryResult;
  };

  const loadJsonSource = `
    export async function loadJson(path) {
      return globalThis.__equivLoadJson(path);
    }
  `;
  try {
    await importEquivalenceQuizModule(loadJsonSource);
    await flushEquivalenceHandlers();

    container.dispatch('click', {
      target: document.getElementById('equiv-submit')
    });
    await flushEquivalenceHandlers();

    const retryButton = document.querySelector('.equiv-expl-retry');
    assert.ok(retryButton);
    container.dispatch('click', {target: retryButton});

    assert.equal(retryButton.disabled, true);
    assert.equal(retryButton.textContent, 'Retrying…');

    finishRetry();
    await flushEquivalenceHandlers();

    const explanationSlot = document.querySelector('.equiv-expl-slot');
    assert.match(explanationSlot.innerHTML, /Test relationship explanation/);
    assert.equal(explanationSlot.querySelector('.equiv-expl-failure'), null);
    assert.equal(explanationSlot.querySelector('.equiv-expl-retry'), null);
    assert.equal(loadCount, 2);
  } finally {
    globalThis.document = originalDocument;
    if (originalLoadJson === undefined) {
      delete globalThis.__equivLoadJson;
    } else {
      globalThis.__equivLoadJson = originalLoadJson;
    }
  }
});

test('equivalence submit shows data error when explanation content is incomplete', async () => {
  const originalDocument = globalThis.document;
  const originalLoadJson = globalThis.__equivLoadJson;

  const {document, container} = makeEquivalenceDocument();
  globalThis.document = document;
  globalThis.__equivLoadJson = async (path) => {
    assert.equal(path, './data/equivalence-explanations.json');
    return {
      ok: true,
      data: {
        couplingDisclaimer: 'Missing region data.',
        regions: {},
        links: []
      }
    };
  };

  const loadJsonSource = `
    export async function loadJson(path) {
      return globalThis.__equivLoadJson(path);
    }
  `;
  try {
    await importEquivalenceQuizModule(loadJsonSource);
    await flushEquivalenceHandlers();

    container.dispatch('click', {
      target: document.getElementById('equiv-submit')
    });
    await flushEquivalenceHandlers();

    const failure = document.querySelector('.equiv-expl-failure');
    assert.ok(failure);
    assert.equal(failure.textContent, 'Answer data missing for this question.');
    assert.equal(document.querySelector('.equiv-expl-retry'), null);
  } finally {
    globalThis.document = originalDocument;
    if (originalLoadJson === undefined) {
      delete globalThis.__equivLoadJson;
    } else {
      globalThis.__equivLoadJson = originalLoadJson;
    }
  }
});


test('flashcards save click shows inline feedback when saved cards cannot be read', async () => {
  await withFlashcardsEnv({
    localStorage: {
      getItem() { return '{'; },
      setItem() { throw new Error('should not write after unreadable saved cards'); }
    }
  }, async ({elements}) => {
    const addForm = elements.get('fc-add-form');
    const frontInput = elements.get('fc-input-front');
    const backInput = elements.get('fc-input-back');
    const saveButton = elements.get('fc-form-save');
    const wrap = elements.get('fc-card-wrap');

    frontInput.value = 'Front';
    backInput.value = 'Back';
    saveButton.dispatch('click');

    const errorCallout = addForm.querySelector('.callout.error');
    assert.ok(errorCallout);
    assert.equal(
        errorCallout.textContent,
        "Couldn't save flashcard: saved card data is corrupt: "
          + "Unexpected end of JSON input");
    assert.equal(wrap.children.length > 0, true);
  });
});

test('masterquiz save button shows inline feedback when saved cards cannot be read', async () => {
  const saveButton = {textContent: '', disabled: false};
  const explanation = new StubElement('mq-explanation');

  await withMasterquizEnv({
    document: {
      getElementById(id) {
        if (id === 'mq-save-flashcard') return saveButton;
        if (id === 'mq-explanation') return explanation;
        return null;
      }
    },
    localStorage: {
      getItem(key) { return key === 'userFlashcards' ? '{' : null; },
      setItem() {}
    }
  }, async ({handleSaveFlashcard, __setMasterquizState}) => {
    __setMasterquizState({
      queue: [MASTERQUIZ_QUEUE_REF],
      qIdx: 0,
      submitted: true
    });
    handleSaveFlashcard();

    const errorCallout = explanation.querySelector('.callout.error');
    assert.ok(errorCallout);
    assert.equal(
        errorCallout.textContent,
        "Couldn't save flashcard: saved card data is corrupt: "
          + "Unexpected end of JSON input");
    assert.equal(saveButton.textContent, '');
    assert.equal(saveButton.disabled, true);
  });
});

test('masterquiz duplicate save is treated as already satisfied without extra noise', async () => {
  const saveButton = {textContent: '', disabled: false};

  await withMasterquizEnv({
    document: {
      getElementById(id) { return id === 'mq-save-flashcard' ? saveButton : null; }
    },
    localStorage: {
      getItem(key) {
        if (key !== 'userFlashcards') return null;
        return JSON.stringify([{id: 'user-mq-q1'}]);
      },
      setItem() { throw new Error('should not write duplicate save'); }
    }
  }, async ({handleSaveFlashcard, __setMasterquizState}) => {
    __setMasterquizState({
      queue: [MASTERQUIZ_QUEUE_REF],
      qIdx: 0,
      submitted: true
    });
    handleSaveFlashcard();

    assert.equal(saveButton.textContent, 'Already saved');
    assert.equal(saveButton.disabled, true);
  });
});

test('masterquiz failed write does not mark empty storage card as saved in memory', async () => {
  const firstButton = {textContent: '', disabled: false};
  const secondButton = {textContent: '', disabled: false};
  const explanation = new StubElement('mq-explanation');
  let activeButton = firstButton;

  await withMasterquizEnv({
    document: {
      getElementById(id) {
        if (id === 'mq-save-flashcard') return activeButton;
        if (id === 'mq-explanation') return explanation;
        return null;
      }
    },
    localStorage: {
      getItem() { return null; },
      setItem() { throw new Error('quota exceeded'); }
    }
  }, async ({handleSaveFlashcard, __setMasterquizState}) => {
    __setMasterquizState({
      queue: [MASTERQUIZ_QUEUE_REF],
      qIdx: 0,
      submitted: true
    });

    handleSaveFlashcard();
    activeButton = secondButton;
    handleSaveFlashcard();

    assert.equal(firstButton.textContent, '');
    assert.equal(secondButton.textContent, '');
    assert.equal(explanation.children.length, 1);
    assert.equal(
        explanation.children[0].textContent,
        "Couldn't save flashcard: browser storage is unavailable: quota exceeded");
  });
});

test('masterquiz save shows preparation feedback when saved cards cannot stringify', async () => {
  const originalJSONstringify = JSON.stringify;
  const saveButton = {textContent: '', disabled: false};
  const explanation = new StubElement('mq-explanation');
  JSON.stringify = () => { throw new TypeError('cyclic card data'); };

  try {
    await withMasterquizEnv({
      document: {
        getElementById(id) {
          if (id === 'mq-save-flashcard') return saveButton;
          if (id === 'mq-explanation') return explanation;
          return null;
        }
      },
      localStorage: {
        getItem() { return null; },
        setItem() { throw new Error('should not write unprepared cards'); }
      }
    }, async ({handleSaveFlashcard, __setMasterquizState}) => {
      __setMasterquizState({
        queue: [MASTERQUIZ_QUEUE_REF],
        qIdx: 0,
        submitted: true
      });
      handleSaveFlashcard();

      const errorCallout = explanation.querySelector('.callout.error');
      assert.ok(errorCallout);
      assert.equal(
          errorCallout.textContent,
          "Couldn't save flashcard: saved card data couldn't be prepared: "
            + "cyclic card data");
      assert.equal(saveButton.disabled, true);
    });
  } finally {
    JSON.stringify = originalJSONstringify;
  }
});

test('masterquiz result save button shows inline feedback when storage is unavailable', async () => {
  const resultButton = {textContent: '', disabled: false, value: 'q1'};
  const resultDetail = new StubElement('mq-result-detail');
  resultButton.parentNode = resultDetail;

  await withMasterquizEnv({
    document: {
      getElementById() {}
    },
    localStorage: {
      getItem() { return '[]'; },
      setItem() { throw new Error('quota exceeded'); }
    }
  }, async ({handleResultSave, __setMasterquizState}) => {
    __setMasterquizState({
      QUESTIONS: {[MASTERQUIZ_QUESTION_ID]: MASTERQUIZ_QUEUE_CARD}
    });
    handleResultSave(resultButton);

    const errorCallout = resultDetail.querySelector('.callout.error');
    assert.ok(errorCallout);
    assert.equal(
        errorCallout.textContent,
        "Couldn't save flashcard: browser storage is unavailable: quota exceeded");
    assert.equal(resultButton.textContent, '');
    assert.equal(resultButton.disabled, true);
  });
});

test('masterquiz reset progress shows stats feedback when storage removal fails', async () => {
  const stats = {textContent: ''};

  await withMasterquizEnv({
    document: {
      getElementById(id) { return id === 'mq-stats' ? stats : null; }
    },
    localStorage: {
      removeItem() { throw new Error('storage unavailable'); }
    },
    confirm: () => true
  }, async ({handleResetProgress}) => {
    handleResetProgress();

    assert.equal(
        stats.textContent,
        "Couldn't reset progress: browser storage is unavailable.");
  });
});
