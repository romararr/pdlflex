document.addEventListener("DOMContentLoaded", function () {
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

  function pendingMatches() {
    const current = session();

    return current.rounds
      .filter(round => round.status !== "completed")
      .sort((a, b) =>
        Number(b.status === "active") -
        Number(a.status === "active") ||
        a.number - b.number
      )
      .flatMap(round =>
        round.matches
          .filter(match => !match.completed)
          .map(match => ({ round, match }))
      );
  }

  function activateAndFocus(roundId, matchId) {
    try {
      const round = PFApp.activateRound(roundId);

      render();

      PFUI.toast(`Ronde ${round.number} sekarang aktif.`);

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
        <span>Kemerataan</span>
        <strong>${fairness.score}%</strong>
        <small>${fairness.min}-${fairness.max} game/peserta</small>
      </div>

      <div class="stat">
        <span>Perubahan skor</span>
        <strong>${current.scoreHistory.length}</strong>
        <small>bisa di-undo</small>
      </div>`;

    document.getElementById("fairnessBar").style.width =
      `${fairness.score}%`;

    document.getElementById("fairnessLabel").textContent =
      `${fairness.score}% · selisih ${fairness.difference} game`;
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

    chooser.innerHTML = items.map(({ round, match }) => {
      const active = round.status === "active";

      return `
        <div class="match-choice ${active ? "active" : ""}">
          <div style="display:flex;justify-content:space-between;gap:7px">
            <span class="badge ${active ? "badge-success" : ""}">
              Ronde ${round.number} · Court ${match.court}
            </span>
            <span class="list-meta">
              ${active ? "Aktif" : "Menunggu"}
            </span>
          </div>

          <strong class="match-choice-title">
            ${PFUI.escapeHtml(sideName(match, "A"))}
            <span style="color:var(--muted)">vs</span>
            ${PFUI.escapeHtml(sideName(match, "B"))}
          </strong>

          <button
            class="btn ${active ? "btn-soft" : "btn-primary"} btn-sm"
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

    return '<span class="badge">Menunggu</span>';
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
          <span class="court">Court ${match.court}</span>
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
            <div class="empty-icon">⌕</div>
            <strong>Tidak ada ronde yang cocok</strong>
            <div>Ubah filter atau pencarian.</div>
          </div>
        </div>`;
      return;
    }

    roundsContainer.innerHTML = rounds.map(round => `
      <section class="round" id="round-${round.id}">
        <div class="round-head">
          <div>
            <strong>Ronde ${round.number}</strong>
            <small>
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
                class="btn btn-secondary btn-sm"
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
        const round = PFApp.activateRound(
          button.dataset.round
        );

        render();
        PFUI.toast(`Ronde ${round.number} aktif.`);
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
      PFApp.completeTournament(false);
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
