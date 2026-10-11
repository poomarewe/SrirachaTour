import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revealLoadingScreen } from '../src/loadingTransition.js';

function element() {
  const classes = new Set(), listeners = new Map();
  return {
    classList: { add: name => classes.add(name), contains: name => classes.has(name) },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
    end: (animationName, layer) => listeners.get('animationend')?.({ animationName, target: { classList: { contains: name => name === layer } } }),
  };
}
test('reveal waits one second and finishes only after the trailing triangle layer', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const loader = element(); let finished = 0;
  revealLoadingScreen(loader, () => finished++);
  t.mock.timers.tick(999); assert.equal(loader.classList.contains('is-departing'), false);
  t.mock.timers.tick(1); assert.equal(loader.classList.contains('is-departing'), true);
  loader.end('journey-drive-away', 'journey-loader__bus');
  loader.end('journey-triangle-reveal', 'journey-loader__layer--first');
  assert.equal(finished, 0);
  loader.end('journey-triangle-reveal', 'journey-loader__layer--last');
  assert.equal(finished, 1); t.mock.timers.tick(5000); assert.equal(finished, 1);
});
test('reduced motion preserves the one-second hold and skips the moving reveal', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  const loader = element(); let finished = false;
  revealLoadingScreen(loader, () => { finished = true; });
  t.mock.timers.tick(999); assert.equal(finished, false);
  t.mock.timers.tick(1); assert.equal(finished, true); assert.equal(loader.classList.contains('is-departing'), false);
});
test('missing animation events still clear the loader, and unmount cancels pending work', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  let finished = 0;
  revealLoadingScreen(element(), () => finished++);
  t.mock.timers.tick(1000); assert.equal(finished, 0);
  t.mock.timers.tick(1310); assert.equal(finished, 1);
  const cancelled = element(); const cancel = revealLoadingScreen(cancelled, () => finished++);
  cancel(); t.mock.timers.tick(5000);
  assert.equal(finished, 1); assert.equal(cancelled.classList.contains('is-departing'), false);
});
