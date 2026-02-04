/**
 * Serial port connection and I/O handling
 */
export function createSerialConnection() {
  let port = null;
  let reader = null;
  let writer = null;
  let connected = false;

  return {
    get connected() {
      return connected;
    },

    async connect(baudRate, onData, onError) {
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
      if (!connected || !writer) return false;
      try {
        await writer.write(new TextEncoder().encode(data + "\n"));
        return true;
      } catch (err) {
        return false;
      }
    },

    async readLoop(onData, onError) {
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
