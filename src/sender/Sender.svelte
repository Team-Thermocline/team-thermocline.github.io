<script>
  import { buildTemperatureCommand } from "./tcode.js";

  let port = null;
  let reader = null;
  let writer = null;
  let connected = false;
  let baudRate = 115200;
  let logs = [];
  let temperature = "";

  const baudRates = [9600, 19200, 38400, 57600, 115200];

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

      addLog(`Connected at ${baudRate} baud`, "success");
      readLoop();
    } catch (err) {
      addLog(`Connection failed: ${err.message}`, "error");
      connected = false;
    }
  }

  async function disconnect() {
    try {
      connected = false;
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
        
        const text = decoder.decode(value);
        addLog(`RX: ${text}`, "rx");
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
      await writer.write(new TextEncoder().encode(command + "\n"));
      addLog(`TX: ${command}`, "tx");
    } catch (err) {
      addLog(`Send error: ${err.message}`, "error");
    }
  }
</script>

<div>
  <h2>Serial Terminal</h2>

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
  </div>

  <div>
    <label>
      Temperature:
      <input type="number" bind:value={temperature} placeholder="Enter temperature" disabled={!connected} />
    </label>
    <button on:click={setTemperature} disabled={!connected}>Set Temperature</button>
  </div>

  <div>
    <h3>Terminal Log</h3>
    <div style="border: 1px solid #ccc; padding: 10px; height: 400px; overflow-y: auto; font-family: monospace; background: #000; color: #0f0;">
      {#each logs as log}
        <div>
          <span>[{log.timestamp}]</span>
          <span style="color: {log.type === 'error' ? '#f00' : log.type === 'success' ? '#0f0' : log.type === 'rx' ? '#0ff' : '#fff'}">
            {log.message}
          </span>
        </div>
      {/each}
    </div>
  </div>
</div>
