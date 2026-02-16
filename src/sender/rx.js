/**
 * RX utilities: split serial text stream into lines + parse controller telemetry.
 */

export function createLineProcessor() {
  let buffer = "";

  return {
    /**
     * Push a decoded text chunk, return completed "lines".
     * Also handles keepalive '.' without a trailing newline.
     * Always returns lines even if garbled - converts non-printable chars to hex.
     * @param {string} chunk
     * @param {Uint8Array} rawBytes - Optional raw bytes for fallback display
     * @returns {string[]}
     */
    push(chunk, rawBytes = null) {
      if (!chunk && !rawBytes) return [];
      
      // If chunk is empty but we have raw bytes, show hex representation
      if (!chunk && rawBytes && rawBytes.length > 0) {
        const hex = Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        return [`[garbled: ${hex}]`];
      }

      if (!chunk) return [];

      // Normalize garbled characters - replace non-printable with hex
      const normalized = chunk.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, (c) => {
        const code = c.charCodeAt(0);
        return `\\x${code.toString(16).padStart(2, '0')}`;
      });

      buffer += normalized;

      // Split on newline(s) and emit all complete lines.
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() ?? "";

      const lines = [];
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) lines.push(trimmed);
      }

      // If device sends keepalive '.' without newline, emit it too.
      if (buffer.trim() === ".") {
        lines.push(".");
        buffer = "";
      }

      return lines;
    },

    reset() {
      buffer = "";
    },
  };
}

function parseTelemetryValue(key, rawValue) {
  const v = rawValue.trim();
  if (v === "true") return true;
  if (v === "false") return false;
  if (key === "STATE") return v;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}

/**
 * Parse a telemetry line like:
 * "data: TEMP=0.0 RH=0.0 HEAT=false STATE=IDLE SET_TEMP=0.0 SET_RH=0.0 ALARM=0"
 * 
 * Then you can retreive the value like telemetry.TEMP or telemetry.STATE etc.
 *
 * @param {string} line
 * @returns {Record<string, any> | null}
 */
export function parseTelemetryLine(line) {
  const trimmed = (line ?? "").trim();
  if (!trimmed.toLowerCase().startsWith("data:")) return null;

  const body = trimmed.slice(trimmed.indexOf(":") + 1).trim();
  const parts = body.split(/\s+/).filter(Boolean);
  const out = {};

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const rawValue = part.slice(eq + 1);
    if (!key) continue;
    out[key] = parseTelemetryValue(key, rawValue);
  }

  return Object.keys(out).length ? out : null;
}

