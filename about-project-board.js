/* ================================================================
   LNJK STUDIO PROJECT BOARD

   Replace the placeholder details in STUDIO_MEMBERS when your team
   profiles are ready. Both desktop and mobile About windows use this
   same list, so each member only needs to be updated once.
   ================================================================ */

const STUDIO_MEMBERS = [
  {
    id: "crew-member-01",
    file: "01",
    name: "Crew Member 01",
    role: "Role / Discipline",
    summary: "Add a short description of this member's main contribution to Roadimentary.",
    bio: "Replace this placeholder with a brief introduction, background, and what this member enjoys about working on the project.",
    specialties: ["Primary specialty", "Project responsibility", "Team contribution"],
    portrait: ""
  },
  {
    id: "crew-member-02",
    file: "02",
    name: "Crew Member 02",
    role: "Role / Discipline",
    summary: "Add a short description of this member's main contribution to Roadimentary.",
    bio: "Replace this placeholder with a brief introduction, background, and what this member enjoys about working on the project.",
    specialties: ["Primary specialty", "Project responsibility", "Team contribution"],
    portrait: ""
  },
  {
    id: "crew-member-03",
    file: "03",
    name: "Crew Member 03",
    role: "Role / Discipline",
    summary: "Add a short description of this member's main contribution to Roadimentary.",
    bio: "Replace this placeholder with a brief introduction, background, and what this member enjoys about working on the project.",
    specialties: ["Primary specialty", "Project responsibility", "Team contribution"],
    portrait: ""
  },
  {
    id: "crew-member-04",
    file: "04",
    name: "Crew Member 04",
    role: "Role / Discipline",
    summary: "Add a short description of this member's main contribution to Roadimentary.",
    bio: "Replace this placeholder with a brief introduction, background, and what this member enjoys about working on the project.",
    specialties: ["Primary specialty", "Project responsibility", "Team contribution"],
    portrait: ""
  }
];

const studioBoardReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function createMemberPortrait(member, className) {
  const portrait = document.createElement("span");
  portrait.className = className;

  if (member.portrait) {
    const image = document.createElement("img");
    image.src = member.portrait;
    image.alt = `${member.name} portrait`;
    portrait.append(image);
  } else {
    portrait.textContent = member.file;
    portrait.setAttribute("aria-hidden", "true");
  }

  return portrait;
}

