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

export function attachRetryButton(callout, onRetry) {
  if (!callout) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn callout-retry";
  button.textContent = "Retry";
  button.addEventListener("click", onRetry);
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
  let priorCallout = null;
  async function attempt() {
    container.classList.add("loading");
    const result = await load();
    container.classList.remove("loading");
    priorCallout?.remove();
    priorCallout = null;
    if (result.ok) {
      render(result.data);
      return;
    }

    priorCallout = showFetchError(container, result, {onRetry: attempt});
  }
  return attempt();
}

export function handleImportError(result, {render, onRetry}) {
  const cause = result.cause;
  let reason = "unexpected error: " + (cause.name || cause);
  if (cause.name === "SyntaxError") {
    reason = "module failed to parse";
  } else if (cause.name === "TypeError") {
    reason = "network request failed";
  }
  render("Couldn't load " + result.path + ": " + reason + ".", onRetry);
}
