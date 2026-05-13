import {handleFetchError} from './load.js';

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
  button.addEventListener("click", onRetry);
  callout.appendChild(button);
}

export function renderImportError(container, message, onRetry) {
  const callout = appendErrorCallout(container, message);
  if (onRetry) attachRetryButton(callout, onRetry);
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

    handleFetchError(result, {
      render: (message, retry) => {
        priorCallout = appendErrorCallout(container, message);
        if (retry) attachRetryButton(priorCallout, retry);
      },
      onRetry: attempt
    });
  }
  return attempt();
}
