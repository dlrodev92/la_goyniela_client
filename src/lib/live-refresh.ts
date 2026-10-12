export const LIVE_REFRESH_INTERVAL_MS = 30_000;

export type LiveRefreshDeps = {
  refresh: () => void;
  isVisible: () => boolean;
  /** True while something must not be interrupted (e.g. a form submission in flight). */
  isBusy?: () => boolean;
  intervalMs?: number;
  setInterval?: (handler: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
};

/**
 * Pure scheduling for the live refresh: ticks every `intervalMs` while visible and idle, refreshes once when
 * the tab becomes visible again (restarting the interval), and stops ticking while hidden.
 */
export function createLiveRefresh(deps: LiveRefreshDeps) {
  const every = deps.intervalMs ?? LIVE_REFRESH_INTERVAL_MS;
  const set = deps.setInterval ?? ((handler, ms) => globalThis.setInterval(handler, ms));
  const clear = deps.clearInterval ?? (handle => globalThis.clearInterval(handle as ReturnType<typeof setInterval>));
  let handle: unknown = null;
  const tick = () => { if (deps.isVisible() && !deps.isBusy?.()) deps.refresh(); };
  const stopTimer = () => { if (handle !== null) { clear(handle); handle = null; } };
  const startTimer = () => { stopTimer(); handle = set(tick, every); };
  return {
    start() { if (deps.isVisible()) startTimer(); },
    /** Call from `visibilitychange`. */
    onVisibilityChange() {
      if (deps.isVisible()) { tick(); startTimer(); } else stopTimer();
    },
    stop: stopTimer,
  };
}
