/**
 * Debug table: contents and logic for the "Show Debug Values" popup.
 */

/**
 * Poll interval: number (ms) or on_connect
 * Optional nominal check (green if true, yellow if false)
 */

/**
 * TDR board temperature entries
 */
export const TDR_TEMPERATURE_ENTRIES = [
  {
    key: "TDR0_TEMPERATURE_C",
    label: "Heater Temperature (°C)",
    pollInterval: 5000,
    nominalExpr: "Number.isFinite(Number(v)) && Number(v) > 15 && Number(v) < 180",
  },
  {
    key: "TDR1_TEMPERATURE_C",
    label: "Evaporator Temperature (°C)",
    pollInterval: 5000,
    nominalExpr: "Number.isFinite(Number(v)) && Number(v) > -40 && Number(v) < 40",
  },
  {
    key: "TDR2_TEMPERATURE_C",
    label: "Compressor Temperature (°C)",
    pollInterval: 5000,
    nominalExpr: "Number.isFinite(Number(v)) && Number(v) > 15 && Number(v) < 100",
  },
  {
    key: "TDR3_TEMPERATURE_C",
    label: "Ambient Temperature (°C)",
    pollInterval: 5000,
    nominalExpr: "Number.isFinite(Number(v)) && Number(v) > 15 && Number(v) < 25",
  },
];

export const TDR_TEMPERATURE_KEYS = TDR_TEMPERATURE_ENTRIES.map((e) => e.key);

const DEBUG_KEYS = [
  {
    key: "BUILD",
    label: "Build",
    pollInterval: "on_connect",
    nominalExpr: 'typeof v === "string" && !String(v).includes("-dirty")', // Build isn't dirty
  },
  {
    key: "BUILDER",
    label: "Builder",
    pollInterval: "on_connect",
  },
  { key: "BUILD_DATE", label: "Build date", pollInterval: "on_connect" },
  {
    key: "CT0_AMPS",
    label: "Heater Amps",
    pollInterval: 1000,
    nominalExpr: "Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) < 10",
  },
  {
    key: "CT1_AMPS",
    label: "Compressor Amps",
    pollInterval: 1000,
    nominalExpr: "Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) < 10",
  },
  {
    key: "CT2_AMPS",
    label: "External Fan Amps",
    pollInterval: 1000,
    nominalExpr: "Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) < 5",
  },
  {
    key: "CT3_AMPS",
    label: "Internal Fan Amps",
    pollInterval: 1000,
    nominalExpr: "Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) < 1",
  },
  ...TDR_TEMPERATURE_ENTRIES,
  { key: "STATE", label: "State", pollInterval: 10000 },
  {
    key: "FAULT",
    label: "Fault",
    pollInterval: 5000,
    nominalExpr: "v === 'NONE'",
  },
  { key: "COMPRESSOR_ON_TIME", label: "Compressor On Time", pollInterval: 10000 },
  { key: "COMPRESSOR_OFF_TIME", label: "Compressor Off Time", pollInterval: 10000 },
  {
    key: "SHT35_TEMPERATURE_C",
    label: "SHT35 Temperature (°C)",
    pollInterval: 5000,
    nominalExpr: "Number.isFinite(Number(v)) && Number(v) !== 0.0",
  },
  { key: "SHT35_HUMIDITY", label: "SHT35 Humidity", pollInterval: 5000 },
  {
    key: "I2C_SCAN",
    label: "I2C Devices",
    pollInterval: 25000,
    nominalExpr: "v.includes('ADG') && v.includes('SHT35')",
  },
  { key: "FREERTOS_HEAP_FREE", label: "Free Heap", pollInterval: 5000 },
  { key: "FREERTOS_HEAP_MIN", label: "Min Heap", pollInterval: 20000 },
];

function nominalCheckerFor(entry) {
  if (typeof entry.nominal === "function") return entry.nominal;
  if (typeof entry.nominalExpr === "string" && entry.nominalExpr.trim()) {
    try {
      return new Function("v", `return !!(${entry.nominalExpr});`);
    } catch (e) {
      console.warn("[DebugTable] invalid nominalExpr for", entry.key, e);
      return () => false;
    }
  }
  return null;
}

const nominalCheckByKey = Object.fromEntries(DEBUG_KEYS.map((e) => [e.key, nominalCheckerFor(e)]));

function valueNominalClass(raw, checker) {
  if (!checker || raw == null || raw === "") return "";
  try {
    return checker(raw) ? "debug-value-nominal" : "debug-value-warn";
  } catch {
    return "debug-value-warn";
  }
}

function formatValue(key, raw) {
  if (raw == null || raw === "") return "...";
  if (key === "BUILD_DATE" && typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw * 1000).toLocaleString();
  }

  // Special cases
  if (key === "I2C_SCAN") {
    // For I2C scan just show the direct output
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return `0x${raw.toString(16).toUpperCase()}`;
    }
    return String(raw);
  }

  // Bools
  if (typeof raw === "boolean") return raw ? "true" : "false";

  // Default
  return String(raw);
}

function formatPollInterval(pi) {
  if (pi === "on_connect") return "On connect";
  if (typeof pi === "number" && pi > 0) return pi >= 1000 ? `${pi / 1000} s` : `${pi} ms`;
  return "...";
}

function formatLastPolled(ts) {
  if (ts == null || typeof ts !== "number" || !Number.isFinite(ts)) return "...";
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
 * @returns {{ key: string, label: string, value: string, valueClass: string, pollInterval: string, lastPolled: string }[]}
 */
export function getDebugRows(telemetry, lastPolledByKey = {}) {
  if (!telemetry || typeof telemetry !== "object") {
    return DEBUG_KEYS.map(({ key, label, pollInterval }) => ({
      key,
      label,
      value: "...",
      valueClass: "",
      pollInterval: formatPollInterval(pollInterval),
      lastPolled: formatLastPolled(lastPolledByKey[key]),
    }));
  }
  return DEBUG_KEYS.map(({ key, label, pollInterval }) => {
    const raw = telemetry[key];
    return {
      key,
      label,
      value: formatValue(key, raw),
      valueClass: valueNominalClass(raw, nominalCheckByKey[key]),
      pollInterval: formatPollInterval(pollInterval),
      lastPolled: formatLastPolled(lastPolledByKey[key]),
    };
  });
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
