import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

class TestElement {
  constructor(id = '', {tagName = 'div', href = ''} = {}) {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.href = href;
    this.hash = href ? new URL(href, 'https://example.test').hash : '';
    this.children = [];
    this.listeners = {};
    this.parentNode = null;
    this.dataset = {};
    this.disabled = false;
    this.value = '';
    this.textContent = '';
    this._innerHTML = '';
    this._classes = new Set();
    this._className = '';
    this.classList = {
      add: (...tokens) => {
        tokens.forEach((token) => this._classes.add(token));
        this.#syncClassName();
      },
      remove: (...tokens) => {
        tokens.forEach((token) => this._classes.delete(token));
        this.#syncClassName();
      },
      toggle: (token, force) => {
        if (force === undefined) {
          if (this._classes.has(token)) {
            this._classes.delete(token);
            this.#syncClassName();
            return false;
          }
          this._classes.add(token);
          this.#syncClassName();
          return true;
        }
        if (force) this._classes.add(token);
        else this._classes.delete(token);
        this.#syncClassName();
        return force;
      },
      contains: (token) => this._classes.has(token)
    };
  }

  #syncClassName() {
    this._className = [...this._classes].join(' ');
  }

  set className(value) {
    this._className = value;
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get className() {
    return this._className;
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(node) {
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  cloneNode() {
    const clone = new TestElement('', {
      tagName: this.tagName,
      href: this.href
    });
    clone.className = this.className;
    clone.innerHTML = this.innerHTML;
    clone.textContent = this.textContent;
    clone.value = this.value;
    clone.disabled = this.disabled;
    clone.dataset = {...this.dataset};
    return clone;
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
      currentTarget: this,
      ...event
    }));
  }

  querySelector(selector) {
    return findFirst(this, (el) => matches(el, selector));
  }

  querySelectorAll(selector) {
    return findAll(this, (el) => matches(el, selector));
  }
}

function findFirst(root, predicate) {
  for (const child of root.children) {
    if (predicate(child)) return child;
    const nested = findFirst(child, predicate);
    if (nested) return nested;
  }
  return null;
}

function findAll(root, predicate, found = []) {
  for (const child of root.children) {
    if (predicate(child)) found.push(child);
    findAll(child, predicate, found);
  }
  return found;
}

function matches(el, selector) {
  if (selector.startsWith('[href="')) {
    return el.href === selector.slice(7, -2);
  }
  if (selector.startsWith('.')) {
    const classes = selector.slice(1).split('.');
    return classes.every((token) => el.classList.contains(token));
  }
  return false;
}

function makeDocument() {
  const elements = new Map();
  return {
    createElement(tagName) {
      return new TestElement('', {tagName});
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    register(element) {
      elements.set(element.id, element);
      return element;
    }
  };
}

function makeWindow() {
  const listeners = {};
  return {
    addEventListener(type, handler) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(handler);
    },
    dispatch(type, event = {}) {
      (listeners[type] || []).forEach((handler) => handler(event));
    }
  };
}

function importSource(source) {
  const nonce = `\n// ${Date.now()}-${Math.random()}`;
  return import(
    `data:text/javascript;base64,${
      Buffer.from(source + nonce).toString('base64')}`
  );
}

async function importDiagnoseSubmodule(name) {
  const [
    moduleSource,
    studyDataCacheSource,
    shuffleSource,
    abbrExpandSource
  ] = await Promise.all([
    readFile(new URL(`../scripts/${name}.js`, import.meta.url), 'utf8'),
    readFile(new URL('../scripts/study-data-cache.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/shuffle.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/abbr-expand.js', import.meta.url), 'utf8')
  ]);
  const freshDataUrl = (source) => {
    const nonce = `\n// ${Date.now()}-${Math.random()}`;
    return `data:text/javascript;base64,${
      Buffer.from(source + nonce).toString('base64')}`;
  };
  const cacheUrl = freshDataUrl(studyDataCacheSource);
  const shuffleUrl = freshDataUrl(shuffleSource);
  const abbrExpandUrl = freshDataUrl(abbrExpandSource);
  const rewritten = moduleSource
    .replace("'./study-data-cache.js'", `'${cacheUrl}'`)
    .replace("'./shuffle.js'", `'${shuffleUrl}'`)
    .replace("'./abbr-expand.js'", `'${abbrExpandUrl}'`);
  return importSource(rewritten);
}

