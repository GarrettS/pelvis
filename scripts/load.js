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

export function handleFetchError(result, {render, onRetry}) {
  const cause = result.cause;
  let reason = "unexpected error: " + (cause.name || cause);
  if (typeof cause.status === "number") {
    reason = "server returned " + cause.status;
  } else if (cause.name === "SyntaxError") {
    reason = "response wasn't valid JSON";
  } else if (cause.name === "TypeError") {
    reason = "network request failed";
  }
  const filename = result.path.slice(result.path.lastIndexOf("/") + 1);
  render("Couldn't load " + filename + ": " + reason + ".", onRetry);
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
