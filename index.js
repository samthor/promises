//
// To use this library as an ES module without installing it, you can go to:
//   https://rawgit.com/?url=https://github.com/samthor/promises/blob/master/index.js
//
// ... and include the latest version like this:
//   import * as promises from 'https://cdn.rawgit.com/...<REST OF URL>';
//

const noop = () => {};

/**
 * @return {!Promise<void>} resolved after requestAnimationFrame
 */
export function frame() {
  return new Promise((r) => self.requestAnimationFrame(r));
}

/**
 * @return {!Promise<void>} resolved after microtask (requires native Promise)
 */
export const microtask = self.queueMicrotask ? 
    () => new Promise((r) => self.queueMicrotask(r)) :
    () => Promise.resolve();

/**
 * @param {number=} ms
 * @return {!Promise<void>} resolved after timeout
 */
export function timeout(ms = 0) {
  return new Promise((r) => self.setTimeout(r, ms));
}

/**
 * Returns a Promise that resolves after the specified time. If no time is passed, waits for
 * a microtask.
 *
 * @param {number=} ms to wait, null/undefined for microtask
 * @return {!Promise<void>}
 */
export function sleep(ms) {
  return ms != null ? timeout(ms) : microtask();
}

/**
 * Returns a Promise that resolves after a single event is fired.
 *
 * @param {!EventTarget} target
 * @param {string} name
 * @return {!Promise<!Event>}
 */
export function event(target, name) {
  return new Promise((resolve) => {
    // don't use {once: true}, for IE11 support (would just leak memory)
    const handler = () => {
      resolve();
      target.removeEventListener(name, handler);
    };
    target.addEventListener(name, handler);
  });
}

/**
 * Returns a newly deduped function over the passed time. This will return a Promise that is
 * resolved only when the 'last' deduped call is run. Only the last call's arguments will be passed
 * to the underlying deduped call.
 *
 * @template T
 * @param {function(...*): T} fn to dedup
 * @param {function(): !Promise<*>} delayer to build Promise to dedup over
 * @return {function(...*): Promise<T>}
 */
export function dedup(fn, delayer) {
  let p = null;
  let lastArguments;
  return function(...args) {
    lastArguments = args;
    if (p === null) {
      // first call, create Promise
      p = delayer().then(() => {
        const args = lastArguments;
        p = null;
        lastArguments = undefined;  // clear in case of memory leak
        return fn(...args);
      });
    }
    return p;
  };
}

/**
 * Symbol that indicates a call managed by makeSingle has been cancelled in favor of a new call.
 */
export const takeoverSymbol = Object.seal({});

const abortSymbol = Object.seal({});  // distinct from takeoverSymbol so folks can't return it

/**
 * Accepts a generator function, which yields awaitables (ostensibly Promise instances, but
 * actually anything that may be `await`-ed on), and converts it to an async function that
 * cancels any previous calls.
 *
 * @param {function(...*): !Iterator<*>} generator
 * @return {function(...*): !Promise<*>}
 */
export function makeSingle(generator) {
  let previousPromise;
  let previousResolve = noop;

  return async function(...args) {
    previousResolve(abortSymbol);
    ({promise: previousPromise, resolve: previousResolve} = resolvable());
    const localSinglePromise = previousPromise;

    const iter = generator(...args);
    let resumeValue;
    for (;;) {
      const n = iter.next(resumeValue);
      if (n.done) {
        return n.value;  // final return value of passed generator
      }

      // whatever the generator yielded, _now_ run await on it
      resumeValue = await Promise.race([toPromise(n.value), localSinglePromise]);
      if (resumeValue === abortSymbol) {
        return takeoverSymbol;
      }
      // next loop, we give resumeValue back to the generator
    }
  };
}

/**
 * Builds a wait group. This returns a method which accepts an optional Promise (or anything which
 * can be `await`-ed) to add to the group. The method also returns a Promise which resolves when
 * all group promises are complete, although this Promise rejects early if any of its group members
 * reject.
 *
 * Notably, an empty group will always resolve immediately.
 *
 * @param {(function(boolean): void)=} callback invoked with false for empty, true for non-empty
 * @return {function(*=): Promise<void>}
 */
export function group(callback=noop) {
  let count = 0;
  let p = null;
  let resolve = null;

  const resolveWithError = (err) => currentResolve(Promise.reject(err));
  const dec = () => {
    --count;
    if (count < 0) {
      throw new TypeError('got -ve count in group');
    } else if (count > 0) {
      return;  // nothing to do
    }

    try {
      callback(false);
    } catch (e) {
      resolveWithError(e);
    }

    resolve();
    p = null;
    resolve = null;
  };

  return function(task=undefined) {
    const promiseWasNull = (p === null);
    if (promiseWasNull) {
      if (task === undefined) {
        return Promise.resolve();  // immediately done
      }

      ({promise: p, resolve} = resolvable());
      if (count !== 0) {
        throw new TypeError('expective +ve count for Promise creation');
      }
    } else if (task === undefined) {
      // don't push a task, just wait for p to be done
      return p;
    }

    ++count;
    toPromise(task).catch(resolveWithError).then(dec);
    promiseWasNull && callback(true);  // perform last so any Error doesn't effect behavior
    return p;
  };
}

/**
 * Helper to return a Promise and a resolve helper.
 *
 * @template {T}
 * @return {{promise: !Promise<T>, resolve: function(T): void}}
 */
export function resolvable() {
  let resolve;
  const promise = new Promise((r) => resolve = r);
  return {promise, resolve};
}

/**
 * Helper that turns anything into a Promise (async/await magic).
 *
 * @template {T}
 * @param {(T|!Promise<T>)} t
 * @return {!Promise<T>} t
 */
async function toPromise(t) {
  return t;
}
