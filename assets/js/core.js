(function () {
  "use strict";

  let state = PFStorage.load();

  function refresh() {
    state = PFStorage.load();
    return state;
  }

  function persist() {
    state = PFStorage.save(state);
    window.dispatchEvent(
      new CustomEvent("padelflex:state", { detail: state })
    );
    return state;
  }

  function getState() {
    return state;
  }

  function getEntities() {
    return PFScheduler.getEntities(state);
  }

  function getEntity(id) {
    return getEntities().find(entity => entity.id === id) ||
      state.players.find(player => player.id === id) ||
      state.teams.find(team => team.id === id) ||
      null;
  }

  function entityName(id) {
    return getEntity(id)?.name || "Peserta";
  }

  function entityDetails(id) {
    if (state.setup.randomMode !== "team") return "";

    const team = state.teams.find(item => item.id === id);
    if (!team) return "";

    return `${team.player1} & ${team.player2}`;
  }

  function getRound(id) {
    return state.rounds.find(round => round.id === id) || null;
  }

  function getActiveRound() {
    return getRound(state.activeRoundId);
  }

  function getDeferredRounds() {
    return state.rounds
      .filter(round =>
        round.deferred &&
        round.status !== "completed" &&
        round.matches.some(match => !match.completed)
      )
      .sort((a, b) =>
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime() ||
        a.number - b.number
      );
  }

  function getNextRound(excludedId = null) {
    const scheduled = state.rounds.filter(round =>
      round.status === "scheduled" &&
      round.id !== excludedId
    );

    return scheduled
      .sort((a, b) =>
        Number(a.deferred) - Number(b.deferred) ||
        a.number - b.number
      )[0] || null;
  }

  function getLastRoundNumber() {
    return state.rounds.reduce(
      (maximum, round) => Math.max(maximum, round.number),
      0
    );
  }

  function saveSetup(values) {
    if (state.submitted) {
      throw new Error(
        "Pertandingan sudah disubmit. Reset sesi untuk mengubah sistem pertandingan."
      );
    }

    const matchName = String(values.matchName || "").trim();

    if (!matchName) {
      throw new Error("Nama pertandingan belum diisi.");
    }

    const randomMode =
      values.randomMode === "team" ? "team" : "player";
    const scoreMode =
      values.scoreMode === "manual" ? "manual" : "fixed";

    state.setup = {
      ...state.setup,
      initialized: true,
      matchName,
      randomMode,
      scoreMode,
      pointsTotal: Math.max(1, Number(values.pointsTotal || 21)),
      courtCount: Math.max(1, Number(values.courtCount || 1)),
      minimumGames: Math.max(1, Number(values.minimumGames || 4))
    };

    if (randomMode === "team") {
      state.players = [];
    } else {
      state.teams = [];
    }

    persist();
    return state.setup;
  }

  function validateRoster() {
    if (!state.setup.initialized) {
      throw new Error("Selesaikan inisialisasi pertandingan terlebih dahulu.");
    }

    const entities = getEntities();
    const minimum =
      state.setup.randomMode === "team" ? 2 : 4;

    if (entities.length < minimum) {
      throw new Error(
        state.setup.randomMode === "team"
          ? "Minimal masukkan 2 tim."
          : "Minimal masukkan 4 pemain."
      );
    }

    return entities;
  }

  function nextJoinedRound() {
    const active = getActiveRound();

    if (active) return active.number + 1;
    return getLastRoundNumber() + 1 || 1;
  }

  function addPlayer(name) {
    if (state.setup.randomMode !== "player") {
      throw new Error("Sesi ini menggunakan mode Per Tim.");
    }

    const clean = String(name || "").trim();

    if (!clean) throw new Error("Nama pemain belum diisi.");

    const duplicate = state.players.some(
      player => player.name.toLowerCase() === clean.toLowerCase()
    );

    if (duplicate) throw new Error("Nama pemain sudah terdaftar.");

    state.players.push({
      id: PFStorage.uid("player"),
      name: clean,
      active: true,
      joinedAtRound: state.submitted ? nextJoinedRound() : 1,
      createdAt: new Date().toISOString()
    });

    const rebuilt = state.submitted
      ? rebuildFutureSchedule()
      : null;

    persist();
    return rebuilt;
  }

  function addTeam(teamName, player1, player2) {
    if (state.setup.randomMode !== "team") {
      throw new Error("Sesi ini menggunakan mode Per Player.");
    }

    const first = String(player1 || "").trim();
    const second = String(player2 || "").trim();
    const generatedName =
      String(teamName || "").trim() ||
      `${first} & ${second}`;

    if (!first || !second) {
      throw new Error("Nama kedua pemain dalam tim harus diisi.");
    }

    if (first.toLowerCase() === second.toLowerCase()) {
      throw new Error("Nama pemain dalam satu tim tidak boleh sama.");
    }

    const duplicateName = state.teams.some(
      team => team.name.toLowerCase() === generatedName.toLowerCase()
    );

    if (duplicateName) {
      throw new Error("Nama tim sudah terdaftar.");
    }

    const usedPlayer = state.teams.some(team =>
      [team.player1, team.player2]
        .some(name =>
          name.toLowerCase() === first.toLowerCase() ||
          name.toLowerCase() === second.toLowerCase()
        )
    );

    if (usedPlayer) {
      throw new Error("Salah satu pemain sudah terdaftar pada tim lain.");
    }

    state.teams.push({
      id: PFStorage.uid("team"),
      name: generatedName,
      player1: first,
      player2: second,
      active: true,
      joinedAtRound: state.submitted ? nextJoinedRound() : 1,
      createdAt: new Date().toISOString()
    });

    const rebuilt = state.submitted
      ? rebuildFutureSchedule()
      : null;

    persist();
    return rebuilt;
  }

  function removeEntity(id) {
    const entity = getEntity(id);

    if (!entity) throw new Error("Peserta tidak ditemukan.");

    const hasProtectedMatch = state.rounds.some(round =>
      round.matches.some(match => {
        const included =
          PFScheduler.matchEntityIds(state, match).includes(id);

        return included && (
          match.completed ||
          round.status === "active" ||
          match.status === "deferred"
        );
      })
    );

    if (hasProtectedMatch) {
      entity.active = false;

      if (state.submitted) rebuildFutureSchedule();
      persist();

      return {
        removed: false,
        deactivated: true
      };
    }

    if (state.setup.randomMode === "team") {
      state.teams = state.teams.filter(team => team.id !== id);
    } else {
      state.players = state.players.filter(player => player.id !== id);
    }

    if (state.submitted) rebuildFutureSchedule();
    persist();

    return {
      removed: true,
      deactivated: false
    };
  }

  function setEntityActive(id, active) {
    const entity = getEntity(id);

    if (!entity) throw new Error("Peserta tidak ditemukan.");

    entity.active = Boolean(active);

    const rebuilt = state.submitted
      ? rebuildFutureSchedule()
      : null;

    persist();
    return rebuilt;
  }

  function preservedRoundsForRebuild() {
    const result = [];

    state.rounds.forEach(round => {
      const protectedMatches = round.matches.filter(match =>
        match.completed ||
        round.status === "active" ||
        match.status === "deferred"
      );

      if (!protectedMatches.length) return;

      result.push({
        ...round,
        matches: protectedMatches
      });
    });

    return result.sort((a, b) => a.number - b.number);
  }

  function getRecommendation(preservedRounds = null) {
    const preserved =
      preservedRounds === null
        ? preservedRoundsForRebuild()
        : preservedRounds;

    return PFScheduler.recommend(
      state,
      preserved,
      {
        minimumGames: state.setup.minimumGames,
        maxRounds: 80
      }
    );
  }

  function applyActiveStatus(round) {
    round.status = "active";
    round.deferred = false;

    round.matches.forEach(match => {
      if (!match.completed) {
        match.status = "active";
      }
    });

    state.activeRoundId = round.id;
  }

  function submitTournament() {
    validateRoster();

    const recommendation = PFScheduler.recommend(
      state,
      [],
      {
        minimumGames: state.setup.minimumGames,
        maxRounds: 80
      }
    );

    if (!recommendation.available) {
      throw new Error(recommendation.reason);
    }

    const generated = PFScheduler.buildRounds(
      state,
      recommendation.rounds,
      1,
      []
    );

    if (!generated.length) {
      throw new Error("Jadwal pertandingan gagal dibuat.");
    }

    state.rounds = generated;
    state.submitted = true;
    applyActiveStatus(state.rounds[0]);
    persist();

    return {
      recommendation,
      generated: generated.length
    };
  }

  function rebuildFutureSchedule() {
    const preserved = preservedRoundsForRebuild();
    const recommendation = getRecommendation(preserved);

    if (!recommendation.available) {
      return {
        generated: 0,
        recommendation
      };
    }

    const startNumber =
      preserved.reduce(
        (maximum, round) => Math.max(maximum, round.number),
        0
      ) + 1;

    const generated = PFScheduler.buildRounds(
      state,
      recommendation.rounds,
      startNumber,
      preserved
    );

    state.rounds = [...preserved, ...generated]
      .sort((a, b) => a.number - b.number);

    const active = getActiveRound();

    if (!active) {
      const firstNormal =
        generated[0] ||
        state.rounds.find(round => round.status === "scheduled");

      if (firstNormal) applyActiveStatus(firstNormal);
    }

    return {
      generated: generated.length,
      recommendation
    };
  }

  function setScore(roundId, matchId, side, rawValue) {
    const round = getRound(roundId);
    const match = round?.matches.find(item => item.id === matchId);

    if (!round || !match) {
      throw new Error("Pertandingan tidak ditemukan.");
    }

    const valueText = String(rawValue ?? "").trim();

    if (valueText === "") {
      if (side === "A") match.scoreA = "";
      else match.scoreB = "";

      match.completed = false;
      match.status = round.status === "active" ? "active" : "scheduled";
      persist();
      return match;
    }

    const value = Number(valueText);

    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Skor tidak valid.");
    }

    if (state.setup.scoreMode === "fixed") {
      const total = Number(state.setup.pointsTotal);

      if (value > total) {
        throw new Error(`Skor maksimal ${total}.`);
      }

      if (side === "A") {
        match.scoreA = value;
        match.scoreB = total - value;
      } else {
        match.scoreB = value;
        match.scoreA = total - value;
      }

      match.completed = true;
    } else {
      if (side === "A") match.scoreA = value;
      else match.scoreB = value;

      match.completed =
        match.scoreA !== "" &&
        match.scoreB !== "";
    }

    match.status = match.completed
      ? "completed"
      : (round.status === "active" ? "active" : "scheduled");

    if (
      round.matches.length &&
      round.matches.every(item => item.completed)
    ) {
      round.status = "completed";
    }

    persist();
    return match;
  }

  function activateRound(roundId) {
    const target = getRound(roundId);

    if (!target) throw new Error("Ronde tidak ditemukan.");
    if (target.status === "completed") {
      throw new Error("Ronde ini sudah selesai.");
    }

    const active = getActiveRound();

    if (active && active.id !== target.id) {
      const complete =
        active.matches.length &&
        active.matches.every(match => match.completed);

      active.status = complete ? "completed" : "scheduled";

      active.matches.forEach(match => {
        if (!match.completed) {
          match.status =
            match.status === "deferred"
              ? "deferred"
              : "scheduled";
        }
      });
    }

    applyActiveStatus(target);
    persist();

    return target;
  }

  function skipMatch(roundId, matchId) {
    const round = getRound(roundId);
    const match = round?.matches.find(item => item.id === matchId);

    if (!round || !match) {
      throw new Error("Pertandingan tidak ditemukan.");
    }

    if (match.completed) {
      throw new Error("Pertandingan yang sudah selesai tidak dapat ditunda.");
    }

    round.matches = round.matches.filter(item => item.id !== match.id);

    match.status = "deferred";
    match.deferredCount = Number(match.deferredCount || 0) + 1;
    match.deferredAt = new Date().toISOString();

    const deferredRound = {
      id: PFStorage.uid("round"),
      number: getLastRoundNumber() + 1,
      status: "scheduled",
      deferred: true,
      createdAt: new Date().toISOString(),
      matches: [match],
      resting: []
    };

    state.rounds.push(deferredRound);

    if (!round.matches.length) {
      round.status = "completed";

      if (round.id === state.activeRoundId) {
        state.activeRoundId = null;

        const next = getNextRound(round.id);

        if (next) applyActiveStatus(next);
      }
    } else if (
      round.matches.every(item => item.completed)
    ) {
      round.status = "completed";
    }

    persist();

    return {
      deferredRound,
      activeRound: getActiveRound()
    };
  }

  function startNextRound() {
    const active = getActiveRound();

    if (
      active &&
      active.matches.some(match => !match.completed)
    ) {
      throw new Error(
        "Selesaikan atau tunda semua pertandingan pada ronde aktif."
      );
    }

    if (active) active.status = "completed";

    const next = getNextRound(active?.id || null);

    if (!next) {
      state.activeRoundId = null;
      persist();
      return null;
    }

    applyActiveStatus(next);
    persist();
    return next;
  }

  function computeStats() {
    const entities =
      state.setup.randomMode === "team"
        ? state.teams
        : state.players;

    const stats = {};

    entities.forEach(entity => {
      stats[entity.id] = {
        id: entity.id,
        name: entity.name,
        details:
          state.setup.randomMode === "team"
            ? `${entity.player1} & ${entity.player2}`
            : "",
        active: entity.active !== false,
        played: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        scored: 0,
        conceded: 0,
        diff: 0,
        compensation: 0,
        points: 0,
        rank: null
      };
    });

    state.rounds.forEach(round => {
      round.matches.forEach(match => {
        if (!match.completed) return;

        const scoreA = Number(match.scoreA);
        const scoreB = Number(match.scoreB);
        const wonA = scoreA > scoreB;
        const wonB = scoreB > scoreA;

        match.teamA.forEach(id => {
          if (!stats[id]) return;

          stats[id].played++;
          stats[id].scored += scoreA;
          stats[id].conceded += scoreB;

          if (wonA) stats[id].wins++;
          else if (wonB) stats[id].losses++;
          else stats[id].ties++;
        });

        match.teamB.forEach(id => {
          if (!stats[id]) return;

          stats[id].played++;
          stats[id].scored += scoreB;
          stats[id].conceded += scoreA;

          if (wonB) stats[id].wins++;
          else if (wonA) stats[id].losses++;
          else stats[id].ties++;
        });
      });
    });

    const values = Object.values(stats);
    const maxGames = values.reduce(
      (maximum, item) => Math.max(maximum, item.played),
      0
    );

    const compensationPerMissed =
      state.setup.scoreMode === "fixed"
        ? Math.floor(Number(state.setup.pointsTotal) / 2)
        : 0;

    values.forEach(item => {
      item.diff = item.scored - item.conceded;
      const missed = Math.max(0, maxGames - item.played);

      item.compensation =
        item.played > 0
          ? missed * compensationPerMissed
          : 0;

      item.points =
        state.setup.scoreMode === "fixed"
          ? item.scored + item.compensation
          : item.wins * 3 + item.ties;
    });

    const sorted = values.sort((a, b) =>
      Number(b.played > 0) - Number(a.played > 0) ||
      b.points - a.points ||
      b.diff - a.diff ||
      b.wins - a.wins ||
      b.scored - a.scored ||
      a.name.localeCompare(b.name)
    );

    let previous = null;
    let rank = 0;

    sorted.forEach((item, index) => {
      const tied =
        previous &&
        item.played > 0 &&
        previous.played > 0 &&
        item.points === previous.points &&
        item.diff === previous.diff &&
        item.wins === previous.wins &&
        item.losses === previous.losses &&
        item.ties === previous.ties;

      if (!tied) rank = index + 1;

      item.rank = item.played > 0 ? rank : null;
      previous = item;
    });

    return {
      stats,
      sorted,
      maxGames,
      compensationPerMissed
    };
  }

  function replaceState(newState) {
    state = PFStorage.save(newState);

    window.dispatchEvent(
      new CustomEvent("padelflex:state", { detail: state })
    );
  }

  function reset() {
    state = PFStorage.reset();

    window.dispatchEvent(
      new CustomEvent("padelflex:state", { detail: state })
    );

    return state;
  }

  window.PFApp = {
    refresh,
    persist,
    getState,
    getEntities,
    getEntity,
    entityName,
    entityDetails,
    getRound,
    getActiveRound,
    getDeferredRounds,
    getNextRound,
    saveSetup,
    addPlayer,
    addTeam,
    removeEntity,
    setEntityActive,
    validateRoster,
    getRecommendation,
    submitTournament,
    rebuildFutureSchedule,
    setScore,
    activateRound,
    skipMatch,
    startNextRound,
    computeStats,
    replaceState,
    reset
  };
})();
