(function () {
  "use strict";

  const STORAGE_KEY = "padelflex_flow_v2";

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function defaultState() {
    return {
      version: 2,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function normalize(raw) {
    const base = defaultState();
    const state = raw && typeof raw === "object" ? raw : {};

    return {
      ...base,
      ...state,
      setup: {
        ...base.setup,
        ...(state.setup || {})
      },
      players: Array.isArray(state.players) ? state.players : [],
      teams: Array.isArray(state.teams) ? state.teams : [],
      rounds: Array.isArray(state.rounds) ? state.rounds : [],
      submitted: Boolean(state.submitted),
      activeRoundId: state.activeRoundId || null
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalize(JSON.parse(raw)) : defaultState();
    } catch (error) {
      console.error("Gagal membaca localStorage:", error);
      return defaultState();
    }
  }

  function save(state) {
    const normalized = normalize(state);
    normalized.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function reset() {
    const state = defaultState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function exportJson(state) {
    return JSON.stringify(normalize(state), null, 2);
  }

  function importJson(text) {
    const parsed = JSON.parse(text);

    if (!parsed || !parsed.setup || !Array.isArray(parsed.rounds)) {
      throw new Error("Format backup tidak valid.");
    }

    return save(parsed);
  }

  window.PFStorage = {
    STORAGE_KEY,
    uid,
    defaultState,
    load,
    save,
    reset,
    exportJson,
    importJson
  };
})();
