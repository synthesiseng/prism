// A single pending native pass owns one visible-time budget, shared by callers.
export function visiblePaintDeadline(
  document: Document,
  duration: number,
  expire: () => void
): () => void {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 2 ** 31 - 1) {
    throw new RangeError(
      "nativePaintTimeoutMs must be greater than 0 and at most 2147483647."
    );
  }
  let remaining = duration;
  let started: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  const pause = (): void => {
    if (started !== undefined)
      remaining = Math.max(0, remaining - (performance.now() - started));
    started = undefined;
    clearTimeout(timer);
    timer = undefined;
  };
  const cancel = (): void => {
    settled = true;
    pause();
    document.removeEventListener("visibilitychange", visibility);
  };
  const visibility = (): void => {
    pause();
    if (settled || document.visibilityState === "hidden") return;
    started = performance.now();
    timer = setTimeout(() => {
      // A queued timer can race a visibility change; never expire while hidden.
      if (document.visibilityState === "hidden") {
        pause();
        return;
      }
      cancel();
      expire();
    }, remaining);
  };
  document.addEventListener("visibilitychange", visibility);
  visibility();
  return cancel;
}
