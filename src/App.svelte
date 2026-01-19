<script>
  import { loadUpdates } from "./lib/updates.js";
  import { marked } from "marked";
  import Sender from "./sender/Sender.svelte";
  import Docs from "./Docs.svelte";
  import Countdown from "./Countdown.svelte";
  import Timeline from "./Timeline.svelte";

  const navItems = [
    { label: "Home", href: "#home", page: "home" },
    { label: "Docs", href: "#docs", page: "docs" },
    { label: "Sender", href: "#sender", page: "sender" },
  ];
  const updates = loadUpdates();
  let active = null;
  let currentPage = "home";

  // Initialize from hash on page load
  if (typeof window !== "undefined") {
    const hash = window.location.hash.slice(1);
    if (hash && ["home", "docs", "sender"].includes(hash)) {
      currentPage = hash;
    } else if (hash && hash.startsWith("update:")) {
      const slug = hash.slice(7); // Remove "update:" prefix
      const update = updates.find((u) => u.slug === slug);
      if (update) {
        currentPage = "home";
        active = update;
      }
    }
  }

  function openUpdate(u) {
    active = u;
    currentPage = "home";
    if (typeof window !== "undefined") {
      window.location.hash = `update:${u.slug}`;
    }
  }
  function closeUpdate() {
    active = null;
    if (typeof window !== "undefined") {
      window.location.hash = "home";
    }
  }
  function navigate(page) {
    if (page) {
      currentPage = page;
      active = null; // Close any open update when navigating
      // Update URL hash
      if (typeof window !== "undefined") {
        window.location.hash = page;
      }
    }
  }

  // Listen for hash changes (back/forward buttons)
  if (typeof window !== "undefined") {
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.slice(1);
      if (hash && ["home", "docs", "sender"].includes(hash)) {
        currentPage = hash;
        active = null;
      } else if (hash && hash.startsWith("update:")) {
        const slug = hash.slice(7);
        const update = updates.find((u) => u.slug === slug);
        if (update) {
          currentPage = "home";
          active = update;
        }
      } else if (!hash) {
        currentPage = "home";
        active = null;
      }
    });
  }
</script>

<svelte:window
  on:keydown={(e) => e.key === "Escape" && active && closeUpdate()}
/>

<header class="topbar">
  <div class="container">
    <div class="brand">
      <img
        class="logo"
        src="/logos/Thermocline%20Logo.png"
        alt="Team Thermocline Logo"
      />
      <Countdown />
    </div>
  </div>
  <nav class="navbar">
    <div class="container nav-inner">
      {#each navItems as item}
        <a
          class="nav-btn"
          href={item.href}
          rel="noopener noreferrer"
          on:click={() => navigate(item.page)}>{item.label}</a
        >
      {/each}
      <Timeline />
    </div>
  </nav>
  <div class="edge-strip"></div>
  <div class="edge-strip alt"></div>
  <div class="edge-strip"></div>
</header>

<main class="container">
  {#if currentPage === "home"}
    <section class="content-block">
      <h2>Welcome</h2>
      <p>
        Each year, SNHU Capstone teams are tasked with various projects. These projects 
        simulate real-world engineering challenges and are meant to be a final culmination of
        our engineering skills.
        <br><br>
        Team Thermocline is one of two teams building a Thermal Testing Chamber as a capstone project for 2025-2026.
        This site is a public facing hub for
        our process, deliverables, binaries, CAD, drawings, sourcecode, repair
        resources and all other aspects related to our project!
      </p>

      <h3>About SNHU</h3>
      <ul class="link-list">
        <li>
          <a
            href="https://www.snhu.edu/about-us/newsroom/education/what-is-a-capstone-project"
            >What is a Capstone Project?</a
          >
        </li>
      </ul>

      <h3>Project Resources</h3>
      <ul class="link-list">
        <li>
          <a
            href="https://cad.onshape.com/documents/0f6d7252fc29b453c7fe25c5/w/f9ad2d1b899e019a4809f833/e/44465f285c45dfca95ecae76?renderMode=0&uiState=6969aaa170ee313f4754e0f0"
            target="_blank"
            rel="noopener noreferrer"
            >CAD Model (Onshape)</a
          >
        </li>
        <li>
          <a href="https://github.com/Team-Thermocline/Controller"
            >Controller Firmware and Schematics (GitHub)</a
          >
        </li>
      </ul>

      <h3>Click on any update below to see the details!</h3>
    </section>

    <section class="updates">
      <h2 class="updates-title">Updates</h2>
      {#if updates.length === 0}
        <p class="updates-empty">No updates yet.</p>
      {:else}
        <div class="updates-grid">
          {#each updates as u}
            <button
              class="update-card"
              on:click={() => openUpdate(u)}
              type="button"
            >
              {#if u.previewUrl}
                <img class="update-thumb" src={u.previewUrl} alt={u.title} />
              {/if}
              <div class="update-body">
                <h3 class="update-title">{u.title}</h3>
                <p class="update-blurb">{u.blurb}</p>
              </div>
              <div class="update-actions">
                {#if u.bundleUrl}
                  <a class="nav-btn" href={u.bundleUrl} download>Download Zip</a
                  >
                {/if}
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </section>
  {:else if currentPage === "sender"}
    <Sender />
  {:else if currentPage === "docs"}
    <Docs />
  {/if}
</main>

<footer class="footer">
  <div class="container">
    <div class="footer-content">
      <span>© 2026<br><a href="mailto:joseph.sedutto@snhu.edu">Click to Contact</a></span>
      <div class="footer-links">
        <a href="https://github.com/Team-Thermocline/team-thermocline.github.io" target="_blank" rel="noopener noreferrer">Website Source</a>
        <a href="https://www.snhu.edu/" target="_blank" rel="noopener noreferrer">SNHU</a>
      </div>
    </div>
  </div>
</footer>

{#if active}
  <div
    class="modal-backdrop"
    on:click={closeUpdate}
    on:keydown={(e) => e.key === "Escape" && closeUpdate()}
    role="button"
    tabindex="0"
  >
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3 class="modal-title">{active.title}</h3>
        <button class="modal-close" on:click={closeUpdate}>✕</button>
      </div>
      {#if active.previewUrl}
        <img class="modal-thumb" src={active.previewUrl} alt={active.title} />
      {/if}
      <div class="modal-body markdown">
        {@html marked.parse(active.markdown || "")}
      </div>
      <div class="modal-actions">
        {#if active.bundleUrl}
          <a class="nav-btn" href={active.bundleUrl} download>Download Zip</a>
        {/if}
      </div>
    </div>
  </div>
{/if}
