function appendErrorCallout(element, message) {
  if (!element) return;
  const callout = document.createElement('div');
  callout.className = 'callout error';
  callout.textContent = message;
  element.appendChild(callout);
}

function fetchReason(responseOrError) {
  const errorName = responseOrError?.name;

  if (errorName) {
    if (errorName === 'SyntaxError') {
      return "response wasn't valid JSON";
    } else if (errorName === 'TypeError') {
      return 'network request failed';
    }
    return 'unexpected error: ' + errorName;
  }

  if (typeof responseOrError?.status === 'number') {
    return 'server returned ' + responseOrError.status;
  }
  return 'unexpected error';
}

export function showFetchError(element, filename, responseOrError) {
  appendErrorCallout(element,
      `Couldn't load ${filename}: ${fetchReason(responseOrError)}.`);
}

export function showModuleLoadError(element, modulePath, moduleError) {
  let reason = 'unexpected error: ';

  if (moduleError.name === 'SyntaxError') {
    reason = 'module failed to parse';
  } else if (moduleError.name === 'TypeError') {
    reason = 'network request failed';
  } else {
    reason += moduleError.name;
  }
  appendErrorCallout(element, `Couldn't load ${modulePath}: ${reason}.`);
}
