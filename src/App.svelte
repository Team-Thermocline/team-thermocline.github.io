<script>
  import { loadUpdates } from "./lib/updates.js";
  import { marked } from "marked";
  import Sender from "./sender/Sender.svelte";
  import Docs from "./Docs.svelte";
  import Credits from "./Credits.svelte";
  import Countdown from "./Countdown.svelte";
  import Timeline from "./Timeline.svelte";
  import { isKioskUrl } from "./lib/kiosk.js";
  import { docsPathnameToSphinxRel } from "./lib/docsUrl.js";

  const navItems = [
    { label: "Home", href: "/#home", page: "home" },
    { label: "Docs", href: "/docs/", page: "docs" },
    { label: "Sender", href: "/#sender", page: "sender" },
    { label: "Credits", href: "/#credits", page: "credits" },
  ];
  const updates = loadUpdates();
  const projectResources = [
    {
      title: "CAD Model",
      href: "https://cad.onshape.com/documents/0f6d7252fc29b453c7fe25c5/w/f9ad2d1b899e019a4809f833/e/44465f285c45dfca95ecae76?renderMode=0&uiState=6969aaa170ee313f4754e0f0", // I know i could link to /onshape, but then on mobile the onshape app wont catch it and wont open native
      blurb: "Our complete system, designed in 3D on Onshape.",
      imageUrl: "/previews/onshape.png"
    },
    {
      title: "Firmware and Schematics",
      href: "https://github.com/Team-Thermocline/Controller",
      blurb: "Embedded firmware, schematics, and electronics design files on GitHub.",
      imageUrl: "/previews/controller.png"
    },
    {
      title: "Photo Album",
      href: "https://photos.google.com/share/AF1QipN5t9A_6PNaoRJ17JOjYEKFbv0uV5bw1ODZwkMjSba-olt65rTJzqaehpMs2j25pw?key=NlRyVkw2MEQ4V2prRE03M1dSRzVDaW9QelNVUEN3",
      blurb: "Photos of the build, testing, development and team activities!",
      imageUrl: "/previews/photos.png"
    }
  ];
  let active = null;
  let currentPage = "home";
  /** Sphinx HTML file served under /sphinx/ (URL bar uses /docs/...). */
  let docsSphinxRelPath = "index.html";
  let isMobile = false;

  let kioskMode = typeof window !== "undefined" && isKioskUrl();

  if (typeof window !== "undefined") {
    const mq = window.matchMedia("(max-width: 768px)");
    isMobile = mq.matches;
    mq.addEventListener("change", (e) => {
      isMobile = e.matches;
      if (isMobile && currentPage === "sender") {
        currentPage = "home";
        history.replaceState({ spa: true }, "", "/#home");
      }
    });
  }

  $: visibleNavItems = isMobile ? navItems.filter((i) => i.page !== "sender") : navItems;
  $: effectivePage = isMobile && currentPage === "sender" ? "home" : currentPage;

  function syncFromLocation() {
    if (typeof window === "undefined") return;

    if (window.location.hash === "#docs") {
      history.replaceState({ spa: true }, "", "/docs/");
    }

    const path = window.location.pathname;
    if (path === "/docs" || path.startsWith("/docs/")) {
      currentPage = "docs";
      docsSphinxRelPath = docsPathnameToSphinxRel(path);
      active = null;
      return;
    }

    const hash = window.location.hash.slice(1);
    if (hash && ["home", "docs", "sender", "credits"].includes(hash)) {
      currentPage = isMobile && hash === "sender" ? "home" : hash;
      if (isMobile && hash === "sender") {
        history.replaceState({ spa: true }, "", "/#home");
      }
      active = null;
    } else if (hash && hash.startsWith("update:")) {
      const slug = hash.slice(7);
      const update = updates.find((u) => u.slug === slug);
      if (update) {
        currentPage = "home";
        active = update;
      }
    } else if (!hash && path === "/") {
      currentPage = "home";
      active = null;
    }
  }

  if (typeof window !== "undefined") {
    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("thermo-docs-url", () => {
      docsSphinxRelPath = docsPathnameToSphinxRel(window.location.pathname);
    });
    window.addEventListener("hashchange", () => {
      if (window.location.pathname.startsWith("/docs")) return;
      syncFromLocation();
    });
  }

  function openUpdate(u) {
    active = u;
    currentPage = "home";
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith("/docs")) {
        history.pushState({ spa: true }, "", "/");
      }
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
    if (!page || (isMobile && page === "sender")) return;
    active = null;
    if (typeof window === "undefined") return;

    if (page === "docs") {
      history.pushState({ spa: true }, "", "/docs/");
      currentPage = "docs";
      docsSphinxRelPath = "index.html";
      return;
    }
    if (page === "home") {
      history.pushState({ spa: true }, "", "/#home");
      currentPage = "home";
      return;
    }
    if (page === "sender") {
      history.pushState({ spa: true }, "", "/#sender");
      currentPage = "sender";
      return;
    }
    if (page === "credits") {
      history.pushState({ spa: true }, "", "/#credits");
      currentPage = "credits";
      return;
    }
  }
