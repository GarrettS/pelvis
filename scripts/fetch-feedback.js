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
  if (cause instanceof Response) {
    return 'server returned ' + cause.status;
  }
  if (cause instanceof SyntaxError) {
    return "response wasn't valid JSON";
  }
  if (cause instanceof TypeError) {
    return 'network request failed';
  }
  return 'unexpected error (' + (cause?.name || 'Error') + ')';
}

function moduleLoadReason(cause) {
  if (cause instanceof SyntaxError) {
    return 'module failed to parse';
  }
  if (cause instanceof TypeError) {
    return 'network request failed';
  }
  return 'unexpected error (' + (cause?.name || 'Error') + ')';
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
