(function () {
  "use strict";

  let root = PFStorage.load();

  function persist() {
    root = PFStorage.save(root);

    window.dispatchEvent(
      new CustomEvent("padelflex:state", { detail: root })
    );

    return root;
  }

  function refresh() {
    root = PFStorage.load();
    return root;
  }

  function getRoot() {
    return root;
  }

  function getSessions(options = {}) {
    const includeArchived = Boolean(options.includeArchived);

    return [...root.sessions]
      .filter(session =>
        includeArchived ||
        session.status !== "archived"
      )
      .sort((a, b) =>
        new Date(b.updatedAt || 0).getTime() -
        new Date(a.updatedAt || 0).getTime()
      );
  }

  function getSession(id) {
    return root.sessions.find(session => session.id === id) || null;
  }

  function getSelectedSession() {
    return getSession(root.selectedSessionId);
  }

  function requireSession() {
    const session = getSelectedSession();

    if (!session) {
      throw new Error("Belum ada turnamen yang dipilih.");
    }

    return session;
  }

  function touch(session) {
    session.updatedAt = new Date().toISOString();
  }

  function createDraft(initial = {}) {
    const session = PFStorage.defaultSession();

    session.setup = {
      ...session.setup,
      ...initial,
      initialized: false
    };

    root.sessions.push(session);
    root.selectedSessionId = session.id;
    persist();

    return session;
  }

  function selectSession(id) {
    const session = getSession(id);

    if (!session) {
      throw new Error("Turnamen tidak ditemukan.");
    }

    root.selectedSessionId = session.id;
    persist();

    return session;
  }

  function duplicateSession(id) {
    const source = getSession(id);

    if (!source) {
      throw new Error("Turnamen tidak ditemukan.");
    }

    const copy = PFStorage.normalizeSession({
      ...JSON.parse(JSON.stringify(source)),
      id: PFStorage.uid("session"),
      status: "draft",
      submitted: false,
      setup: {
        ...source.setup,
        initialized: true,
        matchName: `${source.setup.matchName} - Copy`
      },
      rounds: [],
      activeRoundId: null,
      scoreHistory: [],
      completedAt: null,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    copy.players = copy.players.map(player => ({
      ...player,
      id: PFStorage.uid("player"),
      joinedAtRound: 1
    }));

    if (source.setup.randomMode === "team") {
      copy.teams = source.teams.map(team => ({
        ...team,
        id: PFStorage.uid("team"),
        joinedAtRound: 1
      }));
    }

    root.sessions.push(copy);
    root.selectedSessionId = copy.id;
    persist();

    return copy;
  }

  function archiveSession(id) {
    const session = getSession(id);

    if (!session) {
      throw new Error("Turnamen tidak ditemukan.");
    }

    session.status = "archived";
    session.archivedAt = new Date().toISOString();
    touch(session);

    if (root.selectedSessionId === id) {
      root.selectedSessionId =
        getSessions().find(item => item.id !== id)?.id || null;
    }

    persist();
  }

  function restoreSession(id) {
    const session = getSession(id);

    if (!session) {
      throw new Error("Turnamen tidak ditemukan.");
    }

    session.status = session.submitted ? "active" : "draft";
    session.archivedAt = null;
    touch(session);
    persist();

    return session;
  }

  function deleteSession(id) {
    const session = getSession(id);

    if (!session) {
      throw new Error("Turnamen tidak ditemukan.");
    }

    root.sessions = root.sessions.filter(item => item.id !== id);

    if (root.selectedSessionId === id) {
      root.selectedSessionId = root.sessions[0]?.id || null;
    }

    persist();
  }

  function getEntities(session = requireSession()) {
    return PFScheduler.getEntities(session);
  }

  function getAllEntities(session = requireSession()) {
    return session.setup.randomMode === "team"
      ? session.teams
      : session.players;
  }

  function getEntity(id, session = requireSession()) {
    return getAllEntities(session)
      .find(entity => entity.id === id) || null;
  }

  function entityName(id, session = requireSession()) {
    return getEntity(id, session)?.name || "Peserta";
  }

  function entityDetails(id, session = requireSession()) {
    if (session.setup.randomMode !== "team") return "";

    const team = session.teams.find(item => item.id === id);

    return team
      ? `${team.player1} & ${team.player2}`
      : "";
  }

  function getRound(id, session = requireSession()) {
    return session.rounds.find(round => round.id === id) || null;
  }

  function getActiveRound(session = requireSession()) {
    return getRound(session.activeRoundId, session);
  }

  function getPendingRounds(session = requireSession()) {
    return session.rounds
      .filter(round => round.status !== "completed")
      .sort((a, b) =>
        Number(b.status === "active") -
        Number(a.status === "active") ||
        a.number - b.number
      );
  }

  function getNextRound(excludedId = null, session = requireSession()) {
    return session.rounds
      .filter(round =>
        round.status === "scheduled" &&
        round.id !== excludedId
      )
      .sort((a, b) => a.number - b.number)[0] || null;
  }

  function saveSetup(values) {
    const session = requireSession();

    if (session.submitted) {
      throw new Error(
        "Turnamen sudah berjalan. Duplikasi atau buat turnamen baru untuk mengubah sistem."
      );
    }

    const matchName = String(values.matchName || "").trim();

    if (!matchName) {
      throw new Error("Nama pertandingan belum diisi.");
    }

    session.setup = {
      ...session.setup,
      initialized: true,
      matchName,
      randomMode:
        values.randomMode === "team"
          ? "team"
          : "player",
      scoreMode:
        values.scoreMode === "manual"
          ? "manual"
          : "fixed",
      pointsTotal: Math.max(
        1,
        Number(values.pointsTotal || 21)
      ),
      courtCount: Math.max(
        1,
        Number(values.courtCount || 1)
      ),
      minimumGames: Math.max(
        1,
        Number(values.minimumGames || 4)
      )
    };

    if (session.setup.randomMode === "team") {
      session.players = [];
    } else {
      session.teams = [];
    }

    touch(session);
    persist();

    return session.setup;
  }

  function nextJoinedRound(session) {
    const active = getActiveRound(session);

    if (active) return active.number + 1;

    return session.rounds.reduce(
      (maximum, round) => Math.max(maximum, round.number),
      0
    ) + 1;
  }

  function rebuildPreservedRounds(session) {
    const preserved = [];

    session.rounds.forEach(round => {
      if (round.status === "active") {
        preserved.push(JSON.parse(JSON.stringify(round)));
        return;
      }

      const completedMatches = round.matches.filter(
        match => match.completed
      );

      if (!completedMatches.length) return;

      preserved.push({
        ...JSON.parse(JSON.stringify(round)),
        status: "completed",
        matches: completedMatches
      });
    });

    return preserved.sort((a, b) => a.number - b.number);
  }

  function getRecommendation(
    session = requireSession(),
    preserved = null
  ) {
    return PFScheduler.recommend(
      session,
      preserved === null
        ? rebuildPreservedRounds(session)
        : preserved,
      {
        minimumGames: session.setup.minimumGames,
        maxRounds: 100
      }
    );
  }

  function rebuildFutureSchedule(session = requireSession()) {
    const preserved = rebuildPreservedRounds(session);
    const recommendation = getRecommendation(session, preserved);

    if (!recommendation.available) {
      return {
        generated: 0,
        recommendation
      };
    }

    const startNumber =
      preserved.reduce(
        (maximum, round) =>
          Math.max(maximum, round.number),
        0
      ) + 1;

    const generated = PFScheduler.buildRounds(
      session,
      recommendation.rounds,
      startNumber,
      preserved
    );

    session.rounds = [...preserved, ...generated]
      .sort((a, b) => a.number - b.number);

    if (!getActiveRound(session)) {
      const next = generated[0] ||
        session.rounds.find(round => round.status === "scheduled");

      if (next) activateRoundInternal(session, next);
    }

    touch(session);

    return {
      generated: generated.length,
      recommendation
    };
  }

  function addPlayer(name) {
    const session = requireSession();

    if (session.setup.randomMode !== "player") {
      throw new Error("Turnamen ini menggunakan mode Per Tim.");
    }

    const clean = String(name || "").trim();

    if (!clean) {
      throw new Error("Nama pemain belum diisi.");
    }

    if (
      session.players.some(
        player =>
          player.name.toLowerCase() === clean.toLowerCase()
      )
    ) {
      throw new Error("Nama pemain sudah terdaftar.");
    }

    session.players.push({
      id: PFStorage.uid("player"),
      name: clean,
      active: true,
      joinedAtRound:
        session.submitted
          ? nextJoinedRound(session)
          : 1,
      createdAt: new Date().toISOString()
    });

    const rebuilt =
      session.submitted
        ? rebuildFutureSchedule(session)
        : null;

    touch(session);
    persist();

    return rebuilt;
  }

  function addTeam(teamName, player1, player2) {
    const session = requireSession();

    if (session.setup.randomMode !== "team") {
      throw new Error("Turnamen ini menggunakan mode Per Player.");
    }

    const first = String(player1 || "").trim();
    const second = String(player2 || "").trim();

    if (!first || !second) {
      throw new Error("Nama kedua pemain harus diisi.");
    }

    if (first.toLowerCase() === second.toLowerCase()) {
      throw new Error("Nama pemain dalam satu tim tidak boleh sama.");
    }

    const name =
      String(teamName || "").trim() ||
      `${first} & ${second}`;

    if (
      session.teams.some(
        team =>
          team.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      throw new Error("Nama tim sudah terdaftar.");
    }

    const playerUsed = session.teams.some(team =>
      [team.player1, team.player2].some(existing =>
        [first, second].some(candidate =>
          existing.toLowerCase() === candidate.toLowerCase()
        )
      )
    );

    if (playerUsed) {
      throw new Error("Salah satu pemain sudah terdaftar di tim lain.");
    }

    session.teams.push({
      id: PFStorage.uid("team"),
      name,
      player1: first,
      player2: second,
      active: true,
      joinedAtRound:
        session.submitted
          ? nextJoinedRound(session)
          : 1,
      createdAt: new Date().toISOString()
    });

    const rebuilt =
      session.submitted
        ? rebuildFutureSchedule(session)
        : null;

    touch(session);
    persist();

    return rebuilt;
  }

  function setEntityActive(id, active) {
    const session = requireSession();
    const entity = getEntity(id, session);

    if (!entity) {
      throw new Error("Peserta tidak ditemukan.");
    }

    entity.active = Boolean(active);

    const rebuilt =
      session.submitted
        ? rebuildFutureSchedule(session)
        : null;

    touch(session);
    persist();

    return rebuilt;
  }

  function removeEntity(id) {
    const session = requireSession();
    const entity = getEntity(id, session);

    if (!entity) {
      throw new Error("Peserta tidak ditemukan.");
    }

    const protectedReference = session.rounds.some(round =>
      round.matches.some(match =>
        PFScheduler
          .matchEntityIds(session, match)
          .includes(id) &&
        (
          match.completed ||
          round.status === "active"
        )
      )
    );

    if (protectedReference) {
      entity.active = false;

      if (session.submitted) {
        rebuildFutureSchedule(session);
      }

      touch(session);
      persist();

      return {
        removed: false,
        deactivated: true
      };
    }

    if (session.setup.randomMode === "team") {
      session.teams = session.teams.filter(team => team.id !== id);
    } else {
      session.players = session.players.filter(player => player.id !== id);
    }

    if (session.submitted) {
      rebuildFutureSchedule(session);
    }

    touch(session);
    persist();

    return {
      removed: true,
      deactivated: false
    };
  }

  function validateRoster(session = requireSession()) {
    if (!session.setup.initialized) {
      throw new Error("Selesaikan inisialisasi pertandingan.");
    }

    const minimum =
      session.setup.randomMode === "team"
        ? 2
        : 4;

    if (getEntities(session).length < minimum) {
      throw new Error(
        session.setup.randomMode === "team"
          ? "Minimal 2 tim aktif."
          : "Minimal 4 pemain aktif."
      );
    }
  }

  function activateRoundInternal(session, target) {
    const active = getActiveRound(session);

    if (active && active.id !== target.id) {
      const completed =
        active.matches.length > 0 &&
        active.matches.every(match => match.completed);

      active.status = completed
        ? "completed"
        : "scheduled";

      active.matches.forEach(match => {
        if (!match.completed) {
          match.status = "scheduled";
        }
      });
    }

    target.status = "active";

    target.matches.forEach(match => {
      if (!match.completed) {
        match.status = "active";
      }
    });

    session.activeRoundId = target.id;
  }

  function submitTournament() {
    const session = requireSession();

    validateRoster(session);

    const recommendation = getRecommendation(session, []);

    if (!recommendation.available) {
      throw new Error(recommendation.reason);
    }

    const generated = PFScheduler.buildRounds(
      session,
      recommendation.rounds,
      1,
      []
    );

    if (!generated.length) {
      throw new Error("Jadwal pertandingan gagal dibuat.");
    }

    session.rounds = generated;
    session.submitted = true;
    session.status = "active";
    session.completedAt = null;
    activateRoundInternal(session, generated[0]);
    touch(session);
    persist();

    return {
      generated: generated.length,
      recommendation
    };
  }

  function activateRound(roundId) {
    const session = requireSession();
    const target = getRound(roundId, session);

    if (!target) {
      throw new Error("Ronde tidak ditemukan.");
    }

    if (target.status === "completed") {
      throw new Error("Ronde ini sudah selesai.");
    }

    activateRoundInternal(session, target);
    touch(session);
    persist();

    return target;
  }

  function pushScoreHistory(
    session,
    round,
    match
  ) {
    session.scoreHistory.push({
      id: PFStorage.uid("score_history"),
      roundId: round.id,
      matchId: match.id,
      before: {
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        completed: match.completed,
        matchStatus: match.status,
        roundStatus: round.status,
        activeRoundId: session.activeRoundId
      },
      createdAt: new Date().toISOString()
    });

    session.scoreHistory = session.scoreHistory.slice(-50);
  }

  function setScore(
    roundId,
    matchId,
    side,
    rawValue
  ) {
    const session = requireSession();
    const round = getRound(roundId, session);
    const match = round?.matches.find(item => item.id === matchId);

    if (!round || !match) {
      throw new Error("Pertandingan tidak ditemukan.");
    }

    const text = String(rawValue ?? "").trim();

    pushScoreHistory(session, round, match);

    if (text === "") {
      if (side === "A") match.scoreA = "";
      else match.scoreB = "";

      match.completed = false;
      match.status =
        round.status === "active"
          ? "active"
          : "scheduled";
    } else {
      const value = Number(text);

      if (!Number.isFinite(value) || value < 0) {
        session.scoreHistory.pop();
        throw new Error("Skor tidak valid.");
      }

      if (session.setup.scoreMode === "fixed") {
        const total = Number(session.setup.pointsTotal);

        if (value > total) {
          session.scoreHistory.pop();
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
        : "active";
    }

    if (
      round.matches.length &&
      round.matches.every(item => item.completed)
    ) {
      round.status = "completed";
    } else if (round.id === session.activeRoundId) {
      round.status = "active";
    }

    touch(session);
    persist();

    return match;
  }

  function undoLastScore() {
    const session = requireSession();
    const history = session.scoreHistory.pop();

    if (!history) {
      throw new Error("Belum ada perubahan skor yang bisa dibatalkan.");
    }

    const round = getRound(history.roundId, session);
    const match = round?.matches.find(
      item => item.id === history.matchId
    );

    if (!round || !match) {
      throw new Error("Riwayat skor tidak lagi tersedia.");
    }

    match.scoreA = history.before.scoreA;
    match.scoreB = history.before.scoreB;
    match.completed = history.before.completed;
    match.status = history.before.matchStatus;
    round.status = history.before.roundStatus;
    session.activeRoundId = history.before.activeRoundId;

    touch(session);
    persist();

    return {
      round,
      match
    };
  }

  function reopenMatch(roundId, matchId) {
    const session = requireSession();
    const round = getRound(roundId, session);
    const match = round?.matches.find(item => item.id === matchId);

    if (!round || !match) {
      throw new Error("Pertandingan tidak ditemukan.");
    }

    pushScoreHistory(session, round, match);
    match.completed = false;
    match.status = "active";
    activateRoundInternal(session, round);
    touch(session);
    persist();

    return match;
  }

  function startNextRound() {
    const session = requireSession();
    const active = getActiveRound(session);

    if (
      active &&
      active.matches.some(match => !match.completed)
    ) {
      throw new Error(
        "Ronde aktif masih memiliki pertandingan tanpa skor."
      );
    }

    if (active) active.status = "completed";

    const next = getNextRound(active?.id || null, session);

    if (!next) {
      session.activeRoundId = null;
      touch(session);
      persist();
      return null;
    }

    activateRoundInternal(session, next);
    touch(session);
    persist();

    return next;
  }

  function completeTournament(force = false) {
    const session = requireSession();

    const unfinished = session.rounds.reduce(
      (total, round) =>
        total +
        round.matches.filter(match => !match.completed).length,
      0
    );

    if (unfinished && !force) {
      throw new Error(
        `${unfinished} pertandingan belum memiliki skor.`
      );
    }

    session.status = "completed";
    session.completedAt = new Date().toISOString();
    session.activeRoundId = null;

    session.rounds.forEach(round => {
      if (round.matches.every(match => match.completed)) {
        round.status = "completed";
      }
    });

    touch(session);
    persist();

    return session;
  }

  function reopenTournament() {
    const session = requireSession();

    session.status = "active";
    session.completedAt = null;

    const next = session.rounds.find(round =>
      round.matches.some(match => !match.completed)
    );

    if (next) {
      activateRoundInternal(session, next);
    }

    touch(session);
    persist();

    return session;
  }

  function computeStats(session = requireSession()) {
    const entities =
      session.setup.randomMode === "team"
        ? session.teams
        : session.players;

    const stats = {};

    entities.forEach(entity => {
      stats[entity.id] = {
        id: entity.id,
        name: entity.name,
        details:
          session.setup.randomMode === "team"
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
        winRate: 0,
        rank: null
      };
    });

    session.rounds.forEach(round => {
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
      (maximum, item) =>
        Math.max(maximum, item.played),
      0
    );

    const compensationPerMissed =
      session.setup.scoreMode === "fixed"
        ? Math.floor(Number(session.setup.pointsTotal) / 2)
        : 0;

    values.forEach(item => {
      item.diff = item.scored - item.conceded;
      item.winRate =
        item.played > 0
          ? item.wins / item.played
          : 0;

      const missed = Math.max(0, maxGames - item.played);

      item.compensation =
        item.played > 0
          ? missed * compensationPerMissed
          : 0;

      item.points =
        session.setup.scoreMode === "fixed"
          ? item.scored + item.compensation
          : item.wins * 3 + item.ties;
    });

    const sorted = [...values].sort((a, b) =>
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

  function sessionSummary(session) {
    const entities =
      session.setup.randomMode === "team"
        ? session.teams
        : session.players;

    const matches = session.rounds.flatMap(round => round.matches);
    const completed = matches.filter(match => match.completed).length;

    return {
      id: session.id,
      name: session.setup.matchName,
      status: session.status,
      entityCount: entities.length,
      rounds: session.rounds.length,
      matches: matches.length,
      completedMatches: completed,
      progress:
        matches.length > 0
          ? Math.round(completed / matches.length * 100)
          : 0,
      fairness: PFScheduler.fairness(session),
      updatedAt: session.updatedAt
    };
  }

  function replaceRoot(newRoot) {
    root = PFStorage.save(newRoot);

    window.dispatchEvent(
      new CustomEvent("padelflex:state", { detail: root })
    );
  }

  function clearAll() {
    root = PFStorage.clear();

    window.dispatchEvent(
      new CustomEvent("padelflex:state", { detail: root })
    );

    return root;
  }

  window.PFApp = {
    persist,
    refresh,
    getRoot,
    getSessions,
    getSession,
    getSelectedSession,
    requireSession,
    createDraft,
    selectSession,
    duplicateSession,
    archiveSession,
    restoreSession,
    deleteSession,
    getEntities,
    getAllEntities,
    getEntity,
    entityName,
    entityDetails,
    getRound,
    getActiveRound,
    getPendingRounds,
    getNextRound,
    saveSetup,
    addPlayer,
    addTeam,
    setEntityActive,
    removeEntity,
    validateRoster,
    getRecommendation,
    rebuildFutureSchedule,
    submitTournament,
    activateRound,
    setScore,
    undoLastScore,
    reopenMatch,
    startNextRound,
    completeTournament,
    reopenTournament,
    computeStats,
    sessionSummary,
    replaceRoot,
    clearAll
  };
})();
