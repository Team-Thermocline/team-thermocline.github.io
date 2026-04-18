/**
 * Status grid light conditions. Each function returns
 * "off" | "green" | "blink-green" | "blink-yellow" | "blink-red"
 * for one status cell.
 */

import {
  EXHAUST_CT1_COMPRESSOR_OFF_A,
  EXHAUST_CT2_FAN_ON_A,
  ICE_CHAMBER_MIN_DELTA_C,
  ICE_TDR1_FREEZING_BELOW_C,
  MAX_QUEUE,
  MONK_TEMP_C_HIGH,
  MONK_TEMP_C_LOW,
} from "./constants.js";

function asBool(v) {
  return v === true;
}

function asNumber(v) {
  return typeof v === "number" ? v : Number(v);
}

/** CONN: green when connected and at least one good RX line; red on error or queue full (≥25); else yellow. */
export function connectionState(inputs) {
  const { lastConnectionError, serialConnected, hasReceivedGoodRx, commandQueueLength = 0 } = inputs;
  if (lastConnectionError) return "blink-red";
  if (commandQueueLength >= MAX_QUEUE) return "blink-red";
  if (serialConnected && hasReceivedGoodRx) return "green";
  return "blink-yellow";
}

/** FAULT: red when alarm non-zero or FAULT string is not NONE. */
export function faultState(inputs) {
  const { alarmValue, faultString } = inputs;
  if (alarmValue !== 0) return "blink-red";
  if (faultString && faultString.toUpperCase() !== "NONE") return "blink-red";
  return "off";
}

/* Ready, Its a lot of conditions!
 * solid green when STATE=standby
 * flashing green when STATE=idle.
 * Requires CONN green, Build/Builder/Build Date, no fault, door safe (if reported). 
 * Off when disconnected. 
 */
export function readyState(inputs) {
  const {
    serialConnected,
    connectionStateVal,
    q1Complete,
    faultStateVal,
    hasDoorSafe,
    doorSafe,
    telemetry,
  } = inputs;
  if (!serialConnected) return "off";
  const allGates =
    connectionStateVal === "green" &&
    q1Complete &&
    faultStateVal === "off" &&
    (!hasDoorSafe || doorSafe === true);
  if (!allGates) return "blink-yellow";
  const state = (telemetry?.STATE ?? "").toString().trim().toLowerCase();
  if (state === "standby") return "green";
  if (state === "idle") return "blink-green";
  return "green";
}

/** HEAT: yellow when controller reports HEAT true. */
export function heatState(inputs) {
  return asBool(inputs.telemetry?.HEAT) ? "blink-yellow" : "off";
}

/** COOL: yellow when controller reports COOL true. */
export function coolState(inputs) {
  return asBool(inputs.telemetry?.COOL) ? "blink-yellow" : "off";
}

/** IDLE: solid green when Q0 STATE is idle. */
export function idleState(inputs) {
  const s = (inputs.telemetry?.STATE ?? "").toString().trim().toLowerCase();
  if (s === "idle") return "green";
  return "off";
}

/**
 * FAST: blink yellow when Q0 STATE names a fast mode (e.g. COOL_FAST; future HEAT_FAST).
 */
export function fastState(inputs) {
  const s = (inputs.telemetry?.STATE ?? "").toString().trim().toUpperCase();
  if (s.includes("FAST")) return "blink-yellow";
  return "off";
}

/** True when Q0 TEMP is an extreme chamber temperature (C). */
export function isMonkTemperatureAlert(telemetry) {
  const t = asNumber(telemetry?.TEMP);
  if (!Number.isFinite(t)) return false;
  return t < MONK_TEMP_C_LOW || t > MONK_TEMP_C_HIGH;
}

/** MONK: blink red when chamber is monk level of temperature */
export function monkModeState(inputs) {
  return isMonkTemperatureAlert(inputs.telemetry) ? "blink-red" : "off";
}

/**
 * ICE: flash yellow when evaporator (TDR1) is below freezing and at least 20C colder than
 * chamber temperature from Q0 (TEMP). In STATE=dehumidify the same condition flashes green.
 */
export function iceState(inputs) {
  const t1 = asNumber(inputs.telemetry?.TDR1_TEMPERATURE_C);
  const chamberC = asNumber(inputs.telemetry?.TEMP);
  if (!Number.isFinite(t1) || !Number.isFinite(chamberC)) return "off";
  if (
    t1 < ICE_TDR1_FREEZING_BELOW_C &&
    chamberC - t1 >= ICE_CHAMBER_MIN_DELTA_C
  ) {
    const state = (inputs.telemetry?.STATE ?? "").toString().trim().toLowerCase();
    if (state === "dehumidify") return "blink-green";
    return "blink-yellow";
  }
  return "off";
}

