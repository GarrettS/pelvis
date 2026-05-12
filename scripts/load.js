export async function loadJson(path) {
  let resp;
  try {
    resp = await fetch(path);
  } catch (cause) {
    return {ok: false, path, cause};
  }
  if (!resp.ok) return {ok: false, path, cause: resp};
  try {
    return {ok: true, data: await resp.json()};
  } catch (cause) {
    return {ok: false, path, cause};
  }
}

export function appendErrorCallout(element, message) {
  if (!element) return null;

  const callout = document.createElement("div");
  callout.className = "callout error";
  callout.textContent = message;
  element.appendChild(callout);
  return callout;
}

function attachRetryButton(callout, onRetry) {
  if (!callout) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn callout-retry";
  button.textContent = "Retry";
  button.addEventListener("click", async function () {
    this.disabled = true;
    this.textContent = "Retrying…";
    try {
      await onRetry();
    } finally {
      callout.remove();
    }
  });
  callout.appendChild(button);
}

export function showFetchError(element, result, options) {
  const error = result.cause;
  let reason = "unexpected error: " + (error.name || error);
  if (typeof error.status === "number") {
    reason = "server returned " + error.status;
  } else if (error.name === "SyntaxError") {
    reason = "response wasn't valid JSON";
  } else if (error.name === "TypeError") {
    reason = "network request failed";
  }
  const filename = result.path.slice(result.path.lastIndexOf("/") + 1);
  const callout = appendErrorCallout(
      element, "Couldn't load " + filename + ": " + reason + ".");
  if (options?.onRetry) attachRetryButton(callout, options.onRetry);
  return callout;
}

export async function loadAndRender({load, container, render}) {
  async function attempt() {
    const result = await load();
    if (result.ok) {
      render(result.data);
      return;
    }

    showFetchError(container, result, {onRetry: attempt});
  }
  return attempt();
}

export function showImportError(element, modulePath, error) {
  let reason = "unexpected error: " + (error.name || error);
  if (error.name === "SyntaxError") {
    reason = "module failed to parse";
  } else if (error.name === "TypeError") {
    reason = "network request failed";
  }
  appendErrorCallout(element, "Couldn't load " + modulePath + ": " + reason + ".");
}
