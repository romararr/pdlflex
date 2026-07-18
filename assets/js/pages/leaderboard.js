document.addEventListener("DOMContentLoaded", function () {
  const body = document.getElementById("leaderboardBody");
  const mobileRows = document.getElementById("mobileLeaderboardRows");
  const formula = document.getElementById("formula");

  function calculation() {
    return PFApp.computeStats();
  }

  function rankDisplay(item) {
    if (!item.rank) return '<span class="mobile-rank-number">—</span>';
    if (item.rank === 1) return '<span class="mobile-medal">🥇</span>';
    if (item.rank === 2) return '<span class="mobile-medal">🥈</span>';
    if (item.rank === 3) return '<span class="mobile-medal">🥉</span>';

    return `<span class="mobile-rank-number">${item.rank}</span>`;
  }

  function renderMobileSummary(state) {
    document.getElementById("mobileMatchName").textContent =
      state.setup.matchName || "Pertandingan Padel";

    document.getElementById("mobileRandomMode").textContent =
      state.setup.randomMode === "team"
        ? "Per Tim"
        : "Americano · Per Player";

    document.getElementById("mobileScoreMode").textContent =
      state.setup.scoreMode === "fixed"
        ? `${state.setup.pointsTotal} Points`
        : "Manual Score";

    const participantCount =
      state.setup.randomMode === "team"
        ? state.teams.filter(team => team.active !== false).length
        : state.players.filter(player => player.active !== false).length;

    const participantLabel =
      state.setup.randomMode === "team"
        ? `${participantCount} Teams`
        : `${participantCount} Players`;

    document.getElementById("mobileParticipantMeta").textContent =
      `${participantLabel} · ${state.setup.courtCount} ` +
      `${Number(state.setup.courtCount) === 1 ? "Court" : "Courts"}`;
  }

  function render() {
    const state = PFApp.getState();
    const result = calculation();

    document.getElementById("leaderboardMode").textContent =
      state.setup.randomMode === "team"
        ? "Leaderboard Tim"
        : "Leaderboard Player";

    renderMobileSummary(state);

    if (!result.sorted.length) {
      body.innerHTML =
        '<tr><td colspan="7" style="text-align:center;color:var(--muted)">Belum ada peserta.</td></tr>';

      mobileRows.innerHTML = `
        <div class="mobile-leaderboard-empty">
          Belum ada peserta atau hasil pertandingan.
        </div>`;
    } else {
      body.innerHTML = result.sorted.map(item => `
        <tr style="${item.played === 0 ? "opacity:.5" : ""}">
          <td>
            ${item.rank
              ? `<span class="rank ${item.rank <= 3 ? "top" : ""}">${item.rank}</span>`
              : "—"}
          </td>
          <td>
            <strong>${PFUI.escapeHtml(item.name)}</strong>
            ${item.details
              ? `<div class="list-meta">${PFUI.escapeHtml(item.details)}</div>`
              : ""}
          </td>
          <td>${item.played}</td>
          <td>${item.wins}-${item.losses}-${item.ties}</td>
          <td>${item.diff > 0 ? "+" : ""}${item.diff}</td>
          <td>${item.compensation}</td>
          <td><span class="points">${item.points}</span></td>
        </tr>
      `).join("");

      mobileRows.innerHTML = result.sorted.map(item => `
        <div class="mobile-leaderboard-row ${item.played === 0 ? "not-played" : ""}">
          <div class="mobile-player-cell">
            <div class="mobile-rank">${rankDisplay(item)}</div>
            <div class="mobile-player-copy">
              <strong>${PFUI.escapeHtml(item.name)}</strong>
              ${item.details
                ? `<small>${PFUI.escapeHtml(item.details)}</small>`
                : ""}
            </div>
          </div>

          <div class="mobile-stat">${item.played}</div>
          <div class="mobile-stat mobile-wlt">${item.wins}-${item.losses}-${item.ties}</div>
          <div class="mobile-stat">${item.diff > 0 ? "+" : ""}${item.diff}</div>
          <div class="mobile-stat">${item.compensation}</div>
          <div class="mobile-stat mobile-points">${item.points}</div>
        </div>
      `).join("");
    }

    formula.innerHTML =
      state.setup.scoreMode === "fixed"
        ? `<strong>Rumus:</strong> P = skor yang dikumpulkan + kompensasi.
           Kompensasi setiap game yang lebih sedikit adalah
           <strong>${result.compensationPerMissed}</strong> poin.
           G terbanyak saat ini <strong>${result.maxGames}</strong>.`
        : `<strong>Rumus skor manual:</strong> menang 3 poin, seri 1 poin,
           kalah 0 poin. Tie-breaker memakai selisih skor.`;
  }

  document.getElementById("exportCsv").addEventListener(
    "click",
    function () {
      const state = PFApp.getState();
      const result = calculation();
      const rows = result.sorted.filter(item => item.played > 0);

      if (!rows.length) {
        PFUI.toast("Belum ada hasil untuk diexport.");
        return;
      }

      const data = [
        ["Nama pertandingan", state.setup.matchName],
        ["Jenis random", state.setup.randomMode === "team" ? "Per Tim" : "Per Player"],
        ["Sistem skor", state.setup.scoreMode === "fixed" ? `Total ${state.setup.pointsTotal}` : "Manual"],
        ["Tanggal export", new Date().toLocaleString("id-ID")],
        [],
        ["Rank", "Nama", "G", "W-L-T", "Diff", "+M", "P"]
      ];

      rows.forEach(item => {
        data.push([
          item.rank,
          item.name,
          item.played,
          `${item.wins}-${item.losses}-${item.ties}`,
          item.diff,
          item.compensation,
          item.points
        ]);
      });

      const csv =
        "\uFEFF" +
        data
          .map(row => row.map(PFUI.csvValue).join(";"))
          .join("\r\n");

      PFUI.downloadText(
        csv,
        `${PFUI.safeFileName(state.setup.matchName)}-leaderboard.csv`,
        "text/csv;charset=utf-8"
      );

      PFUI.toast("Leaderboard CSV berhasil dibuat.");
    }
  );

  document.getElementById("exportPng").addEventListener(
    "click",
    function () {
      const state = PFApp.getState();
      const rows = calculation().sorted.filter(item => item.played > 0);

      if (!rows.length) {
        PFUI.toast("Belum ada hasil untuk diexport.");
        return;
      }

      const width = 1100;
      const headerHeight = 180;
      const rowHeight = 72;
      const height = headerHeight + rows.length * rowHeight + 65;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;

      context.fillStyle = "#f4f7fb";
      context.fillRect(0, 0, width, height);

      context.fillStyle = "#246bfd";
      context.fillRect(0, 0, width, 125);

      context.fillStyle = "#ffffff";
      context.font = "700 22px Arial";
      context.fillText("PadelFlex Leaderboard", 52, 48);
      context.font = "800 36px Arial";
      context.fillText(state.setup.matchName, 52, 94);

      const columns = [52, 130, 535, 645, 785, 900, 1010];
      const headers = ["#", "Nama", "G", "W-L-T", "Diff", "+M", "P"];

      context.fillStyle = "#69758a";
      context.font = "700 17px Arial";

      headers.forEach((header, index) => {
        context.fillText(header, columns[index], 158);
      });

      rows.forEach((item, index) => {
        const y = headerHeight + index * rowHeight;

        context.fillStyle = "#ffffff";
        context.strokeStyle = "#e1e7f0";
        context.beginPath();
        context.roundRect(36, y, width - 72, rowHeight - 10, 15);
        context.fill();
        context.stroke();

        context.fillStyle = "#172033";
        context.font = "700 19px Arial";
        context.fillText(String(item.rank), columns[0], y + 38);
        context.fillText(item.name.slice(0, 30), columns[1], y + 38);

        context.font = "600 17px Arial";
        context.fillText(String(item.played), columns[2], y + 38);
        context.fillText(
          `${item.wins}-${item.losses}-${item.ties}`,
          columns[3],
          y + 38
        );
        context.fillText(String(item.diff), columns[4], y + 38);
        context.fillText(String(item.compensation), columns[5], y + 38);

        context.fillStyle = "#246bfd";
        context.font = "800 21px Arial";
        context.fillText(String(item.points), columns[6], y + 38);
      });

      context.fillStyle = "#69758a";
      context.font = "500 14px Arial";
      context.fillText(
        `Generated ${new Date().toLocaleString("id-ID")}`,
        52,
        height - 24
      );

      const anchor = document.createElement("a");
      anchor.download =
        `${PFUI.safeFileName(state.setup.matchName)}-leaderboard.png`;
      anchor.href = canvas.toDataURL("image/png");
      anchor.click();

      PFUI.toast("Gambar leaderboard berhasil dibuat.");
    }
  );

  document.getElementById("exportBackup").addEventListener(
    "click",
    function () {
      const state = PFApp.getState();

      PFUI.downloadText(
        PFStorage.exportJson(state),
        `${PFUI.safeFileName(state.setup.matchName)}-backup.json`,
        "application/json"
      );

      PFUI.toast("Backup pertandingan berhasil dibuat.");
    }
  );

  render();
});
