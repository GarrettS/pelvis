import {handleFetchError} from './load.js';
import {newEl} from './el-create.js';

export const appendErrorCallout = (element, textContent) =>
  element.appendChild(newEl('div', { className: 'callout error', textContent }));

export const clearErrors = container =>
  container.querySelectorAll('.callout.error').forEach(el => el.remove());

export function renderError(container, message, onRetry) {
  const callout = appendErrorCallout(container, message);
  if (onRetry) attachRetryButton(callout, onRetry);
  return callout;
}

function attachRetryButton(callout, onRetry) {
  const button = newEl('button', {
    type: 'button',
    className: 'callout-retry',
    textContent: 'Retry'
  });
  button.addEventListener('click', onRetry);
  callout.appendChild(button);
}

export const attemptLoad = ({loader, container, render}) =>
  (async function attempt() {
    container.classList.add('loading');
    const result = await loader();
    container.classList.remove('loading');
    clearErrors(container);

    if (result.ok) return render(result.data);

    handleFetchError(result, {
      render: (message, retry) => renderError(container, message, retry),
      onRetry: attempt
    });
  })();
