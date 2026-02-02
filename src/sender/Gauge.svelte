<script>
  export let label = "";
  export let unit = "";
  export let min = 0;
  export let max = 100;
  export let value = null; // current
  export let setpoint = null;
  export let setpointBand = 3; // +/- (in gauge units)
  // "band": +/- setpointBand around setpoint
  // "under": from min up to setpoint (e.g. RH 0..SET_RH)
  export let setpointZone = "band";
  // Debug/testing: show indicators even when values are null.
  export let debugForceNeedles = false;

  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const toNumberOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  $: v = toNumberOrNull(value);
  $: sp = toNumberOrNull(setpoint);

  const lerp = (a, b, t) => a + (b - a) * t;
  $: debugCurrent = lerp(min, max, 0.25);
  $: debugSetpoint = lerp(min, max, 0.75);
  $: vForNeedle = v === null && debugForceNeedles ? debugCurrent : v;
  $: spForNeedle = sp === null && debugForceNeedles ? debugSetpoint : sp;

  // Needle sweep: -90 (left) -> +90 (right), base needle points "up"
  const angleFor = (n) => {
    if (n === null) return null;
    if (max === min) return 0;
    const t = clamp01((n - min) / (max - min));
    return -90 + t * 180;
  };

  $: valueAngle = angleFor(vForNeedle);
  $: setpointAngle = angleFor(spForNeedle);

  const CX = 100;
  const CY = 100;
  const ARC_RADIUS = 80;
  const TRACK_WIDTH = 40; // requested 40px path thickness

  const pointFor = (angleDeg, radius) => {
    const rad = (Math.PI / 180) * angleDeg;
    return {
      x: CX + radius * Math.sin(rad),
      y: CY - radius * Math.cos(rad),
    };
  };

  const arcD = (startAngle, endAngle, radius = ARC_RADIUS) => {
    const start = pointFor(startAngle, radius);
    const end = pointFor(endAngle, radius);
    const delta = Math.abs(endAngle - startAngle);
    const largeArcFlag = delta > 180 ? 1 : 0;
    const sweepFlag = endAngle >= startAngle ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
  };

  $: fullArc = arcD(-90, 90);

  $: zoneLowValue =
    spForNeedle === null
      ? null
      : setpointZone === "under"
        ? min
        : clamp(spForNeedle - setpointBand, min, max);
  $: zoneHighValue =
    spForNeedle === null
      ? null
      : setpointZone === "under"
        ? clamp(spForNeedle, min, max)
        : clamp(spForNeedle + setpointBand, min, max);
  $: zoneStartAngle = zoneLowValue === null ? null : angleFor(zoneLowValue);
  $: zoneEndAngle = zoneHighValue === null ? null : angleFor(zoneHighValue);
  $: zoneArc =
    zoneStartAngle === null || zoneEndAngle === null ? null : arcD(zoneStartAngle, zoneEndAngle);

  $: inZone =
    vForNeedle !== null &&
    zoneLowValue !== null &&
    zoneHighValue !== null &&
    vForNeedle >= zoneLowValue &&
    vForNeedle <= zoneHighValue;

  $: innerR = ARC_RADIUS - TRACK_WIDTH / 2;
  $: outerR = ARC_RADIUS + TRACK_WIDTH / 2;
  $: setpointInner = setpointAngle === null ? null : pointFor(setpointAngle, innerR);
  $: setpointOuter = setpointAngle === null ? null : pointFor(setpointAngle, outerR);
</script>

<div class="gauge">
  <div class="title">{label}</div>
  <svg viewBox="0 0 200 140" class="svg" aria-label={label}>
    <!-- track -->
    <path d={fullArc} class="arc" />

    <!-- setpoint band (zone) -->
    {#if zoneArc}
      <path d={zoneArc} class="setpoint-zone" class:in-zone={inZone} />
      {#if setpointInner && setpointOuter}
        <line
          x1={setpointInner.x}
          y1={setpointInner.y}
          x2={setpointOuter.x}
          y2={setpointOuter.y}
          class="setpoint-center"
          class:in-zone={inZone}
        />
      {/if}
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

    <circle cx="100" cy="100" r="6" class="hub" />
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

  <div class="controls">
    <slot />
  </div>
</div>

<style>
  .gauge {
    display: flex;
    flex-direction: column;
    border: 1px solid #ccc;
    padding: 8px;
    width: 240px;
    box-sizing: border-box;
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
    stroke-width: 40;
    stroke-linecap: butt;
  }
  .setpoint-zone {
    fill: none;
    stroke: rgba(255, 211, 77, 0.35);
    stroke-width: 40;
    stroke-linecap: butt;
  }
  .setpoint-center {
    stroke: #ffd34d;
    stroke-width: 3;
    stroke-linecap: round;
  }
  .setpoint-zone.in-zone {
    stroke: rgba(120, 255, 120, 0.35);
  }
  .setpoint-center.in-zone {
    stroke: #78ff78;
  }
  .needle {
    stroke-linecap: round;
  }
  .needle.value {
    stroke: #00ffff;
    stroke-width: 4;
  }
  .hub {
    fill: #ddd;
    stroke: #222;
    stroke-width: 1;
  }
  .numbers {
    margin-top: 6px;
    font-family: monospace;
    font-variant-numeric: tabular-nums;
  }
  .row {
    display: flex;
    justify-content: space-between;
  }
  .k {
    opacity: 0.7;
  }
  .v {
    min-width: 90px;
    text-align: right;
  }
  .controls {
    margin-top: 8px;
    margin-top: auto;
  }
</style>

