<script>
  import { afterUpdate, onMount, onDestroy } from "svelte";
  import "./Sender.css";
  import { buildM0Command, buildM2Command, buildQueryCommand, buildTemperatureCommand } from "./tcode.js";
  import { createLineProcessor, normalizeFaultString, parseLooseTelemetryLine } from "./rx.js";
  import { createSerialConnection } from "./serial.js";
  import { fToC, getTempUiModel } from "./temp.js";
  import { computeStickToBottom, scrollToBottom } from "./terminalScroll.js";
  import Gauge from "./Gauge.svelte";
  import StatusGrid from "./StatusGrid.svelte";
  import Graph from "./Graph.svelte";
  import KioskNumpad from "./KioskNumpad.svelte";
  import { TDR_TEMPERATURE_KEYS } from "./DebugTable.js";
  import {
    computeStatusStates,
    isCoolFastOrSlowState,
    isMonkTemperatureAlert,
    isStandbyOrHeatingState,
  } from "./statusGridState.js";
  import {
    DEFAULT_Q0_QUERY_INTERVAL_MS,
    DEFAULT_SERIAL_BAUD,
    MAX_QUEUE,
    PENDING_Q0_LINE_TIMEOUT_MS,
    Q0_QUERY_INTERVAL_MAX_MS,
    Q0_QUERY_INTERVAL_MIN_MS,
    Q1_CT_STANDBY_HEAT_POLL_MS,
    Q1_TDR1_COOL_POLL_MS,
    SERIAL_BAUD_RATES,
    SERIAL_LOG_MAX_LINES,
    TEMP_GAUGE_BAND_C,
  } from "./constants.js";
  import { createCommandQueue } from "./commandQueue.js";
  import { showWarning } from "../lib/warning.js";
  import { hasElectronSerial } from "../lib/kiosk.js";
  import Music from "../Music.svelte";

  export let kioskMode = false;
  $: isKiosk = kioskMode || hasElectronSerial();

  let serial = createSerialConnection();
  let baudRate = DEFAULT_SERIAL_BAUD;
  let logs = [];
  let temperature = "";
  let showKeepalives = false;
  let showUpdates = false;
  let audioAlertsEnabled = true;
  let musicAlerts;
  let lineProcessor = createLineProcessor();
  let queryInterval = null;
  let queryIntervalMs = DEFAULT_Q0_QUERY_INTERVAL_MS;
  let commandQueue = null;
  let commandQueueLength = 0; // Length of the command queue
  /** Timeouts for post-connect Q1 metadata retries (cleared on disconnect). */
  let buildMetadataRetryTimeouts = [];
  let telemetry = null;
  let manualCommand = "";
  let tempNumpadOpen = false;

  // UI and Terminal state vars
  let terminalEl = null;
  let stickToBottom = true;
  let showFahrenheit = false;
  let lastConnectionError = null;
  let hasReceivedGoodRx = false;
  let TEST_MODE = false;
  let isUserInputAllowed = false;
  let serialConnected = false;
  /** Main process opened /dev/ttyAMA*; Web Serial `serial.connected` stays false. */
  let electronSerialBridged = false;
  let electronPollTimer = null;
  $: serialLinkUp = serial.connected || electronSerialBridged;
  let q1BuildDone = false;
  let q1BuilderDone = false;
  let q1BuildDateDone = false;
  let samples = []; // [{ t, tempC, setTempC, rh, tdrC?: (number|null)[] }]
  let recordAllTdrTemps = false;
  let tdrPollInterval = null;
  /** Q1 TDR1 while cooling (evaporator temp for ICE indicator). */
  let tdr1CoolPollInterval = null;
  let tdr1CoolPollActive = false;
  /** Q1 CT1/CT2 in standby or heating (EXHAUST machinery-space hint). */
  let ctStandbyHeatPollInterval = null;
  let ctStandbyHeatPollActive = false;

  $: tempUi = getTempUiModel({
    telemetry,
    showFahrenheit,
    minC: -50,
    maxC: 80,
    bandC: TEMP_GAUGE_BAND_C,
  });
  $: debugForceGaugeNeedles = TEST_MODE;

  const baudRates = SERIAL_BAUD_RATES;
  const isKeepalive = (log) =>
    log?.type === "rx" && (log?.message || "").replace(/^RX:\s*/, "").trim() === ".";

  const isQ0Tx = (log) => log?.type === "tx" && /^TX:\s*Q0\b/i.test(log?.message || "");
  const isQ0RxData = (log) => log?.type === "rx" && /^RX:\s*data:/i.test(log?.message || "");
  const isRxOk = (log) =>
    log?.type === "rx" && /^RX:\s*ok\b/i.test((log?.message || "").trim());



  // PENDING CHUNK
  // Its a (little) messy and i could clean this up
  // but, mostly okay way to reduce the spam of Q0 chatter
  let pendingQ0 = 0; // 0 = none, 1 = sent, 2 = got data (expect ok)
  let pendingQ0StartedAt = 0;

  const isQ0Command = (command) => /^Q0\b/i.test((command ?? "").trim());
  const isDataLine = (line) => /^data:/i.test((line ?? "").trim());
  const isOkLine = (line) => /^ok\b/i.test((line ?? "").trim());
  /** Q0 telemetry lines normally include TEMP or RH; avoid matching BUILD-only `data:` lines to the Q0 collapse path. */
  const looksLikeQ0Data = (line) => /TEMP=/.test(line ?? "") || /\bRH=/.test(line ?? "");

  const Q1_META_KEYS = ["BUILD", "BUILDER", "BUILD_DATE"];
  function isQ1MetaOnlyParsed(parsed) {
    if (!parsed || typeof parsed !== "object") return false;
    const keys = Object.keys(parsed);
    return keys.length > 0 && keys.every((k) => Q1_META_KEYS.includes(k));
  }

  function upsertCollapsedQ0(ts = new Date().toLocaleTimeString()) {
    const last = logs[logs.length - 1];
    if (last?.type === "info" && last?.message === "[ ... ]") {
      logs = [...logs.slice(0, -1), { ...last, timestamp: ts }];
      return;
    }
    logs = [
      ...logs,
      {
        message: "[ ... ]",
        type: "info",
        timestamp: ts,
      },
    ];
    if (logs.length > SERIAL_LOG_MAX_LINES) logs = logs.slice(-SERIAL_LOG_MAX_LINES);
  }

  const buildDisplayLogs = (allLogs) => {
    const base = showKeepalives ? allLogs : allLogs.filter((l) => !isKeepalive(l));
    if (showUpdates) return base;

    const out = [];
    for (let i = 0; i < base.length; i++) {
      const log = base[i];

      // Collapse: TX Q0 + RX data + RX ok  =>  [ ... ]
      if (isQ0Tx(log) && isQ0RxData(base[i + 1]) && isRxOk(base[i + 2])) {
        const endTs =
          base[i + 2]?.timestamp ?? base[i + 1]?.timestamp ?? log.timestamp;
        const last = out[out.length - 1];
        if (last?.type === "info" && last?.message === "[ ... ]") {
          last.timestamp = endTs;
        } else {
          out.push({ timestamp: endTs, type: "info", message: "[ ... ]" });
        }
        i += 2;
        continue;
      }

      out.push(log);
    }
    return out;
  };

  $: displayLogs = buildDisplayLogs(logs);

  /**
   * Extract commit hash from build version string.
   * Format: v1.0-27-g1bb9088-dirty -> extracts "1bb9088"
   * Finds the 'g' and extracts everything after it up to the next '-' (if any).
   */
  function extractCommitHash(buildVersion) {
    if (typeof buildVersion !== "string") return null;
    const gIndex = buildVersion.indexOf("g");
    if (gIndex === -1) return null;
    const afterG = buildVersion.slice(gIndex + 1);
    const dashIndex = afterG.indexOf("-");
    return dashIndex === -1 ? afterG : afterG.slice(0, dashIndex);
  }

  /** Always string for UI / extractCommitHash; controller may send numeric-looking tags. */
  $: buildVersion =
    telemetry?.BUILD == null || telemetry?.BUILD === ""
      ? null
      : String(telemetry.BUILD);
  $: buildCommitHash = extractCommitHash(buildVersion);
  $: builderName = telemetry?.BUILDER ?? null;
  $: buildDateSec = telemetry?.BUILD_DATE ?? null;
  $: buildDateText =
    typeof buildDateSec === "number" && Number.isFinite(buildDateSec)
      ? new Date(buildDateSec * 1000).toLocaleString()
      : null;
  $: buildIsDirty = typeof buildVersion === "string" && buildVersion.includes("-dirty");
  $: q1Complete = q1BuildDone && q1BuilderDone && q1BuildDateDone;

  let dirtyWarningShown = false;
  $: if (buildIsDirty && q1Complete && !dirtyWarningShown) {
    dirtyWarningShown = true;
    showWarning("WARNING: Build is dirty! Download the latest build from", {
      linkUrl: "https://github.com/Team-Thermocline/Controller/releases/latest",
      linkText: "here",
    });
  }

  let bufferWarningShown = false;
  $: if (commandQueueLength >= MAX_QUEUE && !bufferWarningShown) {
    bufferWarningShown = true;
    showWarning(
      `Command queue saturated (${MAX_QUEUE}). Oldest pending commands may be dropped until the device catches up.`
    );
  }

  // For debug table polling
  let lastPolledByKey = {};
  let lastFaultWarned = null;

  function applyParsedTelemetry(parsed) {
    if (!parsed) return;

    if (Object.prototype.hasOwnProperty.call(parsed, "BUILD")) q1BuildDone = true;
    if (Object.prototype.hasOwnProperty.call(parsed, "BUILDER")) q1BuilderDone = true;
    if (Object.prototype.hasOwnProperty.call(parsed, "BUILD_DATE")) q1BuildDateDone = true;

    // Update last polled by key
    const now = Date.now();
    const updates = Object.fromEntries(Object.keys(parsed).map((k) => [k, now]));
    lastPolledByKey = { ...lastPolledByKey, ...updates };

    telemetry = {
      ...telemetry,
      ...parsed,
    };

    syncTdr1CoolPoll();
    syncCtStandbyHeatPoll();

    // Show warning if FAULT is not NONE
    if (Object.prototype.hasOwnProperty.call(parsed, "FAULT")) {
      const f = normalizeFaultString(parsed.FAULT);
      if (f && f.toUpperCase() !== "NONE" && f !== lastFaultWarned) {
        lastFaultWarned = f;
        showWarning("FAULT! " + f);
      }
      if (f.toUpperCase() === "NONE") lastFaultWarned = null;
    }

    // Record time-series samples when Q0 telemetry arrives
    if (Object.prototype.hasOwnProperty.call(parsed, "TEMP") || Object.prototype.hasOwnProperty.call(parsed, "RH")) {
      const tempC = telemetry?.TEMP;
      const setTempC = telemetry?.SET_TEMP;
      const rh = telemetry?.RH;
      if (typeof tempC === "number" && Number.isFinite(tempC) && typeof rh === "number" && Number.isFinite(rh)) {
        const next = {
          t: Date.now(),
          tempC,
          setTempC: typeof setTempC === "number" && Number.isFinite(setTempC) ? setTempC : null,
          rh,
        };
        if (recordAllTdrTemps) {
          next.tdrC = TDR_TEMPERATURE_KEYS.map((k) => {
            const v = telemetry[k];
            return typeof v === "number" && Number.isFinite(v) ? v : null;
          });
        }
        samples = [...samples, next];
        if (samples.length > 50_000) samples = samples.slice(-50_000);
      }
    }
  }

  $: monkStatusLabel = isMonkTemperatureAlert(telemetry) ? "MONK!" : "";

  $: statusStates = computeStatusStates({
    serialConnected,
    hasReceivedGoodRx,
    lastConnectionError,
    commandQueueLength,
    telemetry,
    testMode: TEST_MODE,
    q1BuildDone,
    q1BuilderDone,
    q1BuildDateDone,
  });
  // Either green is ready state! 
  $: readyGreen = statusStates?.ready === "green" || statusStates?.ready === "blink-green";
  // Allow user input when connected (or when test mode is enabled)
  $: isUserInputAllowed = serialConnected || TEST_MODE;

  async function handleStatusActivate(key) {
    if (key === "connection") {
      if (serialLinkUp) await disconnect();
      else await connect();
      return;
    }
    if (key === "test") {
      const turningOn = !TEST_MODE;
      TEST_MODE = !TEST_MODE;
      if (turningOn) musicAlerts?.playTestModeFault?.();
      showWarning("WARNING: Test mode is now " + (TEST_MODE ? "ON" : "OFF")); // Shows you the test warning
      return;
    }
    if (key === "fault") {
      showWarning("Not implemented yet! Sorry!");
    }
  }

  function updateStickiness() {
    stickToBottom = computeStickToBottom(terminalEl, 30);
  }

  afterUpdate(() => {
    if (!terminalEl) return;
    if (stickToBottom) {
      scrollToBottom(terminalEl);
    }
  });

  function startQueryPolling() {
    stopQueryPolling();
    const ms = Math.max(
      Q0_QUERY_INTERVAL_MIN_MS,
      Math.min(Q0_QUERY_INTERVAL_MAX_MS, Number(queryIntervalMs) || DEFAULT_Q0_QUERY_INTERVAL_MS)
    );
    queryInterval = setInterval(() => {
      sendTcode(buildQueryCommand());
    }, ms);
  }

  function setQueryIntervalMs(ms) {
    const val = Math.max(
      Q0_QUERY_INTERVAL_MIN_MS,
      Math.min(Q0_QUERY_INTERVAL_MAX_MS, Math.round(Number(ms)) || DEFAULT_Q0_QUERY_INTERVAL_MS)
    );
    queryIntervalMs = val;
    if (serialLinkUp) startQueryPolling();
  }

  function stopQueryPolling() {
    if (queryInterval) {
      clearInterval(queryInterval);
      queryInterval = null;
    }
  }

  function stopTdrPoll() {
    if (tdrPollInterval) {
      clearInterval(tdrPollInterval);
      tdrPollInterval = null;
    }
  }

  function stopTdr1CoolPoll() {
    if (tdr1CoolPollInterval) {
      clearInterval(tdr1CoolPollInterval);
      tdr1CoolPollInterval = null;
    }
    tdr1CoolPollActive = false;
  }

  /** Start/stop ~20s Q1 TDR1 only when COOL_FAST / COOL_SLOW */
  function syncTdr1CoolPoll() {
    const want = serialConnected && isCoolFastOrSlowState(telemetry);
    if (want === tdr1CoolPollActive) return;
    stopTdr1CoolPoll();
    if (!want) return;
    tdr1CoolPollActive = true;
    const tick = () => {
      if (!serialConnected || !isCoolFastOrSlowState(telemetry)) {
        stopTdr1CoolPoll();
        return;
      }
      sendTcode("Q1 TDR1_TEMPERATURE_C");
    };
    tick();
    tdr1CoolPollInterval = setInterval(tick, Q1_TDR1_COOL_POLL_MS);
  }

  function stopCtStandbyHeatPoll() {
    if (ctStandbyHeatPollInterval) {
      clearInterval(ctStandbyHeatPollInterval);
      ctStandbyHeatPollInterval = null;
    }
    ctStandbyHeatPollActive = false;
  }

  /** ~20s Q1 CT1 + CT2 while standby or heating (EXHAUST indicator). */
  function syncCtStandbyHeatPoll() {
    const want = serialConnected && isStandbyOrHeatingState(telemetry);
    if (want === ctStandbyHeatPollActive) return;
    stopCtStandbyHeatPoll();
    if (!want) return;
    ctStandbyHeatPollActive = true;
    const tick = () => {
      if (!serialConnected || !isStandbyOrHeatingState(telemetry)) {
        stopCtStandbyHeatPoll();
        return;
      }
      sendTcode("Q1 CT1_AMPS");
      sendTcode("Q1 CT2_AMPS");
    };
    tick();
    ctStandbyHeatPollInterval = setInterval(tick, Q1_CT_STANDBY_HEAT_POLL_MS);
  }

  /** Q1 TDR temperature keys at the same cadence as Q0 (graph update interval). */
  $: {
    stopTdrPoll();
    if (serialLinkUp && recordAllTdrTemps) {
      const ms = Math.max(
        Q0_QUERY_INTERVAL_MIN_MS,
        Math.min(Q0_QUERY_INTERVAL_MAX_MS, Number(queryIntervalMs) || DEFAULT_Q0_QUERY_INTERVAL_MS)
      );
      const tick = () => {
        for (const key of TDR_TEMPERATURE_KEYS) {
          sendTcode(`Q1 ${key}`);
        }
      };
      tick();
      tdrPollInterval = setInterval(tick, ms);
    }
  }

  async function sendTcode(command) {
    if (!serialLinkUp || !commandQueue) return;
    try {
      await commandQueue.send(command);
    } catch (err) {
      if (err?.dropped) return;
      if ((err?.message || "").toLowerCase().includes("device has been lost")) {
        lastConnectionError = err?.message || String(err);
      }
      addLog(err?.message ?? "Send error", "error");
    }
  }

  function clearBuildMetadataRetries() {
    for (const id of buildMetadataRetryTimeouts) {
      clearTimeout(id);
    }
    buildMetadataRetryTimeouts = [];
  }

  /** Re-request Q1 build fields if still empty (first reply after connect is sometimes lost). */
  async function refreshQ1BuildMetadataIfMissing() {
    if (!serialLinkUp || !commandQueue) return;
    try {
      const b = telemetry?.BUILD;
      if (b == null || b === "") await sendTcode("Q1 BUILD");
      const br = telemetry?.BUILDER;
      if (br == null || br === "") await sendTcode("Q1 BUILDER");
      const bd = telemetry?.BUILD_DATE;
      if (bd == null || bd === "") await sendTcode("Q1 BUILD_DATE");
    } catch {
      /* ignore */
    }
  }

  function scheduleBuildMetadataRetries() {
    clearBuildMetadataRetries();
    buildMetadataRetryTimeouts = [
      setTimeout(() => void refreshQ1BuildMetadataIfMissing(), 2000),
      setTimeout(() => void refreshQ1BuildMetadataIfMissing(), 5500),
    ];
  }

  async function finalizeElectronSerialSession(portPath) {
    if (typeof window === "undefined" || !window.electronSerial) return;
    if (electronSerialBridged) return;

    lastConnectionError = null;
    hasReceivedGoodRx = false;
    q1BuildDone = false;
    q1BuilderDone = false;
    q1BuildDateDone = false;
    lineProcessor.reset();
    commandQueueLength = 0;
    commandQueue = createCommandQueue(
      (cmd) => window.electronSerial.write(cmd).then((r) => r?.success === true),
      {
        onSend(cmd) {
          if (isQ0Command(cmd)) {
            pendingQ0 = 1;
            pendingQ0StartedAt = Date.now();
          }
          if (!showUpdates && isQ0Command(cmd)) upsertCollapsedQ0();
          else addLog(`TX: ${cmd}`, "tx");
        },
        onQueueChange(n) {
          commandQueueLength = n;
        },
      },
    );
    const pathNote = portPath ? ` on ${portPath}` : "";
    addLog(`Connected (Electron)${pathNote} at ${baudRate} baud`, "success");
    serialConnected = true;
    electronSerialBridged = true;
    await runQ1StartupQueries();
    startQueryPolling();
    scheduleBuildMetadataRetries();
    if (electronPollTimer != null) {
      clearInterval(electronPollTimer);
      electronPollTimer = null;
    }
  }

  async function connect() {
    lastConnectionError = null;
    hasReceivedGoodRx = false;
    q1BuildDone = false;
    q1BuilderDone = false;
    q1BuildDateDone = false;
    serialConnected = false;
    electronSerialBridged = false;
    addLog("Requesting serial port...", "info");

    if (typeof window !== "undefined" && window.electronSerial) {
      const r = await window.electronSerial.connect(baudRate);
      if (r?.success) {
        await finalizeElectronSerialSession(r.port);
        return;
      }
      addLog(r?.error ?? "Electron serial connect failed", "error");
      return;
    }

    const success = await serial.connect(baudRate, handleSerialData, (err) => {
      addLog(`Connection error: ${err}`, "error");
      lastConnectionError = err;
    });

    if (success) {
      lineProcessor.reset();
      commandQueueLength = 0;
      commandQueue = createCommandQueue(
        (cmd) => serial.write(cmd),
        {
          onSend(cmd) {
            if (isQ0Command(cmd)) {
              pendingQ0 = 1;
              pendingQ0StartedAt = Date.now();
            }
            if (!showUpdates && isQ0Command(cmd)) upsertCollapsedQ0();
            else addLog(`TX: ${cmd}`, "tx");
          },
          onQueueChange(n) {
            commandQueueLength = n;
          },
        }
      );
      addLog(`Connected at ${baudRate} baud`, "success");
      serialConnected = true;
      await runQ1StartupQueries();
      startQueryPolling();
      scheduleBuildMetadataRetries();
      syncTdr1CoolPoll();
      syncCtStandbyHeatPoll();
    } else {
      addLog("Connection failed", "error");
    }
  }

  function handleSerialData(text, rawBytes) {
    const lines = lineProcessor.push(text, rawBytes);
    for (const line of lines) {
      commandQueue?.onLine(line);

      // Q1 build metadata must never be swallowed by the Q0 collapse path (showUpdates off + pendingQ0).
      const metaParsed = parseLooseTelemetryLine(line);
      if (isQ1MetaOnlyParsed(metaParsed)) {
        applyParsedTelemetry(metaParsed);
        hasReceivedGoodRx = true;
        addLog(`RX: ${line}`, "rx");
        continue;
      }

      // If Q0 updates are hidden, collapse "data:" + "ok" that follow a Q0.
      if (!showUpdates && pendingQ0 > 0) {
        // expire a stuck pending Q0 so we don't swallow other traffic forever
        if (pendingQ0StartedAt && Date.now() - pendingQ0StartedAt > PENDING_Q0_LINE_TIMEOUT_MS) {
          pendingQ0 = 0;
          pendingQ0StartedAt = 0;
        }

        if (isDataLine(line) && looksLikeQ0Data(line)) {
          pendingQ0 = 2;
          applyParsedTelemetry(parseLooseTelemetryLine(line));
          upsertCollapsedQ0();
          continue;
        }
        if (pendingQ0 === 2 && isOkLine(line)) {
          pendingQ0 = 0;
          pendingQ0StartedAt = 0;
          upsertCollapsedQ0();
          continue;
        }
      }

      applyParsedTelemetry(parseLooseTelemetryLine(line));
      hasReceivedGoodRx = true;
      addLog(`RX: ${line}`, "rx");
    }
  }

  async function disconnect() {
    clearBuildMetadataRetries();
    stopQueryPolling();
    stopTdrPoll();
    stopTdr1CoolPoll();
    stopCtStandbyHeatPoll();
    commandQueue = null;
    commandQueueLength = 0;
    lastConnectionError = null;
    hasReceivedGoodRx = false;
    serialConnected = false;
    if (electronSerialBridged && typeof window !== "undefined" && window.electronSerial) {
      await window.electronSerial.disconnect();
    }
    electronSerialBridged = false;
    await serial.disconnect();
    pendingQ0 = 0;
    pendingQ0StartedAt = 0;
    dirtyWarningShown = false;
    bufferWarningShown = false;
    lastFaultWarned = null;
    addLog("Disconnected", "info");
  }

  function addLog(message, type = "info") {
    logs = [
      ...logs,
      {
        message,
        type,
        timestamp: new Date().toLocaleTimeString(),
      },
    ];
    if (logs.length > SERIAL_LOG_MAX_LINES) {
      logs = logs.slice(-SERIAL_LOG_MAX_LINES);
    }
  }

  function clearLogs() {
    // Clear out text logs
    logs = [];
    // Clear out samples from graph
    samples = [];
  }

  async function sendManual() {
    if (!isUserInputAllowed) {
      addLog("Input not allowed", "error");
      return;
    }
    if (!serialLinkUp) {
      addLog("Not connected", "error");
      return;
    }
    const cmd = (manualCommand ?? "").trim();
    if (!cmd) return;
    await sendTcode(cmd);
    manualCommand = "";
  }

  async function setTemperature() {
    if (!isUserInputAllowed) {
      addLog("Input not allowed", "error");
      return;
    }
    if (!serialLinkUp) {
      addLog("Not connected", "error");
      return;
    }

    const raw = parseFloat(temperature);
    if (isNaN(raw)) {
      addLog("Invalid temperature value", "error");
      return;
    }

    try {
      const tempCToSend = showFahrenheit ? fToC(raw) : raw;
      const command = buildTemperatureCommand(tempCToSend);
      await sendTcode(command);
    } catch (err) {
      addLog(`Send error: ${err.message}`, "error");
    }
  }

  async function onTempNumpadDone(e) {
    temperature = e.detail.value;
    tempNumpadOpen = false;
    await setTemperature();
  }

  async function runQ1StartupQueries() {
    try {
      await sendTcode("Q1 BUILD");
      await sendTcode("Q1 BUILDER");
      await sendTcode("Q1 BUILD_DATE");
      // First BUILD reply is occasionally dropped right after link-up; ask again after a short pause.
      await new Promise((r) => setTimeout(r, 400));
      await sendTcode("Q1 BUILD");
    } catch {
      addLog("Q1 startup queries failed", "error");
    }
  }

  function stopModes() {
    if (!isUserInputAllowed) {
      addLog("Input not allowed", "error");
      return;
    }
    if (!serialLinkUp) {
      addLog("Not connected", "error");
      return;
    }
    
    // Send M0 to stop the machine
    sendTcode(buildM0Command());
  }

  async function resetModes() {
    if (!isUserInputAllowed) {
      addLog("Input not allowed", "error");
      return;
    }
    if (!serialLinkUp) {
      addLog("Not connected", "error");
      return;
    }
    
    // Send M2 to reset the machine
    sendTcode(buildM2Command());
  }

  onMount(() => {
    if (typeof window === "undefined" || !window.electronSerial) return;

    window.electronSerial.onData((data) => handleSerialData(data));
    window.electronSerial.onError((err) => {
      const msg = typeof err === "string" ? err : String(err);
      lastConnectionError = msg;
      addLog(`Serial error: ${msg}`, "error");
    });
    window.electronSerial.onAutoConnected((portPath) => void finalizeElectronSerialSession(portPath));

    const stopElectronPoll = () => {
      if (electronPollTimer != null) {
        clearInterval(electronPollTimer);
        electronPollTimer = null;
      }
    };

    const tick = async () => {
      if (electronSerialBridged) {
        stopElectronPoll();
        return;
      }
      try {
        if (await window.electronSerial.isConnected()) {
          void finalizeElectronSerialSession(null);
          stopElectronPoll();
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    electronPollTimer = setInterval(tick, 400);
    // Main auto-connect can lag the UI (late /dev/ttyAMA2, EBUSY after systemd restart); do not stop at 20s.
    setTimeout(stopElectronPoll, 180000);
  });

  onDestroy(() => {
    clearBuildMetadataRetries();
    if (electronPollTimer != null) {
      clearInterval(electronPollTimer);
      electronPollTimer = null;
    }
  });
</script>

<Music bind:this={musicAlerts} telemetry={telemetry} enabled={audioAlertsEnabled} />

<div class="sender" class:kiosk={isKiosk}>
  <div class="content">
      <div class="top-row">
      <div class="box connection">
        <div class="box-title">Connection</div>

        <div class="field">
          <label>
            Baud Rate
            <select bind:value={baudRate} disabled={serialLinkUp}>
              {#each baudRates as rate}
                <option value={rate}>{rate}</option>
              {/each}
            </select>
          </label>
        </div>

        <div class="button-row">
          {#if !serialLinkUp}
            <button on:click={connect}>Connect</button>
          {:else}
            <button on:click={disconnect}>Disconnect</button>
          {/if}
          <button on:click={clearLogs}>Clear Log</button>
        </div>

        <div class="toggles">
          <label>
            <input type="checkbox" bind:checked={showFahrenheit} />
            Display °F
          </label>
          {#if !isKiosk}
            <label>
              <input type="checkbox" bind:checked={showKeepalives} />
              Show keepalives (.)
            </label>
            <label>
              <input type="checkbox" bind:checked={showUpdates} />
              Show updates (Q0 ...)
            </label>
            <label>
              <input type="checkbox" bind:checked={audioAlertsEnabled} />
              Play audio alerts
            </label>
          {/if}

          <div class="build-info">
            <span class="build-info-label">Build</span>
            <span class="build-info-value build-version" class:dirty={buildIsDirty}>
              {#if buildVersion != null && buildVersion !== ""}
                <span
                  class="build-version-text"
                  title={"https://github.com/Team-Thermocline/Controller/commit/" +
                    (buildCommitHash ?? buildVersion)}
                >
                  {buildVersion}
                </span>
              {:else}
                N/A
              {/if}
            </span>
            <span class="build-info-label">Builder</span>
            <span class="build-info-value">{builderName ?? "N/A"}</span>
            <span class="build-info-label">Build date</span>
            <span class="build-info-value">{buildDateText ?? "N/A"}</span>
          </div>
        </div>
      </div>

      <div class="gauges">
        <div class="box">
          <Gauge
            label="Temperature"
            unit={tempUi.unit}
            theme="temp"
            min={tempUi.gaugeMin}
            max={tempUi.gaugeMax}
            value={tempUi.tempDisplay}
            setpoint={tempUi.setTempDisplay}
            setpointBand={tempUi.bandDisplay}
            debugForceNeedles={debugForceGaugeNeedles}
          >
            <div class="gauge-controls">
              {#if isKiosk}
                <button
                  type="button"
                  class="kiosk-temp-btn"
                  disabled={!isUserInputAllowed}
                  on:click={() => {
                    if (isUserInputAllowed) tempNumpadOpen = true;
                  }}
                >
                  {temperature !== "" && temperature != null
                    ? `${temperature} ${tempUi.unit}`
                    : `Set (${tempUi.unit})`}
                </button>
              {:else}
                <input
                  type="number"
                  bind:value={temperature}
                  placeholder={`Set (${tempUi.unit})`}
                  disabled={!isUserInputAllowed}
                  on:keydown={(e) => {
                    if (e.key === "Enter") setTemperature();
                  }}
                />
              {/if}
              <button on:click={setTemperature} disabled={!isUserInputAllowed}>Set</button>
            </div>
          </Gauge>
        </div>

        <div class="box">
          <Gauge
            label="Humidity"
            unit="%"
            theme="rh"
            min={0}
            max={100}
            value={telemetry?.RH}
            setpoint={telemetry?.SET_RH}
            setpointZone="under"
            debugForceNeedles={debugForceGaugeNeedles}
          />
        </div>
      </div>

      <div class="box status-panel">
        <StatusGrid
          states={statusStates}
          labelByKey={{ monk_mode: monkStatusLabel }}
          clickableKeys={["connection", "fault", "test"]}
          onCellActivate={handleStatusActivate}
        />
      </div>
    </div>

    <div class="graph-row">
      <div class="box graph">
        <Graph
          bind:recordAllTdrTemps
          samples={samples}
          showFahrenheit={showFahrenheit}
          telemetry={telemetry}
          lastPolledByKey={lastPolledByKey}
          sendTcode={sendTcode}
          queryIntervalMs={queryIntervalMs}
          setQueryIntervalMs={setQueryIntervalMs}
          isKiosk={isKiosk}
        />
      </div>

      <div class="power-stack">
        <div class="box">
          <Gauge
            label="Power"
            unit="W"
            theme="power"
            min={0}
            max={1600}
            value={telemetry?.POWER}
            debugForceNeedles={debugForceGaugeNeedles}
          />
        </div>
        <div class="box mode-controls">
          <div class="button-row">
            <button
              on:click={stopModes}
              disabled={!isUserInputAllowed}
              title="Set controller mode to STANDBY"
            >
              STOP
            </button>
            <button
              on:click={resetModes}
              disabled={!isUserInputAllowed}
              title="Tell the controller to reboot itself"
            >
              CONTROLLER RESET
            </button>
          </div>
        </div>
      </div>
    </div>

    {#if !isKiosk}
    <div class="box terminal">
      <div class="box-title">Terminal</div>
      <div class="terminal-shell">
        <div
          class="terminal-scroll"
          bind:this={terminalEl}
          on:scroll={updateStickiness}
        >
          {#each displayLogs as log}
            <div class="log-line">
              <span class="ts">[{log.timestamp}]</span>
              <span
                class="msg"
                style="color: {isKeepalive(log) ? '#666' : log.type === 'error' ? '#f00' : log.type === 'success' ? '#0f0' : log.type === 'rx' ? '#0ff' : '#fff'}"
              >
                {log.message}
              </span>
            </div>
          {/each}
        </div>

        <div class="terminal-input">
          <input
            class="manual"
            placeholder="Type a command and press Enter (e.g. Q0*61)"
            bind:value={manualCommand}
            disabled={!isUserInputAllowed}
            on:keydown={(e) => {
              if (e.key === "Enter") sendManual();
            }}
          />
          <button on:click={sendManual} disabled={!isUserInputAllowed}>Send</button>
        </div>
      </div>
    </div>
    {/if}
  </div>

  <KioskNumpad
    bind:open={tempNumpadOpen}
    title={`Set temperature (${tempUi.unit})`}
    initialValue={temperature}
    allowDecimal={true}
    allowNegative={true}
    on:done={onTempNumpadDone}
    on:cancel={() => (tempNumpadOpen = false)}
  />
</div>
