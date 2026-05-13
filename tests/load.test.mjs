import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function importLoadModule() {
  const source = await readFile(
      new URL('../scripts/load.js', import.meta.url), 'utf8');
  const nonce = `\n// ${Date.now()}-${Math.random()}`;
  return import(
      `data:text/javascript;base64,${
        Buffer.from(source + nonce).toString('base64')}`);
}

test('handleImportError diagnoses SyntaxError as a parse failure', async () => {
  const {handleImportError} = await importLoadModule();
  let captured = null;
  const cause = new SyntaxError('unexpected token');

  handleImportError({ok: false, path: './foo.js', cause}, {
    render: (message, retry) => { captured = {message, retry}; },
    onRetry: () => {}
  });

  assert.equal(captured.message,
      "Couldn't load ./foo.js: module failed to parse.");
  assert.equal(typeof captured.retry, 'function');
});

test('handleImportError diagnoses TypeError as a network failure', async () => {
  const {handleImportError} = await importLoadModule();
  let captured = null;
  const cause = new TypeError('Failed to fetch');

  handleImportError({ok: false, path: './foo.js', cause}, {
    render: (message) => { captured = message; }
  });

  assert.equal(captured,
      "Couldn't load ./foo.js: network request failed.");
});

test('handleImportError passes onRetry to the render delegate', async () => {
  const {handleImportError} = await importLoadModule();
  let retryCalls = 0;
  let receivedRetry = null;

  handleImportError(
      {ok: false, path: './foo.js', cause: new Error('boom')},
      {
        render: (_message, retry) => { receivedRetry = retry; },
        onRetry: () => { retryCalls++; }
      });

  receivedRetry();
  assert.equal(retryCalls, 1);
});

test('handleFetchError diagnoses an HTTP status as a server error', async () => {
  const {handleFetchError} = await importLoadModule();
  let captured = null;

  handleFetchError(
      {ok: false, path: './data/foo.json', cause: {status: 503}},
      {render: (message) => { captured = message; }});

  assert.equal(captured,
      "Couldn't load foo.json: server returned 503.");
});

test('handleFetchError uses filename, not the full path', async () => {
  const {handleFetchError} = await importLoadModule();
  let captured = null;

  handleFetchError(
      {ok: false,
       path: './deeply/nested/data/bar.json',
       cause: new TypeError('Failed to fetch')},
      {render: (message) => { captured = message; }});

  assert.equal(captured,
      "Couldn't load bar.json: network request failed.");
});
