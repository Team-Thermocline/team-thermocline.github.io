<script>
  import 'digit-spinner/dist/index.js';
  
  // Countdown timer
  const targetTimestamp = 1777068000; // April 24, 6pm
  let days = 0;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  
  function updateCountdown() {
    if (typeof window === "undefined") return;
    const now = Date.now();
    const target = targetTimestamp * 1000; // Convert to milliseconds
    const diff = target - now;
    
    if (diff <= 0) {
      days = 0;
      hours = 0;
      minutes = 0;
      seconds = 0;
      return;
    }
    
    const totalSeconds = Math.floor(diff / 1000);
    days = Math.floor(totalSeconds / 86400);
    hours = Math.floor((totalSeconds % 86400) / 3600);
    minutes = Math.floor((totalSeconds % 3600) / 60);
    seconds = totalSeconds % 60;
  }
  
  // Initialize and update countdown every second
  if (typeof window !== "undefined") {
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }
</script>

<div class="countdown-container">
  <span class="countdown-label">Countdown to Final Presentation:</span>
  <div class="countdown-timer">
    <div class="time-unit">
      <digit-spinner value={days} min-digits={3} direction="shortest"></digit-spinner>
      <span class="unit-label">days</span>
    </div>
    <div class="time-unit">
      <digit-spinner value={hours} min-digits={2} direction="shortest"></digit-spinner>
      <span class="unit-label">hours</span>
    </div>
    <div class="time-unit">
      <digit-spinner value={minutes} min-digits={2} direction="shortest"></digit-spinner>
      <span class="unit-label">minutes</span>
    </div>
    <div class="time-unit">
      <digit-spinner value={seconds} min-digits={2} direction="shortest"></digit-spinner>
      <span class="unit-label">seconds</span>
    </div>
  </div>
</div>

<style>
  .countdown-container {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 1;
  }
  
  .countdown-label {
    font-size: 14px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    text-align: right;
  }
  
  .countdown-timer {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-family: "Courier New", monospace;
    white-space: nowrap;
  }
  
  .time-unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    min-height: 50px;
  }
  
  .countdown-timer digit-spinner {
    --digit-font-size: 14px;
    --digit-font: "Courier New", monospace;
    --digit-color: var(--text);
    --digit-font-weight: 600;
    --digit-background: transparent;
    --spinner-background: transparent;
    --spinner-border-width: 0;
    --spinner-border-color: transparent;
    height: 50px;
    display: flex;
    align-items: center;
  }
  
  .unit-label {
    font-size: 14px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: center;
    position: absolute;
    top: 68px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    white-space: nowrap;
  }
</style>
