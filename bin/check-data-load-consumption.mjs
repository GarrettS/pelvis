import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import * as espree from 'espree';

const SCRIPT_DIR = 'scripts';
const DATA_DIR = 'data';
const SERVICE_WORKER = 'sw.js';

const failures = [];
const warnings = [];
const consumedUrls = new Set();
const staticLoads = [];
const loadRefs = [];
const unsupportedRefs = [];

function normalizeDataUrl(value) {
  if (typeof value !== 'string') return null;
  if (!value.endsWith('.json')) return null;
  if (value.startsWith('./data/')) return value;
  if (value.startsWith('data/')) return './' + value;
  return null;
}

function isIdentifier(node, name) {
  return node?.type === 'Identifier' && (!name || node.name === name);
}

function propertyName(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'Literal') return String(node.value);
  return null;
}

function isMember(node, objectName, propName) {
  return node?.type === 'MemberExpression'
    && !node.computed
    && isIdentifier(node.object, objectName)
    && propertyName(node.property) === propName;
}

function calleeName(node) {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'MemberExpression') {
    const object = calleeName(node.object);
    const prop = propertyName(node.property);
    return object && prop ? object + '.' + prop : null;
  }
  return null;
}

function literalDataUrl(node) {
  if (node?.type !== 'Literal') return null;
  return normalizeDataUrl(node.value);
}

function loadJsonCall(node, names) {
  if (node?.type !== 'CallExpression') return null;
  if (!isIdentifier(node.callee) || !names.has(node.callee.name)) return null;
  return literalDataUrl(node.arguments[0]);
}

function fetchCall(node) {
  if (node?.type !== 'CallExpression') return null;
  if (!isIdentifier(node.callee, 'fetch')) return null;
  return literalDataUrl(node.arguments[0]);
}

function awaitCall(node) {
  return node?.type === 'AwaitExpression' ? node.argument : node;
}

function walk(node, visitor, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visitor(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    if (Array.isArray(value)) {
      value.forEach((child) => walk(child, visitor, node));
    } else if (value && typeof value.type === 'string') {
      walk(value, visitor, node);
    }
  }
}

function loadJsonNames(program) {
  const names = new Set();
  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    if (!node.source.value.endsWith('/load-json.js')) continue;
    for (const spec of node.specifiers) {
      if (spec.type !== 'ImportSpecifier') continue;
      if (spec.imported.name === 'loadJson') names.add(spec.local.name);
    }
  }
  return names;
}

function isBindingIdentifier(node, parent) {
  if (!isIdentifier(node)) return false;
  if (parent?.type === 'VariableDeclarator' && parent.id === node) return true;
  if (parent?.type === 'FunctionDeclaration' && parent.id === node) return true;
  if (parent?.type === 'FunctionExpression' && parent.id === node) return true;
  if (parent?.type === 'ClassDeclaration' && parent.id === node) return true;
  if (parent?.type === 'ImportSpecifier') return true;
  if (parent?.type === 'ImportDeclaration') return true;
  return false;
}

function isWriteIdentifier(node, parent) {
  if (!isIdentifier(node)) return false;
  if (parent?.type === 'AssignmentExpression' && parent.left === node) return true;
  if (parent?.type === 'UpdateExpression' && parent.argument === node) return true;
  return false;
}

function identifierIsRead(node, parent) {
  if (!isIdentifier(node)) return false;
  if (isBindingIdentifier(node, parent)) return false;
  if (isWriteIdentifier(node, parent)) return false;
  if (parent?.type === 'MemberExpression' && parent.property === node) {
    return parent.computed;
  }
  if (parent?.type === 'Property' && parent.key === node) return false;
  return true;
}

function memberIsAssignmentLeft(node, parent) {
  return parent?.type === 'AssignmentExpression' && parent.left === node;
}

function bindingHasRead(program, name) {
  let hasRead = false;
  walk(program, (node, parent) => {
    if (hasRead) return;
    if (node.name === name && identifierIsRead(node, parent)) hasRead = true;
  });
  return hasRead;
}

