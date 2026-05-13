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
  }

  appendChild(node) {
    node.parentNode = this;
    this.children.push(node);
    return node;
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
  const loadSrc = await readFile(
      new URL('../scripts/load.js', import.meta.url), 'utf8');
  const loadUrl = `data:text/javascript;base64,${
      Buffer.from(loadSrc + nonce).toString('base64')}`;
  const errorUiSrc = (await readFile(
      new URL('../scripts/error-ui.js', import.meta.url), 'utf8'))
      .replace(/from ['"]\.\/load\.js['"]/, `from '${loadUrl}'`);
  return import(
      `data:text/javascript;base64,${
        Buffer.from(errorUiSrc + nonce).toString('base64')}`);
}

test('renderImportError appends a callout with the given message', async () => {
  const {renderImportError} = await importErrorUiModule();
  const container = new StubElement('div');

  renderImportError(container, 'Couldn\'t load ./foo.js.', () => {});

  assert.equal(container.children.length, 1);
  const callout = container.children[0];
  assert.equal(callout.className, 'callout error');
  assert.equal(callout.textContent, 'Couldn\'t load ./foo.js.');
});

test('renderImportError attaches a Retry button when onRetry is provided',
    async () => {
  const {renderImportError} = await importErrorUiModule();
  const container = new StubElement('div');

  renderImportError(container, 'msg', () => {});

  const callout = container.children[0];
  assert.equal(callout.children.length, 1);
  const button = callout.children[0];
  assert.equal(button.tagName, 'button');
  assert.equal(button.type, 'button');
  assert.equal(button.className, 'btn callout-retry');
  assert.equal(button.textContent, 'Retry');
});

test('renderImportError omits the Retry button when onRetry is absent',
    async () => {
  const {renderImportError} = await importErrorUiModule();
  const container = new StubElement('div');

  renderImportError(container, 'msg');

  assert.equal(container.children.length, 1);
  assert.equal(container.children[0].children.length, 0);
});

test('Retry click invokes the onRetry callback', async () => {
  const {renderImportError} = await importErrorUiModule();
  const container = new StubElement('div');
  let retryCalls = 0;

  renderImportError(container, 'msg', () => { retryCalls++; });

  const button = container.children[0].children[0];
  await button.dispatch('click');

  assert.equal(retryCalls, 1);
});
