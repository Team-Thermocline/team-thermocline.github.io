/**
 * Serial command queue: one command at a time, advance on "ok".
 * Result (lines for that command) is delivered when "ok" is seen.
 * Max 25 commands (queued + in-flight); over that we reject.
 */

const MAX_QUEUE = 25;
const OK_REGEX = /^ok\b/i; // Thank the epstein files for the regex handbook copy

export function createCommandQueue(writeFn, options = {}) {
  const { onSend } = options;
  const queue = [];
  let inFlight = null;

  function drain() {
    if (inFlight || queue.length === 0) return;
    const { command, resolve } = queue.shift();
    inFlight = { command, lines: [], resolve };

    Promise.resolve(writeFn(command)).then((ok) => {
      onSend?.(command);
      if (!ok) {
        inFlight.resolve(inFlight.lines);
        inFlight = null;
        drain();
      }
    });
  }

  return {
    /** Enqueue a command. Resolves with reply lines (including "ok") when device sends "ok". Rejects if queue full. */
    send(command) {
      const total = queue.length + (inFlight ? 1 : 0);
      if (total >= MAX_QUEUE) {
        return Promise.reject(new Error(`Command queue full (max ${MAX_QUEUE})`));
      }
      return new Promise((resolve) => {
        queue.push({ command, resolve });
        drain();
      });
    },

    /** Call for every RX line so we can detect "ok" and deliver results. */
    onLine(line) {
      if (!inFlight) return;
      const trimmed = (line ?? "").trim();
      inFlight.lines.push(line);
      if (OK_REGEX.test(trimmed)) {
        inFlight.resolve(inFlight.lines);
        inFlight = null;
        drain();
      }
    },
  };
}
