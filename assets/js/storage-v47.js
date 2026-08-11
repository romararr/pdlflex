(function () {
  "use strict";

  const STORAGE_KEY = "padelflex_v4";
  const LEGACY_KEY = "padelflex_flow_v2";

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function defaultSession() {
    return {
      id: uid("session"),
      status: "draft",
      setup: {
        initialized: false,
        matchName: "Padel Malam Ini",
        randomMode: "player",
        scoreMode: "fixed",
        pointsTotal: 21,
        courtCount: 1,
        scheduleMode: "manual",
        minimumGames: 4,
        minRestRounds: 1
      },
      players: [],
      teams: [],
      submitted: false,
      rounds: [],
      activeRoundId: null,
      roundCompletionCounter: 0,
      balanceEpochRound: 1,
      scoreHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      archivedAt: null
    };
  }

  function defaultRoot() {
    return {
      version: 4,
      selectedSessionId: null,
      sessions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function finiteNumber(value, fallback, min = -Infinity, max = Infinity) {
    const number = Number(value);

    if (!Number.isFinite(number)) return fallback;

    return Math.min(max, Math.max(min, number));
  }

  function normalizeEntity(entity, type) {
    if (!entity || typeof entity !== "object") return null;

    const id = String(entity.id || "").trim();
    const name = String(entity.name || "").trim();

    if (!id || !name) return null;

    const normalized = {
      ...entity,
      id,
      name,
      active: entity.active !== false,
      joinedAtRound: finiteNumber(
        entity.joinedAtRound,
        1,
        1
      )
    };

    if (type === "team") {
      normalized.player1 = String(entity.player1 || "").trim();
      normalized.player2 = String(entity.player2 || "").trim();

      if (!normalized.player1 || !normalized.player2) {
        return null;
      }
    }

    return normalized;
  }

  function normalizeMatch(match, randomMode) {
    if (!match || typeof match !== "object") return null;

    const id = String(match.id || "").trim();
    const expectedTeamSize = randomMode === "team" ? 1 : 2;
    const teamA = Array.isArray(match.teamA)
      ? match.teamA.map(String).filter(Boolean)
      : [];
    const teamB = Array.isArray(match.teamB)
      ? match.teamB.map(String).filter(Boolean)
      : [];

    if (
      !id ||
      teamA.length !== expectedTeamSize ||
      teamB.length !== expectedTeamSize
    ) {
      return null;
    }

    return {
      ...match,
      id,
      court: finiteNumber(match.court, 1, 1),
      teamA,
      teamB,
      scoreA: match.scoreA === undefined || match.scoreA === null
        ? ""
        : match.scoreA,
      scoreB: match.scoreB === undefined || match.scoreB === null
        ? ""
        : match.scoreB,
      completed: Boolean(match.completed),
      status: ["scheduled", "active", "completed"].includes(match.status)
        ? match.status
        : (match.completed ? "completed" : "scheduled")
    };
  }

  function normalizeRound(round, randomMode, fallbackNumber) {
    if (!round || typeof round !== "object") return null;

    const id = String(round.id || "").trim();
    if (!id) return null;

    const matches = Array.isArray(round.matches)
      ? round.matches
          .map(match => normalizeMatch(match, randomMode))
          .filter(Boolean)
      : [];

    if (!matches.length) return null;

    return {
      ...round,
      id,
      number: finiteNumber(
        round.number,
        fallbackNumber || 1,
        1
      ),
      status: ["scheduled", "active", "completed"].includes(round.status)
        ? round.status
        : (
            matches.every(match => match.completed)
              ? "completed"
              : "scheduled"
          ),
      matches,
      resting: Array.isArray(round.resting)
        ? round.resting.map(String).filter(Boolean)
        : []
    };
  }

  function normalizeSession(raw) {
    const base = defaultSession();
    const session = raw && typeof raw === "object" ? raw : {};

    const inferredScheduleMode =
      session.setup?.scheduleMode ||
      (
        Array.isArray(session.rounds) &&
        session.rounds.some(round =>
          round &&
          round.kind !== "manual_extra" &&
          round.kind !== "manual"
        )
          ? "auto"
          : "manual"
      );

    const randomMode = session.setup?.randomMode === "team"
      ? "team"
      : "player";

    const normalized = {
      ...base,
      ...session,
      id: String(session.id || base.id),
      status: ["draft", "active", "completed", "archived"].includes(session.status)
        ? session.status
        : "draft",
      setup: {
        ...base.setup,
        ...(session.setup || {}),
        randomMode,
        scoreMode: session.setup?.scoreMode === "manual" ? "manual" : "fixed",
        pointsTotal: finiteNumber(
          session.setup?.pointsTotal,
          21,
          1
        ),
        courtCount: finiteNumber(
          session.setup?.courtCount,
          1,
          1,
          20
        ),
        minimumGames: finiteNumber(
          session.setup?.minimumGames,
          4,
          1,
          100
        ),
        minRestRounds: finiteNumber(
          session.setup?.minRestRounds,
          1,
          0,
          3
        ),
        scheduleMode: inferredScheduleMode
      },
      players: Array.isArray(session.players)
        ? session.players
            .map(entity => normalizeEntity(entity, "player"))
            .filter(Boolean)
        : [],
      teams: Array.isArray(session.teams)
        ? session.teams
            .map(entity => normalizeEntity(entity, "team"))
            .filter(Boolean)
        : [],
      rounds: Array.isArray(session.rounds)
        ? session.rounds
            .map((round, index) =>
              normalizeRound(round, randomMode, index + 1)
            )
            .filter(Boolean)
        : [],
      scoreHistory: Array.isArray(session.scoreHistory)
        ? session.scoreHistory.filter(history =>
            history &&
            typeof history === "object" &&
            typeof history.roundId === "string" &&
            typeof history.matchId === "string" &&
            history.before &&
            typeof history.before === "object"
          )
        : [],
      submitted: Boolean(session.submitted),
      roundCompletionCounter: finiteNumber(
        session.roundCompletionCounter,
        0,
        0
      ),
      balanceEpochRound: finiteNumber(
        session.balanceEpochRound,
        1,
        1
      )
    };

    let completionCounter = normalized.roundCompletionCounter;

    [...normalized.rounds]
      .sort((a, b) =>
        Number(a.number || 0) - Number(b.number || 0)
      )
      .forEach(round => {
        if (
          round.status === "completed" ||
          (
            Array.isArray(round.matches) &&
            round.matches.length > 0 &&
            round.matches.every(match => match.completed)
          )
        ) {
          if (!Number(round.completedOrder)) {
            completionCounter++;
            round.completedOrder = completionCounter;
          } else {
            completionCounter = Math.max(
              completionCounter,
              Number(round.completedOrder)
            );
          }
        }
      });

    normalized.roundCompletionCounter = completionCounter;

    const validRoundIds = new Set(
      normalized.rounds.map(round => round.id)
    );
    const validMatchIds = new Set(
      normalized.rounds.flatMap(round =>
        round.matches.map(match => match.id)
      )
    );

    normalized.scoreHistory = normalized.scoreHistory.filter(history =>
      validRoundIds.has(history.roundId) &&
      validMatchIds.has(history.matchId)
    );

    if (
      normalized.activeRoundId &&
      !validRoundIds.has(normalized.activeRoundId)
    ) {
      normalized.activeRoundId = null;
    }

    return normalized;
  }

  function normalizeRoot(raw) {
    const base = defaultRoot();
    const root = raw && typeof raw === "object" ? raw : {};

    const sessions = [];
    const seenSessionIds = new Set();

    if (Array.isArray(root.sessions)) {
      root.sessions.forEach(rawSession => {
        const session = normalizeSession(rawSession);

        if (seenSessionIds.has(session.id)) return;

        seenSessionIds.add(session.id);
        sessions.push(session);
      });
    }

    const selectedExists = sessions.some(
      session => session.id === root.selectedSessionId
    );

    return {
      ...base,
      ...root,
      version: 4,
      sessions,
      selectedSessionId: selectedExists
        ? root.selectedSessionId
        : (sessions[0]?.id || null)
    };
  }

  function migrateLegacy() {
    try {
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (!legacyRaw) return null;

      const legacy = JSON.parse(legacyRaw);

      if (!legacy || !legacy.setup) return null;

      const session = normalizeSession({
        ...legacy,
        id: uid("session"),
        status: legacy.submitted ? "active" : "draft",
        scoreHistory: [],
        createdAt: legacy.createdAt || new Date().toISOString(),
        updatedAt: legacy.updatedAt || new Date().toISOString()
      });

      const root = defaultRoot();
      root.sessions = [session];
      root.selectedSessionId = session.id;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
      return root;
    } catch (error) {
      console.error("Migrasi data lama gagal:", error);
      return null;
    }
  }

  function quarantineCorruptData(raw, error) {
    try {
      const quarantineKey =
        `${STORAGE_KEY}_corrupt_${Date.now()}`;

      if (raw) {
        localStorage.setItem(quarantineKey, raw);
      }

      localStorage.removeItem(STORAGE_KEY);
      console.warn(
        `Data rusak dipindahkan ke ${quarantineKey}:`,
        error
      );
    } catch (quarantineError) {
      console.warn(
        "Data rusak tidak dapat dikarantina:",
        quarantineError
      );
    }
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return normalizeRoot(migrateLegacy() || defaultRoot());
    }

    try {
      const parsed = JSON.parse(raw);

      if (!parsed || !Array.isArray(parsed.sessions)) {
        throw new Error("Struktur root PadelFlex tidak valid.");
      }

      return normalizeRoot(parsed);
    } catch (error) {
      quarantineCorruptData(raw, error);
      return normalizeRoot(migrateLegacy() || defaultRoot());
    }
  }

  function save(root) {
    const normalized = normalizeRoot(root);
    normalized.updatedAt = new Date().toISOString();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(normalized)
    );

    return normalized;
  }

  function exportJson(root) {
    return JSON.stringify(normalizeRoot(root), null, 2);
  }

  function importJson(text) {
    const parsed = JSON.parse(text);

    if (
      !parsed ||
      !Array.isArray(parsed.sessions) ||
      parsed.sessions.some(session =>
        !session ||
        typeof session.id !== "string" ||
        !session.id ||
        !session.setup ||
        typeof session.setup.matchName !== "string"
      )
    ) {
      throw new Error("Format backup PadelFlex tidak valid.");
    }

    const ids = parsed.sessions.map(session => session.id);

    if (new Set(ids).size !== ids.length) {
      throw new Error("Backup memiliki ID turnamen yang duplikat.");
    }

    return save(parsed);
  }

  function clear() {
    const root = defaultRoot();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
    return root;
  }

  window.PFStorage = {
    STORAGE_KEY,
    LEGACY_KEY,
    uid,
    defaultRoot,
    defaultSession,
    normalizeSession,
    normalizeRoot,
    load,
    save,
    exportJson,
    importJson,
    clear
  };
})();
