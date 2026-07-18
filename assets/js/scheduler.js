(function () {
  "use strict";

  function key(a, b) {
    return [a, b].sort().join("|");
  }

  function getEntities(state) {
    return state.setup.randomMode === "team"
      ? state.teams.filter(team => team.active !== false)
      : state.players.filter(player => player.active !== false);
  }

  function entitiesPerCourt(state) {
    return state.setup.randomMode === "team" ? 2 : 4;
  }

  function usableCourts(state) {
    const entities = getEntities(state);
    return Math.min(
      Number(state.setup.courtCount),
      Math.floor(entities.length / entitiesPerCourt(state))
    );
  }

  function matchEntityIds(state, match) {
    if (state.setup.randomMode === "team") {
      return [match.teamA[0], match.teamB[0]];
    }

    return [...match.teamA, ...match.teamB];
  }

  function createMetrics(state, rounds) {
    const metrics = {
      playCount: new Map(),
      lastPlayed: new Map(),
      pairCount: new Map(),
      opponentCount: new Map()
    };

    [...rounds]
      .sort((a, b) => a.number - b.number)
      .forEach(round => {
        round.matches.forEach(match => {
          const all = matchEntityIds(state, match);

          all.forEach(id => {
            metrics.playCount.set(id, (metrics.playCount.get(id) || 0) + 1);
            metrics.lastPlayed.set(id, round.number);
          });

          if (state.setup.randomMode === "player") {
            [
              [match.teamA[0], match.teamA[1]],
              [match.teamB[0], match.teamB[1]]
            ].forEach(([a, b]) => {
              const pair = key(a, b);
              metrics.pairCount.set(
                pair,
                (metrics.pairCount.get(pair) || 0) + 1
              );
            });

            match.teamA.forEach(a => {
              match.teamB.forEach(b => {
                const opponent = key(a, b);
                metrics.opponentCount.set(
                  opponent,
                  (metrics.opponentCount.get(opponent) || 0) + 1
                );
              });
            });
          } else {
            const opponent = key(match.teamA[0], match.teamB[0]);
            metrics.opponentCount.set(
              opponent,
              (metrics.opponentCount.get(opponent) || 0) + 1
            );
          }
        });
      });

    return metrics;
  }

  function selectEntities(entities, slotCount, metrics) {
    return [...entities]
      .sort((a, b) => {
        const playDiff =
          (metrics.playCount.get(a.id) || 0) -
          (metrics.playCount.get(b.id) || 0);

        if (playDiff !== 0) return playDiff;

        const lastDiff =
          (metrics.lastPlayed.get(a.id) || 0) -
          (metrics.lastPlayed.get(b.id) || 0);

        if (lastDiff !== 0) return lastDiff;

        const joinedDiff =
          (a.joinedAtRound || 1) -
          (b.joinedAtRound || 1);

        if (joinedDiff !== 0) return joinedDiff;

        return (a.name || "").localeCompare(b.name || "");
      })
      .slice(0, slotCount);
  }

  function combinationsOfFour(items) {
    const result = [];

    for (let a = 0; a < items.length - 3; a++) {
      for (let b = a + 1; b < items.length - 2; b++) {
        for (let c = b + 1; c < items.length - 1; c++) {
          for (let d = c + 1; d < items.length; d++) {
            result.push([items[a], items[b], items[c], items[d]]);
          }
        }
      }
    }

    return result;
  }

  function pairingOptions(group) {
    const [a, b, c, d] = group;

    return [
      [[a, b], [c, d]],
      [[a, c], [b, d]],
      [[a, d], [b, c]]
    ];
  }

  function playerPairingPenalty(teamA, teamB, metrics) {
    const pairPenalty =
      (metrics.pairCount.get(key(teamA[0], teamA[1])) || 0) * 100 +
      (metrics.pairCount.get(key(teamB[0], teamB[1])) || 0) * 100;

    let opponentPenalty = 0;

    teamA.forEach(a => {
      teamB.forEach(b => {
        opponentPenalty +=
          (metrics.opponentCount.get(key(a, b)) || 0) * 8;
      });
    });

    return pairPenalty + opponentPenalty;
  }

  function registerPlayerMatch(match, roundNumber, metrics) {
    const all = [...match.teamA, ...match.teamB];

    all.forEach(id => {
      metrics.playCount.set(id, (metrics.playCount.get(id) || 0) + 1);
      metrics.lastPlayed.set(id, roundNumber);
    });

    [
      [match.teamA[0], match.teamA[1]],
      [match.teamB[0], match.teamB[1]]
    ].forEach(([a, b]) => {
      const pair = key(a, b);
      metrics.pairCount.set(pair, (metrics.pairCount.get(pair) || 0) + 1);
    });

    match.teamA.forEach(a => {
      match.teamB.forEach(b => {
        const opponent = key(a, b);
        metrics.opponentCount.set(
          opponent,
          (metrics.opponentCount.get(opponent) || 0) + 1
        );
      });
    });
  }

  function buildPlayerMatches(selected, courts, roundNumber, metrics) {
    const remaining = selected.map(entity => entity.id);
    const matches = [];

    for (let court = 1; court <= courts; court++) {
      if (remaining.length < 4) break;

      let best = null;

      combinationsOfFour(remaining).forEach(group => {
        pairingOptions(group).forEach(([teamA, teamB]) => {
          const penalty = playerPairingPenalty(teamA, teamB, metrics);

          if (!best || penalty < best.penalty) {
            best = { group, teamA, teamB, penalty };
          }
        });
      });

      if (!best) break;

      const match = {
        id: PFStorage.uid("match"),
        court,
        teamA: best.teamA,
        teamB: best.teamB,
        scoreA: "",
        scoreB: "",
        completed: false,
        status: "scheduled",
        deferredCount: 0
      };

      matches.push(match);
      registerPlayerMatch(match, roundNumber, metrics);

      best.group.forEach(id => {
        const index = remaining.indexOf(id);
        if (index >= 0) remaining.splice(index, 1);
      });
    }

    return matches;
  }

  function buildTeamMatches(selected, courts, roundNumber, metrics) {
    const remaining = selected.map(entity => entity.id);
    const matches = [];

    for (let court = 1; court <= courts; court++) {
      if (remaining.length < 2) break;

      let bestPair = null;

      for (let a = 0; a < remaining.length - 1; a++) {
        for (let b = a + 1; b < remaining.length; b++) {
          const teamA = remaining[a];
          const teamB = remaining[b];
          const penalty =
            (metrics.opponentCount.get(key(teamA, teamB)) || 0) * 100;

          if (!bestPair || penalty < bestPair.penalty) {
            bestPair = { teamA, teamB, penalty };
          }
        }
      }

      if (!bestPair) break;

      const match = {
        id: PFStorage.uid("match"),
        court,
        teamA: [bestPair.teamA],
        teamB: [bestPair.teamB],
        scoreA: "",
        scoreB: "",
        completed: false,
        status: "scheduled",
        deferredCount: 0
      };

      matches.push(match);

      [bestPair.teamA, bestPair.teamB].forEach(id => {
        metrics.playCount.set(id, (metrics.playCount.get(id) || 0) + 1);
        metrics.lastPlayed.set(id, roundNumber);
      });

      const opponent = key(bestPair.teamA, bestPair.teamB);
      metrics.opponentCount.set(
        opponent,
        (metrics.opponentCount.get(opponent) || 0) + 1
      );

      remaining.splice(remaining.indexOf(bestPair.teamA), 1);
      remaining.splice(remaining.indexOf(bestPair.teamB), 1);
    }

    return matches;
  }

  function buildRounds(state, count, startNumber, preservedRounds) {
    const entities = getEntities(state);
    const courts = usableCourts(state);
    const perCourt = entitiesPerCourt(state);

    if (
      entities.length < perCourt ||
      courts < 1 ||
      count < 1
    ) {
      return [];
    }

    const metrics = createMetrics(state, preservedRounds);
    const generated = [];

    for (let offset = 0; offset < count; offset++) {
      const number = startNumber + offset;
      const slots = courts * perCourt;
      const selected = selectEntities(entities, slots, metrics);

      const matches =
        state.setup.randomMode === "team"
          ? buildTeamMatches(selected, courts, number, metrics)
          : buildPlayerMatches(selected, courts, number, metrics);

      const playingIds = matches.flatMap(match =>
        matchEntityIds(state, match)
      );

      generated.push({
        id: PFStorage.uid("round"),
        number,
        status: "scheduled",
        deferred: false,
        createdAt: new Date().toISOString(),
        matches,
        resting: entities
          .filter(entity => !playingIds.includes(entity.id))
          .map(entity => entity.id)
      });
    }

    return generated;
  }

  function countAppearances(state, entities, rounds) {
    const counts = new Map(entities.map(entity => [entity.id, 0]));

    rounds.forEach(round => {
      round.matches.forEach(match => {
        matchEntityIds(state, match).forEach(id => {
          if (counts.has(id)) {
            counts.set(id, counts.get(id) + 1);
          }
        });
      });
    });

    return entities.map(entity => counts.get(entity.id) || 0);
  }

  function targetFeasible(counts, rounds, slotsPerRound, exactOnly) {
    const entityCount = counts.length;
    const currentTotal = counts.reduce((sum, value) => sum + value, 0);
    const finalTotal = currentTotal + rounds * slotsPerRound;
    const low = Math.floor(finalTotal / entityCount);
    const high = Math.ceil(finalTotal / entityCount);
    const highCount = finalTotal % entityCount;

    if (exactOnly && highCount !== 0) return null;

    let forcedHigh = 0;
    let forcedLow = 0;

    for (const current of counts) {
      const canReachLow =
        current <= low &&
        low <= current + rounds;

      const canReachHigh =
        current <= high &&
        high <= current + rounds;

      if (!canReachLow && !canReachHigh) return null;
      if (!canReachLow && canReachHigh) forcedHigh++;
      if (canReachLow && !canReachHigh) forcedLow++;
    }

    if (
      forcedHigh > highCount ||
      highCount > entityCount - forcedLow
    ) {
      return null;
    }

    return {
      low,
      high,
      exact: low === high
    };
  }

  function recommend(state, preservedRounds, options = {}) {
    const entities = getEntities(state);
    const courts = usableCourts(state);
    const perCourt = entitiesPerCourt(state);

    if (entities.length < perCourt || courts < 1) {
      return {
        available: false,
        reason:
          state.setup.randomMode === "team"
            ? "Minimal 2 tim aktif untuk membuat pertandingan."
            : "Minimal 4 pemain aktif untuk membuat pertandingan."
      };
    }

    const slotsPerRound = courts * perCourt;
    const counts = countAppearances(state, entities, preservedRounds);
    const currentMax = Math.max(...counts, 0);
    const minimumGames = Math.max(
      1,
      Number(options.minimumGames || state.setup.minimumGames || 4)
    );
    const minimumTarget = Math.max(minimumGames, currentMax);
    const maxRounds = Math.max(1, Number(options.maxRounds || 80));

    let bestCompact = null;

    for (let rounds = 1; rounds <= maxRounds; rounds++) {
      const compact = targetFeasible(
        counts,
        rounds,
        slotsPerRound,
        false
      );

      if (
        compact &&
        compact.low >= minimumTarget &&
        !bestCompact
      ) {
        bestCompact = { rounds, ...compact };
      }

      const exact = targetFeasible(
        counts,
        rounds,
        slotsPerRound,
        true
      );

      if (exact && exact.low >= minimumTarget) {
        return {
          available: true,
          rounds,
          exact: true,
          minGames: exact.low,
          maxGames: exact.high,
          entityCount: entities.length,
          courts,
          slotsPerRound,
          currentCounts: counts
        };
      }
    }

    if (bestCompact) {
      return {
        available: true,
        rounds: bestCompact.rounds,
        exact: false,
        minGames: bestCompact.low,
        maxGames: bestCompact.high,
        entityCount: entities.length,
        courts,
        slotsPerRound,
        currentCounts: counts
      };
    }

    return {
      available: false,
      reason:
        "Pemerataan belum ditemukan. Kurangi minimum game atau periksa roster."
    };
  }

  window.PFScheduler = {
    getEntities,
    entitiesPerCourt,
    usableCourts,
    matchEntityIds,
    buildRounds,
    recommend
  };
})();
