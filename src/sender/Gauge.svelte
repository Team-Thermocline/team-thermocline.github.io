<script>
  export let label = "";
  export let unit = "";
  export let min = 0;
  export let max = 100;
  export let value = null; // current
  export let setpoint = null;

  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const toNumberOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  $: v = toNumberOrNull(value);
  $: sp = toNumberOrNull(setpoint);

  // Needle sweep: -90 (left) -> +90 (right), base needle points "up"
  const angleFor = (n) => {
    if (n === null) return null;
    if (max === min) return 0;
    const t = clamp01((n - min) / (max - min));
    return -90 + t * 180;
  };

  $: valueAngle = angleFor(v);
  $: setpointAngle = angleFor(sp);
</script>

<div class="gauge">
  <div class="title">{label}</div>
  <svg viewBox="0 0 200 120" class="svg" aria-label={label}>
    <!-- arc -->
    <path d="M20 100 A80 80 0 0 1 180 100" class="arc" />

    <!-- setpoint needle -->
    {#if setpointAngle !== null}
      <line
        x1="100"
        y1="100"
        x2="100"
        y2="30"
        class="needle setpoint"
        transform={`rotate(${setpointAngle} 100 100)`}
      />
    {/if}

    <!-- current needle -->
    {#if valueAngle !== null}
      <line
        x1="100"
        y1="100"
        x2="100"
        y2="28"
        class="needle value"
        transform={`rotate(${valueAngle} 100 100)`}
      />
    {/if}

    <circle cx="100" cy="100" r="5" class="hub" />
  </svg>

  <div class="numbers">
    <div class="row">
      <span class="k">cur</span>
      <span class="v">{v === null ? "--" : v}{unit}</span>
    </div>
    <div class="row">
      <span class="k">set</span>
      <span class="v">{sp === null ? "--" : sp}{unit}</span>
    </div>
  </div>
</div>

<style>
  .gauge {
    display: inline-block;
    border: 1px solid #ccc;
    padding: 8px;
    width: 240px;
  }
  .title {
    font-weight: 600;
    margin-bottom: 6px;
  }
  .svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .arc {
    fill: none;
    stroke: #888;
    stroke-width: 6;
  }
  .needle {
    stroke-linecap: round;
  }
  .needle.value {
    stroke: #00ffff;
    stroke-width: 4;
  }
  .needle.setpoint {
    stroke: #ffd34d;
    stroke-width: 2;
  }
  .hub {
    fill: #ddd;
    stroke: #222;
    stroke-width: 1;
  }
  .numbers {
    margin-top: 6px;
    font-family: monospace;
  }
  .row {
    display: flex;
    justify-content: space-between;
  }
  .k {
    opacity: 0.7;
  }
</style>

