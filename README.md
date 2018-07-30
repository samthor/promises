[![Build Status](https://travis-ci.org/samthor/promises.svg?branch=master)](https://travis-ci.org/samthor/promises)

The missing `Promise` helpers your project needs—just contains a few helpers that can benefit your project.
Ships as an ES module.

Requires a native implementation of `Promise` (maybe a polyfill will work too), and support for `async` and `await`.
You might be able to transpile these requirements away for [older browsers](https://medium.com/dev-channel/es6-modules-in-chrome-canary-m60-ba588dfb8ab7).

## Usage

Add to your dependencies via NPM or Yarn.

```js
import * as promises from './node_modules/promiseslib/index.js';  // or
import * as promises from 'promiseslib';  // maybe, but must be transpiled
```

If you're feeling lazy, open this file in [RawGit](https://rawgit.com/?url=https://github.com/samthor/promises/blob/master/index.js) and use the latest production link.
This won't provide you with updates but it is easy to include whole "https://..." paths via ES modules.

### Methods

* `promises.sleep(ms)`: builds a `Promise` which resolves after a specified time (or a frame if negative, or microtask if null/undefined is passed)

* `promises.event(target, event)`: builds a `Promise` which resolves when the given event occurs

* `promises.dedup(fn, ms)`: builds a dedup function which delays calls until the last in the specified period, all calls return the same shared `Promise` representing the completion of the last call

* `promises.makeSingle(generator)`: converts a generator (that yields `Promise` instances) into a task that can only run at most once ([read more](https://dev.to/chromiumdev/cancellable-async-functions-in-javascript-5gp7))

* `promises.group(callback)`: builds a wait group; aka a function which, when called with a `Promise`, returns a new `Promise` that waits for all passed promises to complete before resolving
