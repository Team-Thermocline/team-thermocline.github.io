<script>
  import { MONK_TEMP_C_HIGH, MONK_TEMP_C_LOW } from "./constants.js";
  import { STATUS_CELLS } from "./statusGridCells.js";

  const monkModeHelp = `Chamber TEMP from Q0: flashes red below ${MONK_TEMP_C_LOW} °C or above ${MONK_TEMP_C_HIGH} °C.`;

  /**
   * states: { [key: string]: "off" | "red" | "green" | "yellow" | "blink-red" | "blink-yellow" | string }
   */
  export let states = {};
  export let cells = STATUS_CELLS;
  /** Optional per-key label override (e.g. monk_mode → MONK! when chamber temp is extreme). */
  export let labelByKey = {};
  export let clickableKeys = [];
  export let onCellActivate = null;

  const normalizeState = (s) => (s ?? "off").toString().trim().toLowerCase();
  const isClickable = (key) => Array.isArray(clickableKeys) && clickableKeys.includes(key);
  const helpByKey = {
    connection: "Connect/disconnect the controller.",
    test: "Toggle test mode on/off.",
    fault: "Clear current faults.",
    monk_mode: monkModeHelp,
  };

  function activate(key) {
    if (!isClickable(key)) return;
    if (typeof onCellActivate === "function") onCellActivate(key);
  }
</script>

<div class="status-grid">
  {#each cells as cell (cell.key)}
    {@const state = normalizeState(states?.[cell.key])}
    {@const label = labelByKey?.[cell.key] ?? cell.label}
    {@const help = helpByKey[cell.key] ?? null}
    {#if isClickable(cell.key)}
      <button
        type="button"
        class="status-cell onclicked"
        data-key={cell.key}
        data-state={state}
        data-clickable="true"
        title={help ?? ""}
        on:click={() => activate(cell.key)}
      >
        {label}
      </button>
    {:else}
      <div class="status-cell" data-key={cell.key} data-state={state} data-clickable="false">
        {label}
      </div>
    {/if}
  {/each}
</div>

