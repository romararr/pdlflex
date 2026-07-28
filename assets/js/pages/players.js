document.addEventListener("DOMContentLoaded", function () {
  const session = PFApp.requireSession();
  const playerForm = document.getElementById("playerForm");
  const teamForm = document.getElementById("teamForm");
  const list = document.getElementById("entityList");
  const count = document.getElementById("entityCount");
  const recommendation = document.getElementById("recommendation");
  const submitButton = document.getElementById("submitTournament");
  const continueButton = document.getElementById("continueTournament");
  const batchPanel = document.getElementById("batchPanel");
  const isTeam = session.setup.randomMode === "team";

  playerForm.classList.toggle("hidden", isTeam);
  teamForm.classList.toggle("hidden", !isTeam);
  batchPanel.classList.toggle("hidden", isTeam);

  document.getElementById("rosterMode").textContent =
    isTeam ? "Tim Tetap" : "Pemain Individual";

  function allEntities() {
    return PFApp.getAllEntities();
  }

  function renderRecommendation() {
    const active = PFApp.getEntities();
    const minimum = isTeam ? 2 : 4;

    if (active.length < minimum) {
      recommendation.innerHTML =
        `<strong>Roster belum cukup.</strong> ` +
        (isTeam
          ? "Minimal 2 tim aktif."
          : "Minimal 4 pemain aktif.");

      submitButton.disabled = true;
      return;
    }

    const result = PFApp.getRecommendation(
      session,
      session.submitted ? null : []
    );

    if (!result.available) {
      recommendation.innerHTML =
        `<strong>Jadwal belum dapat dibuat.</strong> ` +
        PFUI.escapeHtml(result.reason);

      submitButton.disabled = true;
      return;
    }

    recommendation.innerHTML =
      result.exact
        ? `<strong>Pemerataan penuh:</strong>
           ${result.rounds} ronde tambahan,
           ${result.courts} court terpakai, dan setiap
           ${isTeam ? "tim" : "pemain"} mencapai
           ${result.minGames} game.`
        : `<strong>Pemerataan terbaik:</strong>
           ${result.rounds} ronde tambahan dengan hasil
           ${result.minGames}-${result.maxGames} game per
           ${isTeam ? "tim" : "pemain"}.`;

    submitButton.disabled = session.submitted;
  }

  function render() {
    const entities = allEntities();
    const activeCount = entities.filter(
      entity => entity.active !== false
    ).length;

    count.textContent =
      `${activeCount} aktif dari ${entities.length}`;

    if (!entities.length) {
      list.innerHTML = `
        <div class="empty">
          <div class="empty-icon">👥</div>
          <strong>Roster masih kosong</strong>
          <div>
            Tambahkan ${isTeam ? "tim" : "pemain"} untuk membuat jadwal.
          </div>
        </div>`;
    } else {
      list.innerHTML = entities.map(entity => {
        const details = isTeam
          ? `${entity.player1} & ${entity.player2}`
          : (
              entity.joinedAtRound > 1
                ? `Masuk sejak ronde ${entity.joinedAtRound}`
                : "Peserta awal"
            );

        return `
          <div
            class="list-item"
            style="${entity.active === false ? "opacity:.55" : ""}">

            <div style="display:flex;align-items:center;gap:11px;min-width:0">
              <span class="avatar">
                ${PFUI.escapeHtml(
                  entity.name.slice(0, 2).toUpperCase()
                )}
              </span>

              <div class="list-main">
                <div class="list-title">
                  ${PFUI.escapeHtml(entity.name)}
                </div>
                <div class="list-meta">
                  ${PFUI.escapeHtml(details)}
                </div>
              </div>
            </div>

            <div class="list-actions">
              <button
                class="btn btn-soft btn-sm"
                data-action="toggle"
                data-id="${entity.id}">
                ${entity.active === false
                  ? "Aktifkan"
                  : "Istirahatkan"}
              </button>

              <button
                class="btn btn-danger btn-sm"
                data-action="remove"
                data-id="${entity.id}">
                Hapus
              </button>
            </div>
          </div>`;
      }).join("");
    }

    document
      .getElementById("midSessionNotice")
      .classList.toggle("hidden", !session.submitted);

    submitButton.classList.toggle(
      "hidden",
      session.submitted
    );

    continueButton.classList.toggle(
      "hidden",
      !session.submitted
    );

    renderRecommendation();
  }

  playerForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const input = document.getElementById("playerName");
    const name = input.value.trim();

    try {
      const rebuilt = PFApp.addPlayer(name);

      input.value = "";
      render();

      PFUI.toast(
        rebuilt
          ? `${name} ditambahkan. ${rebuilt.generated} ronde mendatang dibuat ulang.`
          : `${name} ditambahkan.`
      );
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  teamForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("teamName");
    const player1 = document.getElementById("teamPlayer1");
    const player2 = document.getElementById("teamPlayer2");

    try {
      const createdName =
        name.value.trim() ||
        `${player1.value.trim()} & ${player2.value.trim()}`;

      const rebuilt = PFApp.addTeam(
        name.value,
        player1.value,
        player2.value
      );

      name.value = "";
      player1.value = "";
      player2.value = "";

      render();

      PFUI.toast(
        rebuilt
          ? `${createdName} ditambahkan. Jadwal mendatang disusun ulang.`
          : `${createdName} ditambahkan.`
      );
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  document.getElementById("addBatch").addEventListener(
    "click",
    function () {
      const textarea = document.getElementById("batchNames");
      const names = textarea.value
        .split(/\r?\n|,/)
        .map(name => name.trim())
        .filter(Boolean);

      if (!names.length) {
        PFUI.toast("Belum ada nama untuk ditambahkan.");
        return;
      }

      let added = 0;
      const errors = [];

      names.forEach(name => {
        try {
          PFApp.addPlayer(name);
          added++;
        } catch (error) {
          errors.push(`${name}: ${error.message}`);
        }
      });

      textarea.value = "";
      render();

      PFUI.toast(
        `${added} pemain ditambahkan` +
        (errors.length ? `, ${errors.length} dilewati.` : ".")
      );
    }
  );

  list.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const entity = PFApp.getEntity(button.dataset.id);

    if (!entity) return;

    try {
      if (button.dataset.action === "toggle") {
        const nextActive = entity.active === false;

        PFApp.setEntityActive(
          entity.id,
          nextActive
        );

        PFUI.toast(
          `${entity.name} ${nextActive
            ? "diaktifkan"
            : "diistirahatkan"}.`
        );
      }

      if (button.dataset.action === "remove") {
        if (!confirm(`Hapus ${entity.name}?`)) return;

        const result = PFApp.removeEntity(entity.id);

        PFUI.toast(
          result.deactivated
            ? "Peserta sudah memiliki hasil/ronde aktif sehingga dinonaktifkan."
            : "Peserta dihapus."
        );
      }

      render();
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  submitButton.addEventListener("click", function () {
    try {
      const result = PFApp.submitTournament();

      PFUI.toast(
        `${result.generated} ronde berhasil dibuat.`
      );

      setTimeout(() => {
        location.href = "matches.html";
      }, 400);
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  continueButton.addEventListener("click", function () {
    location.href =
      session.status === "completed"
        ? "leaderboard.html"
        : "matches.html";
  });

  render();
});
