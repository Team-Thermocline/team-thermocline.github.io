/**
 * Serial port connection and I/O handling
 * Supports both Web Serial API (browser) and Electron IPC (Electron)
 */

// Detect if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronSerial;

export function createSerialConnection() {
  let port = null;
  let reader = null;
  let writer = null;
  let connected = false;
  let dataHandler = null;
  let errorHandler = null;
  let autoConnectCallback = null;

  // Electron IPC handlers
  if (isElectron) {
    window.electronSerial.onData((data) => {
      if (connected && dataHandler) {
        // Convert string data to match Web Serial API format
        const encoder = new TextEncoder();
        const bytes = encoder.encode(data);
        dataHandler(data, bytes);
      }
    });

    window.electronSerial.onError((error) => {
      if (connected && errorHandler) {
        errorHandler(error);
      }
    });

    // Handle auto-connect notification
    window.electronSerial.onAutoConnected((portPath) => {
      console.log('Auto-connected to:', portPath);
      connected = true;
      if (autoConnectCallback) {
        autoConnectCallback(portPath);
      }
    });
  }

  return {
    get connected() {
      return connected;
    },

    setAutoConnectCallback(callback) {
      autoConnectCallback = callback;
    },

    async connect(baudRate, onData, onError) {
      dataHandler = onData;
      errorHandler = onError;

      if (isElectron) {
        // Use Electron IPC for serial communication
        try {
          const result = await window.electronSerial.connect(baudRate);
          if (result.success) {
            connected = true;
            return true;
          } else {
            onError?.(result.error || 'Failed to connect');
            connected = false;
            return false;
          }
        } catch (err) {
          onError?.(err.message);
          connected = false;
          return false;
        }
      }

      // Web Serial API path (browser)
      if (!navigator.serial) {
        onError?.("Web Serial API not supported. Use Chrome/Chromium.");
        return false;
      }

      try {
        port = await navigator.serial.requestPort();
        await port.open({
          baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: "none",
          flowControl: "none",
        });

        await port.setSignals({ dataTerminalReady: true });

        reader = port.readable.getReader();
        writer = port.writable.getWriter();
        connected = true;

        // Start read loop asynchronously
        this.readLoop(onData, onError).catch(() => {});
        return true;
      } catch (err) {
        onError?.(err.message);
        connected = false;
        return false;
      }
    },

    async disconnect() {
      connected = false;
      
      if (isElectron) {
        try {
          await window.electronSerial.disconnect();
        } catch (err) {
          // Ignore disconnect errors
        }
        return;
      }

      // Web Serial API path
      try {
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
      } catch (err) {
        // Ignore disconnect errors
      }
    },

    async write(data) {
      if (!connected) return false;
      
      if (isElectron) {
        try {
          const result = await window.electronSerial.write(data);
          return result.success;
        } catch (err) {
          return false;
        }
      }

      // Web Serial API path
      if (!writer) return false;
      try {
        await writer.write(new TextEncoder().encode(data + "\n"));
        return true;
      } catch (err) {
        return false;
      }
    },

    async readLoop(onData, onError) {
      // Only used for Web Serial API
      if (isElectron) {
        return; // Electron uses IPC events instead
      }

      const decoder = new TextDecoder("utf-8", { fatal: false });
      const fallbackDecoder = new TextDecoder("latin1");

      try {
        while (connected && reader) {
          const { value, done } = await reader.read();
          if (done) break;

          // Try UTF-8 first
          let text = decoder.decode(value, { stream: true });
          
          // If decoding produced replacement chars or empty, try latin1
          if (text.includes("\uFFFD") || (!text && value.length > 0)) {
            text = fallbackDecoder.decode(value, { stream: true });
          }

          // Always emit data - rx.js will handle display even if garbled
          onData?.(text || "", value);
        }
      } catch (err) {
        if (connected) {
          onError?.(err.message);
        }
      }
    },
  };
}