/** True when controller STATE is aggressive/slow cooling (poll TDR1 more often). */
export function isCoolFastOrSlowState(telemetry) {
  const s = (telemetry?.STATE ?? "").toString().trim().toLowerCase();
  return s === "cool_fast" || s === "cool_slow";
}

/** Standby or active heating (Q0): used for exhaust / machinery-space fan vs compressor check. */
export function isStandbyOrHeatingState(telemetry) {
  const s = (telemetry?.STATE ?? "").toString().trim().toLowerCase();
  if (s === "standby") return true;
  return asBool(telemetry?.HEAT);
}

/**
 * EXHAUST (hot_exhaust): in standby or while heating, blink yellow if condenser fan draws
 * current (CT2) but the compressor does not (CT1). Requires Q1 CT1/CT2 in telemetry.
 */
export function hotExhaustState(inputs) {
  const telemetry = inputs.telemetry;
  if (!telemetry || !isStandbyOrHeatingState(telemetry)) return "off";

  const ct1 = asNumber(telemetry.CT1_AMPS);
  const ct2 = asNumber(telemetry.CT2_AMPS);
  if (!Number.isFinite(ct1) || !Number.isFinite(ct2)) return "off";

  if (ct2 >= EXHAUST_CT2_FAN_ON_A && ct1 < EXHAUST_CT1_COMPRESSOR_OFF_A) return "blink-yellow";
  return "off";
}

/** TEST: red when test mode on. */
export function testState(inputs) {
  return inputs.testMode ? "blink-red" : "off";
}

/** DOOR: green when DOOR true, yellow when false; off if controller doesn't report DOOR. */
export function doorState(inputs) {
  const { hasDoor, door } = inputs;
  if (!hasDoor) return "off";
  return door ? "green" : "blink-yellow";
}

/** DOOR_SAFE: green when DOOR_SAFE true, yellow when false; off if controller doesn't report DOOR_SAFE. */
export function doorSafeState(inputs) {
  const { hasDoorSafe, doorSafe } = inputs;
  if (!hasDoorSafe) return "off";
  return doorSafe ? "green" : "blink-yellow";
}

/**
 * Compute all status states from raw inputs.
 * @param {{
 *   serialConnected: boolean,
 *   hasReceivedGoodRx: boolean,
 *   lastConnectionError: string | null,
 *   commandQueueLength: number (optional),
 *   telemetry: object | null,
 *   testMode: boolean,
 *   q1BuildDone: boolean,
 *   q1BuilderDone: boolean,
 *   q1BuildDateDone: boolean,
 * }} inputs
 */
export function computeStatusStates(inputs) {
  const alarmValue =
    inputs.telemetry?.ALARM == null ? 0 : asNumber(inputs.telemetry.ALARM);
  const faultString =
    inputs.telemetry?.FAULT != null ? String(inputs.telemetry.FAULT).trim() : "";
  const hasDoor = typeof inputs.telemetry?.DOOR === "boolean";
  const door = hasDoor ? inputs.telemetry.DOOR : null;
  const hasDoorSafe = typeof inputs.telemetry?.DOOR_SAFE === "boolean";
  const doorSafe = hasDoorSafe ? inputs.telemetry.DOOR_SAFE : null;
  const q1Complete =
    inputs.q1BuildDone && inputs.q1BuilderDone && inputs.q1BuildDateDone;

  const conn = connectionState(inputs);
  const fault = faultState({ ...inputs, alarmValue, faultString });

  return {
    connection: conn,
    fault,
    ready: readyState({
      ...inputs,
      connectionStateVal: conn,
      faultStateVal: fault,
      q1Complete,
      hasDoorSafe,
      doorSafe,
    }),
    heat: heatState(inputs),
    cool: coolState(inputs),
    idle: idleState(inputs),
    ice: iceState(inputs),
    hot_exhaust: hotExhaustState(inputs),
    fast: fastState(inputs),
    monk_mode: monkModeState(inputs),
    test: testState(inputs),
    door: doorState({ ...inputs, hasDoor, door }),
    door_safe: doorSafeState({ ...inputs, hasDoorSafe, doorSafe }),
  };
}
