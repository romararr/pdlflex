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
        minimumGames: 4
      },
      players: [],
      teams: [],
      submitted: false,
      rounds: [],
      activeRoundId: null,
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

  function normalizeSession(raw) {
    const base = defaultSession();
    const session = raw && typeof raw === "object" ? raw : {};

    return {
      ...base,
      ...session,
      setup: {
        ...base.setup,
        ...(session.setup || {})
      },
      players: Array.isArray(session.players) ? session.players : [],
      teams: Array.isArray(session.teams) ? session.teams : [],
      rounds: Array.isArray(session.rounds) ? session.rounds : [],
      scoreHistory: Array.isArray(session.scoreHistory)
        ? session.scoreHistory
        : [],
      submitted: Boolean(session.submitted)
    };
  }

  function normalizeRoot(raw) {
    const base = defaultRoot();
    const root = raw && typeof raw === "object" ? raw : {};

    const sessions = Array.isArray(root.sessions)
      ? root.sessions.map(normalizeSession)
      : [];

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

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        return normalizeRoot(JSON.parse(raw));
      }

      return normalizeRoot(migrateLegacy() || defaultRoot());
    } catch (error) {
      console.error("Gagal membaca penyimpanan:", error);
      return defaultRoot();
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
      !Array.isArray(parsed.sessions)
    ) {
      throw new Error("Format backup PadelFlex tidak valid.");
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
