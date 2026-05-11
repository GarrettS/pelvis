import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

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

function makeDocumentStub() {
  return {
    createElement(tagName) {
      return {
        tagName,
        className: '',
        textContent: '',
      };
    }
  };
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
    loadErrorsSource,
    abbrExpandSource,
    shuffleSource,
    loadJsonSource
  ] = await Promise.all([
    readFile(new URL('../scripts/flashcards.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/load-errors.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/abbr-expand.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/shuffle.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/load-json.js', import.meta.url), 'utf8')
  ]);
  const rewrittenSource = flashcardsSource
    .replace("'./load-errors.js'", `'${freshDataUrl(loadErrorsSource)}'`)
    .replace("'./abbr-expand.js'", `'${freshDataUrl(abbrExpandSource)}'`)
    .replace("'./shuffle.js'", `'${freshDataUrl(shuffleSource)}'`)
    .replace("'./load-json.js'", `'${freshDataUrl(loadJsonSource)}'`);
  return importSource(rewrittenSource);
}

async function importMasterquizModule() {
  const [
    masterquizSource,
    equivalenceSource,
    loadErrorsSource,
    abbrExpandSource,
    shuffleSource,
    loadJsonSource,
    progressSource
  ] = await Promise.all([
    readFile(new URL('../scripts/masterquiz.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/equivalence.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/load-errors.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/abbr-expand.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/shuffle.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/load-json.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/master-quiz-progress.js', import.meta.url), 'utf8')
  ]);
  const rewrittenSource = masterquizSource
    .replace("'./equivalence.js'", `'${freshDataUrl(equivalenceSource)}'`)
    .replace("'./load-errors.js'", `'${freshDataUrl(loadErrorsSource)}'`)
    .replace("'./abbr-expand.js'", `'${freshDataUrl(abbrExpandSource)}'`)
    .replace("'./shuffle.js'", `'${freshDataUrl(shuffleSource)}'`)
    .replace("'./load-json.js'", `'${freshDataUrl(loadJsonSource)}'`)
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
    shuffleSource
  ] = await Promise.all([
    readFile(new URL('../scripts/equivalence-quiz.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/equivalence.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/shuffle.js', import.meta.url), 'utf8')
  ]);
  const rewrittenSource = equivalenceQuizSource
    .replace("'./equivalence.js'", `'${freshDataUrl(equivalenceSource)}'`)
    .replace("'./shuffle.js'", `'${freshDataUrl(shuffleSource)}'`)
    .replace("'./load-json.js'", `'${freshDataUrl(loadJsonSource)}'`);
  return importSource(rewrittenSource);
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
  const tagRe = /<(button|div|span|p|strong)\b([^>]*)>/g;
  let match;
  while ((match = tagRe.exec(html)) !== null) {
    const element = new EquivalenceTestElement(
      getEquivalenceAttribute(match[2], 'id') || ''
    );
    element.tagName = match[1].toUpperCase();
    element.className = getEquivalenceAttribute(match[2], 'class') || '';
    element.disabled = /\bdisabled\b/.test(match[2]);
    const dataOpt = getEquivalenceAttribute(match[2], 'data-opt');
    if (dataOpt) element.dataset.opt = dataOpt;

    const textEnd = html.indexOf('<', tagRe.lastIndex);
    const rawText = html.slice(
      tagRe.lastIndex,
      textEnd === -1 ? html.length : textEnd
    );
    element.textContent = rawText.replace(/\s+/g, ' ').trim();
    root.appendChild(element);
  }
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
  const regionIds = ['ip', 'is', 'isp', 'si', 'af'];
  const regions = {};
  for (const regionId of regionIds) {
    regions[regionId] = {
      name: regionId.toUpperCase(),
      anatomicalName: regionId.toUpperCase() + ' region',
      manualRef: 'Manual test ref',
      er: {
        pri: regionId + ' ER explanation',
        biomechanics: regionId + ' ER note'
      },
      ir: {
        pri: regionId + ' IR explanation',
        biomechanics: regionId + ' IR note'
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

test('showFetchError renders HTTP and JSON failure messages', async () => {
  globalThis.document = makeDocumentStub();

  const {showFetchError} = await importLocalModule(
      '../scripts/load-errors.js');
  const appended = [];
  const container = {
    appendChild(node) {
      appended.push(node);
    }
  };

  showFetchError(container, { path: 'study-data.json', cause: new Response('', {status: 404}) });
  showFetchError(container, { path: 'study-data.json', cause: new SyntaxError('Unexpected token < in JSON at position 0') });

  assert.equal(appended[0].className, 'callout error');
  assert.equal(
      appended[0].textContent,
      "Couldn't load study-data.json: server returned 404.");
  assert.equal(
      appended[1].textContent,
      "Couldn't load study-data.json: response wasn't valid JSON.");
});

test('showImportError distinguishes module parse failures', async () => {
  globalThis.document = makeDocumentStub();

  const {showImportError} = await importLocalModule(
      '../scripts/load-errors.js');
  const appended = [];
  const container = {
    appendChild(node) {
      appended.push(node);
    }
  };

  showImportError(
      container,
      './diagnose-game.js',
      new SyntaxError('Unexpected token export'));

  assert.equal(
      appended[0].textContent,
      "Couldn't load ./diagnose-game.js: module failed to parse.");
});

test('loadJson returns ok:false with Response cause on HTTP error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response('', {status: 503}));

  const {loadJson} = await importLocalModule('../scripts/load-json.js');
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

  const {loadJson} = await importLocalModule('../scripts/load-json.js');
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
    assert.equal(failure.textContent, "Couldn't load explanations.");
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

test('equivalence results keep pending explanation load separate from failure', async () => {
  const originalDocument = globalThis.document;
  const originalLoadJson = globalThis.__equivLoadJson;

  const {document, container} = makeEquivalenceDocument(1);
  let finishLoad;
  const pendingResult = new Promise((resolve) => {
    finishLoad = () => resolve({
      ok: true,
      data: makeCompleteEquivalenceExplanations()
    });
  });

  globalThis.document = document;
  globalThis.__equivLoadJson = async (path) => {
    assert.equal(path, './data/equivalence-explanations.json');
    return pendingResult;
  };

  const loadJsonSource = `
    export async function loadJson(path) {
      return globalThis.__equivLoadJson(path);
    }
  `;
  try {
    await importEquivalenceQuizModule(loadJsonSource);

    container.dispatch('click', {
      target: document.getElementById('equiv-submit')
    });
    await flushEquivalenceHandlers();

    container.dispatch('click', {
      target: document.querySelector('.feedback-next')
    });

    const incorrectList = document.getElementById('equiv-incorrect-list');
    assert.ok(incorrectList.querySelector('.equiv-expl-loading'));
    assert.equal(incorrectList.querySelector('.equiv-expl-failure'), null);

    finishLoad();
    await flushEquivalenceHandlers();

    assert.ok(incorrectList.querySelector('.equiv-expl-region'));
    assert.ok(incorrectList.querySelector('.equiv-expl-link'));
    assert.equal(incorrectList.querySelector('.equiv-expl-loading'), null);
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
    assert.equal(failure.textContent, 'Explanation data is incomplete.');
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
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  const elements = new Map();
  function addElement(id) {
    const element = new StubElement(id);
    elements.set(id, element);
    return element;
  }

  const wrap = addElement('fc-card-wrap');
  addElement('fc-progress');
  addElement('fc-reset');
  addElement('fc-cat-filters');
  addElement('fc-weight-filters');
  addElement('fc-add-btn');
  const addForm = addElement('fc-add-form');
  const frontInput = addElement('fc-input-front');
  addElement('fc-input-hint');
  const backInput = addElement('fc-input-back');
  addElement('fc-input-detail');
  addElement('fc-detail-count');
  addElement('fc-form-preview');
  addElement('fc-form-cancel');
  addElement('fc-preview-card');
  addElement('fc-edit-section');
  addElement('fc-preview-section');
  addElement('fc-form-title');
  addElement('fc-form-edit-back');
  const saveButton = addElement('fc-form-save');
  const activeCatBtn = new StubElement();
  const activeWeightBtn = new StubElement();

  globalThis.document = {
    createElement(tagName) {
      return new StubElement(tagName);
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(selector) {
      if (selector === '#fc-cat-filters .fc-filter-btn.active') {
        return activeCatBtn;
      }
      if (selector === '#fc-weight-filters .fc-filter-btn.active') {
        return activeWeightBtn;
      }
      return null;
    }
  };
  globalThis.fetch = () => Promise.resolve(
      new Response(
          JSON.stringify([{front: 'Term', back: 'Definition'}]),
          {status: 200, headers: {'Content-Type': 'application/json'}}));
  globalThis.localStorage = {
    getItem() {
      return '{';
    },
    setItem() {
      throw new Error('should not write after unreadable saved cards');
    }
  };

  await importFlashcardsModule();

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

  globalThis.document = originalDocument;
  globalThis.fetch = originalFetch;
  globalThis.localStorage = originalLocalStorage;
});

test('masterquiz save button shows inline feedback when saved cards cannot be read', async () => {
  const originalDocument = globalThis.document;
  const originalLocalStorage = globalThis.localStorage;

  const saveButton = {textContent: '', disabled: false};
  const explanation = new StubElement('mq-explanation');
  globalThis.document = {
    createElement(tagName) {
      return new StubElement(tagName);
    },
    getElementById(id) {
      if (id === 'mq-save-flashcard') return saveButton;
      if (id === 'mq-explanation') return explanation;
      return null;
    }
  };
  globalThis.localStorage = {
    getItem(key) {
      return key === 'userFlashcards' ? '{' : null;
    },
    setItem() {}
  };

  const {handleSaveFlashcard, __setMasterquizState} = await importMasterquizModule();
  __setMasterquizState({
    queue: [{
      id: 'q1',
      stem: 'Question stem',
      domain: 'anatomy',
      answer: 'A',
      explanation: 'Because.',
      options: [{key: 'A', text: 'Correct'}]
    }],
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

  globalThis.document = originalDocument;
  globalThis.localStorage = originalLocalStorage;
});

test('masterquiz duplicate save is treated as already satisfied without extra noise', async () => {
  const originalDocument = globalThis.document;
  const originalLocalStorage = globalThis.localStorage;

  const saveButton = {textContent: '', disabled: false};
  globalThis.document = {
    getElementById(id) {
      return id === 'mq-save-flashcard' ? saveButton : null;
    }
  };
  globalThis.localStorage = {
    getItem(key) {
      if (key !== 'userFlashcards') return null;
      return JSON.stringify([{id: 'user-mq-q1'}]);
    },
    setItem() {
      throw new Error('should not write duplicate save');
    }
  };

  const {handleSaveFlashcard, __setMasterquizState} = await importMasterquizModule();
  __setMasterquizState({
    queue: [{
      id: 'q1',
      stem: 'Question stem',
      domain: 'anatomy',
      answer: 'A',
      explanation: 'Because.',
      options: [{key: 'A', text: 'Correct'}]
    }],
    qIdx: 0,
    submitted: true
  });
  handleSaveFlashcard();

  assert.equal(saveButton.textContent, 'Already saved');
  assert.equal(saveButton.disabled, true);

  globalThis.document = originalDocument;
  globalThis.localStorage = originalLocalStorage;
});

test('masterquiz failed write does not mark empty storage card as saved in memory', async () => {
  const originalDocument = globalThis.document;
  const originalLocalStorage = globalThis.localStorage;

  const firstButton = {textContent: '', disabled: false};
  const secondButton = {textContent: '', disabled: false};
  const explanation = new StubElement('mq-explanation');
  let activeButton = firstButton;
  globalThis.document = {
    createElement(tagName) {
      return new StubElement(tagName);
    },
    getElementById(id) {
      if (id === 'mq-save-flashcard') return activeButton;
      if (id === 'mq-explanation') return explanation;
      return null;
    }
  };
  globalThis.localStorage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('quota exceeded');
    }
  };

  const {handleSaveFlashcard, __setMasterquizState} = await importMasterquizModule();
  __setMasterquizState({
    queue: [{
      id: 'q1',
      stem: 'Question stem',
      domain: 'anatomy',
      answer: 'A',
      explanation: 'Because.',
      options: [{key: 'A', text: 'Correct'}]
    }],
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

  globalThis.document = originalDocument;
  globalThis.localStorage = originalLocalStorage;
});

test('masterquiz save shows preparation feedback when saved cards cannot stringify', async () => {
  const originalDocument = globalThis.document;
  const originalLocalStorage = globalThis.localStorage;
  const originalJSONstringify = JSON.stringify;

  const saveButton = {textContent: '', disabled: false};
  const explanation = new StubElement('mq-explanation');
  globalThis.document = {
    createElement(tagName) {
      return new StubElement(tagName);
    },
    getElementById(id) {
      if (id === 'mq-save-flashcard') return saveButton;
      if (id === 'mq-explanation') return explanation;
      return null;
    }
  };
  globalThis.localStorage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('should not write unprepared cards');
    }
  };
  JSON.stringify = () => {
    throw new TypeError('cyclic card data');
  };

  const {handleSaveFlashcard, __setMasterquizState} = await importMasterquizModule();
  __setMasterquizState({
    queue: [{
      id: 'q1',
      stem: 'Question stem',
      domain: 'anatomy',
      answer: 'A',
      explanation: 'Because.',
      options: [{key: 'A', text: 'Correct'}]
    }],
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

  JSON.stringify = originalJSONstringify;
  globalThis.document = originalDocument;
  globalThis.localStorage = originalLocalStorage;
});

test('masterquiz result save button shows inline feedback when storage is unavailable', async () => {
  const originalDocument = globalThis.document;
  const originalLocalStorage = globalThis.localStorage;

  const resultButton = {textContent: '', disabled: false, value: 'q1'};
  const resultDetail = new StubElement('mq-result-detail');
  resultButton.parentNode = resultDetail;
  globalThis.document = {
    createElement(tagName) {
      return new StubElement(tagName);
    },
    getElementById() {}
  };
  globalThis.localStorage = {
    getItem() {
      return '[]';
    },
    setItem() {
      throw new Error('quota exceeded');
    }
  };

  const {handleResultSave, __setMasterquizState} = await importMasterquizModule();
  __setMasterquizState({
    QUESTIONS: [{
      id: 'q1',
      stem: 'Question stem',
      domain: 'anatomy',
      answer: 'A',
      explanation: 'Because.',
      options: [{key: 'A', text: 'Correct'}]
    }]
  });
  handleResultSave(resultButton);

  const errorCallout = resultDetail.querySelector('.callout.error');
  assert.ok(errorCallout);
  assert.equal(
      errorCallout.textContent,
      "Couldn't save flashcard: browser storage is unavailable: quota exceeded");
  assert.equal(resultButton.textContent, '');
  assert.equal(resultButton.disabled, true);

  globalThis.document = originalDocument;
  globalThis.localStorage = originalLocalStorage;
});

test('masterquiz reset progress shows stats feedback when storage removal fails', async () => {
  const originalConfirm = globalThis.confirm;
  const originalDocument = globalThis.document;
  const originalLocalStorage = globalThis.localStorage;

  const stats = {textContent: ''};
  globalThis.confirm = () => true;
  globalThis.document = {
    getElementById(id) {
      return id === 'mq-stats' ? stats : null;
    }
  };
  globalThis.localStorage = {
    removeItem() {
      throw new Error('storage unavailable');
    }
  };

  const {handleResetProgress} = await importMasterquizModule();
  handleResetProgress();

  assert.equal(
      stats.textContent,
      "Couldn't reset progress: browser storage is unavailable.");

  globalThis.confirm = originalConfirm;
  globalThis.document = originalDocument;
  globalThis.localStorage = originalLocalStorage;
});
