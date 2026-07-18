document.addEventListener("DOMContentLoaded", function () {
  const state = PFApp.getState();
  const form = document.getElementById("setupForm");
  const modeOptions = document.querySelectorAll("[data-mode-option]");
  const scoreSystem = document.getElementById("scoreSystem");
  const lockedNotice = document.getElementById("lockedNotice");
  const saveButton = document.getElementById("saveSetup");
  const resumeButton = document.getElementById("resumeMatch");

  document.getElementById("matchName").value = state.setup.matchName;
  document.getElementById("courtCount").value = state.setup.courtCount;
  document.getElementById("minimumGames").value = state.setup.minimumGames;

  scoreSystem.value =
    state.setup.scoreMode === "manual"
      ? "manual"
      : `fixed:${state.setup.pointsTotal}`;

  document.querySelector(
    `input[name="randomMode"][value="${state.setup.randomMode}"]`
  ).checked = true;

  function renderModes() {
    modeOptions.forEach(option => {
      const input = option.querySelector("input");
      option.classList.toggle("selected", input.checked);
    });
  }

  modeOptions.forEach(option => {
    option.addEventListener("click", function () {
      const input = option.querySelector("input");

      if (input.disabled) return;

      input.checked = true;
      renderModes();
    });
  });

  if (state.submitted) {
    form.querySelectorAll("input, select").forEach(control => {
      control.disabled = true;
    });

    saveButton.classList.add("hidden");
    resumeButton.classList.remove("hidden");
    lockedNotice.classList.remove("hidden");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    try {
      const scoreValue = scoreSystem.value;
      const scoreMode =
        scoreValue === "manual"
          ? "manual"
          : "fixed";

      const pointsTotal =
        scoreMode === "fixed"
          ? Number(scoreValue.split(":")[1])
          : 0;

      PFApp.saveSetup({
        matchName: document.getElementById("matchName").value,
        randomMode:
          document.querySelector('input[name="randomMode"]:checked').value,
        scoreMode,
        pointsTotal,
        courtCount: Number(
          document.getElementById("courtCount").value
        ),
        minimumGames: Number(
          document.getElementById("minimumGames").value
        )
      });

      PFUI.toast("Inisialisasi pertandingan tersimpan.");
      setTimeout(() => {
        location.href = "players.html";
      }, 350);
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  resumeButton.addEventListener("click", function () {
    location.href = "matches.html";
  });

  document.getElementById("resetSession").addEventListener("click", function () {
    const confirmation = prompt(
      'Ketik "RESET" untuk memulai pertandingan baru.'
    );

    if (confirmation !== "RESET") {
      PFUI.toast("Reset dibatalkan.");
      return;
    }

    PFApp.reset();
    location.reload();
  });

  renderModes();
});
