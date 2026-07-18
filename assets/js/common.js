(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message) {
    const element = document.getElementById("toast");

    if (!element) return;

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toast.timer);
    toast.timer = setTimeout(
      () => element.classList.remove("show"),
      2500
    );
  }

  function safeFileName(value) {
    return String(value || "padelflex")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "padelflex";
  }

  function csvValue(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function downloadText(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.click();

    URL.revokeObjectURL(url);
  }

  function currentStep() {
    const page = document.body.dataset.page;

    if (page === "setup") return 1;
    if (page === "players") return 2;
    if (page === "matches") return 4;
    if (page === "leaderboard") return 5;

    return 1;
  }

  function renderStepper() {
    const state = PFApp.getState();
    const activeStep = currentStep();

    document.querySelectorAll("[data-step]").forEach(element => {
      const step = Number(element.dataset.step);
      const done =
        step === 1
          ? state.setup.initialized
          : step === 2
            ? PFApp.getEntities().length > 0
            : step === 3
              ? state.submitted
              : step === 4
                ? state.rounds.some(round =>
                    round.matches.some(match => match.completed)
                  )
                : false;

      element.classList.toggle("active", step === activeStep);
      element.classList.toggle("done", done && step !== activeStep);
    });
  }

  function renderHeader() {
    const state = PFApp.getState();
    const title = document.getElementById("headerMatchName");
    const subtitle = document.getElementById("headerMatchMeta");

    if (title) title.textContent = state.setup.matchName || "PadelFlex";

    if (subtitle) {
      const mode =
        state.setup.randomMode === "team"
          ? "Per Tim"
          : "Per Player";

      const scoring =
        state.setup.scoreMode === "fixed"
          ? `Total ${state.setup.pointsTotal}`
          : "Skor Manual";

      subtitle.textContent =
        `${mode} · ${scoring} · ${state.setup.courtCount} court`;
    }
  }

  function guardPage() {
    const state = PFApp.getState();
    const page = document.body.dataset.page;

    if (
      page !== "setup" &&
      !state.setup.initialized
    ) {
      location.href = "index.html";
      return;
    }

    if (
      page === "matches" &&
      !state.submitted
    ) {
      location.href = "players.html";
    }
  }

  function init() {
    guardPage();
    renderHeader();
    renderStepper();

    window.addEventListener(
      "padelflex:state",
      function () {
        renderHeader();
        renderStepper();
      }
    );

    window.addEventListener("storage", event => {
      if (event.key === PFStorage.STORAGE_KEY) {
        PFApp.refresh();
        location.reload();
      }
    });
  }

  window.PFUI = {
    escapeHtml,
    toast,
    safeFileName,
    csvValue,
    downloadText,
    renderHeader,
    renderStepper
  };

  document.addEventListener("DOMContentLoaded", init);
})();
