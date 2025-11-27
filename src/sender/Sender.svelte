<script>
  import "./sender.css";
  import { parseJsonLine } from "./logic.js";

  let port = null;
  let reader = null;
  let writer = null;
  let connected = false;
  let logs = [];
  let baudRate = 115200;
  let autoConnect = true;

  let status = null;
  let statusInterval = null;
  let pingInterval = null;
  let showConsole = true;
  let consoleOutput = null;

  $: if (autoConnect && !connected && navigator.serial) {
    connect();
  }

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

      addLog("Connected", "success");
      readLoop();
      startStatusPolling();
      // Send initial status request immediately
      sendCommand("get_status");
    } catch (err) {
      addLog(`Connection failed: ${err.message}`, "error");
    }
  }

  async function disconnect() {
    stopStatusPolling();
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
      status = null;
      showConsole = true; // Show console again on disconnect
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
          processIncomingLine(line);
        }
      }

      buffer = buffer.trim();
      if (buffer) {
        processIncomingLine(buffer);
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
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }
    // Auto-scroll to bottom
    setTimeout(() => {
      if (consoleOutput) {
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
      }
    }, 0);
  }

  // Auto-scroll when logs change
  $: if (logs.length > 0 && consoleOutput) {
    setTimeout(() => {
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }, 0);
  }

  function clearLogs() {
    logs = [];
  }

  async function sendCommand(cmdType, cmdData = {}) {
    if (!connected || !writer) {
      return false;
    }

    const payload = {
      type: cmdType,
      data: cmdData,
    };

    try {
      const text = JSON.stringify(payload);
      await writer.write(new TextEncoder().encode(text + "\n"));
      addLog(`TX -> ${text}`, "tx");
      return true;
    } catch (err) {
      addLog(`Send error: ${err.message}`, "error");
      return false;
    }
  }

  function startStatusPolling() {
    stopStatusPolling();
    // Poll status every 10 seconds
    statusInterval = setInterval(async () => {
      await sendCommand("get_status");
    }, 10000);
    // Also send initial ping
    sendCommand("ping");
    // Then ping every 10 seconds
    pingInterval = setInterval(async () => {
      await sendCommand("ping");
    }, 10000);
  }

  function stopStatusPolling() {
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }

  function processIncomingLine(line) {
    if (!line) return;

    const result = parseJsonLine(line);
    if (!result.ok) {
      addLog(`Invalid JSON: ${line}`, "error");
      return;
    }

    const parsed = result.value;
    const msgType = parsed?.type || "unknown";

    addLog(`RX <- ${line}`, "rx");

    // Handle reply messages
    if (msgType === "reply") {
      handleReply(parsed);
      return;
    }

    addLog(`Unhandled message type '${msgType}'`, "info");
  }

  function handleReply(parsed) {
    const replyData = parsed.data || {};
    const success = replyData.success ?? false;

    if (success && replyData.status !== undefined) {
      // This is a status reply
      const hadStatus = status !== null;
      status = {
        status: replyData.status || "unknown",
        uptime_ms: replyData.uptime_ms ?? 0,
        revision: replyData.revision || "unknown",
        build_date: replyData.build_date || "0",
      };
      addLog("Status received", "success");
      // Hide console once we first receive status
      if (!hadStatus) {
        showConsole = false;
      }
    } else if (success && replyData.message === "pong") {
      // This is a ping reply
      addLog("Pong received", "info");
    } else {
      addLog(`Reply: ${JSON.stringify(replyData)}`, "info");
    }
  }

  function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  function formatBuildDate(timestamp) {
    if (!timestamp || timestamp === "0") return "Unknown";
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleString();
  }
</script>

<main class="container">
  <section class="content-block">
    <h2>Controller Console</h2>
    <p>Connect to your thermal chamber controller via serial port.</p>

    <div class="warning">
      <strong>⚠️ Browser Compatibility:</strong> This tool works best in Chrome/Edge.
    </div>

    <div class="serial-controls">
      <div class="control-row">
        <label for="baud">Baud Rate:</label>
        <select id="baud" bind:value={baudRate} disabled={connected}>
          <option value="9600">9600</option>
          <option value="19200">19200</option>
          <option value="38400">38400</option>
          <option value="57600">57600</option>
          <option value="115200">115200</option>
        </select>
      </div>

      <div class="control-row">
        <label>
          <input type="checkbox" bind:checked={autoConnect} />
          Auto-connect on page load
        </label>
      </div>

      <div class="control-row">
        {#if !connected}
          <button class="nav-btn" on:click={connect}>Connect</button>
        {:else}
          <button class="nav-btn" on:click={disconnect}>Disconnect</button>
        {/if}
        <button class="nav-btn" on:click={clearLogs}>Clear Logs</button>
        <button class="nav-btn" on:click={() => (showConsole = !showConsole)}>
          {showConsole ? "Hide" : "Show"} Console
        </button>
      </div>

      {#if status}
        {@const statusClass = status.status.toLowerCase()}
        {@const isDirty = status.revision.toUpperCase().includes("DIRTY")}
        <div class="control-row">
          <span class="status-info">
            Status: <span class="status-value status-{statusClass}"
              >{status.status}</span
            >
          </span>
          <span>Uptime: {formatUptime(status.uptime_ms)}</span>
        </div>
        <div class="control-row">
          <span class="status-info">
            Revision: <span
              class="status-value revision-{isDirty ? 'dirty' : 'clean'}"
              >{status.revision}</span
            >
          </span>
          <span>Build: {formatBuildDate(status.build_date)}</span>
        </div>
      {/if}
    </div>

    {#if showConsole}
      <div class="console">
        <div class="console-output" bind:this={consoleOutput}>
          {#each logs as log}
            <div class={`log-entry log-${log.type}`}>
              <span class="log-time">[{log.timestamp}]</span>
              <span class="log-message">{log.message}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>
</main>
