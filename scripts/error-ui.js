import {appendErrorCallout, attachRetryButton} from './load.js';

export function renderImportError(container, message, onRetry) {
  const callout = appendErrorCallout(container, message);
  if (onRetry) attachRetryButton(callout, onRetry);
}