function derivedNameFromAssignment(node, parent, resultName) {
  if (!isMember(node, resultName, 'data')) return null;
  if (parent?.type === 'VariableDeclarator' && isIdentifier(parent.id)) {
    return parent.id.name;
  }
  if (parent?.type === 'AssignmentExpression' && parent.right === node) {
    if (isIdentifier(parent.left)) return parent.left.name;
  }
  return null;
}

function resultDataIsConsumed(program, resultName) {
  const derivedNames = new Set();
  let consumed = false;

  walk(program, (node, parent) => {
    if (!isMember(node, resultName, 'data')) return;
    if (memberIsAssignmentLeft(node, parent)) return;

    const derivedName = derivedNameFromAssignment(node, parent, resultName);
    if (derivedName) {
      derivedNames.add(derivedName);
      return;
    }
    consumed = true;
  });

  if (consumed) return true;
  for (const name of derivedNames) {
    if (bindingHasRead(program, name)) return true;
  }
  return false;
}

function valueBindingIsConsumed(program, name) {
  return bindingHasRead(program, name);
}

function arrowWrapperLoadJson(init, loadNames) {
  if (init?.type !== 'ArrowFunctionExpression') return null;
  let body = init.body;
  if (body?.type === 'AwaitExpression') body = body.argument;
  if (body?.type !== 'CallExpression') return null;
  return loadJsonCall(body, loadNames) ? body : null;
}

function collectVariableLoads(program, loadNames, sourceFile) {
  walk(program, (node) => {
    if (node.type !== 'VariableDeclarator') return;
    const init = awaitCall(node.init);
    const url = loadJsonCall(init, loadNames);
    if (url && isIdentifier(node.id)) {
      staticLoads.push({
        sourceFile,
        line: init.loc.start.line,
        url,
        consumed: resultDataIsConsumed(program, node.id.name)
      });
      return;
    }

    const wrapperCall = arrowWrapperLoadJson(init, loadNames);
    if (wrapperCall && isIdentifier(node.id)) {
      staticLoads.push({
        sourceFile,
        line: wrapperCall.loc.start.line,
        url: loadJsonCall(wrapperCall, loadNames),
        consumed: true
      });
      return;
    }

    if (init?.type !== 'CallExpression') return;
    if (calleeName(init.callee) !== 'Promise.all') return;
    if (node.id.type !== 'ArrayPattern') return;
    const values = init.arguments[0]?.elements || [];
    node.id.elements.forEach((element, index) => {
      const promiseCall = values[index];
      const promiseUrl = loadJsonCall(promiseCall, loadNames);
      if (!promiseUrl || !isIdentifier(element)) return;
      staticLoads.push({
        sourceFile,
        line: promiseCall.loc.start.line,
        url: promiseUrl,
        consumed: resultDataIsConsumed(program, element.name)
      });
    });
  });
}

function collectLoadRefs(program, loadNames, sourceFile) {
  walk(program, (node) => {
    const url = loadJsonCall(node, loadNames);
    if (!url) return;
    loadRefs.push({sourceFile, line: node.loc.start.line, url});
  });
}

function collectFetchLoads(program, sourceFile) {
  const responseUrls = new Map();
  walk(program, (node) => {
    if (node.type !== 'VariableDeclarator' || !isIdentifier(node.id)) return;
    const url = fetchCall(awaitCall(node.init));
    if (url) responseUrls.set(node.id.name, {
      url,
      sourceFile,
      line: node.loc.start.line
    });
  });

  walk(program, (node) => {
    if (node.type !== 'VariableDeclarator' || !isIdentifier(node.id)) return;
    const init = awaitCall(node.init);
    if (init?.type !== 'CallExpression') return;
    const callee = init.callee;
    if (callee?.type !== 'MemberExpression') return;
    if (propertyName(callee.property) !== 'json') return;
    if (!isIdentifier(callee.object)) return;

    const response = responseUrls.get(callee.object.name);
    if (!response) return;
    staticLoads.push({
      sourceFile: response.sourceFile,
      line: response.line,
      url: response.url,
      consumed: valueBindingIsConsumed(program, node.id.name)
    });
    responseUrls.delete(callee.object.name);
  });

  for (const response of responseUrls.values()) unsupportedRefs.push(response);
}

