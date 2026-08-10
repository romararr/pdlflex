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

  function ensureTournamentWritable(session) {
    if (session.status === "archived") {
      throw new Error("Turnamen berada di arsip. Pulihkan terlebih dahulu.");
    }

    if (session.status === "completed") {
      throw new Error(
        "Turnamen sudah selesai. Buka kembali turnamen dari leaderboard untuk melakukan perubahan."
      );
    }
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
        initialized: Boolean(source.setup.initialized),
        matchName: `${source.setup.matchName} - Copy`
      },
      rounds: [],
      activeRoundId: null,
      roundCompletionCounter: 0,
      balanceEpochRound: 1,
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

    session.status = session.completedAt
      ? "completed"
      : (session.submitted ? "active" : "draft");
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
      root.selectedSessionId =
        root.sessions.find(item => item.status !== "archived")?.id ||
        root.sessions[0]?.id ||
        null;
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

  function getNextRound(excludedId = null, session = requireSession()) {
    return session.rounds
      .filter(round =>
        round.status === "scheduled" &&
        round.id !== excludedId
      )
      .sort((a, b) => {
        const restA = getRoundRestStatus(a, session);
        const restB = getRoundRestStatus(b, session);

        return (
          Number(restB.ready) - Number(restA.ready) ||
          restB.minimumRest - restA.minimumRest ||
          a.number - b.number
        );
      })[0] || null;
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
      ),
      scheduleMode:
        values.scheduleMode === "auto"
          ? "auto"
          : "manual",
      minRestRounds: Math.max(
        0,
        Math.min(
          3,
          Number(values.minRestRounds ?? 1)
        )
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

  function maxRoundNumber(session) {
    return session.rounds.reduce(
      (maximum, round) =>
        Math.max(maximum, Number(round.number) || 0),
      0
    );
  }

  function nextJoinedRound(session) {
    if (!session.submitted) return 1;

    if (session.setup.scheduleMode === "manual") {
      return maxRoundNumber(session) + 1;
    }

    const protectedMaximum = session.rounds.reduce(
      (maximum, round) => {
        const protectedRound =
          round.status === "active" ||
          round.matches.some(match => match.completed);

        return protectedRound
          ? Math.max(maximum, Number(round.number) || 0)
          : maximum;
      },
      0
    );

    return protectedMaximum + 1;
  }

  function rebuildPreservedRounds(session) {
    const preserved = [];

    session.rounds.forEach(round => {
      if (
        round.status === "active" ||
        round.kind === "manual_extra" ||
        round.kind === "manual"
      ) {
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
    if (session.setup.scheduleMode === "manual") {
      touch(session);

      return {
        generated: 0,
        manual: true,
        recommendation: {
          available: true,
          manual: true,
          rounds: 0
        }
      };
    }

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

    const generated = PFScheduler.buildRecommendedRounds(
      session,
      recommendation,
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


  function removeUnplayedReferences(session, entityId) {
    const removedMatchIds = new Set();
    const removedRoundIds = new Set();

    session.rounds = session.rounds
      .map(round => {
        if (round.status === "active") return round;

        const matches = round.matches.filter(match => {
          const remove =
            !match.completed &&
            PFScheduler
              .matchEntityIds(session, match)
              .includes(entityId);

          if (remove) removedMatchIds.add(match.id);
          return !remove;
        });

        if (!matches.length) {
          removedRoundIds.add(round.id);
        }

        return {
          ...round,
          matches
        };
      })
      .filter(round => round.matches.length > 0);

    if (removedMatchIds.size || removedRoundIds.size) {
      session.scoreHistory = session.scoreHistory.filter(history =>
        !removedMatchIds.has(history.matchId) &&
        !removedRoundIds.has(history.roundId)
      );
    }
  }

  function resequenceCompletionOrders(session) {
    const completedRounds = session.rounds
      .filter(round =>
        round.matches.length > 0 &&
        round.matches.every(match => match.completed)
      )
      .sort((a, b) => {
        const timeA = Date.parse(a.completedAt || "");
        const timeB = Date.parse(b.completedAt || "");
        const validA = Number.isFinite(timeA);
        const validB = Number.isFinite(timeB);

        if (validA && validB && timeA !== timeB) {
          return timeA - timeB;
        }

        return (Number(a.completedOrder) || Number.MAX_SAFE_INTEGER) -
          (Number(b.completedOrder) || Number.MAX_SAFE_INTEGER) ||
          (Number(a.number) || 0) - (Number(b.number) || 0);
      });

    completedRounds.forEach((round, index) => {
      round.status = "completed";
      round.completedOrder = index + 1;
    });

    session.roundCompletionCounter = completedRounds.length;
  }

  function validateRoundAvailability(session, round) {
    const unavailable = new Set();

    round.matches
      .filter(match => !match.completed)
      .forEach(match => {
        PFScheduler
          .matchEntityIds(session, match)
          .forEach(id => {
            const entity = getEntity(id, session);

            if (!entity || entity.active === false) {
              unavailable.add(entity?.name || "Peserta tidak dikenal");
            }
          });
      });

    if (unavailable.size) {
      throw new Error(
        `Tidak dapat mengaktifkan ronde. Peserta nonaktif/tidak tersedia: ${[...unavailable].join(", ")}.`
      );
    }
  }

  function markBalanceEpoch(
    session = requireSession()
  ) {
    if (!session.submitted) {
      session.balanceEpochRound = 1;
      return 1;
    }

    const epoch = Math.max(
      1,
      nextJoinedRound(session)
    );

    session.balanceEpochRound = epoch;
    return epoch;
  }

  function addPlayer(name) {
    const session = requireSession();
    ensureTournamentWritable(session);

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

    const joinedAtRound =
      session.submitted
        ? nextJoinedRound(session)
        : 1;

    session.players.push({
      id: PFStorage.uid("player"),
      name: clean,
      active: true,
      joinedAtRound,
      createdAt: new Date().toISOString()
    });

    if (session.submitted) {
      session.balanceEpochRound = joinedAtRound;
    }

    const rebuilt =
      session.submitted
        ? rebuildFutureSchedule(session)
        : null;

    touch(session);
    persist();

    return rebuilt;
  }

  function addPlayersBatch(names) {
    const session = requireSession();
    ensureTournamentWritable(session);

    if (session.setup.randomMode !== "player") {
      throw new Error("Turnamen ini menggunakan mode Per Tim.");
    }

    const existingNames = new Set(
      session.players.map(player => player.name.toLowerCase())
    );
    const batchNames = new Set();
    const addedNames = [];
    const skipped = [];

    (Array.isArray(names) ? names : [])
      .map(name => String(name || "").trim())
      .filter(Boolean)
      .forEach(name => {
        const key = name.toLowerCase();

        if (existingNames.has(key) || batchNames.has(key)) {
          skipped.push(name);
          return;
        }

        batchNames.add(key);
        addedNames.push(name);
      });

    if (!addedNames.length) {
      throw new Error("Tidak ada nama baru yang dapat ditambahkan.");
    }

    const joinedAtRound = session.submitted
      ? nextJoinedRound(session)
      : 1;

    addedNames.forEach(name => {
      session.players.push({
        id: PFStorage.uid("player"),
        name,
        active: true,
        joinedAtRound,
        createdAt: new Date().toISOString()
      });
    });

    if (session.submitted) {
      session.balanceEpochRound = joinedAtRound;
    }

    const rebuilt = session.submitted
      ? rebuildFutureSchedule(session)
      : null;

    touch(session);
    persist();

    return {
      addedNames,
      skipped,
      rebuilt
    };
  }

  function addTeam(teamName, player1, player2) {
    const session = requireSession();
    ensureTournamentWritable(session);

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

    const joinedAtRound =
      session.submitted
        ? nextJoinedRound(session)
        : 1;

    session.teams.push({
      id: PFStorage.uid("team"),
      name,
      player1: first,
      player2: second,
      active: true,
      joinedAtRound,
      createdAt: new Date().toISOString()
    });

    if (session.submitted) {
      session.balanceEpochRound = joinedAtRound;
    }

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
    ensureTournamentWritable(session);
    const entity = getEntity(id, session);

    if (!entity) {
      throw new Error("Peserta tidak ditemukan.");
    }

    const nextActive = Boolean(active);
    const wasActive = entity.active !== false;

    if (wasActive === nextActive) {
      return session.setup.scheduleMode === "manual"
        ? { generated: 0, manual: true }
        : null;
    }

    entity.active = nextActive;

    if (session.submitted) {
      if (!nextActive) {
        removeUnplayedReferences(session, entity.id);
      } else {
        entity.joinedAtRound = nextJoinedRound(session);
      }

      markBalanceEpoch(session);
    }

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
    ensureTournamentWritable(session);
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
        markBalanceEpoch(session);
        rebuildFutureSchedule(session);
      }

      touch(session);
      persist();

      return {
        removed: false,
        deactivated: true
      };
    }

    removeUnplayedReferences(session, id);

    if (session.setup.randomMode === "team") {
      session.teams = session.teams.filter(team => team.id !== id);
    } else {
      session.players = session.players.filter(player => player.id !== id);
    }

    if (session.submitted) {
      markBalanceEpoch(session);
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
    ensureTournamentWritable(session);

    validateRoster(session);

    if (session.setup.scheduleMode === "manual") {
      session.rounds = [];
      session.submitted = true;
      session.status = "active";
      session.completedAt = null;
      session.activeRoundId = null;
      session.roundCompletionCounter = 0;
      session.balanceEpochRound = 1;
      touch(session);
      persist();

      return {
        generated: 0,
        manual: true,
        recommendation: {
          available: true,
          manual: true,
          rounds: 0
        }
      };
    }

    const recommendation = getRecommendation(session, []);

    if (!recommendation.available) {
      throw new Error(recommendation.reason);
    }

    const generated = PFScheduler.buildRecommendedRounds(
      session,
      recommendation,
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
    session.activeRoundId = null;
    session.roundCompletionCounter = 0;
    session.balanceEpochRound = 1;
    activateRoundInternal(session, generated[0]);
    touch(session);
    persist();

    return {
      generated: generated.length,
      manual: false,
      recommendation
    };
  }

  function activateRound(roundId) {
    const session = requireSession();
    ensureTournamentWritable(session);
    const target = getRound(roundId, session);

    if (!target) {
      throw new Error("Ronde tidak ditemukan.");
    }

    if (target.status === "completed") {
      throw new Error("Ronde ini sudah selesai.");
    }

    if (!target.matches.some(match => !match.completed)) {
      throw new Error("Ronde ini tidak memiliki pertandingan yang bisa dimainkan.");
    }

    validateRoundAvailability(session, target);
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
        roundCompletedOrder: round.completedOrder || null,
        roundCompletedAt: round.completedAt || null,
        roundCompletionCounter:
          Number(session.roundCompletionCounter || 0),
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
    ensureTournamentWritable(session);

    const round = getRound(roundId, session);
    const match = round?.matches.find(item => item.id === matchId);

    if (!round || !match) {
      throw new Error("Pertandingan tidak ditemukan.");
    }

    const text = String(rawValue ?? "").trim();
    const fixedScore = session.setup.scoreMode === "fixed";

    if (text === "") {
      const noChange = fixedScore
        ? (
            match.scoreA === "" &&
            match.scoreB === "" &&
            !match.completed
          )
        : (
            (side === "A" ? match.scoreA : match.scoreB) === "" &&
            !match.completed
          );

      if (noChange) return match;

      pushScoreHistory(session, round, match);

      if (fixedScore) {
        match.scoreA = "";
        match.scoreB = "";
      } else if (side === "A") {
        match.scoreA = "";
      } else {
        match.scoreB = "";
      }

      match.completed = false;
    } else {
      const value = Number(text);

      if (!Number.isFinite(value) || value < 0) {
        throw new Error("Skor tidak valid.");
      }

      if (!Number.isInteger(value)) {
        throw new Error("Skor harus berupa angka bulat.");
      }

      if (fixedScore) {
        const total = Number(session.setup.pointsTotal);

        if (value > total) {
          throw new Error(`Skor maksimal ${total}.`);
        }

        const nextScoreA = side === "A"
          ? value
          : total - value;
        const nextScoreB = side === "A"
          ? total - value
          : value;

        if (
          match.scoreA === nextScoreA &&
          match.scoreB === nextScoreB &&
          match.completed
        ) {
          return match;
        }

        pushScoreHistory(session, round, match);
        match.scoreA = nextScoreA;
        match.scoreB = nextScoreB;
        match.completed = true;
      } else {
        const nextScoreA = side === "A" ? value : match.scoreA;
        const nextScoreB = side === "B" ? value : match.scoreB;
        const nextCompleted =
          nextScoreA !== "" &&
          nextScoreB !== "";

        if (
          match.scoreA === nextScoreA &&
          match.scoreB === nextScoreB &&
          match.completed === nextCompleted
        ) {
          return match;
        }

        pushScoreHistory(session, round, match);
        match.scoreA = nextScoreA;
        match.scoreB = nextScoreB;
        match.completed = nextCompleted;
      }
    }

    match.status = match.completed
      ? "completed"
      : (
          round.id === session.activeRoundId
            ? "active"
            : "scheduled"
        );

    if (
      round.matches.length &&
      round.matches.every(item => item.completed)
    ) {
      round.status = "completed";

      if (!Number(round.completedOrder)) {
        session.roundCompletionCounter =
          Number(session.roundCompletionCounter || 0) + 1;

        round.completedOrder =
          session.roundCompletionCounter;

        round.completedAt =
          new Date().toISOString();
      }
    } else if (round.id === session.activeRoundId) {
      round.status = "active";
    } else {
      round.status = "scheduled";
    }

    touch(session);
    persist();

    return match;
  }

  function undoLastScore() {
    const session = requireSession();
    ensureTournamentWritable(session);
    const history = session.scoreHistory.at(-1);

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

    session.scoreHistory.pop();
    match.scoreA = history.before.scoreA;
    match.scoreB = history.before.scoreB;
    match.completed = history.before.completed;
    match.status = history.before.matchStatus;
    round.status = history.before.roundStatus;
    round.completedOrder =
      history.before.roundCompletedOrder || null;
    round.completedAt =
      history.before.roundCompletedAt || null;
    session.activeRoundId = history.before.activeRoundId;
    resequenceCompletionOrders(session);

    touch(session);
    persist();

    return {
      round,
      match
    };
  }

  function reopenMatch(roundId, matchId) {
    const session = requireSession();
    ensureTournamentWritable(session);
    const round = getRound(roundId, session);
    const match = round?.matches.find(item => item.id === matchId);

    if (!round || !match) {
      throw new Error("Pertandingan tidak ditemukan.");
    }

    pushScoreHistory(session, round, match);
    match.completed = false;
    match.status = "active";
    round.completedOrder = null;
    round.completedAt = null;
    activateRoundInternal(session, round);
    resequenceCompletionOrders(session);
    touch(session);
    persist();

    return match;
  }

  function startNextRound() {
    const session = requireSession();
    ensureTournamentWritable(session);
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

  function completeTournament() {
    const session = requireSession();
    ensureTournamentWritable(session);

    const totalMatches = session.rounds.reduce(
      (total, round) =>
        total + round.matches.length,
      0
    );

    if (!totalMatches) {
      throw new Error(
        "Belum ada pertandingan. Tambahkan minimal satu match terlebih dahulu."
      );
    }

    const unfinished = session.rounds.reduce(
      (total, round) =>
        total +
        round.matches.filter(match => !match.completed).length,
      0
    );

    if (unfinished) {
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

    if (session.status === "archived") {
      throw new Error("Turnamen berada di arsip. Pulihkan terlebih dahulu.");
    }

    if (session.status !== "completed") {
      return session;
    }

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



  function getRestProfile(
    session = requireSession()
  ) {
    const currentOrder =
      Number(session.roundCompletionCounter || 0);

    const lastPlayed = new Map();

    session.rounds.forEach(round => {
      const completedOrder =
        Number(round.completedOrder || 0);

      if (!completedOrder) return;

      round.matches.forEach(match => {
        PFScheduler
          .matchEntityIds(session, match)
          .forEach(id => {
            lastPlayed.set(
              id,
              Math.max(
                lastPlayed.get(id) || 0,
                completedOrder
              )
            );
          });
      });
    });

    return {
      currentOrder,
      required:
        Math.max(
          0,
          Number(session.setup.minRestRounds ?? 1)
        ),
      lastPlayed
    };
  }

  function getParticipantRestStatus(
    participantIds,
    session = requireSession()
  ) {
    const profile = getRestProfile(session);
    const ids = Array.isArray(participantIds)
      ? [...new Set(participantIds.filter(Boolean))]
      : [];

    const items = ids.map(id => {
      const entity = getEntity(id, session);
      const lastOrder = profile.lastPlayed.get(id) || 0;
      const neverPlayed = !lastOrder;
      const rest = neverPlayed
        ? 9999
        : Math.max(
            0,
            profile.currentOrder - lastOrder
          );

      const remaining = Math.max(
        0,
        profile.required - rest
      );

      return {
        id,
        name: entity?.name || "Peserta",
        lastOrder,
        rest,
        neverPlayed,
        ready: remaining === 0,
        remaining
      };
    });

    const tired = items.filter(item => !item.ready);
    const minimumRest = items.length
      ? Math.min(...items.map(item => item.rest))
      : 9999;

    return {
      required: profile.required,
      ready:
        profile.required === 0 ||
        tired.length === 0,
      minimumRest,
      items,
      tired,
      tiredNames: tired.map(item => item.name)
    };
  }


  function getPlannedRestStatus(
    participantIds,
    session = requireSession()
  ) {
    const required = Math.max(
      0,
      Number(session.setup.minRestRounds ?? 1)
    );

    const ids = Array.isArray(participantIds)
      ? [...new Set(participantIds.filter(Boolean))]
      : [];

    const orderedRounds = [...session.rounds]
      .filter(round => round.matches?.length)
      .sort((a, b) =>
        Number(a.number || 0) -
        Number(b.number || 0)
      );

    const items = ids.map(id => {
      let lastIndex = -1;

      for (
        let index = orderedRounds.length - 1;
        index >= 0;
        index--
      ) {
        const included = orderedRounds[index]
          .matches
          .some(match =>
            PFScheduler
              .matchEntityIds(session, match)
              .includes(id)
          );

        if (included) {
          lastIndex = index;
          break;
        }
      }

      const neverScheduled = lastIndex < 0;

      const rest = neverScheduled
        ? 9999
        : Math.max(
            0,
            orderedRounds.length -
            lastIndex -
            1
          );

      const remaining = Math.max(
        0,
        required - rest
      );

      return {
        id,
        name: getEntity(id, session)?.name || "Peserta",
        rest,
        neverScheduled,
        ready: remaining === 0,
        remaining
      };
    });

    const tired = items.filter(item => !item.ready);

    return {
      required,
      ready:
        required === 0 ||
        tired.length === 0,
      minimumRest: items.length
        ? Math.min(...items.map(item => item.rest))
        : 9999,
      items,
      tired,
      tiredNames: tired.map(item => item.name)
    };
  }

  function getManualCreationRestStatus(
    participantIds,
    session = requireSession()
  ) {
    const actual = getParticipantRestStatus(
      participantIds,
      session
    );

    const planned = getPlannedRestStatus(
      participantIds,
      session
    );

    const tiredNames = [
      ...new Set([
        ...actual.tiredNames,
        ...planned.tiredNames
      ])
    ];

    return {
      required: Math.max(
        actual.required,
        planned.required
      ),
      ready:
        actual.ready &&
        planned.ready,
      actual,
      planned,
      tiredNames
    };
  }

  function getMatchRestStatus(
    roundId,
    matchId,
    session = requireSession()
  ) {
    const round = getRound(roundId, session);
    const match = round?.matches.find(
      item => item.id === matchId
    );

    if (!round || !match) {
      return {
        ready: true,
        required: 0,
        minimumRest: 9999,
        items: [],
        tired: [],
        tiredNames: []
      };
    }

    return getParticipantRestStatus(
      PFScheduler.matchEntityIds(session, match),
      session
    );
  }

  function getRoundRestStatus(
    round,
    session = requireSession()
  ) {
    if (!round) {
      return {
        ready: true,
        required: 0,
        minimumRest: 9999,
        items: [],
        tired: [],
        tiredNames: []
      };
    }

    const ids = round.matches
      .filter(match => !match.completed)
      .flatMap(match =>
        PFScheduler.matchEntityIds(session, match)
      );

    return getParticipantRestStatus(ids, session);
  }

  function getCompensationPerMissed(
    session = requireSession()
  ) {
    return session.setup.scoreMode === "fixed"
      ? Math.floor(Number(session.setup.pointsTotal) / 2)
      : 1.5;
  }

  function suggestManualMatchParticipants(
    session = requireSession()
  ) {
    ensureTournamentWritable(session);

    if (!session.submitted) {
      throw new Error(
        "Mulai turnamen terlebih dahulu sebelum menambah match."
      );
    }

    const required =
      session.setup.randomMode === "team"
        ? 2
        : 4;

    const activeEntities = getEntities(session);

    if (activeEntities.length < required) {
      throw new Error(
        session.setup.randomMode === "team"
          ? "Minimal 2 tim aktif."
          : "Minimal 4 pemain aktif."
      );
    }

    const restProfile = getRestProfile(session);
    const epochRound = Math.max(
      1,
      Number(session.balanceEpochRound || 1)
    );

    const epochCompleted = new Map(
      activeEntities.map(entity => [entity.id, 0])
    );

    const epochPlanned = new Map(
      activeEntities.map(entity => [entity.id, 0])
    );

    session.rounds.forEach(round => {
      if (Number(round.number || 0) < epochRound) {
        return;
      }

      round.matches.forEach(match => {
        PFScheduler
          .matchEntityIds(session, match)
          .forEach(id => {
            if (!epochPlanned.has(id)) return;

            epochPlanned.set(
              id,
              epochPlanned.get(id) + 1
            );

            if (match.completed) {
              epochCompleted.set(
                id,
                epochCompleted.get(id) + 1
              );
            }
          });
      });
    });

    return activeEntities
      .map(entity => {
        const lastOrder =
          restProfile.lastPlayed.get(entity.id) || 0;

        const rest = lastOrder
          ? Math.max(
              0,
              restProfile.currentOrder - lastOrder
            )
          : 9999;

        const plannedRest =
          getPlannedRestStatus(
            [entity.id],
            session
          ).items[0];

        const actualReady =
          restProfile.required === 0 ||
          rest >= restProfile.required;

        const plannedReady =
          plannedRest?.ready !== false;

        return {
          entity,
          fullyReady:
            actualReady &&
            plannedReady,
          actualReady,
          plannedReady,
          epochCompleted:
            epochCompleted.get(entity.id) || 0,
          epochPlanned:
            epochPlanned.get(entity.id) || 0,
          rest,
          plannedRest:
            plannedRest?.rest ?? 9999,
          random: Math.random()
        };
      })
      .sort((a, b) =>
        Number(b.fullyReady) - Number(a.fullyReady) ||
        Number(b.actualReady) - Number(a.actualReady) ||
        Number(b.plannedReady) - Number(a.plannedReady) ||
        a.epochCompleted - b.epochCompleted ||
        a.epochPlanned - b.epochPlanned ||
        b.rest - a.rest ||
        b.plannedRest - a.plannedRest ||
        a.random - b.random
      )
      .slice(0, required)
      .map(item => item.entity.id);
  }

  function chooseManualPairing(session, ids) {
    const [a, b, c, d] = ids;
    const options = [
      [[a, b], [c, d]],
      [[a, c], [b, d]],
      [[a, d], [b, c]]
    ];

    const partnerCount = new Map();
    const opponentCount = new Map();
    const pairKey = (x, y) => [x, y].sort().join("|");

    session.rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.teamA.length !== 2 || match.teamB.length !== 2) return;

        [match.teamA, match.teamB].forEach(team => {
          const key = pairKey(team[0], team[1]);
          partnerCount.set(key, (partnerCount.get(key) || 0) + 1);
        });

        match.teamA.forEach(left => {
          match.teamB.forEach(right => {
            const key = pairKey(left, right);
            opponentCount.set(key, (opponentCount.get(key) || 0) + 1);
          });
        });
      });
    });

    return options
      .map(([teamA, teamB]) => {
        const partnerPenalty =
          (partnerCount.get(pairKey(teamA[0], teamA[1])) || 0) * 100 +
          (partnerCount.get(pairKey(teamB[0], teamB[1])) || 0) * 100;

        let opponentPenalty = 0;
        teamA.forEach(left => {
          teamB.forEach(right => {
            opponentPenalty +=
              (opponentCount.get(pairKey(left, right)) || 0) * 8;
          });
        });

        return {
          teamA,
          teamB,
          penalty: partnerPenalty + opponentPenalty,
          tie: Math.random()
        };
      })
      .sort((x, y) =>
        x.penalty - y.penalty ||
        x.tie - y.tie
      )[0];
  }

  function addManualMatch(
    participantIds,
    options = {}
  ) {
    const session = requireSession();
    ensureTournamentWritable(session);

    if (!session.submitted) {
      throw new Error(
        "Turnamen belum disubmit."
      );
    }

    const required =
      session.setup.randomMode === "team"
        ? 2
        : 4;

    const ids = Array.isArray(participantIds)
      ? participantIds.filter(Boolean)
      : [];

    if (ids.length !== required) {
      throw new Error(
        session.setup.randomMode === "team"
          ? "Pilih tepat 2 tim."
          : "Pilih tepat 4 pemain."
      );
    }

    if (new Set(ids).size !== required) {
      throw new Error("Peserta dalam satu match tidak boleh duplikat.");
    }

    const activeIds = new Set(
      getEntities(session).map(entity => entity.id)
    );

    const invalid = ids.find(id => !activeIds.has(id));

    if (invalid) {
      throw new Error(
        "Semua peserta match manual harus berstatus aktif."
      );
    }

    const maximumCourt = Math.max(
      1,
      Number(session.setup.courtCount)
    );

    const court = Math.min(
      maximumCourt,
      Math.max(1, Number(options.court || 1))
    );

    const roundNumber = session.rounds.reduce(
      (maximum, round) =>
        Math.max(maximum, Number(round.number) || 0),
      0
    ) + 1;

    let teamA;
    let teamB;

    if (session.setup.randomMode === "team") {
      teamA = [ids[0]];
      teamB = [ids[1]];
    } else {
      const pairing = chooseManualPairing(session, ids);
      teamA = pairing.teamA;
      teamB = pairing.teamB;
    }

    const match = {
      id: PFStorage.uid("match"),
      court,
      teamA,
      teamB,
      scoreA: "",
      scoreB: "",
      completed: false,
      status: "scheduled",
      createdAt: new Date().toISOString()
    };

    const round = {
      id: PFStorage.uid("round"),
      number: roundNumber,
      status: "scheduled",
      kind: "manual",
      label: String(options.label || "Match Manual").trim() ||
        "Match Manual",
      createdAt: new Date().toISOString(),
      matches: [match],
      resting: getEntities(session)
        .filter(entity => !ids.includes(entity.id))
        .map(entity => entity.id)
    };

    session.rounds.push(round);

    if (Boolean(options.activateNow)) {
      activateRoundInternal(session, round);
    }

    touch(session);
    persist();

    return {
      round,
      match,
      compensationPerMissed:
        getCompensationPerMissed(session)
    };
  }

  function removeManualMatch(
    roundId,
    matchId
  ) {
    const session = requireSession();
    ensureTournamentWritable(session);

    const round = getRound(roundId, session);
    const match = round?.matches.find(
      item => item.id === matchId
    );

    if (
      !round ||
      !match ||
      !["manual_extra", "manual"].includes(round.kind)
    ) {
      throw new Error(
        "Match manual tidak ditemukan."
      );
    }

    if (match.completed) {
      throw new Error(
        "Match manual yang sudah memiliki skor tidak dapat dihapus."
      );
    }

    session.scoreHistory = session.scoreHistory.filter(
      item =>
        item.roundId !== roundId &&
        item.matchId !== matchId
    );

    session.rounds = session.rounds.filter(
      item => item.id !== roundId
    );

    if (session.activeRoundId === roundId) {
      session.activeRoundId = null;
    }

    if (session.submitted) {
      rebuildFutureSchedule(session);
    }

    touch(session);
    persist();

    return true;
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
        joinedAtRound: Math.max(
          1,
          Number(entity.joinedAtRound || 1)
        ),
        eligibleMaxGames: 0,
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
      getCompensationPerMissed(session);

    values.forEach(item => {
      item.diff = item.scored - item.conceded;
      item.winRate =
        item.played > 0
          ? item.wins / item.played
          : 0;

      const eligibleCounts = new Map(
        values.map(entity => [entity.id, 0])
      );

      session.rounds.forEach(round => {
        if (
          Number(round.number || 0) <
          item.joinedAtRound
        ) {
          return;
        }

        round.matches.forEach(match => {
          if (!match.completed) return;

          PFScheduler
            .matchEntityIds(session, match)
            .forEach(id => {
              if (eligibleCounts.has(id)) {
                eligibleCounts.set(
                  id,
                  eligibleCounts.get(id) + 1
                );
              }
            });
        });
      });

      item.eligibleMaxGames = Math.max(
        ...eligibleCounts.values(),
        0
      );

      const ownEligibleGames =
        eligibleCounts.get(item.id) || 0;

      const missed = Math.max(
        0,
        item.eligibleMaxGames - ownEligibleGames
      );

      item.compensation =
        item.played > 0
          ? missed * compensationPerMissed
          : 0;

      item.points =
        session.setup.scoreMode === "fixed"
          ? item.scored + item.compensation
          : item.wins * 3 + item.ties + item.compensation;
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
    getNextRound,
    saveSetup,
    addPlayer,
    addPlayersBatch,
    addTeam,
    setEntityActive,
    removeEntity,
    getRecommendation,
    submitTournament,
    activateRound,
    setScore,
    undoLastScore,
    reopenMatch,
    startNextRound,
    completeTournament,
    reopenTournament,
    getParticipantRestStatus,
    getPlannedRestStatus,
    getManualCreationRestStatus,
    getMatchRestStatus,
    getRoundRestStatus,
    getCompensationPerMissed,
    suggestManualMatchParticipants,
    addManualMatch,
    removeManualMatch,
    computeStats,
    sessionSummary,
    replaceRoot,
    clearAll
  };
})();
