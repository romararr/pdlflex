document.addEventListener("DOMContentLoaded", function () {
  const roundsContainer = document.getElementById("roundsContainer");
  const deferredSection = document.getElementById("deferredSection");
  const deferredQueue = document.getElementById("deferredQueue");
  const deferredCount = document.getElementById("deferredCount");
  const sticky = document.getElementById("stickyActions");
  const stickyTitle = document.getElementById("stickyTitle");
  const stickySubtitle = document.getElementById("stickySubtitle");
  const viewActiveButton = document.getElementById("viewActive");
  const playDeferredButton = document.getElementById("playDeferred");
  const nextRoundButton = document.getElementById("nextRound");

  function sideName(match, side) {
    const ids = side === "A" ? match.teamA : match.teamB;

    if (PFApp.getState().setup.randomMode === "team") {
      return PFApp.entityName(ids[0]);
    }

    return ids.map(PFApp.entityName).join(" & ");
  }

  function sideDetails(match, side) {
    if (PFApp.getState().setup.randomMode !== "team") {
      return "";
    }

    const ids = side === "A" ? match.teamA : match.teamB;
    return PFApp.entityDetails(ids[0]);
  }

  function roundStatus(round) {
    if (round.status === "completed") {
      return '<span class="badge badge-success">Selesai</span>';
    }

    if (round.status === "active") {
      return '<span class="badge">Sedang dimainkan</span>';
    }

    if (round.deferred) {
      return '<span class="badge badge-warning">Ditunda</span>';
    }

    return '<span class="badge">Terjadwal</span>';
  }

  function matchStatus(match, round) {
    if (match.completed) {
      return '<span class="badge badge-success">Skor tersimpan</span>';
    }

    if (match.status === "deferred" || round.deferred) {
      return '<span class="badge badge-warning">Ditunda</span>';
    }

    if (round.status === "active") {
      return '<span class="badge">Siap dimainkan</span>';
    }

    return '<span class="badge">Menunggu</span>';
  }

  function scoreHelp() {
    const setup = PFApp.getState().setup;

    return setup.scoreMode === "fixed"
      ? `Isi salah satu skor. Skor lawan otomatis dihitung dari total ${setup.pointsTotal}.`
      : "Isi kedua skor. Hasil tersimpan otomatis setelah keduanya terisi.";
  }

  function renderMatch(round, match) {
    const setup = PFApp.getState().setup;
    const winnerA =
      match.completed &&
      Number(match.scoreA) > Number(match.scoreB);
    const winnerB =
      match.completed &&
      Number(match.scoreB) > Number(match.scoreA);

    const disabled =
      round.status !== "active"
        ? "disabled"
        : "";

    const detailA = sideDetails(match, "A");
    const detailB = sideDetails(match, "B");

    const classNames = [
      "match",
      round.status === "active" && !match.completed ? "current" : "",
      match.status === "deferred" || round.deferred ? "deferred" : ""
    ].filter(Boolean).join(" ");

    return `
      <div class="${classNames}" id="match-${match.id}">
        <div class="match-top">
          <span class="court">Court ${match.court}</span>
          ${matchStatus(match, round)}
        </div>

        <div class="scoreboard">
          <div class="team ${winnerA ? "winner" : ""}">
            <div class="team-name">
              <span>${PFUI.escapeHtml(sideName(match, "A"))}</span>
              ${detailA ? `<small class="list-meta">${PFUI.escapeHtml(detailA)}</small>` : ""}
            </div>
            <input
              class="score-input"
              type="number"
              min="0"
              ${setup.scoreMode === "fixed" ? `max="${setup.pointsTotal}"` : ""}
              value="${match.scoreA}"
              data-score="A"
              data-round="${round.id}"
              data-match="${match.id}"
              ${disabled}
              aria-label="Skor sisi A">
          </div>

          <div class="vs">VS</div>

          <div class="team ${winnerB ? "winner" : ""}">
            <div class="team-name">
              <span>${PFUI.escapeHtml(sideName(match, "B"))}</span>
              ${detailB ? `<small class="list-meta">${PFUI.escapeHtml(detailB)}</small>` : ""}
            </div>
            <input
              class="score-input"
              type="number"
              min="0"
              ${setup.scoreMode === "fixed" ? `max="${setup.pointsTotal}"` : ""}
              value="${match.scoreB}"
              data-score="B"
              data-round="${round.id}"
              data-match="${match.id}"
              ${disabled}
              aria-label="Skor sisi B">
          </div>
        </div>

        <div class="hint">${scoreHelp()}</div>

        // ${round.status === "active" && !match.completed ? `
        //   <div class="match-actions">
        //     <button
        //       class="btn btn-warning btn-sm"
        //       data-action="skip"
        //       data-round="${round.id}"
        //       data-match="${match.id}">
        //       Tunda / Skip Match
        //     </button>
        //   </div>` : ""}
      </div>`;
  }


  function renderDeferredQueue() {
    const deferredRounds = PFApp.getDeferredRounds();

    deferredSection.classList.toggle(
      "hidden",
      deferredRounds.length === 0
    );

    deferredCount.textContent =
      `${deferredRounds.length} match`;

    playDeferredButton.classList.toggle(
      "hidden",
      deferredRounds.length === 0
    );

    if (!deferredRounds.length) {
      deferredQueue.innerHTML = "";
      return;
    }

    deferredQueue.innerHTML = deferredRounds.map(round => {
      const match = round.matches.find(item => !item.completed);

      if (!match) return "";

      return `
        <div class="list-item">
          <div class="list-main">
            <div class="list-title">
              ${PFUI.escapeHtml(sideName(match, "A"))}
              <span style="color:var(--muted)">vs</span>
              ${PFUI.escapeHtml(sideName(match, "B"))}
            </div>
            <div class="list-meta">
              Sebelumnya Court ${match.court} ·
              Ditunda ${match.deferredCount || 1}× ·
              Sekarang berada di antrean akhir
            </div>
          </div>

          <button
            class="btn btn-warning btn-sm"
            data-action="play-deferred"
            data-round="${round.id}">
            Mainkan Lagi
          </button>
        </div>`;
    }).join("");
  }

  function playDeferredRound(roundId = null) {
    try {
      const deferredRounds = PFApp.getDeferredRounds();
      const targetId = roundId || deferredRounds[0]?.id;

      if (!targetId) {
        PFUI.toast("Tidak ada match tertunda.");
        return;
      }

      const round = PFApp.activateRound(targetId);
      render();

      PFUI.toast(
        `Match tertunda pada Ronde ${round.number} sekarang aktif.`
      );

      setTimeout(() => {
        document
          .getElementById(`round-${round.id}`)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
      }, 80);
    } catch (error) {
      PFUI.toast(error.message);
    }
  }

  function renderSticky() {
    const active = PFApp.getActiveRound();
    const deferredRounds = PFApp.getDeferredRounds();

    if (!active && !deferredRounds.length) {
      sticky.classList.add("hidden");
      return;
    }

    sticky.classList.remove("hidden");

    if (!active) {
      stickyTitle.textContent = "Tidak ada ronde aktif";
      stickySubtitle.textContent =
        `${deferredRounds.length} match tertunda masih menunggu untuk dimainkan.`;

      viewActiveButton.classList.add("hidden");
      nextRoundButton.classList.add("hidden");
      playDeferredButton.classList.toggle(
        "hidden",
        deferredRounds.length === 0
      );
      return;
    }

    const unfinished =
      active.matches.filter(match => !match.completed).length;
    const allCompleted =
      active.matches.length > 0 && unfinished === 0;
    const next = PFApp.getNextRound(active.id);

    stickyTitle.textContent =
      allCompleted
        ? `Ronde ${active.number} selesai`
        : `Ronde ${active.number} sedang berjalan`;

    stickySubtitle.textContent =
      allCompleted
        ? (next
            ? `Ronde ${next.number} siap dimainkan.`
            : "Seluruh jadwal telah selesai.")
        : `${unfinished} pertandingan belum selesai.` +
          (deferredRounds.length
            ? ` ${deferredRounds.length} match tertunda dapat dimainkan kembali kapan saja.`
            : " Match yang belum ready dapat ditunda.");

    viewActiveButton.classList.toggle("hidden", allCompleted);
    nextRoundButton.classList.toggle("hidden", !allCompleted);

    nextRoundButton.textContent =
      next
        ? `Mulai Ronde ${next.number}`
        : "Akhiri Pertandingan";
  }

  function render() {
    const state = PFApp.getState();
    const active = PFApp.getActiveRound();

    document.getElementById("matchSummary").innerHTML = `
      <div class="summary">
        <span>Jenis random</span>
        <strong>${state.setup.randomMode === "team" ? "Tim" : "Player"}</strong>
      </div>
      <div class="summary">
        <span>Sistem skor</span>
        <strong>${state.setup.scoreMode === "fixed" ? `Total ${state.setup.pointsTotal}` : "Manual"}</strong>
      </div>
      <div class="summary">
        <span>Total ronde</span>
        <strong>${state.rounds.length}</strong>
      </div>
      <div class="summary">
        <span>Match selesai</span>
        <strong>${state.rounds.reduce(
          (total, round) =>
            total + round.matches.filter(match => match.completed).length,
          0
        )}</strong>
      </div>`;

    roundsContainer.innerHTML = [...state.rounds]
      .sort((a, b) => a.number - b.number)
      .map(round => `
        <div class="round" id="round-${round.id}">
          <div class="round-head">
            <div>
              <strong>Ronde ${round.number}</strong>
              <small>
                ${round.matches.length} match ·
                ${round.matches.filter(match => match.completed).length} selesai
                ${round.deferred ? " · antrean tunda" : ""}
              </small>
            </div>

            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              ${roundStatus(round)}
              ${round.status === "scheduled" ? `
                <button
                  class="btn btn-secondary btn-sm"
                  data-action="activate-round"
                  data-round="${round.id}">
                  Mainkan Sekarang
                </button>` : ""}
            </div>
          </div>

          <div class="match-list">
            ${round.matches.map(match => renderMatch(round, match)).join("")}
          </div>

          ${round.resting.length ? `
            <div class="resting">
              <strong>Istirahat:</strong>
              ${round.resting
                .map(id => PFUI.escapeHtml(PFApp.entityName(id)))
                .join(", ")}
            </div>` : ""}
        </div>
      `).join("");

    renderDeferredQueue();
    renderSticky();

    if (active) {
      document
        .getElementById(`round-${active.id}`)
        ?.classList.add("active-round");
    }
  }


  deferredQueue.addEventListener("click", function (event) {
    const button = event.target.closest('[data-action="play-deferred"]');

    if (!button) return;

    playDeferredRound(button.dataset.round);
  });

  playDeferredButton.addEventListener("click", function () {
    playDeferredRound();
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

  roundsContainer.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    try {
      if (button.dataset.action === "skip") {
        const result = PFApp.skipMatch(
          button.dataset.round,
          button.dataset.match
        );

        render();

        PFUI.toast(
          result.activeRound
            ? `Match ditunda. Ronde ${result.activeRound.number} sekarang aktif.`
            : "Match ditunda ke belakang antrean."
        );
      }

      if (button.dataset.action === "activate-round") {
        const round = PFApp.activateRound(button.dataset.round);
        render();
        PFUI.toast(`Ronde ${round.number} sekarang aktif.`);
      }
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  viewActiveButton.addEventListener("click", function () {
    const active = PFApp.getActiveRound();

    if (!active) return;

    document
      .getElementById(`round-${active.id}`)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  });

  nextRoundButton.addEventListener("click", function () {
    try {
      const next = PFApp.startNextRound();
      render();

      PFUI.toast(
        next
          ? `Ronde ${next.number} dimulai.`
          : "Seluruh pertandingan selesai."
      );
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  document.getElementById("addMidPlayer").addEventListener(
    "click",
    function () {
      location.href = "players.html";
    }
  );

  render();
});
