function appendErrorCallout(element, message) {
  if (!element) return;
  const callout = document.createElement("div");
  callout.className = "callout error";
  callout.textContent = message;
  element.appendChild(callout);
}

export function showFetchError(element, filename, error) {
  let reason = "unexpected error: " + (error.name || error);
  if (typeof error.status === "number") {
    reason = "server returned " + error.status;
  } else if (error.name === "SyntaxError") {
    reason = "response wasn't valid JSON";
  } else if (error.name === "TypeError") {
    reason = "network request failed";
  }
  appendErrorCallout(element, "Couldn't load " + filename + ": " + reason + ".");
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
