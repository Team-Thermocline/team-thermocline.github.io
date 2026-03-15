<script>
  const creditsSections = [
    {
      title: "Faculty",
      entries: [
        { name: "Professor McInnis", role: "Capstone" },
        { name: "Professor Monk", role: "Project Sponsor" },
        { name: "John Vincent", role: "IDEA Lab Director" },
      ],
    },
    { title: "Mentors and Experts", 
    entries: [
      { name: "Mark Sedutto", role: "Reviewer" },
      { name: "Mike Sedutto", role: "Reviewer" },
    ]},
    {
      title: "Sponsors",
      entries: [
        { name: "Sedutto Motorsports", role: "Manufacturing and Reviewer" },
      ],
    },
    {
      title: "Manufacturers",
      entries: [
        { name: "SendCutSend", role: "Manufacturing" },
        { name: "JLCPCB", role: "Manufacturing" },
      ],
    },
  ];
</script>

<div class="credits-page">
  <div class="credits-intro">
    <h2>Credits & Thank Yous</h2>
    <p>
      We couldn't have done this project alone! Thank you to everyone who
      supported us!
    </p>
  </div>

  {#each creditsSections as section}
    <div class="credits-section">
      <h3 class="credits-section-title">{section.title}</h3>
      <div class="credits-section-list">
        {#each section.entries as entry}
          <div class="credits-entry">
            <span class="credits-name">{entry.name}</span>
            {#if entry.role}
              <span class="credits-role">{entry.role}</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>
