document.addEventListener("DOMContentLoaded", function () {
  const session = PFApp.requireSession();
  const form = document.getElementById("setupForm");
  const scoreSystem = document.getElementById("scoreSystem");
  const modeOptions = document.querySelectorAll("[data-mode]");
  const resumeButton = document.getElementById("resumeTournament");
  const saveButton = document.getElementById("saveSetup");
  const locked = document.getElementById("setupLocked");

  document.getElementById("matchName").value =
    session.setup.matchName;
  document.getElementById("courtCount").value =
    session.setup.courtCount;
  document.getElementById("minimumGames").value =
    session.setup.minimumGames;

  scoreSystem.value =
    session.setup.scoreMode === "manual"
      ? "manual"
      : `fixed:${session.setup.pointsTotal}`;

  const selectedMode = document.querySelector(
    `input[name="randomMode"][value="${session.setup.randomMode}"]`
  );

  if (selectedMode) selectedMode.checked = true;

  function renderModes() {
    modeOptions.forEach(option => {
      const input = option.querySelector("input");

      option.classList.toggle(
        "selected",
        input.checked
      );
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

  if (session.submitted) {
    form.querySelectorAll("input, select").forEach(control => {
      control.disabled = true;
    });

    saveButton.classList.add("hidden");
    resumeButton.classList.remove("hidden");
    locked.classList.remove("hidden");
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
        matchName:
          document.getElementById("matchName").value,
        randomMode:
          document.querySelector(
            'input[name="randomMode"]:checked'
          ).value,
        scoreMode,
        pointsTotal,
        courtCount: Number(
          document.getElementById("courtCount").value
        ),
        minimumGames: Number(
          document.getElementById("minimumGames").value
        )
      });

      PFUI.toast("Pengaturan turnamen tersimpan.");

      setTimeout(() => {
        location.href = "players.html";
      }, 350);
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  resumeButton.addEventListener("click", function () {
    location.href =
      session.status === "completed"
        ? "leaderboard.html"
        : "matches.html";
  });

  renderModes();
});
