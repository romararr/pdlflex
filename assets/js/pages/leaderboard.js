document.addEventListener("DOMContentLoaded", function () {
  if (window.__pfGuardRedirecting) return;

  const desktopBody = document.getElementById("leaderboardBody");
  const mobileRows = document.getElementById("mobileLeaderboardRows");
  const sortMode = document.getElementById("rankingMode");
  const formula = document.getElementById("formula");
  const lifecycleButton = document.getElementById("lifecycleButton");

  function session() {
    return PFApp.requireSession();
  }

  function sortedRows() {
    const result = PFApp.computeStats();
    const mode = sortMode.value;

    const rows = [...result.sorted];

    if (mode === "wins") {
      rows.sort((a, b) =>
        Number(b.played > 0) - Number(a.played > 0) ||
        b.wins - a.wins ||
        b.points - a.points ||
        b.diff - a.diff ||
        a.name.localeCompare(b.name)
      );
    }

    if (mode === "diff") {
      rows.sort((a, b) =>
        Number(b.played > 0) - Number(a.played > 0) ||
        b.diff - a.diff ||
        b.points - a.points ||
        b.wins - a.wins ||
        a.name.localeCompare(b.name)
      );
    }

    if (mode === "winrate") {
      rows.sort((a, b) =>
        Number(b.played > 0) - Number(a.played > 0) ||
        b.winRate - a.winRate ||
        b.played - a.played ||
        b.points - a.points ||
        a.name.localeCompare(b.name)
      );
    }

    function tieKey(item) {
      if (mode === "wins") {
        return [
          item.wins,
          item.points,
          item.diff,
          item.scored,
          item.losses,
          item.ties
        ].join("|");
      }

      if (mode === "diff") {
        return [
          item.diff,
          item.points,
          item.wins,
          item.scored,
          item.losses,
          item.ties
        ].join("|");
      }

      if (mode === "winrate") {
        return [
          item.winRate.toFixed(8),
          item.played,
          item.points,
          item.diff,
          item.wins,
          item.scored
        ].join("|");
      }

      return [
        item.points,
        item.diff,
        item.wins,
        item.scored,
        item.losses,
        item.ties
      ].join("|");
    }

    let previousKey = null;
    let currentRank = 0;

    rows.forEach((item, index) => {
      const currentKey = tieKey(item);

      if (
        previousKey === null ||
        currentKey !== previousKey ||
        item.played === 0
      ) {
        currentRank = index + 1;
      }

      item.displayRank =
        item.played > 0
          ? currentRank
          : null;

      previousKey = currentKey;
    });

    return {
      ...result,
      rows
    };
  }

  function rankVisual(item) {
    if (!item.displayRank) {
      return '<span class="mobile-rank">—</span>';
    }

    if (item.displayRank === 1) {
      return '<span class="mobile-medal">🥇</span>';
    }

    if (item.displayRank === 2) {
      return '<span class="mobile-medal">🥈</span>';
    }

    if (item.displayRank === 3) {
      return '<span class="mobile-medal">🥉</span>';
    }

    return `<span class="mobile-rank">${item.displayRank}</span>`;
  }

  function renderSummary() {
    const current = session();
    const summary = PFApp.sessionSummary(current);

    document.getElementById("summaryMatchName").textContent =
      current.setup.matchName;

    document.getElementById("summaryMode").textContent =
      current.setup.randomMode === "team"
        ? "Per Tim"
        : "Americano · Per Player";

    document.getElementById("summaryScore").textContent =
      current.setup.scoreMode === "fixed"
        ? `${current.setup.pointsTotal} Points`
        : "Manual Score";

    document.getElementById("summaryParticipants").textContent =
      `${summary.entityCount} ${
        current.setup.randomMode === "team"
          ? "Teams"
          : "Players"
      } · ${current.setup.courtCount} ${
        Number(current.setup.courtCount) === 1
          ? "Court"
          : "Courts"
      }`;

    document.getElementById("summaryProgress").textContent =
      `${summary.completedMatches}/${summary.matches} match selesai`;

    document.getElementById("summaryFairness").textContent =
      `${summary.fairness.score}% fairness`;

    document.getElementById("summaryMatchNameDesktop").textContent =
      current.setup.matchName;

    document.getElementById("summaryModeDesktop").textContent =
      current.setup.randomMode === "team"
        ? "Per Tim"
        : "Per Player";

    document.getElementById("summaryScoreDesktop").textContent =
      current.setup.scoreMode === "fixed"
        ? `Total ${current.setup.pointsTotal}`
        : "Manual";

    document.getElementById("summaryProgressDesktop").textContent =
      `${summary.completedMatches}/${summary.matches}`;
  }

  function render() {
    const current = session();
    const result = sortedRows();

    renderSummary();

    desktopBody.innerHTML = result.rows.map(item => `
      <tr style="${item.played === 0 ? "opacity:.5" : ""}">
        <td>
          ${item.displayRank
            ? `<span class="rank ${item.displayRank <= 3 ? "top" : ""}">
                ${item.displayRank}
               </span>`
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

    mobileRows.innerHTML = result.rows.map(item => `
      <div class="mobile-board-row" style="${item.played === 0 ? "opacity:.5" : ""}">
        <div class="mobile-player">
          ${rankVisual(item)}
          <div style="min-width:0">
            <strong>${PFUI.escapeHtml(item.name)}</strong>
            ${item.details
              ? `<small>${PFUI.escapeHtml(item.details)}</small>`
              : ""}
          </div>
        </div>

        <div class="mobile-cell">${item.played}</div>
        <div class="mobile-cell">${item.wins}-${item.losses}-${item.ties}</div>
        <div class="mobile-cell">${item.diff > 0 ? "+" : ""}${item.diff}</div>
        <div class="mobile-cell">${item.compensation}</div>
        <div class="mobile-cell mobile-points">${item.points}</div>
      </div>
    `).join("");

    formula.innerHTML =
      current.setup.scoreMode === "fixed"
        ? `<strong>Rumus PDLUP-style:</strong>
           P = skor yang dikumpulkan + kompensasi.
           Kompensasi per game yang lebih sedikit:
           <strong>${result.compensationPerMissed}</strong> poin.
           G terbanyak: <strong>${result.maxGames}</strong>.`
        : `<strong>Skor manual:</strong>
           menang 3 poin, seri 1 poin, kalah 0 poin.
           Peserta yang tertinggal satu game mendapat
           <strong>+${result.compensationPerMissed}</strong> poin pada +M.
           Tie-breaker menggunakan selisih skor.`;

    lifecycleButton.textContent =
      current.status === "completed"
        ? "Buka Kembali Turnamen"
        : "Tandai Turnamen Selesai";

    lifecycleButton.className =
      current.status === "completed"
        ? "btn btn-soft"
        : "btn btn-success";
  }

  function exportRows() {
    return sortedRows().rows.filter(item => item.played > 0);
  }

  document.getElementById("exportCsv").addEventListener(
    "click",
    function () {
      const current = session();
      const rows = exportRows();

      if (!rows.length) {
        PFUI.toast("Belum ada hasil pertandingan.");
        return;
      }

      const data = [
        ["Nama turnamen", current.setup.matchName],
        ["Mode", current.setup.randomMode === "team" ? "Per Tim" : "Per Player"],
        ["Ranking", sortMode.options[sortMode.selectedIndex].text],
        ["Tanggal export", new Date().toLocaleString("id-ID")],
        [],
        ["Rank", "Nama", "G", "W-L-T", "Diff", "+M", "P"]
      ];

      rows.forEach(item => {
        data.push([
          item.displayRank,
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
        `${PFUI.safeFileName(current.setup.matchName)}-leaderboard.csv`,
        "text/csv;charset=utf-8"
      );

      PFUI.toast("CSV leaderboard berhasil dibuat.");
    }
  );

  document.getElementById("exportJson").addEventListener(
    "click",
    function () {
      const current = session();

      PFUI.downloadText(
        JSON.stringify(current, null, 2),
        `${PFUI.safeFileName(current.setup.matchName)}-turnamen.json`,
        "application/json"
      );

      PFUI.toast("Backup turnamen berhasil dibuat.");
    }
  );

  document.getElementById("exportPng").addEventListener(
    "click",
    function () {
      const current = session();
      const rows = exportRows();

      if (!rows.length) {
        PFUI.toast("Belum ada hasil pertandingan.");
        return;
      }

      const width = 1100;
      const header = 180;
      const rowHeight = 72;
      const height = header + rows.length * rowHeight + 65;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;

      context.fillStyle = "#f3f6fb";
      context.fillRect(0, 0, width, height);

      context.fillStyle = "#246bfd";
      context.fillRect(0, 0, width, 125);

      context.fillStyle = "#ffffff";
      context.font = "700 22px Arial";
      context.fillText("PadelFlex Pro v4", 52, 47);

      context.font = "800 36px Arial";
      context.fillText(
        current.setup.matchName.slice(0, 42),
        52,
        94
      );

      const columns = [52, 130, 535, 645, 785, 900, 1010];
      const headers = ["#", "Nama", "G", "W-L-T", "Diff", "+M", "P"];

      context.fillStyle = "#68758b";
      context.font = "700 17px Arial";

      headers.forEach((label, index) => {
        context.fillText(label, columns[index], 158);
      });

      rows.forEach((item, index) => {
        const y = header + index * rowHeight;

        context.fillStyle = "#ffffff";
        context.strokeStyle = "#e1e7f0";
        context.beginPath();
        context.roundRect(
          36,
          y,
          width - 72,
          rowHeight - 10,
          15
        );
        context.fill();
        context.stroke();

        context.fillStyle = "#172033";
        context.font = "700 19px Arial";
        context.fillText(
          String(item.displayRank),
          columns[0],
          y + 38
        );
        context.fillText(
          item.name.slice(0, 30),
          columns[1],
          y + 38
        );

        context.font = "600 17px Arial";
        context.fillText(String(item.played), columns[2], y + 38);
        context.fillText(
          `${item.wins}-${item.losses}-${item.ties}`,
          columns[3],
          y + 38
        );
        context.fillText(String(item.diff), columns[4], y + 38);
        context.fillText(
          String(item.compensation),
          columns[5],
          y + 38
        );

        context.fillStyle = "#246bfd";
        context.font = "800 21px Arial";
        context.fillText(String(item.points), columns[6], y + 38);
      });

      context.fillStyle = "#68758b";
      context.font = "500 14px Arial";
      context.fillText(
        `Generated ${new Date().toLocaleString("id-ID")}`,
        52,
        height - 24
      );

      const anchor = document.createElement("a");

      anchor.download =
        `${PFUI.safeFileName(current.setup.matchName)}-leaderboard.png`;
      anchor.href = canvas.toDataURL("image/png");
      anchor.click();

      PFUI.toast("Gambar leaderboard berhasil dibuat.");
    }
  );

  lifecycleButton.addEventListener("click", function () {
    const current = session();

    try {
      if (current.status === "completed") {
        PFApp.reopenTournament();
        PFUI.toast("Turnamen dibuka kembali.");
      } else {
        PFApp.completeTournament(false);
        PFUI.toast("Turnamen ditandai selesai.");
      }

      render();
    } catch (error) {
      PFUI.toast(error.message);
    }
  });

  sortMode.addEventListener("change", render);

  render();
});
