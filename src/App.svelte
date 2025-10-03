<script>
  import { loadUpdates } from './lib/updates.js'
  import { marked } from 'marked'
  const navItems = [
    { label: 'Home', href: '#' },
    { label: 'Docs', href: 'https://github.com/Team-Thermocline/thermocline.github.io' },
    { label: 'Controller', href: 'https://github.com/Team-Thermocline/Controller' }
  ]
  const updates = loadUpdates()
  let active = null
  function openUpdate(u) { active = u }
  function closeUpdate() { active = null }
  
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && active && closeUpdate()} />

<header class="topbar">
  <div class="container">
    <div class="brand">
      <img class="logo" src="/logos/Thermocline%20Logo.png" alt="Team Thermocline Logo" />
    </div>
  </div>
  <nav class="navbar">
    <div class="container nav-inner">
      {#each navItems as item}
        <a class="nav-btn" href={item.href} rel="noopener noreferrer">{item.label}</a>
      {/each}
    </div>
  </nav>
  <div class="edge-strip"></div>
  <div class="edge-strip alt"></div>
  <div class="edge-strip"></div>
</header>

<main class="container">
  <section class="content-block">
    <h2>Welcome</h2>
    <p>Team Thermocline is one of two teams working on the 2025-2026 capstone thermal testing chamber project! This site is a public facing hub for our process, deliverables, binaries, CAD, drawings, sourcecode, repair resources and all other aspects related to our project!</p>
    
    <h3>About SNHU</h3>
    <ul class="link-list">
      <li><a href="https://www.snhu.edu/about-us/newsroom/education/what-is-a-capstone-project">What is a Capstone Project?</a></li>
    </ul>

    <h3>About the project</h3>
    <ul class="link-list">
      <li><a href="https://github.com/Team-Thermocline/thermocline.github.io">Github for this site</a></li>
      <li><a href="https://github.com/Team-Thermocline/Controller">Link to the controller</a></li>
    </ul>
  </section>

  <section class="updates">
    <h2 class="updates-title">Updates</h2>
    {#if updates.length === 0}
      <p class="updates-empty">No updates yet.</p>
    {:else}
      <div class="updates-grid">
        {#each updates as u}
          <article class="update-card" on:click={() => openUpdate(u)}>
            {#if u.previewUrl}
              <img class="update-thumb" src={u.previewUrl} alt={u.title} />
            {/if}
            <div class="update-body">
              <h3 class="update-title">{u.title}</h3>
              <p class="update-blurb">{u.blurb}</p>
            </div>
            <div class="update-actions">
              {#if u.bundleUrl}
                <a class="nav-btn" href={u.bundleUrl} download>Download Zip</a>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</main>

{#if active}
  <div class="modal-backdrop" on:click={closeUpdate}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3 class="modal-title">{active.title}</h3>
        <button class="modal-close" on:click={closeUpdate}>✕</button>
      </div>
      {#if active.previewUrl}
        <img class="modal-thumb" src={active.previewUrl} alt={active.title} />
      {/if}
      <div class="modal-body markdown">{@html marked.parse(active.markdown || '')}</div>
      <div class="modal-actions">
        {#if active.bundleUrl}
          <a class="nav-btn" href={active.bundleUrl} download>Download Zip</a>
        {/if}
      </div>
    </div>
  </div>
{/if}

 


