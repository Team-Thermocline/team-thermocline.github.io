<script>
  import { afterUpdate } from "svelte";
  import { buildQueryCommand, buildTemperatureCommand } from "./tcode.js";
  import { createLineProcessor, parseTelemetryLine } from "./rx.js";
  import Gauge from "./Gauge.svelte";

  let port = null;
  let reader = null;
  let writer = null;
  let connected = false;
  let baudRate = 115200;
  let logs = [];
  let temperature = "";
  let showKeepalives = true;
  let lineProcessor = createLineProcessor();
  let queryInterval = null;
  let telemetry = null;
  let manualCommand = "";

  let terminalEl = null;
  let stickToBottom = true;

  const baudRates = [9600, 19200, 38400, 57600, 115200];
  const isKeepalive = (log) =>
    log?.type === "rx" && (log?.message || "").replace(/^RX:\s*/, "").trim() === ".";

  function updateStickiness() {
    if (!terminalEl) return;
    const distanceFromBottom =
      terminalEl.scrollHeight - terminalEl.scrollTop - terminalEl.clientHeight;
    stickToBottom = distanceFromBottom < 30;
  }

  afterUpdate(() => {
    if (!terminalEl) return;
    if (stickToBottom) {
      terminalEl.scrollTop = terminalEl.scrollHeight;
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

    const temp = parseFloat(temperature);
    if (isNaN(temp)) {
      addLog("Invalid temperature value", "error");
      return;
    }

    try {
      const command = buildTemperatureCommand(temp);
      await sendTcode(command);
    } catch (err) {
      addLog(`Send error: ${err.message}`, "error");
    }
  }
</script>

<div>
  <h2>Serial Terminal</h2>

  <div style="display: flex; gap: 12px; flex-wrap: wrap; margin: 10px 0;">
    <Gauge
      label="Temperature"
      unit="°C"
      min={0}
      max={100}
      value={telemetry?.TEMP}
      setpoint={telemetry?.SET_TEMP}
    />
    <Gauge
      label="Humidity"
      unit="%"
      min={0}
      max={100}
      value={telemetry?.RH}
      setpoint={telemetry?.SET_RH}
    />
  </div>

  <div>
    <label>
      Baud Rate:
      <select bind:value={baudRate} disabled={connected}>
        {#each baudRates as rate}
          <option value={rate}>{rate}</option>
        {/each}
      </select>
    </label>
  </div>

  <div>
    {#if !connected}
      <button on:click={connect}>Connect</button>
    {:else}
      <button on:click={disconnect}>Disconnect</button>
    {/if}
    <button on:click={clearLogs}>Clear Log</button>
    <label style="margin-left: 10px;">
      <input type="checkbox" bind:checked={showKeepalives} />
      Show keepalives (.)
    </label>
  </div>

  <div>
    <label>
      Temperature:
      <input type="number" bind:value={temperature} placeholder="Enter temperature" disabled={!connected} />
    </label>
    <button on:click={setTemperature} disabled={!connected}>Set Temperature</button>
  </div>

  <div style="border: 1px solid #ccc; padding: 10px; margin-top: 10px;">
    <strong>Latest Telemetry</strong>
    {#if telemetry}
      <div>Received: {telemetry._receivedAt}</div>
      <div>TEMP: {telemetry.TEMP}</div>
      <div>RH: {telemetry.RH}</div>
      <div>HEAT: {telemetry.HEAT}</div>
      <div>STATE: {telemetry.STATE}</div>
      <div>SET_TEMP: {telemetry.SET_TEMP}</div>
      <div>SET_RH: {telemetry.SET_RH}</div>
      <div>ALARM: {telemetry.ALARM}</div>
    {:else}
      <div>(waiting for data...)</div>
    {/if}
  </div>

  <div>
    <h3>Terminal Log</h3>
    <div
      style="border: 1px solid #ccc; height: 460px; display: flex; flex-direction: column; background: #000;"
    >
      <div
        bind:this={terminalEl}
        on:scroll={updateStickiness}
        style="padding: 10px; overflow-y: auto; flex: 1; font-family: monospace; color: #0f0;"
      >
        {#each (showKeepalives ? logs : logs.filter((l) => !isKeepalive(l))) as log}
          <div>
            <span>[{log.timestamp}]</span>
            <span
              style="color: {isKeepalive(log) ? '#666' : log.type === 'error' ? '#f00' : log.type === 'success' ? '#0f0' : log.type === 'rx' ? '#0ff' : '#fff'}"
            >
              {log.message}
            </span>
          </div>
        {/each}
      </div>

      <div style="display: flex; gap: 8px; padding: 10px; border-top: 1px solid #222;">
        <input
          style="flex: 1; font-family: monospace;"
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
