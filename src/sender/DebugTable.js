/**
 * Debug table: contents and logic for the "Show Debug Values" popup.
 * getDebugRows(telemetry, lastPolledByKey) returns rows with value, pollInterval, lastPolled.
 */

/** Poll interval: number (ms) or "on_connect" for Q1 startup-only. */
const DEBUG_KEYS = [
  { key: "BUILD", label: "Build", pollInterval: "on_connect" },
  { key: "BUILDER", label: "Builder", pollInterval: "on_connect" },
  { key: "BUILD_DATE", label: "Build date", pollInterval: "on_connect" },
  { key: "CT0_AMPS", label: "Load 1 Amps", pollInterval: 1000 },
  { key: "CT1_AMPS", label: "Load 2 Amps", pollInterval: 1000 },
  { key: "CT2_AMPS", label: "Load 3 Amps", pollInterval: 1000 },
  { key: "CT3_AMPS", label: "Load 4 Amps", pollInterval: 1000 },
  { key: "TDR0_TEMPERATURE_C", label: "TC1 Temperature (°C)", pollInterval: 5000 },
  { key: "TDR1_TEMPERATURE_C", label: "TC2 Temperature (°C)", pollInterval: 5000 },
  { key: "TDR2_TEMPERATURE_C", label: "TC3 Temperature (°C)", pollInterval: 5000 },
  { key: "TDR3_TEMPERATURE_C", label: "TC4 Temperature (°C)", pollInterval: 5000 },
  { key: "STATE", label: "State", pollInterval: 10000 },
  { key: "FAULT", label: "Fault", pollInterval: 5000 },
  { key: "COMPRESSOR_ON_TIME", label: "Compressor On Time", pollInterval: 10000 },
  { key: "COMPRESSOR_OFF_TIME", label: "Compressor Off Time", pollInterval: 10000 },
];

function formatValue(key, raw) {
  if (raw == null || raw === "") return "—";
  if (key === "BUILD_DATE" && typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw * 1000).toLocaleString();
  }
  if (typeof raw === "boolean") return raw ? "true" : "false";
  return String(raw);
}

function formatPollInterval(pi) {
  if (pi === "on_connect") return "On connect";
  if (typeof pi === "number" && pi > 0) return pi >= 1000 ? `${pi / 1000} s` : `${pi} ms`;
  return "—";
}

function formatLastPolled(ts) {
  if (ts == null || typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  const d = new Date(ts);
  const now = Date.now();
  const sec = Math.round((now - ts) / 1000);
  if (sec < 2) return "just now";
  if (sec < 60) return `${sec} s ago`;
  return d.toLocaleTimeString();
}

/**
 * @param {Record<string, unknown> | null | undefined} telemetry
 * @param {Record<string, number>} lastPolledByKey - key -> timestamp (ms)
 * @returns {{ key: string, label: string, value: string, pollInterval: string, lastPolled: string }[]}
 */
export function getDebugRows(telemetry, lastPolledByKey = {}) {
  if (!telemetry || typeof telemetry !== "object") {
    return DEBUG_KEYS.map(({ key, label, pollInterval }) => ({
      key,
      label,
      value: "—",
      pollInterval: formatPollInterval(pollInterval),
      lastPolled: formatLastPolled(lastPolledByKey[key]),
    }));
  }
  return DEBUG_KEYS.map(({ key, label, pollInterval }) => ({
    key,
    label,
    value: formatValue(key, telemetry[key]),
    pollInterval: formatPollInterval(pollInterval),
    lastPolled: formatLastPolled(lastPolledByKey[key]),
  }));
}

/**
 * Debug polling loop: sends Q1 <key> for each key at its interval.
 * Only run while debug window is open. sendFn(command) adds to queue (e.g. sendTcode).
 * @returns {{ start(sendFn: (cmd: string) => void | Promise<unknown>): void, stop(): void }}
 */
export function createDebugPoller() {
  let intervals = [];
  let sendFn = null;

  function start(send) {
    stop();
    sendFn = send;
    if (!sendFn) return;

    for (const { key, pollInterval } of DEBUG_KEYS) {
      if (pollInterval === "on_connect") {
        sendFn(`Q1 ${key}`);
      } else if (typeof pollInterval === "number" && pollInterval > 0) {
        sendFn(`Q1 ${key}`);
        intervals.push(setInterval(() => sendFn(`Q1 ${key}`), pollInterval));
      }
    }
  }

  function stop() {
    intervals.forEach(clearInterval);
    intervals = [];
    sendFn = null;
  }

  return { start, stop };
}
