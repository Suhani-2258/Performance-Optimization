export class TimeoutError extends Error {
  constructor() { super('Request timed out'); this.name = 'TimeoutError'; }
}

// Runs fn({ signal }) with a timeout. Aborting parentSignal cancels the request.
export function runRequest(fn, timeoutMs, parentSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const onParent = () => controller.abort();
  if (parentSignal?.aborted) controller.abort();
  parentSignal?.addEventListener('abort', onParent, { once: true });
  const aborted = new Promise((_, reject) => {
    const fail = () => reject(timedOut ? new TimeoutError() : Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    if (controller.signal.aborted) fail();
    else controller.signal.addEventListener('abort', fail, { once: true });
  });
  return Promise.race([new Promise((resolve) => resolve(fn({ signal: controller.signal }))), aborted]).finally(() => {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParent);
  });
}
