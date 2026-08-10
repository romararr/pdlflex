document.addEventListener("DOMContentLoaded", function () {
  const grid = document.getElementById("sessionGrid");
  const search = document.getElementById("sessionSearch");
  const statusFilter = document.getElementById("statusFilter");
  const installButton = document.getElementById("installApp");
  let installPrompt = null;

  function routeFor(session) {
    if (!session.setup.initialized) return "setup.html";
    if (!session.submitted) return "players.html";
    if (session.status === "completed") return "leaderboard.html";
    return "matches.html";
  }

  function statusBadge(status) {
    if (status === "completed") {
      return '<span class="badge badge-success">Selesai</span>';
    }

    if (status === "active") {
      return '<span class="badge">Aktif</span>';
    }

    if (status === "archived") {
      return '<span class="badge badge-warning">Arsip</span>';
    }

    return '<span class="badge">Draft</span>';
  }

  function renderMetrics() {
    const sessions = PFApp.getSessions({
      includeArchived: true
    });

    const active = sessions.filter(
      session => session.status === "active"
    ).length;

    const completed = sessions.filter(
      session => session.status === "completed"
    ).length;

    const participants = sessions.reduce((total, session) => {
      return total + (
        session.setup.randomMode === "team"
          ? session.teams.length
          : session.players.length
      );
    }, 0);

    document.getElementById("metricSessions").textContent =
      sessions.length;
    document.getElementById("metricActive").textContent =
      active;
    document.getElementById("metricCompleted").textContent =
      completed;
    document.getElementById("metricParticipants").textContent =
      participants;
  }

  function render() {
    renderMetrics();

    const query = search.value.trim().toLowerCase();
    const status = statusFilter.value;

    const sessions = PFApp.getSessions({
      includeArchived: true
    }).filter(session => {
      const nameMatch =
        session.setup.matchName
          .toLowerCase()
          .includes(query);

      const statusMatch =
        status === "all" ||
        session.status === status;

      return nameMatch && statusMatch;
    });

    if (!sessions.length) {
      grid.innerHTML = `
        <div class="card" style="grid-column:1/-1">
          <div class="empty">
            <div class="empty-icon">🏆</div>
            <strong>Belum ada turnamen</strong>
            <div>Buat turnamen baru untuk memulai.</div>
          </div>
        </div>`;
      return;
    }

    grid.innerHTML = sessions.map(session => {
      const summary = PFApp.sessionSummary(session);
      const mode =
        session.setup.randomMode === "team"
          ? "Per Tim"
          : "Per Player";

      return `
        <article class="session-card">
          <div class="session-card-head">
            <div class="list-main">
              <h3>${PFUI.escapeHtml(summary.name)}</h3>
              <div class="list-meta">
                Diperbarui ${PFUI.formatDate(summary.updatedAt)}
              </div>
            </div>
            ${statusBadge(summary.status)}
          </div>

          <div class="session-card-meta">
            <span class="badge">${mode}</span>
            <span class="badge">${summary.entityCount} peserta</span>
            <span class="badge">${summary.rounds} ronde</span>
            <span class="badge">${summary.completedMatches}/${summary.matches} match</span>
          </div>

          <div class="fairness">
            <div class="fairness-meter">
              <div
                class="fairness-bar"
                style="width:${summary.fairness.score}%">
              </div>
            </div>
            <span class="fairness-value">
              ${summary.fairness.score}% rata
            </span>
          </div>

          <div class="session-actions" style="margin-top:15px">
            ${summary.status === "archived" ? `
              <button
                class="btn btn-soft btn-sm"
                data-action="restore"
                data-id="${session.id}">
                Pulihkan
              </button>` : `
              <button
                class="btn btn-primary btn-sm"
                data-action="open"
                data-id="${session.id}">
                Buka
              </button>

              <button
                class="btn btn-secondary btn-sm"
                data-action="duplicate"
                data-id="${session.id}">
                Duplikasi
              </button>

              <button
                class="btn btn-warning btn-sm"
                data-action="archive"
                data-id="${session.id}">
                Arsip
              </button>`}

            <button
              class="btn btn-danger btn-sm"
              data-action="delete"
              data-id="${session.id}">
              Hapus
            </button>
          </div>
        </article>`;
    }).join("");
  }

  document.getElementById("newSession").addEventListener(
    "click",
    function () {
      PFApp.createDraft();
      location.href = "setup.html";
    }
  );

  grid.addEventListener("click", function (event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;
    const session = PFApp.getSession(id);

    if (!session) return;

    try {
      if (action === "open") {
        PFApp.selectSession(id);
        location.href = routeFor(session);
        return;
      }

      if (action === "duplicate") {
        PFApp.duplicateSession(id);
        PFUI.toast("Turnamen berhasil diduplikasi.");
        setTimeout(() => {
          location.href = "setup.html";
        }, 350);
        return;
      }

      if (action === "archive") {
        if (!confirm(`Arsipkan ${session.setup.matchName}?`)) {
          return;
        }

        PFApp.archiveSession(id);
        PFUI.toast("Turnamen dipindahkan ke arsip.");
      }

      if (action === "restore") {
        PFApp.restoreSession(id);
        PFUI.toast("Turnamen dipulihkan.");
      }

      if (action === "delete") {
        if (
          !confirm(
            `Hapus permanen ${session.setup.matchName}?`
          )
        ) {
          return;
        }

        PFApp.deleteSession(id);
        PFUI.toast("Turnamen dihapus.");
      }

      render();
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  search.addEventListener("input", render);
  statusFilter.addEventListener("change", render);

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    installButton.classList.remove("hidden");
  });

  installButton.addEventListener("click", async function () {
    if (!installPrompt) {
      PFUI.toast(
        "Gunakan menu browser lalu pilih Install app / Add to Home Screen."
      );
      return;
    }

    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.classList.add("hidden");
  });

  render();
});