function initializeStudioProjectBoard(board, boardIndex) {
  const boardLabel = `studio-board-${boardIndex}`;

  board.innerHTML = `
    <section class="studio-briefing-grid" aria-labelledby="${boardLabel}-title">
      <article class="studio-briefing-card">
        <span class="studio-board-eyebrow">Studio Briefing / File LNJK-01</span>
        <h2 id="${boardLabel}-title">Small Team.<br><span>Big Roads.</span></h2>
        <p class="studio-briefing-lead">
          LNJK Studio is a four-person student development team creating playful
          simulation experiences with strategy, personality, and purpose.
        </p>
        <p>
          Our current project, Roadimentary, turns the fundamentals of road
          construction into an approachable game led by a hardworking beaver crew.
        </p>

        <div class="studio-principles" aria-label="Studio principles">
          <span>Learn by Building</span>
          <span>Strategy with Personality</span>
          <span>Made by Students</span>
        </div>
      </article>

      <aside class="studio-project-sheet" aria-label="Roadimentary project information">
        <div class="project-sheet-clip" aria-hidden="true"></div>
        <div class="project-sheet-heading">
          <span>Active Project</span>
          <strong>RD-001</strong>
        </div>
        <h3>Roadimentary</h3>
        <p>A simplified and cartoonish introduction to planning and building roads.</p>
        <dl>
          <div><dt>Format</dt><dd>Construction Strategy</dd></div>
          <div><dt>Focus</dt><dd>Road-building Basics</dd></div>
          <div><dt>Crew</dt><dd>4 Members</dd></div>
          <div><dt>Status</dt><dd><span class="project-status-light"></span> In Development</dd></div>
        </dl>
        <span class="project-sheet-stamp">Field Approved</span>
      </aside>
    </section>

    <section class="studio-crew-section" aria-labelledby="${boardLabel}-crew-title">
      <header class="studio-section-heading">
        <div>
          <span class="studio-board-eyebrow">Personnel Directory</span>
          <h2 id="${boardLabel}-crew-title">Meet the Crew</h2>
        </div>
        <p>Select a personnel file to open the full profile.</p>
      </header>

      <div class="studio-crew-roster" data-studio-roster aria-label="LNJK Studio crew members"></div>
      <article class="studio-crew-dossier" data-studio-dossier aria-live="polite"></article>
    </section>

    <section class="studio-progress-section" aria-labelledby="${boardLabel}-progress-title">
      <header class="studio-section-heading studio-section-heading--compact">
        <div>
          <span class="studio-board-eyebrow">Development Schedule</span>
          <h2 id="${boardLabel}-progress-title">Project Milestones</h2>
        </div>
      </header>

      <ol class="studio-timeline">
        <li class="is-complete"><span class="timeline-marker">01</span><strong>Team Formed</strong><small>Crew assembled</small></li>
        <li class="is-complete"><span class="timeline-marker">02</span><strong>Concept Shaped</strong><small>Core idea approved</small></li>
        <li class="is-complete"><span class="timeline-marker">03</span><strong>Prototype Built</strong><small>Systems tested</small></li>
        <li class="is-active"><span class="timeline-marker">04</span><strong>In Development</strong><small>Current work zone</small></li>
      </ol>
    </section>

    <footer class="studio-contact-strip">
      <div>
        <span class="studio-board-eyebrow">Follow Development</span>
        <strong>Keep up with the crew.</strong>
      </div>
      <nav aria-label="LNJK Studio links">
        <a href="#">YouTube</a>
        <a href="#">Discord</a>
        <a href="#">Email</a>
      </nav>
      <small>&copy; 2026 LNJK Studio</small>
    </footer>
  `;

  const roster = board.querySelector("[data-studio-roster]");
  const dossier = board.querySelector("[data-studio-dossier]");
  let activeMemberId = STUDIO_MEMBERS[0].id;

  function renderDossier(member) {
    dossier.replaceChildren();

    const portraitWrap = document.createElement("div");
    portraitWrap.className = "crew-dossier-portrait-wrap";
    portraitWrap.append(createMemberPortrait(member, "crew-dossier-portrait"));

    const status = document.createElement("span");
    status.className = "crew-file-status";
    status.textContent = "Active Crew";
    portraitWrap.append(status);

    const copy = document.createElement("div");
    copy.className = "crew-dossier-copy";

    const fileLabel = document.createElement("span");
    fileLabel.className = "studio-board-eyebrow";
    fileLabel.textContent = `Personnel File / ${member.file}`;

    const name = document.createElement("h3");
    name.textContent = member.name;

    const role = document.createElement("strong");
    role.className = "crew-dossier-role";
    role.textContent = member.role;

    const summary = document.createElement("p");
    summary.className = "crew-dossier-summary";
    summary.textContent = member.summary;

    const bio = document.createElement("p");
    bio.textContent = member.bio;

    copy.append(fileLabel, name, role, summary, bio);

    const specialties = document.createElement("div");
    specialties.className = "crew-dossier-specialties";

    const specialtiesLabel = document.createElement("span");
    specialtiesLabel.textContent = "Field Notes";
    const specialtiesList = document.createElement("ul");

    member.specialties.forEach((specialty) => {
      const item = document.createElement("li");
      item.textContent = specialty;
      specialtiesList.append(item);
    });

    specialties.append(specialtiesLabel, specialtiesList);
    dossier.append(portraitWrap, copy, specialties);

    if (!studioBoardReducedMotion.matches) {
      dossier.classList.remove("is-opening");
      void dossier.offsetWidth;
      dossier.classList.add("is-opening");
    }
  }

  function selectMember(memberId, focusCard = false) {
    const member = STUDIO_MEMBERS.find((entry) => entry.id === memberId);
    if (!member) return;

    activeMemberId = member.id;
    roster.querySelectorAll("[data-member-id]").forEach((card) => {
      const selected = card.dataset.memberId === activeMemberId;
      card.classList.toggle("is-active", selected);
      card.setAttribute("aria-pressed", selected ? "true" : "false");
    });

    renderDossier(member);
    if (focusCard) roster.querySelector(`[data-member-id="${member.id}"]`)?.focus();
  }

  STUDIO_MEMBERS.forEach((member, memberIndex) => {
    const card = document.createElement("button");
    card.className = "studio-member-card";
    card.type = "button";
    card.dataset.memberId = member.id;
    card.setAttribute("aria-pressed", memberIndex === 0 ? "true" : "false");

    const pin = document.createElement("span");
    pin.className = "member-card-pin";
    pin.setAttribute("aria-hidden", "true");

    const portrait = createMemberPortrait(member, "member-card-portrait");

    const label = document.createElement("span");
    label.className = "member-card-label";

    const file = document.createElement("small");
    file.textContent = `File ${member.file}`;

    const name = document.createElement("strong");
    name.textContent = member.name;

    const role = document.createElement("span");
    role.textContent = member.role;

    label.append(file, name, role);
    card.append(pin, portrait, label);
    card.addEventListener("click", () => selectMember(member.id));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (memberIndex + direction + STUDIO_MEMBERS.length) % STUDIO_MEMBERS.length;
      selectMember(STUDIO_MEMBERS[nextIndex].id, true);
    });

    roster.append(card);
  });

  selectMember(activeMemberId);
}

document.querySelectorAll("[data-studio-project-board]").forEach(initializeStudioProjectBoard);
