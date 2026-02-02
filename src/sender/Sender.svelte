<script>
  import { afterUpdate } from "svelte";
  import "./Sender.css";
  import { buildQueryCommand, buildTemperatureCommand } from "./tcode.js";
  import { createLineProcessor, parseTelemetryLine } from "./rx.js";
  import { fToC, getTempUiModel } from "./temp.js";
  import { computeStickToBottom, scrollToBottom } from "./terminalScroll.js";
  import Gauge from "./Gauge.svelte";

  let port = null;
  let reader = null;
  let writer = null;
  let connected = false;
  let baudRate = 115200;
  let logs = [];
  let temperature = "";
  let showKeepalives = false;
  let showUpdates = false;
  let lineProcessor = createLineProcessor();
  let queryInterval = null;
  let telemetry = null;
  let manualCommand = "";

  let terminalEl = null;
  let stickToBottom = true;
  let showFahrenheit = false;

  const TEMP_BAND_C = 3;
  $: tempUi = getTempUiModel({
    telemetry,
    showFahrenheit,
    minC: -50,
    maxC: 80,
    bandC: TEMP_BAND_C,
  });
  const debugForceGaugeNeedles = true;

  const baudRates = [9600, 19200, 38400, 57600, 115200];
  const isKeepalive = (log) =>
    log?.type === "rx" && (log?.message || "").replace(/^RX:\s*/, "").trim() === ".";

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
    if (!connected || !writer) return;
    try {
      await writer.write(new TextEncoder().encode(command + "\n"));
      addLog(`TX: ${command}`, "tx");
    } catch (err) {
      addLog(`Send error: ${err.message}`, "error");
    }
  }

  async function connect() {
    try {
      if (!navigator.serial) {
        addLog("Web Serial API not supported. Use Chrome/Edge.", "error");
        return;
      }

      addLog("Requesting serial port...", "info");
      port = await navigator.serial.requestPort();
      await port.open({ 
        baudRate: baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none"
      });

      // Just one tiny line! rp2040 default usb impl. RELIES on this.
      await port.setSignals({ dataTerminalReady: true, requestToSend: true });

      reader = port.readable.getReader();
      writer = port.writable.getWriter();
      connected = true;
      lineProcessor.reset();

      addLog(`Connected at ${baudRate} baud`, "success");
      startQueryPolling();
      readLoop();
    } catch (err) {
      addLog(`Connection failed: ${err.message}`, "error");
      connected = false;
    }
  }

  async function disconnect() {
    try {
      connected = false;
      stopQueryPolling();
      if (reader) {
        await reader.cancel();
        reader.releaseLock();
        reader = null;
      }
      if (writer) {
        writer.releaseLock();
        writer = null;
      }
      if (port) {
        await port.close();
        port = null;
      }
      addLog("Disconnected", "info");
    } catch (err) {
      addLog(`Disconnect error: ${err.message}`, "error");
    }
  }

  async function readLoop() {
    const decoder = new TextDecoder();
    
    try {
      while (connected && reader) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = lineProcessor.push(chunk);
        for (const line of lines) {
          const parsed = parseTelemetryLine(line);
          if (parsed) {
            telemetry = {
              ...telemetry,
              ...parsed,
              _receivedAt: new Date().toLocaleTimeString(),
            };
          }
          addLog(`RX: ${line}`, "rx");
        }
      }
    } catch (err) {
      if (connected) {
        addLog(`Read error: ${err.message}`, "error");
      }
    }
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
    if (!connected || !writer) {
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
</script>

<div class="sender">
  <div class="content">
    <div class="top-row">
      <div class="box connection">
        <div class="box-title">Connection</div>

        <div class="field">
          <label>
            Baud Rate
            <select bind:value={baudRate} disabled={connected}>
              {#each baudRates as rate}
                <option value={rate}>{rate}</option>
              {/each}
            </select>
          </label>
        </div>

        <div class="button-row">
          {#if !connected}
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
        </div>
      </div>

      <div class="gauges">
        <Gauge
          label="Temperature"
          unit={tempUi.unit}
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
              disabled={!connected}
            />
            <button on:click={setTemperature} disabled={!connected}>Set</button>
          </div>
        </Gauge>

        <Gauge
          label="Humidity"
          unit="%"
          min={0}
          max={100}
          value={telemetry?.RH}
          setpoint={telemetry?.SET_RH}
          setpointZone="under"
          debugForceNeedles={debugForceGaugeNeedles}
        />
      </div>
    </div>

    <div class="box graph">
      <div class="box-title">Graph</div>
      <div class="graph-placeholder">(JOE PUT A GRAPH HERE)</div>
    </div>

    <div class="box terminal">
      <div class="box-title">Terminal</div>
      <div class="terminal-shell">
        <div
          class="terminal-scroll"
          bind:this={terminalEl}
          on:scroll={updateStickiness}
        >
          {#each (showKeepalives ? logs : logs.filter((l) => !isKeepalive(l))) as log}
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
            disabled={!connected}
            on:keydown={(e) => {
              if (e.key === "Enter") sendManual();
            }}
          />
          <button on:click={sendManual} disabled={!connected || !manualCommand.trim()}>Send</button>
        </div>
      </div>
    </div>
  </div>
</div>
