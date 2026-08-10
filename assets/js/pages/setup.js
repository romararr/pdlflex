document.addEventListener("DOMContentLoaded", function () {
  if (window.__pfGuardRedirecting) return;

  const session = PFApp.requireSession();
  const form = document.getElementById("setupForm");
  const scoreSystem = document.getElementById("scoreSystem");
  const modeOptions = document.querySelectorAll("[data-mode]");
  const scheduleOptions = document.querySelectorAll("[data-schedule-mode]");
  const minimumGamesField = document.getElementById("minimumGamesField");
  const resumeButton = document.getElementById("resumeTournament");
  const saveButton = document.getElementById("saveSetup");
  const locked = document.getElementById("setupLocked");

  document.getElementById("matchName").value =
    session.setup.matchName;
  document.getElementById("courtCount").value =
    session.setup.courtCount;
  document.getElementById("minimumGames").value =
    session.setup.minimumGames;
  document.getElementById("minRestRounds").value =
    String(session.setup.minRestRounds ?? 1);

  scoreSystem.value =
    session.setup.scoreMode === "manual"
      ? "manual"
      : `fixed:${session.setup.pointsTotal}`;

  const selectedMode = document.querySelector(
    `input[name="randomMode"][value="${session.setup.randomMode}"]`
  );

  if (selectedMode) selectedMode.checked = true;

  const selectedScheduleMode = document.querySelector(
    `input[name="scheduleMode"][value="${session.setup.scheduleMode || "manual"}"]`
  );

  if (selectedScheduleMode) selectedScheduleMode.checked = true;

  function renderModes() {
    modeOptions.forEach(option => {
      const input = option.querySelector("input");

      option.classList.toggle(
        "selected",
        input.checked
      );
    });

    scheduleOptions.forEach(option => {
      const input = option.querySelector("input");

      option.classList.toggle(
        "selected",
        input.checked
      );
    });

    const scheduleMode =
      document.querySelector(
        'input[name="scheduleMode"]:checked'
      )?.value || "manual";

    minimumGamesField.classList.toggle(
      "hidden",
      scheduleMode !== "auto"
    );
  }

  modeOptions.forEach(option => {
    option.addEventListener("click", function () {
      const input = option.querySelector("input");

      if (input.disabled) return;

      input.checked = true;
      renderModes();
    });
  });

  scheduleOptions.forEach(option => {
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
        ),
        scheduleMode:
          document.querySelector(
            'input[name="scheduleMode"]:checked'
          )?.value || "manual",
        minRestRounds: Number(
          document.getElementById("minRestRounds").value
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
