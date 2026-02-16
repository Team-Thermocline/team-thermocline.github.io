<script>
  import { afterUpdate } from "svelte";
  import "./Sender.css";
  import { buildQueryCommand, buildTemperatureCommand } from "./tcode.js";
  import { createLineProcessor, parseTelemetryLine } from "./rx.js";
  import { createSerialConnection } from "./serial.js";
  import { fToC, getTempUiModel } from "./temp.js";
  import { computeStickToBottom, scrollToBottom } from "./terminalScroll.js";
  import Gauge from "./Gauge.svelte";
  import StatusGrid from "./StatusGrid.svelte";
  import Graph from "./Graph.svelte";
  import { computeStatusStates } from "./statusGridState.js";
  import { createCommandQueue } from "./commandQueue.js";

  let serial = createSerialConnection();
  let baudRate = 115200;
  let logs = [];
  let temperature = "";
  let showKeepalives = false;
  let showUpdates = false;
  let lineProcessor = createLineProcessor();
  let queryInterval = null;
  let commandQueue = null;
  let telemetry = null;
  let manualCommand = "";

  // UI and Terminal state vars
  let terminalEl = null;
  let stickToBottom = true;
  let showFahrenheit = false;
  let lastConnectionError = null;
  let hasReceivedGoodRx = false;
  let TEST_MODE = false;
  let q1BuildDone = false;
  let q1BuilderDone = false;
  let q1BuildDateDone = false;
  let samples = []; // [{ t, tempC, setTempC, rh }]

  const TEMP_BAND_C = 3;
  $: tempUi = getTempUiModel({
    telemetry,
    showFahrenheit,
    minC: -50,
    maxC: 80,
    bandC: TEMP_BAND_C,
  });
  $: debugForceGaugeNeedles = TEST_MODE;

  const baudRates = [9600, 19200, 38400, 57600, 115200];
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
  const looksLikeQ0Data = (line) =>
    /TEMP=|RH=|HEAT=|COOL=|STATE=|SET_TEMP=|SET_RH=|ALARM=/i.test(line ?? "");

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
    if (logs.length > 1000) logs = logs.slice(-1000);
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

  $: buildVersion = telemetry?.BUILD ?? null;
  $: buildCommitHash = extractCommitHash(buildVersion);
  $: builderName = telemetry?.BUILDER ?? null;
  $: buildDateSec = telemetry?.BUILD_DATE ?? null;
  $: buildDateText =
    typeof buildDateSec === "number" && Number.isFinite(buildDateSec)
      ? new Date(buildDateSec * 1000).toLocaleString()
      : null;
  $: buildIsDirty = typeof buildVersion === "string" && buildVersion.includes("-dirty");
  $: q1Complete = q1BuildDone && q1BuilderDone && q1BuildDateDone;

  // For debug table polling
  let lastPolledByKey = {};

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
        samples = [...samples, next];
        if (samples.length > 50_000) samples = samples.slice(-50_000);
      }
    }
  }

  $: statusStates = computeStatusStates({
    serialConnected: serial.connected,
    hasReceivedGoodRx,
    lastConnectionError,
    telemetry,
    testMode: TEST_MODE,
    q1BuildDone,
    q1BuilderDone,
    q1BuildDateDone,
  });
  // Either green is ready state! 
  $: readyGreen = statusStates?.ready === "green" || statusStates?.ready === "blink-green";

  async function handleStatusActivate(key) {
    if (key === "connection") {
      if (serial.connected) await disconnect();
      else await connect();
      return;
    }
    if (key === "test") {
      TEST_MODE = !TEST_MODE;
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
    // send every 1 seconds
    queryInterval = setInterval(() => {
      sendTcode(buildQueryCommand());
    }, 1000); // TODO: Could make this configurable
  }

  function stopQueryPolling() {
    if (queryInterval) {
      clearInterval(queryInterval);
      queryInterval = null;
    }
  }

  async function sendTcode(command) {
    if (!serial.connected || !commandQueue) return;
    try {
      await commandQueue.send(command);
    } catch (err) {
      if ((err?.message || "").toLowerCase().includes("device has been lost")) {
        lastConnectionError = err?.message || String(err);
      }
      addLog(err?.message ?? "Send error", "error");
    }
  }

  async function connect() {
    lastConnectionError = null;
    hasReceivedGoodRx = false;
    q1BuildDone = false;
    q1BuilderDone = false;
    q1BuildDateDone = false;
    addLog("Requesting serial port...", "info");

    const success = await serial.connect(baudRate, handleSerialData, (err) => {
      addLog(`Connection error: ${err}`, "error");
      lastConnectionError = err;
    });

    if (success) {
      lineProcessor.reset();
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
        }
      );
      addLog(`Connected at ${baudRate} baud`, "success");
      startQueryPolling();
      runQ1StartupQueries();
    } else {
      addLog("Connection failed", "error");
    }
  }

  function handleSerialData(text, rawBytes) {
    const lines = lineProcessor.push(text, rawBytes);
    for (const line of lines) {
      commandQueue?.onLine(line);

      // If Q0 updates are hidden, collapse "data:" + "ok" that follow a Q0.
      if (!showUpdates && pendingQ0 > 0) {
        // expire a stuck pending Q0 so we don't swallow other traffic forever
        if (pendingQ0StartedAt && Date.now() - pendingQ0StartedAt > 5000) {
          pendingQ0 = 0;
          pendingQ0StartedAt = 0;
        }

        if (isDataLine(line) && looksLikeQ0Data(line)) {
          pendingQ0 = 2;
          applyParsedTelemetry(parseTelemetryLine(line));
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

      applyParsedTelemetry(parseTelemetryLine(line));
      hasReceivedGoodRx = true;
      addLog(`RX: ${line}`, "rx");
    }
  }

  async function disconnect() {
    stopQueryPolling();
    commandQueue = null;
    lastConnectionError = null;
    hasReceivedGoodRx = false;
    pendingQ0 = 0;
    pendingQ0StartedAt = 0;
    await serial.disconnect();
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
    // Keep last 1000 logs
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
  }

  function clearLogs() {
    logs = [];
  }

  async function sendManual() {
    const cmd = (manualCommand ?? "").trim();
    if (!cmd) return;
    await sendTcode(cmd);
    manualCommand = "";
  }

  async function setTemperature() {
    if (!readyGreen) {
      addLog("Not ready", "error");
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

  async function runQ1StartupQueries() {
    try {
      await sendTcode("Q1 BUILD");
      await sendTcode("Q1 BUILDER");
      await sendTcode("Q1 BUILD_DATE");
    } catch {
      addLog("Q1 startup queries failed", "error");
    }
  }
</script>

<div class="sender">
  <div class="content">
    <div class="top-row">
      <div class="box connection">
        <div class="box-title">Connection</div>

        <div class="field">
          <label>
            Baud Rate
            <select bind:value={baudRate} disabled={serial.connected}>
              {#each baudRates as rate}
                <option value={rate}>{rate}</option>
              {/each}
            </select>
          </label>
        </div>

        <div class="button-row">
          {#if !serial.connected}
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
          <label>
            <input type="checkbox" bind:checked={showKeepalives} />
            Show keepalives (.)
          </label>
          <label>
            <input type="checkbox" bind:checked={showUpdates} />
            Show updates (Q0 ...)
          </label>

          <div class="build-info">
            <span class="build-info-label">Build</span>
            <span class="build-info-value build-version" class:dirty={buildIsDirty}>
              {#if buildVersion}
                <a
                  href={"https://github.com/Team-Thermocline/Controller/commit/" + (buildCommitHash ?? buildVersion)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style="color:inherit;text-decoration:underline;"
                >
                  {buildVersion}
                </a>
              {:else}
                —
              {/if}
            </span>
            <span class="build-info-label">Builder</span>
            <span class="build-info-value">{builderName ?? "—"}</span>
            <span class="build-info-label">Build date</span>
            <span class="build-info-value">{buildDateText ?? "—"}</span>
          </div>
        </div>
      </div>

      <div class="gauges">
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
            <input
              type="number"
              bind:value={temperature}
              placeholder={`Set (${tempUi.unit})`}
              disabled={!readyGreen}
              on:keydown={(e) => {
                if (e.key === "Enter") setTemperature();
              }}
            />
            <button on:click={setTemperature} disabled={!readyGreen}>Set</button>
          </div>
        </Gauge>

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

      <div class="box status-panel">
        <StatusGrid
          states={statusStates}
          clickableKeys={["connection", "test"]}
          onCellActivate={handleStatusActivate}
        />
      </div>
    </div>

    <div class="box graph">
      <Graph samples={samples} showFahrenheit={showFahrenheit} telemetry={telemetry} lastPolledByKey={lastPolledByKey} sendTcode={sendTcode} />
    </div>

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
            disabled={!readyGreen}
            on:keydown={(e) => {
              if (e.key === "Enter") sendManual();
            }}
          />
          <button on:click={sendManual} disabled={!readyGreen}>Send</button>
        </div>
      </div>
    </div>
  </div>
</div>
