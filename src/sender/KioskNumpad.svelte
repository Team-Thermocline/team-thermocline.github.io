<script>
  import { createEventDispatcher } from "svelte";

  /** When true, overlay is visible */
  export let open = false;
  export let title = "";
  /** Seed when `open` becomes true */
  export let initialValue = "";
  export let allowDecimal = false;
  export let allowNegative = false;

  const dispatch = createEventDispatcher();

  let local = "";

  $: if (open) {
    local = String(initialValue ?? "").trim();
  }

  function append(ch) {
    if (ch === "." && (!allowDecimal || local.includes("."))) return;
    if (ch === "-" && (!allowNegative || local.length > 0)) return;
    if (ch === "-" && local === "-") return;
    local += ch;
  }

  function back() {
    local = local.slice(0, -1);
  }

  function clearAll() {
    local = "";
  }

  function cancel() {
    open = false;
    dispatch("cancel");
  }

  function done() {
    const v = local.trim();
    dispatch("done", { value: v });
    open = false;
  }

  function backdropKey(e) {
    if (e.key === "Escape") cancel();
  }
</script>

{#if open}
  <div
    class="numpad-overlay"
    role="dialog"
    aria-modal="true"
    aria-label={title || "Number entry"}
    tabindex="-1"
    on:keydown={backdropKey}
  >
    <button type="button" class="numpad-backdrop" aria-label="Cancel" on:click={cancel}></button>
    <div class="numpad-panel">
      <div class="numpad-head">
        <span class="numpad-title">{title}</span>
        <button type="button" class="numpad-x" on:click={cancel}>×</button>
      </div>
      <div class="numpad-display" aria-live="polite">{local || "—"}</div>
      <div class="numpad-grid">
        {#if allowNegative}
          <button type="button" class="numpad-key" on:click={() => append("-")}>−</button>
        {:else}
          <span class="numpad-spacer"></span>
        {/if}
        <button type="button" class="numpad-key" on:click={clearAll}>CLR</button>
        <button type="button" class="numpad-key" on:click={back}>BACK</button>

        <button type="button" class="numpad-key" on:click={() => append("7")}>7</button>
        <button type="button" class="numpad-key" on:click={() => append("8")}>8</button>
        <button type="button" class="numpad-key" on:click={() => append("9")}>9</button>

        <button type="button" class="numpad-key" on:click={() => append("4")}>4</button>
        <button type="button" class="numpad-key" on:click={() => append("5")}>5</button>
        <button type="button" class="numpad-key" on:click={() => append("6")}>6</button>

        <button type="button" class="numpad-key" on:click={() => append("1")}>1</button>
        <button type="button" class="numpad-key" on:click={() => append("2")}>2</button>
        <button type="button" class="numpad-key" on:click={() => append("3")}>3</button>

        {#if allowDecimal}
          <button type="button" class="numpad-key" on:click={() => append(".")}>.</button>
        {:else}
          <span class="numpad-spacer"></span>
        {/if}
        <button type="button" class="numpad-key" on:click={() => append("0")}>0</button>
        <button type="button" class="numpad-key numpad-done" on:click={done}>Done</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .numpad-overlay {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 12px;
    box-sizing: border-box;
  }

  .numpad-backdrop {
    position: absolute;
    inset: 0;
    margin: 0;
    border: none;
    padding: 0;
    background: rgba(0, 0, 0, 0.55);
    cursor: pointer;
  }

  .numpad-panel {
    position: relative;
    width: min(420px, 100%);
    max-height: min(78vh, 520px);
    background: #141418;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
    padding: 12px 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .numpad-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .numpad-title {
    font-size: 1rem;
    font-weight: 600;
    color: #e8e8ec;
  }

  .numpad-x {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    font-size: 1.4rem;
    line-height: 1;
    cursor: pointer;
  }

  .numpad-display {
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-align: right;
    padding: 12px 14px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.35);
    color: #7ec8ff;
    min-height: 2.5rem;
    font-variant-numeric: tabular-nums;
  }

  .numpad-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }

  .numpad-key {
    min-height: 52px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.07);
    color: #f2f2f7;
    font-size: 1.25rem;
    font-weight: 600;
    cursor: pointer;
    touch-action: manipulation;
  }

  .numpad-key:active {
    background: rgba(255, 255, 255, 0.16);
  }

  .numpad-done {
    background: rgba(30, 120, 200, 0.45);
    border-color: rgba(100, 180, 255, 0.45);
  }

  .numpad-spacer {
    min-height: 52px;
  }
</style>
