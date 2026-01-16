<script>
  // Countdown timer
  const targetTimestamp = 1777068000; // April 24, 6pm
  let countdownDisplay = "00:00:00:00.00";
  
  function formatCountdown(ms) {
    if (ms <= 0) return "00:00:00:00.00";
    
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    const hundredths = Math.floor((ms % 100) / 10);
    
    return `${String(days).padStart(2, '0')} days, ${String(hours).padStart(2, '0')} hours, ${String(minutes).padStart(2, '0')} minutes, ${String(seconds).padStart(2, '0')}.${tenths}${hundredths} seconds`;
  }
  
  function updateCountdown() {
    if (typeof window === "undefined") return;
    const now = Date.now();
    const target = targetTimestamp * 1000; // Convert to milliseconds
    const diff = target - now;
    countdownDisplay = formatCountdown(diff);
  }
  
  // Initialize and update countdown every 10ms for hundredths precision
  if (typeof window !== "undefined") {
    updateCountdown();
    setInterval(updateCountdown, 10);
  }
</script>

<div class="countdown-container">
  <span class="countdown-label">Countdown to Final Presentation:</span>
  <span class="countdown-timer">{countdownDisplay}</span>
</div>

<style>
  .countdown-container {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .countdown-label {
    font-size: 14px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    text-align: right;
  }
  
  .countdown-timer {
    font-family: "Courier New", monospace;
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: 0.1em;
    white-space: nowrap;
  }
</style>
