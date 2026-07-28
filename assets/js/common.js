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

  function formatDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function safeFileName(value) {
    return String(value || "padelflex")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
      "padelflex";
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

  function getPage() {
    return document.body.dataset.page || "";
  }

  function renderNavigation() {
    const page = getPage();

    document.querySelectorAll("[data-nav]").forEach(link => {
      link.classList.toggle(
        "active",
        link.dataset.nav === page
      );
    });
  }

  function renderHeader() {
    const session = PFApp.getSelectedSession();
    const title = document.getElementById("topbarTitle");
    const subtitle = document.getElementById("topbarSubtitle");

    if (title) {
      title.textContent =
        session?.setup.matchName ||
        "PadelFlex Pro";
    }

    if (subtitle) {
      if (!session) {
        subtitle.textContent =
          "Multi-turnamen · tanpa database";
      } else {
        const mode =
          session.setup.randomMode === "team"
            ? "Per Tim"
            : "Per Player";

        const score =
          session.setup.scoreMode === "fixed"
            ? `Total ${session.setup.pointsTotal}`
            : "Skor Manual";

        subtitle.textContent =
          `${mode} · ${score} · ${session.setup.courtCount} court`;
      }
    }
  }

  function renderSteps() {
    const session = PFApp.getSelectedSession();
    const page = getPage();

    const activeStep =
      page === "setup" ? 1 :
      page === "players" ? 2 :
      page === "matches" ? 4 :
      page === "leaderboard" ? 5 : 0;

    document.querySelectorAll("[data-step]").forEach(element => {
      const step = Number(element.dataset.step);

      const done =
        step === 1
          ? Boolean(session?.setup.initialized)
          : step === 2
            ? Boolean(
                session &&
                (
                  session.setup.randomMode === "team"
                    ? session.teams.length
                    : session.players.length
                )
              )
            : step === 3
              ? Boolean(session?.submitted)
              : step === 4
                ? Boolean(
                    session?.rounds.some(round =>
                      round.matches.some(match => match.completed)
                    )
                  )
                : Boolean(session?.status === "completed");

      element.classList.toggle("active", step === activeStep);
      element.classList.toggle(
        "done",
        done && step !== activeStep
      );
    });
  }

  function guard() {
    const page = getPage();

    if (
      ["hub", "settings", "display"].includes(page)
    ) {
      return;
    }

    const session = PFApp.getSelectedSession();

    if (!session) {
      location.href = "index.html";
      return;
    }

    if (
      page !== "setup" &&
      !session.setup.initialized
    ) {
      location.href = "setup.html";
      return;
    }

    if (
      page === "matches" &&
      !session.submitted
    ) {
      location.href = "players.html";
    }
  }

  function registerServiceWorker() {
    if (
      "serviceWorker" in navigator &&
      location.protocol !== "file:"
    ) {
      navigator.serviceWorker
        .register("sw.js")
        .catch(error => {
          console.warn("Service worker gagal:", error);
        });
    }
  }

  function init() {
    guard();
    renderNavigation();
    renderHeader();
    renderSteps();
    registerServiceWorker();

    window.addEventListener(
      "padelflex:state",
      function () {
        renderHeader();
        renderSteps();
      }
    );

    window.addEventListener("storage", event => {
      if (event.key === PFStorage.STORAGE_KEY) {
        PFApp.refresh();

        if (getPage() === "display") {
          window.dispatchEvent(
            new CustomEvent("padelflex:display-refresh")
          );
        } else {
          location.reload();
        }
      }
    });
  }

  window.PFUI = {
    escapeHtml,
    toast,
    formatDate,
    safeFileName,
    csvValue,
    downloadText,
    renderHeader,
    renderSteps
  };

  document.addEventListener("DOMContentLoaded", init);
})();
