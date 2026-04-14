import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

async function importLocalModule(relativePath) {
  const moduleUrl = new URL(relativePath, import.meta.url);
  const source = await readFile(moduleUrl, 'utf8');
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

test('showFetchError renders HTTP and JSON failure messages', async () => {
  globalThis.document = makeDocumentStub();

  const {showFetchError} = await importLocalModule(
      '../scripts/fetch-feedback.js');
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

test('showModuleLoadError distinguishes module parse failures', async () => {
  globalThis.document = makeDocumentStub();

  const {showModuleLoadError} = await importLocalModule(
      '../scripts/fetch-feedback.js');
  const appended = [];
  const container = {
    appendChild(node) {
      appended.push(node);
    }
  };

  showModuleLoadError(
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
