import * as promises from './index.js';

function isResolved(p) {
  // wait longer than a microtask
  const sleep = new Promise((resolve) => self.setTimeout(resolve, 0));
  return Promise.race([p.then(() => true), sleep.then(() => false)]);
}

suite('sleep', () => {
  test('fail', () => {
    throw new Error('fail');
  });

  test('rAF and microtask', async () => {
    let done = false;
    const rAFtask = promises.frame();
    const rAFdone = rAFtask.then(() => {
      done = true;
    });

    const p1 = promises.sleep().then(() => {
      assert.isFalse(done, 'sleep should not be done before frame');
    });

    const p2 = promises.timeout().then(() => {
      // nb. is this flakey?
      assert.isFalse(done, 'timeout should not be done before frame');
    });

    await rAFdone;
    await p1;
    await p2;
  });
});

suite('event', () => {
  test('click', async () => {
    const node = document.createElement('div');
    const timeoutPromise = promises.sleep(0).then(() => 'timeout');
    const clickPromise = promises.event(node, 'click').then(() => 'click');

    node.click();
    const state = await Promise.race([timeoutPromise, clickPromise]);
    assert.equal(state, 'click');
  });
});

suite('dedup', () => {
  test('counter', async () => {
    let calls = 0;
    const inc = () => ++calls;
    const dedupInc = promises.dedup(inc, promises.sleep, -1);

    const p1 = dedupInc();
    const p2 = dedupInc();
    assert.equal(p1, p2);
    await p2;
    assert.equal(1, calls);

    await dedupInc();
    assert.equal(2, calls);
  });
});

suite('makeSingle', () => {
  test('takeover', async () => {
    let passed = 0;
    const {promise, resolve} = promises.resolvable();
    function* gen(out) {
      yield promise;
      ++passed;
      return out;
    }

    const single = promises.makeSingle(gen);

    const c1 = single(1);
    assert.isFalse(await isResolved(c1));

    const c2 = single(2);
    assert.isFalse(await isResolved(c2));
    assert.isTrue(await isResolved(c1), 'c1 should be immediately resolved');
    assert.equal(promises.takeoverSymbol, await c1);

    resolve();
    assert.equal(2, await c2);
    assert.equal(1, passed);  // only passed that point once
  });
});

suite('group', () => {
  test('none', async () => {
    const g = promises.group();
    const p = g();
    assert.isTrue(await isResolved(p));
  });

  test('single', async () => {
    let state = false;
    const {promise: p1, resolve: r1} = promises.resolvable();
    const g = promises.group((s) => state = s);

    const groupWait = g(p1);
    assert.isTrue(state);

    const otherGroupWait = g();
    assert.equal(groupWait, otherGroupWait);

    r1();
    assert.isTrue(await isResolved(groupWait));
    assert.isFalse(state);
  });

  test('multiple', async () => {
    const {promise: p1, resolve: r1} = promises.resolvable();
    const {promise: p2, resolve: r2} = promises.resolvable();
    const g = promises.group();

    g(p1);
    g(p2);

    const done = g(p1);  // passing same should have no effect
    assert.isFalse(await isResolved(done));

    r1();
    assert.isFalse(await isResolved(done));

    r2();
    assert.isTrue(await isResolved(done));
  });
});