<script>
  import { finiteOrNull } from "./sender/temp.js";

  /** Live Q0 telemetry; TEMP / SET_TEMP are °C from the controller. */
  export let telemetry = null;

  /** When false, temperature / fault telemetry does not play clips (test-mode fault still can). */
  export let enabled = true;

  const COOLDOWN_MS = 30_000;
  /** Same band as Sender temperature gauge (±°C around setpoint). */
  const REACH_BAND_C = 3;
  const COLD_TARGET_BELOW_C = 10;
  const HOT_TARGET_ABOVE_C = 30;

  const CLIPS = {
    cold: "/rifs/ReachedCold.mp3",
    hot: "/rifs/ReachedHot.mp3",
    fault: "/rifs/Fault.mp3",
  };

  let lastPlayAt = 0;
  /** @type {number | undefined} */
  let prevSetC = undefined;
  /** @type {boolean | undefined} */
  let prevInBand = undefined;
  /** @type {boolean | undefined} */
  let prevFaultActive = undefined;

  function isFaultActive(t) {
    if (!t) return false;
    const alarm = t.ALARM == null ? 0 : Number(t.ALARM);
    if (Number.isFinite(alarm) && alarm !== 0) return true;
    const f = t.FAULT != null ? String(t.FAULT).trim() : "";
    return f !== "" && f.toUpperCase() !== "NONE";
  }

  function inReachBand(tempC, setC) {
    return Math.abs(tempC - setC) <= REACH_BAND_C;
  }

  function playClip(key) {
    const url = CLIPS[key];
    if (!url) return;
    const a = new Audio(url);
    a.play().catch(() => {});
  }

  $: {
    const t = telemetry;
    const tempC = finiteOrNull(t?.TEMP);
    const setC = finiteOrNull(t?.SET_TEMP);
    const fault = isFaultActive(t);
    const now = Date.now();
    const cooldownOk = now - lastPlayAt >= COOLDOWN_MS;

    const nowInBand =
      tempC !== null && setC !== null ? inReachBand(tempC, setC) : false;

    const setChanged =
      prevSetC !== undefined && setC !== null && setC !== prevSetC;

    if (setChanged) prevInBand = nowInBand;

    let clip = null;
    if (enabled) {
      if (prevFaultActive !== undefined && fault && !prevFaultActive) {
        clip = "fault";
      } else if (
        !fault &&
        !setChanged &&
        tempC !== null &&
        setC !== null &&
        prevInBand !== undefined &&
        nowInBand &&
        !prevInBand
      ) {
        if (setC < COLD_TARGET_BELOW_C) clip = "cold";
        else if (setC > HOT_TARGET_ABOVE_C) clip = "hot";
      }
    }

    if (clip && cooldownOk) {
      lastPlayAt = now;
      playClip(clip);
    }

    prevInBand = nowInBand;
    if (setC !== null) prevSetC = setC;
    prevFaultActive = fault;
  }

  /** Fault riff when enabling test mode; counts toward cooldown */
  export function playTestModeFault() {
    playClip("fault");
    lastPlayAt = Date.now();
  }
</script>

<!-- Logic-only; audio is played via Audio() -->
