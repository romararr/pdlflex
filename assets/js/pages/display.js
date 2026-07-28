document.addEventListener("DOMContentLoaded", function () {
  const currentMatch = document.getElementById("displayCurrent");
  const leaderboard = document.getElementById("displayLeaderboard");

  function sideName(session, match, side) {
    const ids = side === "A" ? match.teamA : match.teamB;

    if (session.setup.randomMode === "team") {
      return PFApp.entityName(ids[0], session);
    }

    return ids
      .map(id => PFApp.entityName(id, session))
      .join(" & ");
  }

  function render() {
    PFApp.refresh();

    const session = PFApp.getSelectedSession();

    if (!session) {
      document.getElementById("displayName").textContent =
        "Belum ada turnamen";
      currentMatch.innerHTML =
        '<div class="empty"><strong>Pilih turnamen dari dashboard.</strong></div>';
      leaderboard.innerHTML = "";
      return;
    }

    const active = PFApp.getActiveRound(session);
    const stats = PFApp.computeStats(session);

    document.getElementById("displayName").textContent =
      session.setup.matchName;

    document.getElementById("displayMeta").textContent =
      `${session.setup.randomMode === "team" ? "Per Tim" : "Per Player"} · ` +
      `${session.setup.scoreMode === "fixed"
        ? `Total ${session.setup.pointsTotal}`
        : "Skor Manual"} · ` +
      `${session.setup.courtCount} court`;

    if (!active) {
      currentMatch.innerHTML = `
        <div class="empty">
          <div class="empty-icon">🎾</div>
          <strong>Tidak ada ronde aktif</strong>
          <div>Aktifkan pertandingan dari halaman operator.</div>
        </div>`;
    } else {
      currentMatch.innerHTML = `
        <div>
          <span class="badge">Ronde ${active.number}</span>
          <h2 style="margin:12px 0 0;font-size:28px">Pertandingan Aktif</h2>
        </div>

        <div class="match-list" style="padding:18px 0 0">
          ${active.matches.map(match => `
            <div class="match ${!match.completed ? "current" : ""}">
              <div class="match-top">
                <span class="court">Court ${match.court}</span>
                <span class="badge ${match.completed ? "badge-success" : ""}">
                  ${match.completed ? "Selesai" : "Sedang dimainkan"}
                </span>
              </div>

              <div class="scoreboard">
                <div class="team">
                  <div class="team-name">
                    ${PFUI.escapeHtml(sideName(session, match, "A"))}
                  </div>
                  <div class="display-score">
                    ${match.scoreA === "" ? "–" : match.scoreA}
                  </div>
                </div>

                <div class="vs">VS</div>

                <div class="team">
                  <div class="team-name">
                    ${PFUI.escapeHtml(sideName(session, match, "B"))}
                  </div>
                  <div class="display-score">
                    ${match.scoreB === "" ? "–" : match.scoreB}
                  </div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>`;
    }

    leaderboard.innerHTML = `
      <h2 style="margin:0 0 14px">Top Leaderboard</h2>
      <div class="list">
        ${stats.sorted
          .filter(item => item.played > 0)
          .slice(0, 10)
          .map(item => `
            <div class="list-item">
              <div style="display:flex;align-items:center;gap:11px;min-width:0">
                <span class="rank ${item.rank <= 3 ? "top" : ""}">
                  ${item.rank}
                </span>

                <div class="list-main">
                  <div class="list-title">
                    ${PFUI.escapeHtml(item.name)}
                  </div>
                  <div class="list-meta">
                    ${item.wins}-${item.losses}-${item.ties}
                    · Diff ${item.diff}
                  </div>
                </div>
              </div>

              <span class="points">${item.points}</span>
            </div>
          `).join("")}
      </div>`;

    document.getElementById("displayClock").textContent =
      new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
      });
  }

  window.addEventListener(
    "padelflex:display-refresh",
    render
  );

  setInterval(render, 3000);
  render();
});
