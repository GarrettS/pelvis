import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

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

async function importPatternsModule() {
  const [patternsSource, loadErrorsSource, abbrExpandSource] =
    await Promise.all([
      readFile(new URL('../scripts/patterns.js', import.meta.url), 'utf8'),
      readFile(new URL('../scripts/load-errors.js', import.meta.url), 'utf8'),
      readFile(new URL('../scripts/abbr-expand.js', import.meta.url), 'utf8')
    ]);
  const loadErrorsUrl = `data:text/javascript;base64,${
    Buffer.from(loadErrorsSource).toString('base64')}`;
  const abbrExpandUrl = `data:text/javascript;base64,${
    Buffer.from(abbrExpandSource).toString('base64')}`;
  const rewrittenSource = patternsSource
    .replace('"./load-errors.js"', `"${loadErrorsUrl}"`)
    .replace("'./abbr-expand.js'", `'${abbrExpandUrl}'`);
  return importSource(rewrittenSource);
}

async function importFlashcardsModule() {
  const [flashcardsSource, loadErrorsSource, abbrExpandSource, shuffleSource] =
    await Promise.all([
      readFile(new URL('../scripts/flashcards.js', import.meta.url), 'utf8'),
      readFile(new URL('../scripts/load-errors.js', import.meta.url), 'utf8'),
      readFile(new URL('../scripts/abbr-expand.js', import.meta.url), 'utf8'),
      readFile(new URL('../scripts/shuffle.js', import.meta.url), 'utf8')
    ]);
  const loadErrorsUrl = `data:text/javascript;base64,${
    Buffer.from(loadErrorsSource).toString('base64')}`;
  const abbrExpandUrl = `data:text/javascript;base64,${
    Buffer.from(abbrExpandSource).toString('base64')}`;
  const shuffleUrl = `data:text/javascript;base64,${
    Buffer.from(shuffleSource).toString('base64')}`;
  const rewrittenSource = flashcardsSource
    .replace('"./load-errors.js"', `"${loadErrorsUrl}"`)
    .replace("'./abbr-expand.js'", `'${abbrExpandUrl}'`)
    .replace("'./shuffle.js'", `'${shuffleUrl}'`);
  return importSource(rewrittenSource);
}

async function importMasterquizModule() {
  const [
    masterquizSource,
    equivalenceSource,
    loadErrorsSource,
    abbrExpandSource,
    shuffleSource,
    progressSource
  ] = await Promise.all([
    readFile(new URL('../scripts/masterquiz.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/equivalence.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/load-errors.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/abbr-expand.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/shuffle.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/master-quiz-progress.js', import.meta.url), 'utf8')
  ]);
  const equivalenceUrl = `data:text/javascript;base64,${
    Buffer.from(equivalenceSource).toString('base64')}`;
  const loadErrorsUrl = `data:text/javascript;base64,${
    Buffer.from(loadErrorsSource).toString('base64')}`;
  const abbrExpandUrl = `data:text/javascript;base64,${
    Buffer.from(abbrExpandSource).toString('base64')}`;
  const shuffleUrl = `data:text/javascript;base64,${
    Buffer.from(shuffleSource).toString('base64')}`;
  const progressUrl = `data:text/javascript;base64,${
    Buffer.from(progressSource).toString('base64')}`;
  const rewrittenSource = masterquizSource
    .replace("'./equivalence.js'", `'${equivalenceUrl}'`)
    .replace('"./load-errors.js"', `"${loadErrorsUrl}"`)
    .replace("'./abbr-expand.js'", `'${abbrExpandUrl}'`)
    .replace("'./shuffle.js'", `'${shuffleUrl}'`)
    .replace("'./master-quiz-progress.js'", `'${progressUrl}'`);
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

  showFetchError(container, 'study-data.json', new Response('', {status: 404}));
  showFetchError(
      container,
      'study-data.json',
      new SyntaxError('Unexpected token < in JSON at position 0'));

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
      './diagnose.js',
      new SyntaxError('Unexpected token export'));

  assert.equal(
      appended[0].textContent,
      "Couldn't load ./diagnose.js: module failed to parse.");
});

test('getStudyData clears cached failure so the next call can retry', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = () => {
    fetchCount++;
    if (fetchCount === 1) {
      return Promise.resolve(new Response('', {status: 503}));
    }
    return Promise.resolve(
        new Response(
            JSON.stringify({translationMap: []}),
            {status: 200, headers: {'Content-Type': 'application/json'}}));
  };

  const {getStudyData} = await importLocalModule('../scripts/study-data-cache.js');

  await assert.rejects(getStudyData(), (cause) => cause instanceof Response);
  const data = await getStudyData();

  assert.deepEqual(data, {translationMap: []});
  assert.equal(fetchCount, 2);

  globalThis.fetch = originalFetch;
});

test('getStudyData preserves parse errors for callers', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = () => Promise.resolve(
      new Response('<html>', {
        status: 200,
        headers: {'Content-Type': 'application/json'}
      }));

  const {getStudyData} = await importLocalModule('../scripts/study-data-cache.js');

  await assert.rejects(
      getStudyData(),
      (cause) => cause instanceof SyntaxError);

  globalThis.fetch = originalFetch;
});

test('patterns init shows the fetch failure instead of crashing on raw TypeError', async () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const appended = [];
  const container = {
    appendChild(node) {
      appended.push(node);
    }
  };

  globalThis.document = {
    createElement(tagName) {
      return {
        tagName,
        className: '',
        textContent: '',
      };
    },
    getElementById(id) {
      return id === 'patterns-content' ? container : null;
    }
  };
  globalThis.fetch = () => Promise.reject(new TypeError('offline'));

  const {init} = await importPatternsModule();
  await init();

  assert.equal(appended.length, 1);
  assert.equal(
      appended[0].textContent,
      "Couldn't load cheat-data.json: network request failed.");

  globalThis.document = originalDocument;
  globalThis.fetch = originalFetch;
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

  const {init} = await importFlashcardsModule();
  await init();

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
