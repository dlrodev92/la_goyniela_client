import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createLiveRefresh, LIVE_REFRESH_INTERVAL_MS } = require("../build/tests/lib/live-refresh.js");

function harness({ visible = true, busy = false } = {}) {
  const state = { visible, busy, refreshes: 0, timers: new Map(), next: 1, now: 0 };
  const live = createLiveRefresh({
    refresh: () => { state.refreshes += 1; },
    isVisible: () => state.visible,
    isBusy: () => state.busy,
    setInterval: (handler, ms) => { const id = state.next++; state.timers.set(id, { handler, ms, due: state.now + ms }); return id; },
    clearInterval: id => { state.timers.delete(id); },
  });
  const advance = ms => {
    const end = state.now + ms;
    for (;;) {
      const due = [...state.timers.values()].filter(t => t.due <= end).sort((a, b) => a.due - b.due)[0];
      if (!due) break;
      state.now = due.due; due.due += due.ms; due.handler();
    }
    state.now = end;
  };
  return { state, live, advance };
}

test("refreshes every 30 s while visible and stops on cleanup", () => {
  const { state, live, advance } = harness();
  live.start();
  advance(LIVE_REFRESH_INTERVAL_MS - 1);
  assert.equal(state.refreshes, 0);
  advance(1);
  assert.equal(state.refreshes, 1);
  advance(LIVE_REFRESH_INTERVAL_MS * 2);
  assert.equal(state.refreshes, 3);
  live.stop();
  assert.equal(state.timers.size, 0);
  advance(LIVE_REFRESH_INTERVAL_MS * 5);
  assert.equal(state.refreshes, 3);
});

test("does not start hidden, pauses when hidden and refreshes once when visible again", () => {
  const { state, live, advance } = harness({ visible: false });
  live.start();
  assert.equal(state.timers.size, 0);
  state.visible = true; live.onVisibilityChange();
  assert.equal(state.refreshes, 1);
  assert.equal(state.timers.size, 1);
  state.visible = false; live.onVisibilityChange();
  assert.equal(state.timers.size, 0);
  advance(LIVE_REFRESH_INTERVAL_MS * 3);
  assert.equal(state.refreshes, 1);
});

test("skips ticks while busy (pending submission)", () => {
  const { state, live, advance } = harness();
  live.start();
  state.busy = true;
  advance(LIVE_REFRESH_INTERVAL_MS * 2);
  assert.equal(state.refreshes, 0);
  state.busy = false;
  advance(LIVE_REFRESH_INTERVAL_MS);
  assert.equal(state.refreshes, 1);
});
