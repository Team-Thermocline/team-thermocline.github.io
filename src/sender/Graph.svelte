<script>
  import uPlot from "uplot";
  import "uplot/dist/uPlot.min.css";
  import { onDestroy, onMount } from "svelte";
  import { cToF } from "./temp.js";

  export let samples = []; // [{ t: number(ms), tempC: number, setTempC: number|null, rh: number }]
  export let showFahrenheit = false;

  const isFiniteNum = (n) => typeof n === "number" && Number.isFinite(n);

  let rootEl;
  let plotEl;
  let u = null;

  const formatRel = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (hh > 0) return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  };

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

  const getSpanText = () => {
    if (!samples.length) return "0:00";
    const t0 = samples[0]?.t ?? Date.now();
    const t1 = samples[samples.length - 1]?.t ?? t0;
    return formatRel(t1 - t0);
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
      span: {getSpanText()}
    </div>
  </div>

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
    opacity: 0.75;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
      "Courier New", monospace;
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

