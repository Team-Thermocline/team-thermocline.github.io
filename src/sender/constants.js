/**
 * Sender / status grid tuning values (temperatures in °C unless noted).
 */

/** Max pending serial commands before drops and CONN blink-red. */
export const MAX_QUEUE = 25;

/** MONK indicator: Q0 TEMP outside this band (°C) → MONK! + blink-red. */
export const MONK_TEMP_C_LOW = -30;
export const MONK_TEMP_C_HIGH = 75;

/** ICE: TDR1 must be strictly below this (°C) and this many °C below chamber TEMP. */
export const ICE_TDR1_FREEZING_BELOW_C = 0;
export const ICE_CHAMBER_MIN_DELTA_C = 20;

/** EXHAUST: CT2 (condenser fan) ≥ this (A) and CT1 (compressor) < this (A) → blink in standby/heat. */
export const EXHAUST_CT2_FAN_ON_A = 0.3;
export const EXHAUST_CT1_COMPRESSOR_OFF_A = 0.25;

/** Periodic Q1 while in COOL_FAST / COOL_SLOW (TDR1 for ICE). */
export const Q1_TDR1_COOL_POLL_MS = 20000;

/** Periodic Q1 CT1 + CT2 while in standby or heating (EXHAUST). */
export const Q1_CT_STANDBY_HEAT_POLL_MS = 20000;

/** Default / clamp range for Q0 query interval in the UI. */
export const DEFAULT_Q0_QUERY_INTERVAL_MS = 1000;
export const Q0_QUERY_INTERVAL_MIN_MS = 100;
export const Q0_QUERY_INTERVAL_MAX_MS = 60000;

/** Gauge setpoint band width (°C). */
export const TEMP_GAUGE_BAND_C = 3;

/** Terminal / log ring buffer size. */
export const SERIAL_LOG_MAX_LINES = 1000;

/** Pending Q0 batch: abandon coalescing after this long (ms). */
export const PENDING_Q0_LINE_TIMEOUT_MS = 5000;

/** Default serial speed (baud). */
export const DEFAULT_SERIAL_BAUD = 115200;

/** Baud rates offered in the UI. */
export const SERIAL_BAUD_RATES = Object.freeze([9600, 19200, 38400, 57600, 115200]);