</script>

<svelte:window
  on:keydown={(e) => e.key === "Escape" && active && closeUpdate()}
/>

{#if kioskMode}
  <div class="kiosk-wrap">
    <Sender kioskMode={true} />
  </div>
{:else}
<header class="topbar">
  <div class="container">
    <div class="brand">
      <img
        class="logo"
        src="/logos/Thermocline%20Logo.png"
        alt="Team Thermocline Logo"
      />
      {#if !isMobile}
        <Countdown />
      {/if}
    </div>
  </div>
  <nav class="navbar">
    <div class="container nav-inner">
      {#each visibleNavItems as item}
        <a
          class="nav-btn"
          href={item.href}
          rel="noopener noreferrer"
          on:click|preventDefault={() => navigate(item.page)}>{item.label}</a
        >
      {/each}
      {#if !isMobile}
        <Timeline />
      {/if}
    </div>
  </nav>
  <div class="edge-strip"></div>
  <div class="edge-strip alt"></div>
  <div class="edge-strip"></div>
</header>

<main
  class={effectivePage === "sender" || effectivePage === "docs" ? "container-wide" : "container"}
  class:main-home={effectivePage === "home"}
>
  {#if effectivePage === "home"}
    <div class="home-wrapper">
      <div class="home-content">
        <div class="home-layout">
          <section class="content-block">
            <h2>Welcome</h2>
            <p>
              Each year, SNHU Capstone teams are tasked with various projects. These projects 
              simulate real-world engineering challenges and are meant to be a final culmination of
              our engineering skills.
              <br><br>
              Team Thermocline is
              
              <a href="https://ez-bake.readthedocs.io/en/latest/" target="_blank" rel="noopener noreferrer">
                one of two teams
              </a>
              
              building a Thermal Testing Chamber as a capstone project for 2025-2026.
              This site is a public facing hub for our process, deliverables, binaries, CAD, drawings, source code, repair
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
            <div class="project-resources-grid">
              {#each projectResources as r}
                <a
                  class="project-card"
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img class="project-card-thumb" src={r.imageUrl} alt={r.title} />
                  <div class="project-card-body">
                    <h4 class="project-card-title">{r.title}</h4>
                    <p class="project-card-blurb">{r.blurb}</p>
                  </div>
                </a>
              {/each}
            </div>

            <h3>Click on any update below to see the details!</h3>
          </section>
        </div>

        <section class="updates">
      <h2 class="updates-title">
        Updates

        <!-- RSS Feed -->
        <a href="/feed.xml" class="rss-link" target="_blank" rel="noopener noreferrer" title="RSS Feed">RSS</a>
      </h2>
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
      </div>
    </div>
  {:else if effectivePage === "sender"}
    <Sender kioskMode={false} />
  {:else if effectivePage === "docs"}
    <Docs sphinxRelPath={docsSphinxRelPath} />
  {:else if effectivePage === "credits"}
    <Credits />
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
{/if}
