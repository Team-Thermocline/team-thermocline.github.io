/**
 * Status grid light conditions. Each function returns
 * "off" | "green" | "blink-yellow" | "blink-red"
 * for one status cell.
 */

function asBool(v) {
  return v === true;
}

function asNumber(v) {
  return typeof v === "number" ? v : Number(v);
}

/** CONN: green when connected and at least one good RX line; red on error; else yellow (connecting/disconnected). */
export function connectionState(inputs) {
  const { lastConnectionError, serialConnected, hasReceivedGoodRx } = inputs;
  if (lastConnectionError) return "blink-red";
  if (serialConnected && hasReceivedGoodRx) return "green";
  return "blink-yellow";
}

/** FAULT: red when alarm value non-zero. */
export function faultState(inputs) {
  const { alarmValue } = inputs;
  return alarmValue !== 0 ? "blink-red" : "off";
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
  const hasDoor = typeof inputs.telemetry?.DOOR === "boolean";
  const door = hasDoor ? inputs.telemetry.DOOR : null;
  const hasDoorSafe = typeof inputs.telemetry?.DOOR_SAFE === "boolean";
  const doorSafe = hasDoorSafe ? inputs.telemetry.DOOR_SAFE : null;
  const q1Complete =
    inputs.q1BuildDone && inputs.q1BuilderDone && inputs.q1BuildDateDone;

  const conn = connectionState(inputs);
  const fault = faultState({ ...inputs, alarmValue });

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
    test: testState(inputs),
    door: doorState({ ...inputs, hasDoor, door }),
    door_safe: doorSafeState({ ...inputs, hasDoorSafe, doorSafe }),
  };
}
