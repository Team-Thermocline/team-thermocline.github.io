<script>
  const teamMembers = [
    { name: "Alexandra Friebolin", role: "Mechanical Engineer", headshot: "/headshots/alex.jpg" },
    { name: "Jacob Morrissette", role: "Mechanical Engineer", headshot: "/headshots/jacob.jpg" },
    { name: "Nik DiLullo", role: "Electrical Engineer", headshot: "/headshots/nik.jpg" },
    { name: "Joe Sedutto", role: "Electrical Engineer", headshot: "/headshots/joe.jpg" },
    { name: "Alexia Hnatowicz", role: "Mechanical Engineer", headshot: "/headshots/lexi.jpg" },
  ];

  const creditsSections = [
    {
      title: "Sponsors",
      entries: [
        { name: "Sedutto Motorsports", role: "Manufacturing Sponsor" },
      ],
    },
    {
      title: "Faculty",
      entries: [
        { name: "Professor McInnis", role: "Instructor" },
        { name: "Professor Monk", role: "Project Sponsor" },
        { name: "John Vincent", role: "IDEA Lab Director and Reviewer" },
        { name: "Dr. Ruben Del-Rio-Ruiz", role: "Engineering Lab Facilitator and Reviewer" },
        { name: "Jason Crowell", role: "Lab Operations Specialist" },
        { name: "Professor Guo", role: "Instructor" },
      ],
    },
    { title: "Mentors and Experts", 
    entries: [
      { name: "Arthur Aznive", role: "Reviewer" },
      { name: "Mark Sedutto", role: "Reviewer" },
      { name: "Mike Sedutto", role: "Reviewer" },
      { name: "Tyler", role: "HVAC Expert" },
    ]},
    { title: "Classmates", 
    entries: [
      { name: "Anuj Khadka", role: "OpenFOAM expert" },
      { name: "Jimmy Small", role: "EPA Certified" },
      { name: "Sam Norton", role: "Electrical Engineer" },
      { name: "Matthew MacDonald", role: "Software Collaborator" },
    ]},
    { title: "Others", 
    entries: [
      { name: "r/embeddeded", role: "Community PCB Design Review" },
      { name: "Gary", role: "Materials Donation" },
    ]},
    {
      title: "Manufacturers",
      entries: [
        { name: "SendCutSend", role: "Manufacturing" },
        { name: "JLCPCB", role: "Manufacturing" },
        { name: "LCSC", role: "Parts Supplier" },
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

  <div class="credits-section credits-section--team">
    <h3 class="credits-section-title">Team members</h3>
    <div class="credits-team">
      {#each teamMembers as member, i}
        <div
          class="credits-team-member"
          class:credits-team-member--flip={i % 2 === 1}
        >
          <div class="credits-team-thumb-frame">
            <img
              class="credits-team-headshot"
              src={member.headshot}
              alt={`${member.name} headshot`}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div class="credits-team-text">
            <span class="credits-name">{member.name}</span>
            <span class="credits-role">{member.role}</span>
          </div>
        </div>
      {/each}
    </div>
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
