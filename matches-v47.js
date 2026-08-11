document.addEventListener("DOMContentLoaded", function () {
  if (window.__pfGuardRedirecting) return;

  const chooser = document.getElementById("matchChooser");
  const roundsContainer = document.getElementById("roundsContainer");
  const filterStatus = document.getElementById("matchStatusFilter");
  const search = document.getElementById("matchSearch");

  const sticky = document.getElementById("stickyActions");
  const stickyTitle = document.getElementById("stickyTitle");
  const stickySubtitle = document.getElementById("stickySubtitle");
  const undoScore = document.getElementById("undoScore");
  const completeTournament = document.getElementById("completeTournament");

  const activeMatchContainer = document.getElementById("activeMatchContainer");
  const activeMatchSubtitle = document.getElementById("activeMatchSubtitle");
  const activeMatchBadge = document.getElementById("activeMatchBadge");
  const matchChooserSection = document.getElementById("matchChooserSection");
  const matchHistorySection = document.getElementById("matchHistorySection");
  const operatorRuntimeError = document.getElementById("operatorRuntimeError");

  const extraMatchModal = document.getElementById("extraMatchModal");
  const closeExtraMatchModal = document.getElementById("closeExtraMatchModal");
  const cancelExtraMatchModal = document.getElementById("cancelExtraMatchModal");
  const manualPlayerSlots = document.getElementById("manualPlayerSlots");
  const extraMatchCourt = document.getElementById("extraMatchCourt");
  const extraMatchLabel = document.getElementById("extraMatchLabel");
  const activateExtraMatch = document.getElementById("activateExtraMatch");
  const randomExtraPlayers = document.getElementById("randomExtraPlayers");
  const clearExtraPlayers = document.getElementById("clearExtraPlayers");
  const createExtraMatch = document.getElementById("createExtraMatch");
  const addExtraMatch = document.getElementById("addExtraMatch");
  const extraMatchWeightInfo = document.getElementById("extraMatchWeightInfo");
  const extraMatchRestInfo = document.getElementById("extraMatchRestInfo");

  let extraSelection = [];

  function session() {
    return PFApp.requireSession();
  }

  function showRuntimeError(message) {
    if (!operatorRuntimeError) return;
    operatorRuntimeError.classList.remove("hidden");
    operatorRuntimeError.innerHTML =
      `<strong>Operator error:</strong> ${PFUI.escapeHtml(String(message || "Unknown error"))}`;
  }

  function clearRuntimeError() {
    operatorRuntimeError?.classList.add("hidden");
  }

  function safeRender(name, fn) {
    try {
      fn();
      return true;
    } catch (error) {
      console.error(`PadelFlex ${name}:`, error);
      showRuntimeError(`${name}: ${error.message}`);
      return false;
    }
  }

  function sideName(match, side) {
    const current = session();
    const ids = side === "A" ? match.teamA : match.teamB;

    if (current.setup.randomMode === "team") {
      return PFApp.entityName(ids[0], current);
    }

    return ids
      .map(id => PFApp.entityName(id, current))
      .join(" & ");
  }

  function sideDetails(match, side) {
    const current = session();

    if (current.setup.randomMode !== "team") return "";

    const ids = side === "A" ? match.teamA : match.teamB;

    return PFApp.entityDetails(ids[0], current);
  }


  function extraRequiredCount() {
    return session().setup.randomMode === "team"
      ? 2
      : 4;
  }

  function extraEntityLabel() {
    return session().setup.randomMode === "team"
      ? "Tim"
      : "Player";
  }


  function participantRestLabel(entityId) {
    const current = session();
    const actual = PFApp.getParticipantRestStatus(
      [entityId],
      current
    );

    const planned = PFApp.getPlannedRestStatus(
      [entityId],
      current
    );

    const item = actual.items[0];
    const plannedItem = planned.items[0];

    if (
      (!item || item.neverPlayed) &&
      (!plannedItem || plannedItem.neverScheduled)
    ) {
      return "belum main";
    }

    if (
      !actual.ready ||
      !planned.ready
    ) {
      return "urutan terlalu dekat";
    }

    return "siap";
  }

  function renderSelectedRestStatus() {
    const current = session();
    const ids = extraSelection.filter(Boolean);

    if (ids.length !== extraRequiredCount()) {
      extraMatchRestInfo.innerHTML = `
        <span class="badge">Pilih semua peserta</span>
        <span>
          Sistem akan mengecek apakah pemain sudah mendapat jeda minimal
          ${current.setup.minRestRounds ?? 1}.
        </span>`;

      extraMatchRestInfo.className =
        "rest-readiness";
      return;
    }

    const rest = PFApp.getManualCreationRestStatus(
      ids,
      current
    );

    if (rest.ready) {
      extraMatchRestInfo.innerHTML = `
        <span class="badge badge-success">✓ Siap Istirahat</span>
        <span>
          Semua peserta memenuhi jeda aktual dan urutan jadwal minimal ${rest.required}.
        </span>`;

      extraMatchRestInfo.className =
        "rest-readiness ready";
      return;
    }

    extraMatchRestInfo.innerHTML = `
      <span class="badge badge-warning">⚠ Butuh Istirahat</span>
      <span>
        ${PFUI.escapeHtml(rest.tiredNames.join(", "))}
        terlalu dekat dengan pertandingan sebelumnya atau baru saja bermain.
      </span>`;

    extraMatchRestInfo.className =
      "rest-readiness warning";
  }

  function renderExtraMatchBuilder() {
    const current = session();
    const entities = PFApp.getEntities(current);
    const required = extraRequiredCount();
    const completed = current.status === "completed";

    extraSelection = extraSelection
      .slice(0, required)
      .map(id =>
        entities.some(entity => entity.id === id)
          ? id
          : ""
      );

    while (extraSelection.length < required) {
      extraSelection.push("");
    }

    const selectedIds = new Set(
      extraSelection.filter(Boolean)
    );

    const stats = PFApp.computeStats(current).stats;

    manualPlayerSlots.innerHTML = extraSelection
      .map((selectedId, index) => `
        <div class="manual-slot">
          <label>${extraEntityLabel()} ${index + 1}</label>
          <select
            class="select"
            data-extra-slot="${index}"
            ${completed ? "disabled" : ""}>
            <option value="">Pilih ${extraEntityLabel().toLowerCase()}</option>
            ${entities.map(entity => {
              const selected = entity.id === selectedId;
              const usedElsewhere =
                selectedIds.has(entity.id) &&
                !selected;

              return `
                <option
                  value="${entity.id}"
                  ${selected ? "selected" : ""}
                  ${usedElsewhere ? "disabled" : ""}>
                  ${PFUI.escapeHtml(entity.name)}
                  · G${stats[entity.id]?.played || 0}
                  · ${PFUI.escapeHtml(participantRestLabel(entity.id))}
                </option>`;
            }).join("")}
          </select>
        </div>
      `)
      .join("");

    const previousCourt = extraMatchCourt.value || "1";

    extraMatchCourt.innerHTML = Array.from(
      {
        length: Math.max(
          1,
          Number(current.setup.courtCount)
        )
      },
      (_, index) => `
        <option value="${index + 1}">
          Court ${index + 1}
        </option>
      `
    ).join("");

    if (
      Array.from(extraMatchCourt.options)
        .some(option => option.value === previousCourt)
    ) {
      extraMatchCourt.value = previousCourt;
    }

    const weight = PFApp.getCompensationPerMissed(current);

    extraMatchWeightInfo.innerHTML =
      current.setup.scoreMode === "fixed"
        ? `<strong>Bobot otomatis:</strong>
           sistem total <strong>${current.setup.pointsTotal}</strong>,
           kompensasi <strong>+${weight}</strong> per game tertinggal
           <strong>sejak pemain bergabung</strong>.
           Jeda minimal: <strong>${current.setup.minRestRounds ?? 1}</strong>.`
        : `<strong>Bobot otomatis:</strong>
           menang 3, seri 1, kalah 0, kompensasi
           <strong>+${weight}</strong> per game tertinggal
           <strong>sejak pemain bergabung</strong>.
           Jeda minimal: <strong>${current.setup.minRestRounds ?? 1}</strong>.`;

    createExtraMatch.disabled =
      completed ||
      entities.length < required;

    randomExtraPlayers.disabled =
      completed ||
      entities.length < required;

    clearExtraPlayers.disabled = completed;
    extraMatchCourt.disabled = completed;
    extraMatchLabel.disabled = completed;
    activateExtraMatch.disabled = completed;

    renderSelectedRestStatus();

    if (completed) {
      extraMatchWeightInfo.innerHTML =
        `<strong>Turnamen sudah selesai.</strong>
         Buka kembali turnamen dari leaderboard untuk menambah match.`;
    }
  }

  function pendingMatches() {
    const current = session();

    return current.rounds
      .filter(round => round.status !== "completed")
      .flatMap(round =>
        round.matches
          .filter(match => !match.completed)
          .map(match => ({
            round,
            match,
            rest: PFApp.getRoundRestStatus(
              round,
              current
            )
          }))
      )
      .sort((a, b) =>
        Number(b.round.status === "active") -
          Number(a.round.status === "active") ||
        Number(b.rest.ready) -
          Number(a.rest.ready) ||
        b.rest.minimumRest -
          a.rest.minimumRest ||
        a.round.number -
          b.round.number
      );
  }

  function activateAndFocus(roundId, matchId) {
    try {
      const current = session();
      const target = PFApp.getRound(roundId, current);
      const rest = PFApp.getRoundRestStatus(
        target,
        current
      );

      if (
        !rest.ready &&
        rest.required > 0
      ) {
        const readyAlternative = pendingMatches()
          .some(item =>
            item.round.id !== roundId &&
            item.rest.ready
          );

        const message =
          `${rest.tiredNames.join(", ")} belum memenuhi jeda minimal ` +
          `${rest.required}.` +
          (
            readyAlternative
              ? "\\n\\nAda pertandingan lain yang sudah lebih siap."
              : "\\n\\nBelum ada alternatif yang sepenuhnya siap."
          ) +
          "\\n\\nTetap aktifkan pertandingan ini?";

        if (!confirm(message)) return;
      }

      const round = PFApp.activateRound(roundId);

      render();

      PFUI.toast(
        rest.ready
          ? `Ronde ${round.number} aktif · pemain sudah cukup istirahat.`
          : `Ronde ${round.number} aktif dengan override istirahat.`
      );

      setTimeout(() => {
        document
          .getElementById(`match-${matchId}`)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
      }, 70);
    } catch (error) {
      PFUI.toast(error.message);
    }
  }

  function renderSummary() {
    const current = session();
    const matches = current.rounds.flatMap(
      round => round.matches
    );

    const completed = matches.filter(
      match => match.completed
    ).length;

    const pending = matches.length - completed;
    const fairness = PFScheduler.fairness(current);
    const hasMatches = matches.length > 0;

    document.getElementById("matchMetrics").innerHTML = `
      <div class="operator-metric"><span>Total</span><strong>${matches.length}</strong></div>
      <div class="operator-metric"><span>Selesai</span><strong>${completed}</strong></div>
      <div class="operator-metric"><span>Menunggu</span><strong>${pending}</strong></div>
      <div class="operator-metric"><span>Jeda</span><strong>${current.setup.minRestRounds ?? 1}</strong></div>`;

    document.getElementById("fairnessBar").style.width =
      hasMatches ? `${fairness.score}%` : "0%";

    document.getElementById("fairnessLabel").textContent =
      hasMatches
        ? `${fairness.score}% · ${fairness.min}-${fairness.max} game`
        : "Belum ada data";
  }

  function renderActiveMatch() {
    const current = session();
    const activeRaw = PFApp.getActiveRound(current);
    const active =
      activeRaw?.status === "active"
        ? activeRaw
        : null;

    const match = active?.matches.find(item => !item.completed) ||
      active?.matches[0] ||
      null;

    if (!active || !match) {
      const pending = pendingMatches();

      activeMatchBadge.className = "badge";
      activeMatchBadge.textContent = "Belum aktif";
      activeMatchSubtitle.textContent =
        pending.length
          ? `${pending.length} match menunggu. Pilih dari antrean.`
          : "Belum ada match. Tambahkan pertandingan baru.";

      activeMatchContainer.innerHTML = `
        <div class="active-empty">
          <div class="active-empty-icon">🎾</div>
          <div>
            <strong>${pending.length ? "Pilih match berikutnya" : "Belum ada pertandingan"}</strong>
            <span>${pending.length
              ? "Match yang paling siap berada di bagian Antrean Berikutnya."
              : "Buat match pertama lewat tombol Tambah Match."}</span>
          </div>
          <button class="btn btn-primary btn-sm" data-open-extra-match>＋ Tambah Match</button>
        </div>`;
      return;
    }

    activeMatchBadge.className = "badge badge-success";
    activeMatchBadge.textContent =
      match.completed ? "Selesai" : "Sedang aktif";

    activeMatchSubtitle.textContent =
      `Ronde ${active.number} · Court ${match.court}` +
      (active.label ? ` · ${active.label}` : "");

    activeMatchContainer.innerHTML = renderMatch(active, match, true);
  }

  function renderChooser() {
    const items = pendingMatches()
      .filter(item => item.round.status !== "active");

    document.getElementById("pendingCount").textContent =
      `${items.length} menunggu`;

    matchChooserSection.classList.toggle(
      "hidden",
      items.length === 0
    );

    if (!items.length) {
      chooser.innerHTML = "";
      return;
    }

    chooser.innerHTML = items.map(({ round, match, rest }, index) => `
      <div class="queue-row ${rest.ready ? "ready" : "warning"}">
        <div class="queue-order">${index + 1}</div>
        <div class="queue-main">
          <div class="queue-meta">
            <span>R${round.number} · Court ${match.court}</span>
            <span class="badge ${rest.ready ? "badge-success" : "badge-warning"}">${rest.ready ? "✓ Siap" : "Istirahat"}</span>
          </div>
          <strong>
            ${PFUI.escapeHtml(sideName(match, "A"))}
            <span>vs</span>
            ${PFUI.escapeHtml(sideName(match, "B"))}
          </strong>
          ${rest.ready
            ? ""
            : `<small>${PFUI.escapeHtml(rest.tiredNames.join(", "))} sebaiknya istirahat dulu.</small>`}
        </div>
        <button
          class="btn ${rest.ready ? "btn-primary" : "btn-warning"} btn-sm"
          data-action="activate"
          data-round="${round.id}"
          data-match="${match.id}">
          Mainkan
        </button>
      </div>
    `).join("");
  }

  function matchStatus(round, match) {
    if (match.completed) {
      return '<span class="badge badge-success">Selesai</span>';
    }

    if (round.status === "active") {
      return '<span class="badge">Bisa diisi</span>';
    }

    const rest = PFApp.getMatchRestStatus(
      round.id,
      match.id,
      session()
    );

    return rest.ready
      ? '<span class="badge badge-success">Siap Istirahat</span>'
      : '<span class="badge badge-warning">Butuh Istirahat</span>';
  }

  function renderMatch(round, match, activePanel = false) {
    const current = session();
    const enabled =
      round.status === "active" &&
      current.status !== "completed";

    const winnerA =
      match.completed &&
      Number(match.scoreA) > Number(match.scoreB);

    const winnerB =
      match.completed &&
      Number(match.scoreB) > Number(match.scoreA);

    const detailA = sideDetails(match, "A");
    const detailB = sideDetails(match, "B");

    return `
      <div
        class="match ${enabled && !match.completed ? "current" : ""} ${activePanel ? "active-panel-match" : ""}"
        id="match-${match.id}">

        <div class="match-top">
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
            <span class="court">Court ${match.court}</span>
            ${["manual_extra", "manual"].includes(round.kind)
              ? '<span class="badge badge-warning">Manual</span>'
              : ""}
          </div>
          ${matchStatus(round, match)}
        </div>

        <div class="scoreboard">
          <div class="team ${winnerA ? "winner" : ""}">
            <div class="team-name">
              <span>${PFUI.escapeHtml(sideName(match, "A"))}</span>
              ${detailA
                ? `<small class="list-meta">${PFUI.escapeHtml(detailA)}</small>`
                : ""}
            </div>

            <input
              class="score-input"
              type="number"
              min="0"
              ${current.setup.scoreMode === "fixed"
                ? `max="${current.setup.pointsTotal}"`
                : ""}
              value="${match.scoreA}"
              data-score="A"
              data-round="${round.id}"
              data-match="${match.id}"
              ${enabled ? "" : "disabled"}>
          </div>

          <div class="vs">VS</div>

          <div class="team ${winnerB ? "winner" : ""}">
            <div class="team-name">
              <span>${PFUI.escapeHtml(sideName(match, "B"))}</span>
              ${detailB
                ? `<small class="list-meta">${PFUI.escapeHtml(detailB)}</small>`
                : ""}
            </div>

            <input
              class="score-input"
              type="number"
              min="0"
              ${current.setup.scoreMode === "fixed"
                ? `max="${current.setup.pointsTotal}"`
                : ""}
              value="${match.scoreB}"
              data-score="B"
              data-round="${round.id}"
              data-match="${match.id}"
              ${enabled ? "" : "disabled"}>
          </div>
        </div>

        <div class="match-actions">
          ${match.completed && current.status !== "completed" ? `
            <button
              class="btn btn-secondary btn-sm"
              data-action="edit-score"
              data-round="${round.id}"
              data-match="${match.id}">
              Edit Skor
            </button>` : ""}

          ${!activePanel && !match.completed && round.status !== "active" ? `
            <button
              class="btn btn-primary btn-sm"
              data-action="activate"
              data-round="${round.id}"
              data-match="${match.id}">
              Aktifkan Match Ini
            </button>` : ""}

          ${["manual_extra", "manual"].includes(round.kind) &&
            !match.completed &&
            current.status !== "completed" ? `
            <button
              class="btn btn-danger btn-sm"
              data-action="delete-extra"
              data-round="${round.id}"
              data-match="${match.id}">
              Hapus Match Manual
            </button>` : ""}
        </div>
      </div>`;
  }

  function statusMatchesFilter(round) {
    const value = filterStatus.value;

    if (value === "all") return true;
    if (value === "active") return round.status === "active";
    if (value === "completed") return round.status === "completed";
    if (value === "pending") return round.status === "scheduled";

    return true;
  }

  function searchRound(round) {
    const query = search.value.trim().toLowerCase();

    if (!query) return true;

    return round.matches.some(match =>
      [
        sideName(match, "A"),
        sideName(match, "B")
      ].some(value =>
        value.toLowerCase().includes(query)
      )
    );
  }

  function renderRounds() {
    const current = session();

    const rounds = current.rounds
      .filter(statusMatchesFilter)
      .filter(searchRound)
      .sort((a, b) => b.number - a.number);

    matchHistorySection.classList.toggle(
      "hidden",
      current.rounds.length === 0
    );

    if (!rounds.length) {
      roundsContainer.innerHTML = `
        <div class="compact-empty">
          <strong>Tidak ada data pada filter ini</strong>
          <span>Ubah filter atau kata pencarian.</span>
        </div>`;
      return;
    }

    roundsContainer.innerHTML = rounds.map(round => {
      const match = round.matches[0];
      if (!match) return "";

      const completed = Boolean(match.completed);
      const statusText =
        completed
          ? "Selesai"
          : round.status === "active"
            ? "Aktif"
            : "Menunggu";

      return `
        <div class="history-row" id="round-${round.id}">
          <div class="history-round">
            <strong>R${round.number}</strong>
            <small>Court ${match.court}</small>
          </div>

          <div class="history-match">
            <strong>
              ${PFUI.escapeHtml(sideName(match, "A"))}
              <span>vs</span>
              ${PFUI.escapeHtml(sideName(match, "B"))}
            </strong>
            <small>${round.label ? PFUI.escapeHtml(round.label) : statusText}</small>
          </div>

          <div class="history-score ${completed ? "completed" : ""}">
            ${completed ? `${match.scoreA} - ${match.scoreB}` : "—"}
          </div>

          <div class="history-status">
            <span class="badge ${
              completed
                ? "badge-success"
                : round.status === "active"
                  ? ""
                  : "badge-warning"
            }">${statusText}</span>
          </div>

          <div class="history-actions">
            ${completed && current.status !== "completed" ? `
              <button class="btn btn-secondary btn-sm" data-action="edit-score" data-round="${round.id}" data-match="${match.id}">
                Edit
              </button>` : ""}

            ${!completed && round.status !== "active" ? `
              <button class="btn btn-soft btn-sm" data-action="activate" data-round="${round.id}" data-match="${match.id}">
                Mainkan
              </button>` : ""}

            ${["manual_extra", "manual"].includes(round.kind) &&
              !completed &&
              current.status !== "completed" ? `
              <button class="btn btn-danger btn-sm" data-action="delete-extra" data-round="${round.id}" data-match="${match.id}">
                Hapus
              </button>` : ""}
          </div>
        </div>`;
    }).join("");
  }

  function renderSticky() {
    const current = session();
    const activeRaw = PFApp.getActiveRound(current);
    const active =
      activeRaw?.status === "active"
        ? activeRaw
        : null;

    const pending = pendingMatches();

    undoScore.disabled =
      current.scoreHistory.length === 0;

    completeTournament.classList.toggle(
      "hidden",
      current.status === "completed"
    );

    if (current.status === "completed") {
      stickyTitle.textContent = "Turnamen selesai";
      stickySubtitle.textContent = "Leaderboard akhir sudah dikunci.";
      return;
    }

    if (active) {
      const unfinished =
        active.matches.filter(match => !match.completed).length;

      stickyTitle.textContent = `Ronde ${active.number} aktif`;
      stickySubtitle.textContent =
        unfinished
          ? `${unfinished} match belum selesai.`
          : `${pending.length} match masih menunggu.`;
      return;
    }

    stickyTitle.textContent =
      pending.length ? "Siap lanjut" : "Belum ada match";

    stickySubtitle.textContent =
      pending.length
        ? `${pending.length} match tersedia di antrean.`
        : "Tambahkan pertandingan baru.";
  }

  function render() {
    clearRuntimeError();
    safeRender("summary", renderSummary);
    safeRender("match aktif", renderActiveMatch);
    safeRender("antrean", renderChooser);
    safeRender("riwayat", renderRounds);
    safeRender("action bar", renderSticky);
  }

  activeMatchContainer.addEventListener("click", function (event) {
    const openButton = event.target.closest("[data-open-extra-match]");
    if (openButton) {
      openExtraMatchModal();
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;

    try {
      if (button.dataset.action === "edit-score") {
        if (!confirm("Buka kembali skor pertandingan ini?")) return;

        PFApp.reopenMatch(
          button.dataset.round,
          button.dataset.match
        );

        render();
        PFUI.toast("Skor dibuka untuk diedit.");
      }
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  activeMatchContainer.addEventListener("change", function (event) {
    const input = event.target.closest("[data-score]");
    if (!input) return;

    try {
      PFApp.setScore(
        input.dataset.round,
        input.dataset.match,
        input.dataset.score,
        input.value
      );

      render();
      PFUI.toast("Skor tersimpan otomatis.");
    } catch (error) {
      PFUI.toast(error.message);
      render();
    }
  });

  chooser.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    if (button.dataset.action === "activate") {
      activateAndFocus(
        button.dataset.round,
        button.dataset.match
      );
    }

    if (button.dataset.action === "view") {
      document
        .getElementById(`match-${button.dataset.match}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
    }
  });

  roundsContainer.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    try {
      if (button.dataset.action === "activate") {
        activateAndFocus(
          button.dataset.round,
          button.dataset.match
        );
      }

      if (button.dataset.action === "activate-round") {
        const round = PFApp.getRound(
          button.dataset.round
        );

        const match = round?.matches.find(
          item => !item.completed
        );

        if (round && match) {
          activateAndFocus(
            round.id,
            match.id
          );
        }
      }

      if (button.dataset.action === "edit-score") {
        if (!confirm("Buka kembali skor pertandingan ini?")) {
          return;
        }

        PFApp.reopenMatch(
          button.dataset.round,
          button.dataset.match
        );

        render();
        PFUI.toast("Skor dibuka untuk diedit.");
      }

      if (button.dataset.action === "delete-extra") {
        if (!confirm("Hapus match manual ini?")) {
          return;
        }

        PFApp.removeManualMatch(
          button.dataset.round,
          button.dataset.match
        );

        render();
        PFUI.toast("Match manual dihapus.");
      }
    } catch (error) {
      PFUI.toast(error.message);
    }
  });



  function openExtraMatchModal() {
    extraMatchModal.classList.remove("hidden");
    extraMatchModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    try {
      renderExtraMatchBuilder();
      setTimeout(() => {
        manualPlayerSlots.querySelector("select")?.focus();
      }, 40);
    } catch (error) {
      console.error("PadelFlex modal:", error);
      extraMatchWeightInfo.innerHTML =
        `<strong>Gagal memuat form:</strong> ${PFUI.escapeHtml(error.message)}`;
      showRuntimeError(`Tambah Match: ${error.message}`);
    }
  }

  function closeExtraMatchModalFn() {
    extraMatchModal.classList.add("hidden");
    extraMatchModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  manualPlayerSlots.addEventListener("change", function (event) {
    const select = event.target.closest("[data-extra-slot]");
    if (!select) return;

    const index = Number(select.dataset.extraSlot);
    extraSelection[index] = select.value;
    renderExtraMatchBuilder();
  });

  randomExtraPlayers.addEventListener("click", function () {
    try {
      extraSelection =
        PFApp.suggestManualMatchParticipants();

      renderExtraMatchBuilder();
      PFUI.toast(
        "Peserta diacak: yang sudah cukup istirahat diprioritaskan, lalu jumlah main paling sedikit."
      );
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  clearExtraPlayers.addEventListener("click", function () {
    extraSelection =
      Array(extraRequiredCount()).fill("");

    renderExtraMatchBuilder();
  });

  createExtraMatch.addEventListener("click", function () {
    try {
      const selectedRest = PFApp.getManualCreationRestStatus(
        extraSelection.filter(Boolean),
        session()
      );

      if (
        activateExtraMatch.checked &&
        !selectedRest.ready &&
        selectedRest.required > 0 &&
        !confirm(
          `${selectedRest.tiredNames.join(", ")} belum cukup istirahat.\n\nTetap buat dan aktifkan sekarang?`
        )
      ) {
        return;
      }

      const result = PFApp.addManualMatch(
        extraSelection,
        {
          court: Number(extraMatchCourt.value),
          label: extraMatchLabel.value,
          activateNow: activateExtraMatch.checked
        }
      );

      extraSelection =
        Array(extraRequiredCount()).fill("");

      activateExtraMatch.checked = false;
      closeExtraMatchModalFn();
      render();

      PFUI.toast(
        `Match manual dibuat. Bobot kompensasi +${result.compensationPerMissed}; urutan akan diprioritaskan berdasarkan waktu istirahat.`
      );

      if (result.round.status === "active") {
        setTimeout(() => {
          document
            .getElementById(`match-${result.match.id}`)
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
        }, 80);
      }
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  addExtraMatch?.addEventListener("click", openExtraMatchModal);
  closeExtraMatchModal?.addEventListener("click", closeExtraMatchModalFn);
  cancelExtraMatchModal?.addEventListener("click", closeExtraMatchModalFn);

  extraMatchModal.addEventListener("click", function (event) {
    if (event.target === extraMatchModal) {
      closeExtraMatchModalFn();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (
      event.key === "Escape" &&
      !extraMatchModal.classList.contains("hidden")
    ) {
      closeExtraMatchModalFn();
    }
  });

  filterStatus.addEventListener("change", renderRounds);
  search.addEventListener("input", renderRounds);





  undoScore.addEventListener("click", function () {
    try {
      PFApp.undoLastScore();
      render();
      PFUI.toast("Perubahan skor terakhir dibatalkan.");
    } catch (error) {
      PFUI.toast(error.message);
    }
  });



  completeTournament.addEventListener("click", function () {
    try {
      PFApp.completeTournament();
      PFUI.toast("Turnamen ditandai selesai.");

      setTimeout(() => {
        location.href = "leaderboard.html";
      }, 350);
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  function repairAutoScheduleIfNeeded() {
    const current = session();

    if (
      !current.submitted ||
      current.setup.scheduleMode !== "auto" ||
      current.rounds.length > 0
    ) {
      return { repaired: false, generated: current.rounds.length };
    }

    if (typeof PFApp.ensureAutoSchedule === "function") {
      return PFApp.ensureAutoSchedule();
    }

    const recommendation = PFApp.getRecommendation(current, []);
    if (!recommendation.available) {
      return { repaired: false, generated: 0, error: recommendation.reason };
    }

    const generated = PFScheduler.buildRecommendedRounds(current, recommendation, 1, []);
    if (!generated.length) {
      return { repaired: false, generated: 0, error: "Jadwal otomatis gagal dibuat." };
    }

    generated.forEach(round => {
      round.status = "scheduled";
      round.matches.forEach(match => { if (!match.completed) match.status = "scheduled"; });
    });
    generated[0].status = "active";
    generated[0].matches.forEach(match => { if (!match.completed) match.status = "active"; });
    current.rounds = generated;
    current.activeRoundId = generated[0].id;
    current.roundCompletionCounter = 0;
    current.balanceEpochRound = 1;
    PFStorage.save(PFApp.getRoot());
    return { repaired: true, generated: generated.length, recommendation };
  }

  try {
    const repair = repairAutoScheduleIfNeeded();
    if (repair.repaired) {
      PFUI.toast(`${repair.generated} ronde otomatis dibuat.`);
    } else if (repair.error) {
      showRuntimeError(repair.error);
      PFUI.toast(repair.error);
    }
  } catch (error) {
    showRuntimeError(error.message);
    PFUI.toast(error.message);
  }

  try {
    const current = session();
    const completedCount = current.rounds.reduce(
      (total, round) => total + round.matches.filter(match => match.completed).length,
      0
    );
    if (current.setup.scheduleMode === "auto" && current.rounds.length > 0 && completedCount === 0) {
      filterStatus.value = "pending";
    }
  } catch (_) {}

  render();
});
