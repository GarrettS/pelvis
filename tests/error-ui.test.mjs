import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

class StubElement {
  constructor(tagName = '') {
    this.tagName = tagName;
    this.className = '';
    this.textContent = '';
    this.type = '';
    this.children = [];
    this.listeners = {};
    this.parentNode = null;
    const classes = new Set();
    this.classList = {
      add: (cls) => classes.add(cls),
      remove: (cls) => classes.delete(cls),
      contains: (cls) => classes.has(cls)
    };
  }

  appendChild(node) {
    node.parentNode = this;
    this.children.push(node);
    return node;
  }

  querySelectorAll(selector) {
    if (selector === '.callout.error') {
      return this.children.filter((c) => c.className === 'callout error');
    }
    return [];
  }

  addEventListener(type, handler) {
    (this.listeners[type] ||= []).push(handler);
  }

  dispatch(type) {
    const handlers = this.listeners[type] || [];
    return Promise.all(handlers.map((h) => h.call(this, {target: this})));
  }

  remove() {
    if (!this.parentNode) return;

    this.parentNode.children =
        this.parentNode.children.filter((c) => c !== this);
    this.parentNode = null;
  }
}

async function importErrorUiModule() {
  globalThis.document = {
    createElement: (tagName) => new StubElement(tagName)
  };
  const nonce = `\n// ${Date.now()}-${Math.random()}`;
  const freshDataUrl = (src) => `data:text/javascript;base64,${
      Buffer.from(src + nonce).toString('base64')}`;
  const [loadSrc, elCreateSrc, errorUiSrc] = await Promise.all([
    readFile(new URL('../scripts/load.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/el-create.js', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/error-ui.js', import.meta.url), 'utf8')
  ]);
  const loadUrl = freshDataUrl(loadSrc);
  const elCreateUrl = freshDataUrl(elCreateSrc);
  const rewritten = errorUiSrc
      .replace(/from ['"]\.\/load\.js['"]/, `from '${loadUrl}'`)
      .replace(/from ['"]\.\/el-create\.js['"]/, `from '${elCreateUrl}'`);
  return import(freshDataUrl(rewritten));
}

function fetchFailure(status = 503) {
  return {ok: false, path: './data/test.json', cause: {status}};
}

test('renderError appends a callout with the given message', async () => {
  const {renderError} = await importErrorUiModule();
  const container = new StubElement('div');

  renderError(container, 'Couldn\'t load ./foo.js.', () => {});

  assert.equal(container.children.length, 1);
  const callout = container.children[0];
  assert.equal(callout.className, 'callout error');
  assert.equal(callout.textContent, 'Couldn\'t load ./foo.js.');
});

test('renderError attaches a Retry button when onRetry is provided',
    async () => {
  const {renderError} = await importErrorUiModule();
  const container = new StubElement('div');

  renderError(container, 'msg', () => {});

  const callout = container.children[0];
  assert.equal(callout.children.length, 1);
  const button = callout.children[0];
  assert.equal(button.tagName, 'button');
  assert.equal(button.type, 'button');
  assert.equal(button.className, 'callout-retry');
  assert.equal(button.textContent, 'Retry');
});

test('renderError omits the Retry button when onRetry is absent',
    async () => {
  const {renderError} = await importErrorUiModule();
  const container = new StubElement('div');

  renderError(container, 'msg');

  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].children.length, 0);
});

test('Retry click invokes the onRetry callback', async () => {
  const {renderError} = await importErrorUiModule();
  const container = new StubElement('div');
  let retryCalls = 0;

  renderError(container, 'msg', () => { retryCalls++; });

  const button = container.children[0].children[0];
  await button.dispatch('click');

  assert.equal(retryCalls, 1);
});

test('attemptLoad appends an error callout with a Retry button on failure',
    async () => {
  const {attemptLoad} = await importErrorUiModule();
  const container = new StubElement('div');

  await attemptLoad({
    loader: async () => fetchFailure(),
    container,
    render: () => { throw new Error('render must not run on failure'); }
  });

  assert.equal(container.children.length, 1);
  const callout = container.children[0];
  assert.equal(callout.className, 'callout error');
  assert.equal(callout.children.length, 1);

  const button = callout.children[0];
  assert.equal(button.tagName, 'button');
  assert.equal(button.className, 'callout-retry');
  assert.equal(button.textContent, 'Retry');
});

test('Retry click re-runs the loader and renders on success', async () => {
  const {attemptLoad} = await importErrorUiModule();
  const container = new StubElement('div');
  let calls = 0;
  const loader = async () => {
    calls++;
    return calls === 1
        ? fetchFailure()
        : {ok: true, data: {hello: 'world'}};
  };
  const rendered = [];

  await attemptLoad({
    loader,
    container,
    render: (data) => rendered.push(data)
  });

  assert.equal(calls, 1);
  assert.equal(rendered.length, 0);

  const button = container.children[0].children[0];
  await button.dispatch('click');

  assert.equal(calls, 2);
  assert.deepEqual(rendered, [{hello: 'world'}]);
  assert.equal(container.children.length, 0,
      'original callout removed after successful retry');
});

test('Retry click on persistent failure replaces the old callout with a fresh one',
    async () => {
  const {attemptLoad} = await importErrorUiModule();
  const container = new StubElement('div');
  let calls = 0;
  const loader = async () => {
    calls++;
    return fetchFailure();
  };

  await attemptLoad({loader, container, render: () => {}});

  const originalCallout = container.children[0];
  const originalButton = originalCallout.children[0];
  await originalButton.dispatch('click');

  assert.equal(calls, 2);
  assert.equal(container.children.length, 1);
  assert.notStrictEqual(container.children[0], originalCallout,
      'callout was replaced, not reused');

  const newButton = container.children[0].children[0];
  assert.equal(newButton.textContent, 'Retry');
});

test('Container carries the loading class while the loader is pending',
    async () => {
  const {attemptLoad} = await importErrorUiModule();
  const container = new StubElement('div');
  let calls = 0;
  let resolveSecondCall;
  const loader = () => {
    calls++;
    if (calls === 1) return Promise.resolve(fetchFailure());
    return new Promise((resolve) => { resolveSecondCall = resolve; });
  };

  await attemptLoad({loader, container, render: () => {}});

  assert.equal(container.classList.contains('loading'), false,
      'loading class cleared after the first attempt resolves');

  const button = container.children[0].children[0];
  const clickPromise = button.dispatch('click');

  assert.equal(container.classList.contains('loading'), true,
      'loading class added synchronously when retry is initiated');

  resolveSecondCall({ok: true, data: 'final'});
  await clickPromise;

  assert.equal(container.classList.contains('loading'), false,
      'loading class cleared after retry resolves');
  assert.equal(container.children.length, 0);
});

test('attemptLoad renders directly when the first load succeeds', async () => {
  const {attemptLoad} = await importErrorUiModule();
  const container = new StubElement('div');
  const rendered = [];

  await attemptLoad({
    loader: async () => ({ok: true, data: 42}),
    container,
    render: (data) => rendered.push(data)
  });

  assert.deepEqual(rendered, [42]);
  assert.equal(container.children.length, 0);
});
