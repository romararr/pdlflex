document.addEventListener("DOMContentLoaded", function () {
  const state = PFApp.getState();
  const playerForm = document.getElementById("playerForm");
  const teamForm = document.getElementById("teamForm");
  const list = document.getElementById("entityList");
  const count = document.getElementById("entityCount");
  const submitButton = document.getElementById("submitTournament");
  const recommendationBox = document.getElementById("recommendation");
  const modeTitle = document.getElementById("modeTitle");

  const isTeamMode = state.setup.randomMode === "team";

  playerForm.classList.toggle("hidden", isTeamMode);
  teamForm.classList.toggle("hidden", !isTeamMode);

  modeTitle.textContent = isTeamMode
    ? "Masukkan Tim Tetap"
    : "Masukkan Nama Pemain";

  function renderRecommendation() {
    const entities = PFApp.getEntities();

    if (
      entities.length <
      (isTeamMode ? 2 : 4)
    ) {
      recommendationBox.innerHTML =
        `<strong>Belum cukup peserta.</strong> ` +
        (isTeamMode
          ? "Masukkan minimal 2 tim."
          : "Masukkan minimal 4 pemain.");

      submitButton.disabled = true;
      return;
    }

    const recommendation = PFApp.getRecommendation([]);

    if (!recommendation.available) {
      recommendationBox.innerHTML =
        `<strong>Jadwal belum dapat dibuat.</strong> ` +
        PFUI.escapeHtml(recommendation.reason);

      submitButton.disabled = true;
      return;
    }

    recommendationBox.innerHTML =
      recommendation.exact
        ? `<strong>Jadwal siap:</strong> ${recommendation.rounds} ronde,
           ${recommendation.courts} court terpakai, dan setiap
           ${isTeamMode ? "tim" : "pemain"} mendapat
           ${recommendation.minGames} game.`
        : `<strong>Jadwal siap:</strong> ${recommendation.rounds} ronde.
           Hasil akhir ${recommendation.minGames}-${recommendation.maxGames}
           game per ${isTeamMode ? "tim" : "pemain"}.`;

    submitButton.disabled = state.submitted;
  }

  function render() {
    const current = PFApp.getState();
    const entities =
      current.setup.randomMode === "team"
        ? current.teams
        : current.players;

    count.textContent =
      `${entities.filter(entity => entity.active !== false).length} aktif ` +
      `dari ${entities.length}`;

    if (!entities.length) {
      list.innerHTML = `
        <div class="empty">
          <div class="empty-icon">${isTeamMode ? "👥" : "＋"}</div>
          <strong>Belum ada ${isTeamMode ? "tim" : "pemain"}</strong>
          <div>Tambahkan peserta untuk menyiapkan jadwal otomatis.</div>
        </div>`;
    } else {
      list.innerHTML = entities.map(entity => {
        const details = isTeamMode
          ? `${PFUI.escapeHtml(entity.player1)} &amp; ${PFUI.escapeHtml(entity.player2)}`
          : `${entity.joinedAtRound > 1
              ? `Masuk sejak ronde ${entity.joinedAtRound}`
              : "Peserta awal"}`;

        return `
          <div class="list-item" style="${entity.active === false ? "opacity:.55" : ""}">
            <div style="display:flex;align-items:center;gap:11px;min-width:0">
              <span class="avatar">
                ${PFUI.escapeHtml(entity.name.slice(0, 2).toUpperCase())}
              </span>
              <div class="list-main">
                <div class="list-title">${PFUI.escapeHtml(entity.name)}</div>
                <div class="list-meta">${details}</div>
              </div>
            </div>
            <div class="list-actions">
              <button class="btn btn-soft btn-sm"
                data-action="toggle" data-id="${entity.id}">
                ${entity.active === false ? "Aktifkan" : "Istirahatkan"}
              </button>
              <button class="btn btn-danger btn-sm"
                data-action="remove" data-id="${entity.id}">
                Hapus
              </button>
            </div>
          </div>`;
      }).join("");
    }

    if (current.submitted) {
      submitButton.classList.add("hidden");
      document.getElementById("continueMatch").classList.remove("hidden");
      document.getElementById("midSessionNotice").classList.remove("hidden");
    }

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
          ? `${name} ditambahkan. ${rebuilt.generated} ronde mendatang disusun ulang.`
          : `${name} ditambahkan.`
      );
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  teamForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const teamName = document.getElementById("teamName");
    const player1 = document.getElementById("teamPlayer1");
    const player2 = document.getElementById("teamPlayer2");

    try {
      const rebuilt = PFApp.addTeam(
        teamName.value,
        player1.value,
        player2.value
      );

      const createdName =
        teamName.value.trim() ||
        `${player1.value.trim()} & ${player2.value.trim()}`;

      teamName.value = "";
      player1.value = "";
      player2.value = "";

      render();

      PFUI.toast(
        rebuilt
          ? `${createdName} ditambahkan. ${rebuilt.generated} ronde mendatang disusun ulang.`
          : `${createdName} ditambahkan.`
      );
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  list.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const entity = PFApp.getEntity(id);

    if (!entity) return;

    try {
      if (button.dataset.action === "toggle") {
        const active = entity.active === false;
        const rebuilt = PFApp.setEntityActive(id, active);

        PFUI.toast(
          rebuilt
            ? `${entity.name} ${active ? "diaktifkan" : "diistirahatkan"}. Jadwal mendatang disusun ulang.`
            : `${entity.name} ${active ? "diaktifkan" : "diistirahatkan"}.`
        );
      }

      if (button.dataset.action === "remove") {
        if (!confirm(`Hapus ${entity.name}?`)) return;

        const result = PFApp.removeEntity(id);

        PFUI.toast(
          result.deactivated
            ? "Peserta sudah masuk pertandingan aktif/selesai sehingga dinonaktifkan."
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
        `${result.generated} ronde dibuat otomatis.`
      );

      setTimeout(() => {
        location.href = "matches.html";
      }, 400);
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  document.getElementById("continueMatch").addEventListener(
    "click",
    function () {
      location.href = "matches.html";
    }
  );

  render();
});
