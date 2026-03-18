<script>
  import { STATUS_CELLS } from "./statusGridCells.js";

  /**
   * states: { [key: string]: "off" | "red" | "green" | "yellow" | "blink-red" | "blink-yellow" | string }
   */
  export let states = {};
  export let cells = STATUS_CELLS;
  export let clickableKeys = [];
  export let onCellActivate = null;

  const normalizeState = (s) => (s ?? "off").toString().trim().toLowerCase();
  const isClickable = (key) => Array.isArray(clickableKeys) && clickableKeys.includes(key);
  const helpByKey = {
    connection: "Connect/disconnect the controller.",
    test: "Toggle test mode on/off.",
    fault: "Clear current faults.",
  };

  function activate(key) {
    if (!isClickable(key)) return;
    if (typeof onCellActivate === "function") onCellActivate(key);
  }
</script>

<div class="status-grid">
  {#each cells as cell (cell.key)}
    {@const state = normalizeState(states?.[cell.key])}
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
        {cell.label}
      </button>
    {:else}
      <div class="status-cell" data-key={cell.key} data-state={state} data-clickable="false">
        {cell.label}
      </div>
    {/if}
  {/each}
</div>

