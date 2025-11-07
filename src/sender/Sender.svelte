<script>
  import "./sender.css";
  import { SCHEMA_VERSION, HOST_ID, parseJsonLine } from "./logic.js";

  let port = null;
  let reader = null;
  let writer = null;
  let connected = false;
  let logs = [];
  let command = "";
  let baudRate = 115200;
  let autoConnect = true;
  let showDataLogs = false;

  let handshakeState = "idle";
  let handshakeMessage = "Not connected";
  let handshakeComplete = false;
  let schemaError = false;
  let lastDataFrame = null;
  let lastDataTimestamp = null;
  let helloAckSent = false;

  $: if (autoConnect && !connected && navigator.serial) {
    connect();
  }

  async function connect() {
    try {
      if (!navigator.serial) {
        addLog(
          "Web Serial API not supported. Use Chrome/Edge/Firefox 89+",
          "error",
        );
        addLog("Firefox: Check about:config for dom.serial.enabled", "error");
        return;
      }

      addLog("Requesting serial port...", "info");
      port = await navigator.serial.requestPort();
      await port.open({ baudRate });

      reader = port.readable.getReader();
      writer = port.writable.getWriter();
      connected = true;

      addLog("Connected to serial port", "success");
      setStatus("waiting", "Waiting for hello...");
      resetHandshake({ resetAck: true });

      readLoop();
    } catch (err) {
      addLog(`Connection failed: ${err.message}`, "error");
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
      setStatus("idle", "Not connected");
      resetHandshake({ resetAck: true });
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

  async function sendCommand() {
    if (!connected || !writer) {
      addLog("Not connected", "error");
      return;
    }

    try {
      await writer.write(new TextEncoder().encode(command + "\n"));
      addLog(`TX -> ${command}`, "tx");
      command = "";
    } catch (err) {
      addLog(`Send error: ${err.message}`, "error");
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
  }

  function clearLogs() {
    logs = [];
  }

  function handleKeydown(event) {
    if (event.key === "Enter") {
      sendCommand();
    }
  }

  function resetHandshake(options = {}) {
    handshakeComplete = false;
    schemaError = false;
    lastDataFrame = null;
    lastDataTimestamp = null;
    if (options.resetAck) {
      helloAckSent = false;
    }
  }

  function setStatus(state, message) {
    handshakeState = state;
    handshakeMessage = message;
  }

  async function sendHelloAck() {
    // Can send a hello acknowledge
    if (!connected || !writer) {
      addLog("Cannot send hello_ack (not connected)", "error");
      return;
    }

    if (helloAckSent) {
      addLog("hello_ack already sent; ignoring repeat hello", "info");
      return;
    }

    helloAckSent = true;
    const payload = {
      type: "hello_ack",
      schema: SCHEMA_VERSION,
      host: HOST_ID,
      ts: Date.now(),
    };

    try {
      const text = JSON.stringify(payload);
      await writer.write(new TextEncoder().encode(text + "\n"));
      addLog(`TX -> ${text}`, "tx");
    } catch (err) {
      helloAckSent = false;
      addLog(`Send hello_ack failed: ${err.message}`, "error");
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
    const logThis = msgType !== "data" || showDataLogs;

    if (logThis) {
      addLog(`RX <- ${line}`, "rx");
    }

    // Handle hello message
    if (msgType === "hello") {
      handleHello(parsed);
      return;
    }

    // Handle error message
    if (msgType === "error") {
      schemaError = true;
      setStatus("error", parsed.message || "Firmware reported error");
      addLog(`ERROR: ${handshakeMessage}`, "error");
      helloAckSent = false;
      handshakeComplete = false;
      return;
    }

    if (msgType === "data") {
      const seq = parsed.seq ?? "—";
      const temp = parsed.temp ?? "—";
      if (showDataLogs) {
        addLog(`DATA seq=${seq} temp=${temp}`, "data");
      }
      lastDataFrame = parsed;
      lastDataTimestamp = new Date();
      handshakeComplete = true;
      setStatus("ok", `Receiving data (seq ${seq})`);
      return;
    }

    // Handle hello_ack message
    if (msgType === "hello_ack") {
      handshakeComplete = true;
      setStatus("ok", "Firmware acknowledged handshake");
      addLog("Device echoed hello_ack", "info");
      return;
    }

    addLog(`Unhandled message type '${msgType}'`, "info");
  }

  function handleHello(parsed) {
    const fw = parsed.fw ?? "unknown";
    const schema = parsed.schema ?? "unknown";
    addLog(`HELLO from fw ${fw} (schema ${schema})`, "hello");

    if (handshakeComplete) {
      addLog("Device initiated new handshake, resetting state", "info");
      resetHandshake({ resetAck: true });
    } else {
      resetHandshake();
    }
    setStatus("waiting", "hello received, replying...");

    if (schema !== SCHEMA_VERSION) {
      setStatus(
        "warning",
        `Schema mismatch: device ${schema}, host ${SCHEMA_VERSION}`,
      );
    }

    if (!helloAckSent) {
      sendHelloAck();
      if (schema === SCHEMA_VERSION) {
        setStatus("waiting", "hello_ack sent (waiting for data...)");
      }
    }
  }
</script>

<main class="container">
  <section class="content-block">
    <h2>Serial Console</h2>
    <p>Connect to your thermal chamber controller via serial port.</p>

    <div class="warning">
      <strong>⚠️ Browser Compatibility:</strong> This tool works best in Chrome/Edge.
      Firefox support varies by version.
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
        <label>
          <input type="checkbox" bind:checked={showDataLogs} />
          Show data frames in log
        </label>
      </div>

      <div class="control-row">
        {#if !connected}
          <button class="nav-btn" on:click={connect}>Connect</button>
        {:else}
          <button class="nav-btn" on:click={disconnect}>Disconnect</button>
        {/if}
        <button class="nav-btn" on:click={clearLogs}>Clear Logs</button>
      </div>

      <div class="status-bar">
        <span class={`status-dot status-${handshakeState}`}></span>
        <span class="status-text">{handshakeMessage}</span>
      </div>
    </div>

    <div class="console">
      <div class="console-output">
        {#each logs as log}
          <div class={`log-entry log-${log.type}`}>
            <span class="log-time">[{log.timestamp}]</span>
            <span class="log-message">{log.message}</span>
          </div>
        {/each}
      </div>

      <div class="console-input">
        <input
          type="text"
          bind:value={command}
          on:keydown={handleKeydown}
          placeholder="Enter command..."
          disabled={!connected}
        />
        <button
          class="nav-btn"
          on:click={sendCommand}
          disabled={!connected || !command.trim()}
        >
          Send
        </button>
      </div>
    </div>

    {#if lastDataFrame}
      <section class="data-panel">
        <h3>Latest Data</h3>
        <div class="data-grid">
          <div>
            <span class="data-label">Sequence</span>
            <span>{lastDataFrame.seq ?? "—"}</span>
          </div>
          <div>
            <span class="data-label">Temperature</span>
            <span>
              {lastDataFrame.temp ?? "—"}
              {lastDataFrame.temp !== undefined ? "°C" : ""}
            </span>
          </div>
          <div>
            <span class="data-label">Type</span>
            <span>{lastDataFrame.type ?? "data"}</span>
          </div>
          <div>
            <span class="data-label">Timestamp</span>
            <span>
              {lastDataTimestamp ? lastDataTimestamp.toLocaleTimeString() : "—"}
            </span>
          </div>
        </div>
        <pre class="data-json">{JSON.stringify(lastDataFrame, null, 2)}</pre>
      </section>
    {/if}
  </section>
</main>