function collectUnsupportedDataRefs(program, loadNames, sourceFile) {
  walk(program, (node, parent) => {
    const url = literalDataUrl(node);
    if (!url) return;
    if (parent?.type === 'CallExpression') {
      if (loadJsonCall(parent, loadNames)) return;
      if (fetchCall(parent)) return;
    }
    unsupportedRefs.push({sourceFile, line: node.loc.start.line, url});
  });
}

async function parseScript(sourceFile) {
  const source = await readFile(sourceFile, 'utf8');
  return espree.parse(source, {
    ecmaVersion: 'latest',
    loc: true,
    sourceType: 'module'
  });
}

async function collectScripts() {
  const names = await readdir(SCRIPT_DIR);
  return names
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join(SCRIPT_DIR, name))
    .sort();
}

function analyzeProgram(program, sourceFile) {
  const names = loadJsonNames(program);
  collectLoadRefs(program, names, sourceFile);
  collectVariableLoads(program, names, sourceFile);
  collectFetchLoads(program, sourceFile);
  collectUnsupportedDataRefs(program, names, sourceFile);
}

function swPrecacheUrls(source) {
  return new Set(
    Array.from(source.matchAll(/['"](\.\/[^'"]+)['"]/g))
      .map((match) => match[1])
  );
}

async function dataUrlsOnDisk() {
  const names = await readdir(DATA_DIR);
  return names
    .filter((name) => name.endsWith('.json'))
    .map((name) => './data/' + name)
    .sort();
}

async function analyzeScripts() {
  const scripts = await collectScripts();
  for (const sourceFile of scripts) {
    try {
      analyzeProgram(await parseScript(sourceFile), sourceFile);
    } catch (cause) {
      failures.push(sourceFile + ': parse failed: ' + cause.message);
    }
  }
}

async function compareServiceWorker() {
  const swSource = await readFile(SERVICE_WORKER, 'utf8');
  const precache = swPrecacheUrls(swSource);
  const swDataUrls = [...precache].filter((url) => url.startsWith('./data/'));

  for (const load of staticLoads) {
    if (load.consumed) consumedUrls.add(load.url);
  }

  for (const load of staticLoads) {
    if (load.consumed) continue;
    failures.push(
      load.sourceFile + ':' + load.line + ': '
      + load.url + ' loads JSON but no read consumes result.data'
    );
  }

  for (const url of consumedUrls) {
    if (!precache.has(url)) {
      failures.push(url + ' is consumed by app code but missing from sw.js');
    }
  }

  for (const url of swDataUrls) {
    if (!consumedUrls.has(url)) {
      failures.push(url + ' is in sw.js but has no consumed app data load');
    }
  }

  const staticLoadKeys = new Set(staticLoads.map((load) =>
    load.sourceFile + ':' + load.line + ':' + load.url));
  for (const ref of loadRefs) {
    const key = ref.sourceFile + ':' + ref.line + ':' + ref.url;
    if (staticLoadKeys.has(key)) continue;
    warnings.push(
      ref.sourceFile + ':' + ref.line + ': '
      + ref.url + ' loadJson call is outside a recognized consumed load'
    );
  }

  for (const ref of unsupportedRefs) {
    if (!ref.url) continue;
    warnings.push(
      ref.sourceFile + ':' + ref.line + ': '
      + ref.url + ' data reference is outside a recognized consumed load'
    );
  }

  const diskUrls = await dataUrlsOnDisk();
  for (const url of diskUrls) {
    if (!consumedUrls.has(url) && !precache.has(url)) {
      warnings.push(url + ' exists but has no consumed app data load');
    }
  }
}

function printResult() {
  if (failures.length) {
    console.log('FAIL  Data load consumption');
    failures.forEach((failure) => console.log('  ' + failure));
  } else {
    console.log('PASS  Data load consumption');
  }

  if (warnings.length) {
    console.log('WARN  Data load consumption review');
    warnings.forEach((warning) => console.log('  ' + warning));
  }
}

await analyzeScripts();
await compareServiceWorker();
printResult();
process.exitCode = failures.length ? 1 : 0;
