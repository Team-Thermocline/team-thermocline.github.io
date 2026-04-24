<script>
  import { loadUpdates } from './lib/updates.js';

  // Timeline configuration (project span; end = capstone completion)
  const startTimestamp = 1756830600;
  const endTimestamp = 1777068000; // 2026-04-24T22:00:00.000Z — Final Presentation

  /** "Now" marker frozen at project completion. */
  const FIXED_NOW_SECONDS = endTimestamp;

  // Helper function to convert date string to epoch seconds
  function dateToTimestamp(dateString) {
    return Math.floor(new Date(dateString).getTime() / 1000);
  }

  // Load updates and convert to timeline events
  const updates = loadUpdates();
  const updateEvents = updates.map(update => ({
    timestamp: Math.floor(update.date.getTime() / 1000),
    label: update.title
  }));

  // Planned milestones (all shown; project is complete)
  const allUpcomingEvents = [
    { timestamp: dateToTimestamp('2025-12-10'), label: 'CDR Presentation' },
    { timestamp: dateToTimestamp('2026-01-20'), label: 'I&T Flows, Verification Matrix' },
    { timestamp: dateToTimestamp('2026-02-13'), label: 'Interim Report' },
    { timestamp: dateToTimestamp('2026-02-10'), label: 'Subsystem Operation' },
    { timestamp: dateToTimestamp('2026-02-26'), label: 'TRR Presentations' },
    { timestamp: dateToTimestamp('2026-03-17'), label: 'Functional Demo' },
    { timestamp: dateToTimestamp('2026-03-31'), label: 'Final TRR' },
    { timestamp: dateToTimestamp('2026-04-16'), label: 'Final Tests' },
    { timestamp: dateToTimestamp('2026-04-21'), label: 'Final Posters' },
    { timestamp: dateToTimestamp('2026-04-24'), label: 'Final Project Report' },
  ];

  const events = [
    { timestamp: startTimestamp, label: 'Start' },
    ...updateEvents,
    ...allUpcomingEvents,
    { timestamp: endTimestamp, label: 'Final Presentation' },
  ];

  // Calculate position percentage for an event (0 to 100)
  function getEventPosition(eventTimestamp) {
    const totalDuration = endTimestamp - startTimestamp;
    const eventOffset = eventTimestamp - startTimestamp;
    return (eventOffset / totalDuration) * 100;
  }

  const currentPosition = getEventPosition(FIXED_NOW_SECONDS);
</script>

<div class="timeline-container">
  <div class="timeline-bar"></div>
  <div class="current-arrow" style="left: {currentPosition}%" role="button" tabindex="0">
    <span class="event-tooltip">now</span>
  </div>
  {#each events as event}
    <div
      class="event-ball"
      style="left: {getEventPosition(event.timestamp)}%"
      role="button"
      tabindex="0"
    >
      <span class="event-tooltip">{event.label}<br>{new Date(event.timestamp * 1000).toLocaleDateString()}</span>
    </div>
  {/each}
</div>

<style>
  .timeline-container {
    position: relative;
    flex: 1;
    margin-left: 200px;
    align-self: flex-end;
    margin-bottom: 10px;
    height: 4px;
    z-index: 20;
  }

  .timeline-bar {
    width: 100%;
    height: 4px;
    background: var(--blue-500);
  }

  .current-arrow {
    position: absolute;
    top: 50%;
    transform: translate(-50%, 0);
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-bottom: 16px solid var(--red-600);
    z-index: 15;
    cursor: pointer;
  }

  .current-arrow:hover .event-tooltip,
  .current-arrow:focus-visible .event-tooltip {
    opacity: 1;
  }

  .current-arrow .event-tooltip {
    bottom: auto;
    top: 100%;
    margin-bottom: 20px;
    margin-top: 30px;
  }

  .event-ball {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    background: var(--blue-500);
    border: 3px solid var(--red-600);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
  }

  .event-ball:hover,
  .event-ball:focus-visible {
    width: 16px;
    height: 16px;
    outline: none;
  }

  .event-tooltip {
    position: absolute;
    text-align: center;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    padding: 6px 10px;
    background: var(--blue-700);
    color: var(--text);
    font-size: 14px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .event-ball:hover .event-tooltip,
  .event-ball:focus-visible .event-tooltip {
    opacity: 1;
  }
</style>
