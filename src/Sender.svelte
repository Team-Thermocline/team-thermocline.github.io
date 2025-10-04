<script>
  let port = null
  let reader = null
  let writer = null
  let connected = false
  let logs = []
  let command = ''
  let baudRate = 115200
  let autoConnect = true

  // Auto-connect on page load
  $: if (autoConnect && !connected && navigator.serial) {
    connect()
  }

  async function connect() {
    try {
      if (!navigator.serial) {
        addLog('Web Serial API not supported. Use Chrome/Edge/Firefox 89+', 'error')
        addLog('Firefox: Check about:config for dom.serial.enabled', 'error')
        return
      }
      
      addLog('Requesting serial port...', 'info')
      port = await navigator.serial.requestPort()
      await port.open({ baudRate })
      
      reader = port.readable.getReader()
      writer = port.writable.getWriter()
      connected = true
      
      addLog('Connected to serial port', 'success')
      
      // Start reading
      readLoop()
    } catch (err) {
      addLog(`Connection failed: ${err.message}`, 'error')
    }
  }

  async function disconnect() {
    try {
      if (reader) {
        reader.releaseLock()
        reader = null
      }
      if (writer) {
        writer.releaseLock()
        writer = null
      }
      if (port) {
        await port.close()
        port = null
      }
      connected = false
      addLog('Disconnected', 'info')
    } catch (err) {
      addLog(`Disconnect error: ${err.message}`, 'error')
    }
  }

  async function readLoop() {
    try {
      while (connected && reader) {
        const { value, done } = await reader.read()
        if (done) break
        
        const text = new TextDecoder().decode(value)
        addLog(`RX: ${text}`, 'rx')
      }
    } catch (err) {
      if (connected) {
        addLog(`Read error: ${err.message}`, 'error')
      }
    }
  }

  async function sendCommand() {
    if (!connected || !writer) {
      addLog('Not connected', 'error')
      return
    }
    
    try {
      await writer.write(new TextEncoder().encode(command + '\r\n'))
      addLog(`TX: ${command}`, 'tx')
      command = ''
    } catch (err) {
      addLog(`Send error: ${err.message}`, 'error')
    }
  }

  function addLog(message, type = 'info') {
    logs = [...logs, { 
      message, 
      type, 
      timestamp: new Date().toLocaleTimeString() 
    }]
    // Keep last 100 logs
    if (logs.length > 100) {
      logs = logs.slice(-100)
    }
  }

  function clearLogs() {
    logs = []
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') {
      sendCommand()
    }
  }
</script>

<main class="container">
  <section class="content-block">
    <h2>Serial Console</h2>
    <p>Connect to your thermal chamber controller via serial port.</p>
    
    <div class="warning">
      <strong>⚠️ Browser Compatibility:</strong> This tool works best in Chrome/Edge. Firefox support varies by version.
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
      </div>
    </div>

    <div class="console">
      <div class="console-output">
        {#each logs as log}
          <div class="log-entry log-{log.type}">
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
        <button class="nav-btn" on:click={sendCommand} disabled={!connected || !command.trim()}>
          Send
        </button>
      </div>
    </div>
  </section>
</main>

<style>
  .serial-controls {
    margin: 16px 0;
    padding: 16px;
    background: #0c0f13;
    border: 4px solid var(--edge);
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .control-row:last-child {
    margin-bottom: 0;
  }

  label {
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  select {
    background: var(--blue-700);
    color: var(--text);
    border: 4px solid var(--edge);
    padding: 6px 8px;
  }

  .console {
    margin-top: 16px;
    border: 4px solid var(--edge);
    background: #0c0f13;
  }

  .console-output {
    height: 300px;
    overflow-y: auto;
    padding: 8px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
  }

  .log-entry {
    margin-bottom: 2px;
    display: flex;
    gap: 8px;
  }

  .log-time {
    color: var(--muted);
    flex-shrink: 0;
  }

  .log-message {
    color: var(--text);
  }

  .log-success { color: #4caf50; }
  .log-error { color: #f44336; }
  .log-tx { color: #2196f3; }
  .log-rx { color: #ff9800; }

  .console-input {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-top: 4px solid var(--edge);
  }

  .console-input input {
    flex: 1;
    background: var(--blue-700);
    color: var(--text);
    border: 4px solid var(--edge);
    padding: 8px;
    font-family: 'Courier New', monospace;
  }

  .console-input input:disabled {
    opacity: 0.5;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .warning {
    background: #2d1b1b;
    border: 4px solid #c62828;
    padding: 12px;
    margin: 16px 0;
    color: var(--text);
  }

  .warning strong {
    color: #ff6b6b;
  }
</style>
