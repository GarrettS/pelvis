/**
 * User-visible feedback for failed fetch operations.
 * @module fetch-feedback
 */

function appendErrorCallout(element, message) {
  if (!element) return;
  const callout = document.createElement('div');
  callout.className = 'callout error';
  callout.textContent = message;
  element.appendChild(callout);
}

function fetchReason(cause) {
  const errorName = cause?.name;

  if (errorName) {
    if (errorName === 'SyntaxError') {
      return "response wasn't valid JSON";
    } else if (errorName === 'TypeError') {
      return 'network request failed';
    }
    return 'unexpected error: ' + errorName;
  }

  if (typeof cause?.status === 'number') {
    return 'server returned ' + cause.status;
  }
  return 'unexpected error';
}

function moduleLoadReason(cause) {
  const errorName = cause?.name;

  if (errorName) {
    if (errorName === 'SyntaxError') {
      return 'module failed to parse';
    } else if (errorName === 'TypeError') {
      return 'network request failed';
    }
    return 'unexpected error: ' + errorName;
  }
  return 'unexpected error';
}

export function showFetchError(element, filename, cause) {
  appendErrorCallout(
      element,
      `Couldn't load ${filename}: ${fetchReason(cause)}.`);
}

export function showModuleLoadError(element, modulePath, cause) {
  appendErrorCallout(
      element,
      `Couldn't load ${modulePath}: ${moduleLoadReason(cause)}.`);
}
