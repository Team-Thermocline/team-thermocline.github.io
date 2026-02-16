<script>
  import uPlot from "uplot";
  import "uplot/dist/uPlot.min.css";
  import { onDestroy, onMount } from "svelte";
  import { cToF } from "./temp.js";
  import { getDebugRows, createDebugPoller } from "./DebugTable.js";

  export let samples = []; // [{ t: number(ms), tempC: number, setTempC: number|null, rh: number }]
  export let showFahrenheit = false;
  export let telemetry = null;
  export let lastPolledByKey = {};
  export let sendTcode = null;
  export let queryIntervalMs = 1000;
  export let setQueryIntervalMs = () => {};

  let showDebugPopup = false;
  let debugPopupWasOpen = false;
  const debugPoller = createDebugPoller();
  $: if (showDebugPopup !== debugPopupWasOpen) {
    debugPopupWasOpen = showDebugPopup;
    if (showDebugPopup && sendTcode) debugPoller.start(sendTcode);
    else debugPoller.stop();
  }
  $: debugRows = getDebugRows(telemetry, lastPolledByKey);

  function escapeClose(node, closeFn) {
    if (typeof closeFn !== "function") return;
    const onKey = (e) => {
      if (e.key === "Escape") closeFn();
    };
    document.addEventListener("keydown", onKey);
    return {
      destroy() {
        document.removeEventListener("keydown", onKey);
      },
    };
  }

  const isFiniteNum = (n) => typeof n === "number" && Number.isFinite(n);

  let rootEl;
  let plotEl;
  let u = null;

  // CSV export --joe
  function downloadCsv() {
    const rows = [["timestamp_iso", "elapsed_s", "temp_c", "set_temp_c", "rh"]];
    if (!samples.length) rows.push([new Date().toISOString(), "0", "", ""]);
    const t0 = samples[0]?.t ?? Date.now();

    for (const s of samples) {
      const iso = new Date(s.t).toISOString();
      const elapsed = ((s.t - t0) / 1000).toFixed(3);
      rows.push([
        iso,
        elapsed,
        String(s.tempC ?? ""),
        String(s.setTempC ?? ""),
        String(s.rh ?? ""),
      ]);
    }

    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telemetry-${new Date().toISOString().replaceAll(":", "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const toUplotData = (samps) => {
    // x axis uses seconds since epoch
    const x = [];
    const temp = [];
    const setTemp = [];
    const rh = [];
    for (const s of samps) {
      if (!s || !isFiniteNum(s.t) || !isFiniteNum(s.tempC) || !isFiniteNum(s.rh)) continue;
      x.push(s.t / 1000);
      temp.push(showFahrenheit ? cToF(s.tempC) : s.tempC);
      setTemp.push(isFiniteNum(s.setTempC) ? (showFahrenheit ? cToF(s.setTempC) : s.setTempC) : null);
      rh.push(s.rh);
    }
    return [x, temp, setTemp, rh];
  };

  const resize = () => {
    if (!u || !rootEl) return;
    const w = Math.max(300, Math.floor(rootEl.clientWidth));
    const h = 260;
    u.setSize({ width: w, height: h });
  };

  const makePlot = () => {
    if (!plotEl) return null;

    const tempUnit = showFahrenheit ? "°F" : "°C";
    const root = getComputedStyle(document.documentElement);
    const css = (name, fallback) => root.getPropertyValue(name).trim() || fallback;
    const COLORS = {
      temp: css("--blue-500", "#1f5fa8"),
      setTemp: css("--cyan-500", "#00ffff"),
      rh: css("--red-600", "#c62828"),
    };
    const pointsOff = { show: false };
    const opts = {
      width: 600,
      height: 260,
      legend: { show: true },
      cursor: { drag: { x: true, y: false } },
      scales: {
        x: { time: true },
        temp: { auto: true },
        rh: { auto: true },
      },
      axes: [
        {
          scale: "x",
          stroke: "rgba(255,255,255,0.5)",
          grid: { stroke: "rgba(255,255,255,0.08)" },
        },
        {
          scale: "temp",
          stroke: COLORS.temp,
          grid: { stroke: "rgba(255,255,255,0.08)" },
          values: (u, vals) => vals.map((v) => (isFiniteNum(v) ? v.toFixed(1) : "")),
          label: `Temp (${tempUnit})`,
        },
        {
          scale: "rh",
          side: 1,
          stroke: COLORS.rh,
          grid: { show: false },
          values: (u, vals) => vals.map((v) => (isFiniteNum(v) ? v.toFixed(0) : "")),
          label: "RH (%)",
        },
      ],
      series: [
        {},
        { label: `Temp (${tempUnit})`, scale: "temp", stroke: COLORS.temp, width: 2, points: pointsOff },
        { label: `Set (${tempUnit})`, scale: "temp", stroke: COLORS.setTemp, width: 2, dash: [6, 4], points: pointsOff },
        { label: "RH (%)", scale: "rh", stroke: COLORS.rh, width: 2, points: pointsOff },
      ],
    };

    const data = toUplotData(samples);
    return new uPlot(opts, data, plotEl);
  };

  onMount(() => {
    u = makePlot();
    resize();
    window.addEventListener("resize", resize);
  });

  onDestroy(() => {
    window.removeEventListener("resize", resize);
    if (u) u.destroy();
    u = null;
  });

  $: if (u) {
    // handle unit changes + data updates
    u.setData(toUplotData(samples));
    u.setSeries(1, { label: `Temp (${showFahrenheit ? "°F" : "°C"})` });
    u.setSeries(2, { label: `Set (${showFahrenheit ? "°F" : "°C"})` });
    u.axes[1].label = `Temp (${showFahrenheit ? "°F" : "°C"})`;
    resize();
  }
</script>

<div class="graph-root">
  <div class="graph-toolbar">
    <button type="button" on:click={downloadCsv}>Export CSV</button>
    <div class="graph-meta">
      <label class="update-speed-label">
        Update (ms)
        <input
          type="number"
          class="update-speed-input"
          min="100"
          max="60000"
          step="50"
          value={queryIntervalMs}
          on:input={(e) => setQueryIntervalMs(e.target.value)}
        />
      </label>
      <button type="button" class="debug-btn" on:click={() => (showDebugPopup = true)}>Show Debug Values</button>
    </div>
  </div>

  <!-- Debug popup! Kinda like the popup modal for updates -->
  {#if showDebugPopup}
    <div
      class="debug-overlay"
      role="dialog"
      aria-modal="true"
      use:escapeClose={() => (showDebugPopup = false)}>
      <button
        type="button"
        class="debug-backdrop"
        aria-label="Close"
        on:click={() => (showDebugPopup = false)}></button>
      <div class="debug-modal">
        <div class="debug-modal-header">
          <h3>Debug Values</h3>
          <button type="button" on:click={() => (showDebugPopup = false)}>Close</button>
        </div>
        <table class="debug-table">
          <thead>
            <tr><th>Label</th><th>Value</th><th>Poll interval</th><th>Last polled</th></tr>
          </thead>
          <tbody>
            {#each debugRows as row (row.key)}
              <tr>
                <td>{row.label}</td>
                <td>{row.value}</td>
                <td>{row.pollInterval}</td>
                <td>{row.lastPolled}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  <div class="plot-wrap" bind:this={rootEl}>
    <div class="plot" bind:this={plotEl}></div>
  </div>
</div>

<style>
  .graph-root {
    display: grid;
    gap: 10px;
  }
  .graph-toolbar {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
  }
  .graph-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0.75;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
  }
  .update-speed-label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #888;
  }
  .update-speed-input {
    width: 10ch;
    padding: 4px 6px;
    background: #2a2a2a;
    color: #aaa;
    border: 1px solid #3a3a3a;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.9rem;
  }
  .update-speed-input:focus {
    outline: none;
    border-color: #555;
  }
  .debug-btn {
    margin-left: 8px;
  }
  .debug-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .debug-backdrop {
    position: absolute;
    inset: 0;
    padding: 0;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    cursor: default;
  }
  .debug-modal {
    position: relative;
    background: #1c1c1c;
    border: 1px solid #3a3a3a;
    border-radius: 10px;
    padding: 16px;
    max-width: 90vw;
    max-height: 80vh;
    overflow: auto;
  }
  .debug-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .debug-modal-header h3 {
    margin: 0;
    font-size: 1rem;
  }
  .debug-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .debug-table th,
  .debug-table td {
    text-align: left;
    padding: 6px 12px;
    border-bottom: 1px solid #2b2b2b;
  }
  .debug-table th {
    color: #888;
    font-weight: 600;
  }
  .plot-wrap {
    width: 100%;
  }
  .plot :global(.uplot) {
    background: #000;
  }
  .plot :global(.u-title) {
    color: rgba(255, 255, 255, 0.85);
  }
  .plot :global(.u-legend) {
    color: rgba(255, 255, 255, 0.85);
  }
  .plot :global(.u-legend table) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
    font-size: 12px;
  }
  button {
    background: #242424;
    color: #fff;
    border: 1px solid #3a3a3a;
    border-radius: 8px;
    padding: 8px 10px;
    cursor: pointer;
  }
</style>