function mockFetchOnce(payload) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: {'Content-Type': 'application/json'}
    })
  );
  return () => { globalThis.fetch = originalFetch; };
}

test('doesEntryMatchQuery matches expanded abbreviation titles', async () => {
  const {doesEntryMatchQuery} = await importDiagnoseSubmodule('diagnose-muscle-map');
  const entry = {
    pattern: 'Corrects L AIC (L inlet in IP ER -> needs IP IR)',
    exercises: []
  };

  assert.equal(
    doesEntryMatchQuery(entry, 'anterior interior chain'),
    true
  );
});

test('setupMuscleMap preserves active search query across subview hash changes', async () => {
  const document = makeDocument();
  const window = makeWindow();
  const viewTabs = document.register(new TestElement('muscle-view-tabs'));
  const byMuscleLink = new TestElement('', {
    tagName: 'a',
    href: '#diagnose/exercises/byMuscle'
  });
  byMuscleLink.className = 'subview-tab activeTab';
  const byFindingLink = new TestElement('', {
    tagName: 'a',
    href: '#diagnose/exercises/byFinding'
  });
  byFindingLink.className = 'subview-tab';
  viewTabs.appendChild(byMuscleLink);
  viewTabs.appendChild(byFindingLink);

  const search = document.register(new TestElement('muscle-search', {
    tagName: 'input'
  }));
  const wrap = document.register(new TestElement('muscle-map-wrap'));

  globalThis.document = document;
  globalThis.window = window;
  globalThis.location = {hash: '#diagnose/exercises/byMuscle'};

  const restoreFetch = mockFetchOnce({
    muscleExerciseMap: {
      byMuscle: [
        {muscle: 'L IO/TA', pattern: 'Corrects L AIC', exercises: []}
      ],
      byFinding: [
        {finding: 'L AIC outlet closure', pattern: 'Corrects L AIC', exercises: []},
        {finding: 'B PEC respiratory weakness', pattern: 'Needs B PEC hierarchy', exercises: []}
      ]
    }
  });
  try {
    const {setupMuscleMap} = await importDiagnoseSubmodule('diagnose-muscle-map');
    await setupMuscleMap();

    search.value = 'anterior interior chain';
    search.dispatch('input');
    assert.equal(wrap.children.length, 1);

    globalThis.location.hash = '#diagnose/exercises/byFinding';
    window.dispatch('hashchange');

    assert.equal(wrap.children.length, 1);
  } finally {
    restoreFetch();
  }
});

test('renderCaseVisit uses caseStudy.visitNumber() instead of raw visit data', async () => {
  const document = makeDocument();
  globalThis.document = document;

  const {renderCaseVisit} = await importDiagnoseSubmodule('diagnose-case-studies');
  const caseEl = new TestElement('case-1');
  const caseStudy = {
    isComplete() { return false; },
    currentVisit() {
      return {
        question: 'Choose the next step.',
        options: ['A', 'B']
      };
    },
    visitNumber() { return 3; }
  };

  renderCaseVisit(caseStudy, caseEl);

  assert.match(caseEl.innerHTML, /Visit 3/);
  assert.doesNotMatch(caseEl.innerHTML, /undefined/);
});

test('setupDecisionTree renders question nodes without an id fallback', async () => {
  const document = makeDocument();
  const wrap = document.register(new TestElement('tree-wrap'));
  globalThis.document = document;

  const restoreFetch = mockFetchOnce({
    decisionTree: {
      question: 'Primary question?',
      branches: [
        {
          answer: 'Yes',
          next: {
            terminal: true,
            content: 'Done'
          }
        }
      ]
    }
  });
  try {
    const {setupDecisionTree} = await importDiagnoseSubmodule('diagnose-decision-tree');
    await setupDecisionTree();

    assert.equal(wrap.children[0].innerHTML, 'Primary question?');
  } finally {
    restoreFetch();
  }
});
