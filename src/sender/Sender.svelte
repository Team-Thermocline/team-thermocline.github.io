<script>
  let port = null;
  let reader = null;
  let writer = null;
  let connected = false;
  let baudRate = 115200;
  let logs = [];

  const baudRates = [9600, 19200, 38400, 57600, 115200];

  async function connect() {
    try {
      if (!navigator.serial) {
        addLog("Web Serial API not supported. Use Chrome/Edge.", "error");
        return;
      }

      addLog("Requesting serial port...", "info");
      port = await navigator.serial.requestPort();
      await port.open({ baudRate });

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
      if (reader) {
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
      connected = false;
      addLog("Disconnected", "info");
    } catch (err) {
      addLog(`Disconnect error: ${err.message}`, "error");
    }
  }

  async function readLoop() {
    const decoder = new TextDecoder();
    let buffer = "";
    
    try {
      while (connected && reader) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (line) {
            addLog(`RX: ${line}`, "rx");
          }
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
