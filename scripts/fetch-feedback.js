/**
 * User-visible feedback for failed fetch operations.
 * @module fetch-feedback
 */

/**
 * Append an error callout to a container when a fetch fails.
 *
 * @param {string|Element} container  CSS selector or DOM element.
 * @param {string}         label      Human-readable name of the resource.
 * @param {object}         [opts]
 * @param {string}         [opts.innerHTML]   Replace the default message with HTML content.
 * @param {string}         [opts.classToken]  Extra class added to the callout div.
 */
export function showFetchError(container, label, opts) {
  const el = typeof container === 'string'
    ? document.querySelector(container)
    : container;
  if (!el) return;
  const callout = document.createElement('div');
  callout.className = 'callout error';
  if (opts && opts.classToken) callout.classList.add(opts.classToken);
  if (opts && opts.innerHTML) {
    callout.innerHTML = opts.innerHTML;
  } else {
    callout.textContent = 'Network error: fetch ' + label + ' failed.';
  }
  el.appendChild(callout);
}
