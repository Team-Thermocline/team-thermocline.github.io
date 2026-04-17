/**
 * Serial command queue: one command at a time, advance on "ok".
 * Result (lines for that command) is delivered when "ok" is seen.
 * Max MAX_QUEUE commands (queued + in-flight); when full, oldest queued commands are
 * dropped (rejected with dropped=true) to make room — never the in-flight cmd.
 * If the device does not send "ok" within okTimeoutMs after a successful write,
 * the in-flight command is rejected (timedOut=true) and the queue advances.
 */

import { MAX_QUEUE } from "./constants.js";

export { MAX_QUEUE };

const OK_REGEX = /^ok\b/i; // Thank the epstein files for the regex handbook copy

/** Default max time to wait for "ok" after a successful line write (0 = no limit). */
export const DEFAULT_OK_TIMEOUT_MS = 15_000;

function makeDroppedError(max) {
  const err = new Error(`Command dropped: queue full (max ${max})`);
  err.dropped = true;
  return err;
}

export function createCommandQueue(writeFn, options = {}) {
  const { onSend, onQueueChange, okTimeoutMs = DEFAULT_OK_TIMEOUT_MS } = options;
  const queue = [];
  let inFlight = null;
  let okWaitSeq = 0;

  function total() {
    return queue.length + (inFlight ? 1 : 0);
  }

  function endInflight(onEnd) {
    if (!inFlight) return;
    if (inFlight.timer != null) {
      clearTimeout(inFlight.timer);
      inFlight.timer = null;
    }
    const flight = inFlight;
    inFlight = null;
    onEnd(flight);
    drain();
    onQueueChange?.(total());
  }

  function drain() {
    if (inFlight || queue.length === 0) return;
    const { command, resolve, reject } = queue.shift();
    const seq = ++okWaitSeq;
    inFlight = {
      command,
      lines: [],
      resolve,
      reject,
      timer: null,
      seq,
    };
    onQueueChange?.(total());

    Promise.resolve(writeFn(command)).then((writeOk) => {
      if (!inFlight || inFlight.seq !== seq) return;
      onSend?.(command);
      if (!writeOk) {
        endInflight((f) => f.resolve(f.lines));
        return;
      }
      const ms = okTimeoutMs;
      if (ms <= 0) return;
      inFlight.timer = setTimeout(() => {
        if (!inFlight || inFlight.seq !== seq) return;
        endInflight((f) => {
          const err = new Error(`Timed out waiting for ok (${ms}ms): ${f.command}`);
          err.timedOut = true;
          f.reject(err);
        });
      }, ms);
    });
  }

  return {
    /** Enqueue a command. Resolves with reply lines (including "ok") when device sends "ok". Drops oldest queued if full. */
    send(command) {
      while (total() >= MAX_QUEUE && queue.length > 0) {
        const dropped = queue.shift();
        dropped.reject(makeDroppedError(MAX_QUEUE));
        onQueueChange?.(total());
      }
      if (total() >= MAX_QUEUE) {
        return Promise.reject(new Error(`Command queue full (max ${MAX_QUEUE})`));
      }
      return new Promise((resolve, reject) => {
        queue.push({ command, resolve, reject });
        drain();
      });
    },

    /** Call for every RX line so we can detect "ok" and deliver results. */
    onLine(line) {
      if (!inFlight) return;
      const trimmed = (line ?? "").trim();
      inFlight.lines.push(line);
      if (OK_REGEX.test(trimmed)) {
        const lines = inFlight.lines;
        endInflight((f) => f.resolve(lines));
      }
    },
  };
}
