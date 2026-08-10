document.addEventListener("DOMContentLoaded", function () {
  if (window.__pfGuardRedirecting) return;

  const chooser = document.getElementById("matchChooser");
  const roundsContainer = document.getElementById("roundsContainer");
  const filterStatus = document.getElementById("matchStatusFilter");
  const search = document.getElementById("matchSearch");

  const sticky = document.getElementById("stickyActions");
  const stickyTitle = document.getElementById("stickyTitle");
  const stickySubtitle = document.getElementById("stickySubtitle");
  const viewActive = document.getElementById("viewActive");
  const chooseMatch = document.getElementById("chooseMatch");
  const undoScore = document.getElementById("undoScore");
  const nextRound = document.getElementById("nextRound");
  const completeTournament = document.getElementById("completeTournament");
  const extraMatchSection = document.getElementById("extraMatchSection");
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

    const fairness = PFScheduler.fairness(current);

    document.getElementById("matchMetrics").innerHTML = `
      <div class="stat">
        <span>Match selesai</span>
        <strong>${completed}/${matches.length}</strong>
        <small>${matches.length
          ? Math.round(completed / matches.length * 100)
          : 0}% progres</small>
      </div>

      <div class="stat">
        <span>Ronde</span>
        <strong>${current.rounds.length}</strong>
        <small>${current.setup.courtCount} court</small>
      </div>

      <div class="stat">
        <span>Kemerataan roster aktif</span>
        <strong>${fairness.score}%</strong>
        <small>${fairness.min}-${fairness.max} game sejak R${fairness.balanceEpochRound}</small>
      </div>

      <div class="stat">
        <span>Minimal jeda</span>
        <strong>${current.setup.minRestRounds ?? 1}</strong>
        <small>${current.scoreHistory.length} perubahan skor bisa di-undo</small>
      </div>`;

    document.getElementById("fairnessBar").style.width =
      `${fairness.score}%`;

    document.getElementById("fairnessLabel").textContent =
      `${fairness.score}% · selisih ${fairness.difference} game sejak R${fairness.balanceEpochRound}`;
  }

  function renderChooser() {
    const items = pendingMatches();

    document.getElementById("pendingCount").textContent =
      `${items.length} menunggu`;

    if (!items.length) {
      chooser.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <div class="empty-icon">✓</div>
          <strong>Tidak ada match menunggu</strong>
          <div>Semua pertandingan sudah memiliki skor.</div>
        </div>`;
      return;
    }

    chooser.innerHTML = items.map(({ round, match, rest }) => {
      const active = round.status === "active";

      return `
        <div class="match-choice ${active ? "active" : ""} ${rest.ready ? "rest-ready" : "rest-warning"}">
          <div style="display:flex;justify-content:space-between;gap:7px">
            <span class="badge ${active ? "badge-success" : ""}">
              ${["manual_extra", "manual"].includes(round.kind) ? "Manual · " : ""}
              Ronde ${round.number} · Court ${match.court}
            </span>
            <span class="badge ${rest.ready ? "badge-success" : "badge-warning"}">
              ${rest.ready
                ? "✓ Siap"
                : `Istirahat ${rest.tired.length}`}
            </span>
          </div>

          <strong class="match-choice-title">
            ${PFUI.escapeHtml(sideName(match, "A"))}
            <span style="color:var(--muted)">vs</span>
            ${PFUI.escapeHtml(sideName(match, "B"))}
          </strong>

          <div class="match-rest-note">
            ${rest.ready
              ? `Semua peserta memenuhi jeda minimal ${rest.required}.`
              : `${PFUI.escapeHtml(rest.tiredNames.join(", "))} baru main dan sebaiknya istirahat dulu.`}
          </div>

          <button
            class="btn ${active ? "btn-soft" : rest.ready ? "btn-primary" : "btn-warning"} btn-sm"
            data-action="${active ? "view" : "activate"}"
            data-round="${round.id}"
            data-match="${match.id}">
            ${active ? "Lihat Match" : "Aktifkan Match"}
          </button>
        </div>`;
    }).join("");
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

  function renderMatch(round, match) {
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
        class="match ${enabled && !match.completed ? "current" : ""}"
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

          ${!match.completed && round.status !== "active" ? `
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
      .sort((a, b) => a.number - b.number);

    if (!rounds.length) {
      roundsContainer.innerHTML = `
        <div class="card">
          <div class="empty">
            <div class="empty-icon">＋</div>
            <strong>${current.rounds.length ? "Tidak ada ronde yang cocok" : "Turnamen dimulai dari 0 match"}</strong>
            <div>${current.rounds.length
              ? "Ubah filter atau pencarian."
              : "Gunakan Tambah Match Manual di atas untuk membuat pertandingan pertama."}</div>
          </div>
        </div>`;
      return;
    }

    roundsContainer.innerHTML = rounds.map(round => `
      <section class="round" id="round-${round.id}">
        <div class="round-head">
          <div>
            <strong>
              Ronde ${round.number}
              ${["manual_extra", "manual"].includes(round.kind)
                ? '<span class="badge badge-warning manual-extra-label">Manual</span>'
                : ""}
            </strong>
            <small>
              ${round.label ? `${PFUI.escapeHtml(round.label)} · ` : ""}
              ${round.matches.filter(match => match.completed).length}
              dari ${round.matches.length} match selesai
            </small>
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span class="badge ${
              round.status === "completed"
                ? "badge-success"
                : round.status === "active"
                  ? ""
                  : "badge-warning"
            }">
              ${
                round.status === "completed"
                  ? "Selesai"
                  : round.status === "active"
                    ? "Aktif"
                    : "Menunggu"
              }
            </span>

            ${round.status === "scheduled" &&
              current.status !== "completed" ? `
              <button
                class="btn ${
                  PFApp.getRoundRestStatus(round, current).ready
                    ? "btn-secondary"
                    : "btn-warning"
                } btn-sm"
                data-action="activate-round"
                data-round="${round.id}">
                Aktifkan Ronde
              </button>` : ""}
          </div>
        </div>

        <div class="match-list">
          ${round.matches
            .map(match => renderMatch(round, match))
            .join("")}
        </div>

        ${round.resting.length ? `
          <div class="resting">
            <strong>Istirahat:</strong>
            ${round.resting
              .map(id => PFUI.escapeHtml(
                PFApp.entityName(id, current)
              ))
              .join(", ")}
          </div>` : ""}
      </section>
    `).join("");
  }

  function renderSticky() {
    const current = session();
    const active = PFApp.getActiveRound(current);
    const pending = pendingMatches();

    undoScore.disabled =
      current.scoreHistory.length === 0;

    completeTournament.classList.toggle(
      "hidden",
      current.status === "completed"
    );

    if (current.status === "completed") {
      stickyTitle.textContent = "Turnamen telah selesai";
      stickySubtitle.textContent =
        "Leaderboard akhir sudah dikunci.";
      viewActive.classList.add("hidden");
      chooseMatch.classList.add("hidden");
      nextRound.classList.add("hidden");
      return;
    }

    if (!active) {
      stickyTitle.textContent = "Pilih pertandingan berikutnya";
      stickySubtitle.textContent =
        `${pending.length} match masih menunggu.`;
      viewActive.classList.add("hidden");
      chooseMatch.classList.remove("hidden");
      nextRound.classList.add("hidden");
      return;
    }

    const unfinished =
      active.matches.filter(match => !match.completed).length;

    const allCompleted =
      active.matches.length > 0 &&
      unfinished === 0;

    const next = PFApp.getNextRound(active.id, current);

    stickyTitle.textContent =
      allCompleted
        ? `Ronde ${active.number} selesai`
        : `Ronde ${active.number} aktif`;

    stickySubtitle.textContent =
      allCompleted
        ? (
            next
              ? `Ronde ${next.number} siap dimainkan.`
              : "Seluruh ronde selesai."
          )
        : `${unfinished} match belum memiliki skor.`;

    viewActive.classList.toggle("hidden", allCompleted);
    chooseMatch.classList.toggle(
      "hidden",
      pending.length <= unfinished
    );
    nextRound.classList.toggle("hidden", !allCompleted);

    nextRound.textContent =
      next
        ? `Mulai Ronde ${next.number}`
        : "Selesaikan Jadwal";
  }

  function render() {
    renderSummary();
    renderExtraMatchBuilder();
    renderChooser();
    renderRounds();
    renderSticky();
  }

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

  roundsContainer.addEventListener("change", function (event) {
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

  addExtraMatch.addEventListener("click", function () {
    extraMatchSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

  filterStatus.addEventListener("change", renderRounds);
  search.addEventListener("input", renderRounds);

  viewActive.addEventListener("click", function () {
    const active = PFApp.getActiveRound();

    if (!active) return;

    document
      .getElementById(`round-${active.id}`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  });

  chooseMatch.addEventListener("click", function () {
    document
      .getElementById("matchChooserSection")
      .scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  });

  undoScore.addEventListener("click", function () {
    try {
      PFApp.undoLastScore();
      render();
      PFUI.toast("Perubahan skor terakhir dibatalkan.");
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  nextRound.addEventListener("click", function () {
    try {
      const next = PFApp.startNextRound();

      render();

      PFUI.toast(
        next
          ? `Ronde ${next.number} dimulai.`
          : "Seluruh jadwal selesai."
      );
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

  document.getElementById("addParticipant").addEventListener(
    "click",
    function () {
      location.href = "players.html";
    }
  );

  render();
});
