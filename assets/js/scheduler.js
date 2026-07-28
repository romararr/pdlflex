(function () {
  "use strict";

  function key(a, b) {
    return [a, b].sort().join("|");
  }

  function getEntities(session) {
    return session.setup.randomMode === "team"
      ? session.teams.filter(team => team.active !== false)
      : session.players.filter(player => player.active !== false);
  }

  function entitiesPerCourt(session) {
    return session.setup.randomMode === "team" ? 2 : 4;
  }

  function usableCourts(session) {
    const entities = getEntities(session);

    return Math.min(
      Number(session.setup.courtCount),
      Math.floor(
        entities.length / entitiesPerCourt(session)
      )
    );
  }

  function matchEntityIds(session, match) {
    return session.setup.randomMode === "team"
      ? [match.teamA[0], match.teamB[0]]
      : [...match.teamA, ...match.teamB];
  }

  function createMetrics(session, rounds) {
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
          matchEntityIds(session, match).forEach(id => {
            metrics.playCount.set(
              id,
              (metrics.playCount.get(id) || 0) + 1
            );
            metrics.lastPlayed.set(id, round.number);
          });

          if (session.setup.randomMode === "player") {
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
            const opponent = key(
              match.teamA[0],
              match.teamB[0]
            );

            metrics.opponentCount.set(
              opponent,
              (metrics.opponentCount.get(opponent) || 0) + 1
            );
          }
        });
      });

    return metrics;
  }

  function selectEntities(entities, slots, metrics) {
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

        return String(a.name || "")
          .localeCompare(String(b.name || ""));
      })
      .slice(0, slots);
  }

  function combinationsOfFour(items) {
    const groups = [];

    for (let a = 0; a < items.length - 3; a++) {
      for (let b = a + 1; b < items.length - 2; b++) {
        for (let c = b + 1; c < items.length - 1; c++) {
          for (let d = c + 1; d < items.length; d++) {
            groups.push([items[a], items[b], items[c], items[d]]);
          }
        }
      }
    }

    return groups;
  }

  function pairingOptions(group) {
    const [a, b, c, d] = group;

    return [
      [[a, b], [c, d]],
      [[a, c], [b, d]],
      [[a, d], [b, c]]
    ];
  }

  function playerPenalty(teamA, teamB, metrics) {
    const partnerPenalty =
      (metrics.pairCount.get(key(teamA[0], teamA[1])) || 0) * 100 +
      (metrics.pairCount.get(key(teamB[0], teamB[1])) || 0) * 100;

    let opponentPenalty = 0;

    teamA.forEach(a => {
      teamB.forEach(b => {
        opponentPenalty +=
          (metrics.opponentCount.get(key(a, b)) || 0) * 8;
      });
    });

    return partnerPenalty + opponentPenalty;
  }

  function registerPlayerMatch(
    match,
    roundNumber,
    metrics
  ) {
    [...match.teamA, ...match.teamB].forEach(id => {
      metrics.playCount.set(
        id,
        (metrics.playCount.get(id) || 0) + 1
      );
      metrics.lastPlayed.set(id, roundNumber);
    });

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
  }

  function buildPlayerMatches(
    selected,
    courts,
    roundNumber,
    metrics
  ) {
    const remaining = selected.map(entity => entity.id);
    const matches = [];

    for (let court = 1; court <= courts; court++) {
      if (remaining.length < 4) break;

      let best = null;

      combinationsOfFour(remaining).forEach(group => {
        pairingOptions(group).forEach(([teamA, teamB]) => {
          const penalty = playerPenalty(
            teamA,
            teamB,
            metrics
          );

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
        createdAt: new Date().toISOString()
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

  function buildTeamMatches(
    selected,
    courts,
    roundNumber,
    metrics
  ) {
    const remaining = selected.map(entity => entity.id);
    const matches = [];

    for (let court = 1; court <= courts; court++) {
      if (remaining.length < 2) break;

      let best = null;

      for (let a = 0; a < remaining.length - 1; a++) {
        for (let b = a + 1; b < remaining.length; b++) {
          const teamA = remaining[a];
          const teamB = remaining[b];
          const penalty =
            (metrics.opponentCount.get(key(teamA, teamB)) || 0) * 100;

          if (!best || penalty < best.penalty) {
            best = { teamA, teamB, penalty };
          }
        }
      }

      if (!best) break;

      const match = {
        id: PFStorage.uid("match"),
        court,
        teamA: [best.teamA],
        teamB: [best.teamB],
        scoreA: "",
        scoreB: "",
        completed: false,
        status: "scheduled",
        createdAt: new Date().toISOString()
      };

      matches.push(match);

      [best.teamA, best.teamB].forEach(id => {
        metrics.playCount.set(
          id,
          (metrics.playCount.get(id) || 0) + 1
        );
        metrics.lastPlayed.set(id, roundNumber);
      });

      const opponent = key(best.teamA, best.teamB);
      metrics.opponentCount.set(
        opponent,
        (metrics.opponentCount.get(opponent) || 0) + 1
      );

      remaining.splice(remaining.indexOf(best.teamA), 1);
      remaining.splice(remaining.indexOf(best.teamB), 1);
    }

    return matches;
  }

  function buildRounds(
    session,
    count,
    startNumber,
    preservedRounds
  ) {
    const entities = getEntities(session);
    const courts = usableCourts(session);
    const perCourt = entitiesPerCourt(session);

    if (
      entities.length < perCourt ||
      courts < 1 ||
      count < 1
    ) {
      return [];
    }

    const metrics = createMetrics(session, preservedRounds);
    const rounds = [];

    for (let offset = 0; offset < count; offset++) {
      const number = startNumber + offset;
      const selected = selectEntities(
        entities,
        courts * perCourt,
        metrics
      );

      const matches =
        session.setup.randomMode === "team"
          ? buildTeamMatches(
              selected,
              courts,
              number,
              metrics
            )
          : buildPlayerMatches(
              selected,
              courts,
              number,
              metrics
            );

      const playing = matches.flatMap(match =>
        matchEntityIds(session, match)
      );

      rounds.push({
        id: PFStorage.uid("round"),
        number,
        status: "scheduled",
        createdAt: new Date().toISOString(),
        matches,
        resting: entities
          .filter(entity => !playing.includes(entity.id))
          .map(entity => entity.id)
      });
    }

    return rounds;
  }

  function countAppearances(
    session,
    entities,
    rounds
  ) {
    const counts = new Map(
      entities.map(entity => [entity.id, 0])
    );

    rounds.forEach(round => {
      round.matches.forEach(match => {
        matchEntityIds(session, match).forEach(id => {
          if (counts.has(id)) {
            counts.set(id, counts.get(id) + 1);
          }
        });
      });
    });

    return entities.map(entity => counts.get(entity.id) || 0);
  }

  function targetFeasible(
    counts,
    rounds,
    slotsPerRound,
    exactOnly
  ) {
    const entityCount = counts.length;
    const total =
      counts.reduce((sum, value) => sum + value, 0) +
      rounds * slotsPerRound;

    const low = Math.floor(total / entityCount);
    const high = Math.ceil(total / entityCount);
    const highCount = total % entityCount;

    if (exactOnly && highCount !== 0) return null;

    let forcedHigh = 0;
    let forcedLow = 0;

    for (const current of counts) {
      const canLow =
        current <= low &&
        low <= current + rounds;

      const canHigh =
        current <= high &&
        high <= current + rounds;

      if (!canLow && !canHigh) return null;
      if (!canLow && canHigh) forcedHigh++;
      if (canLow && !canHigh) forcedLow++;
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

  function recommend(
    session,
    preservedRounds,
    options = {}
  ) {
    const entities = getEntities(session);
    const courts = usableCourts(session);
    const perCourt = entitiesPerCourt(session);

    if (entities.length < perCourt || courts < 1) {
      return {
        available: false,
        reason:
          session.setup.randomMode === "team"
            ? "Minimal 2 tim aktif."
            : "Minimal 4 pemain aktif."
      };
    }

    const slots = courts * perCourt;
    const counts = countAppearances(
      session,
      entities,
      preservedRounds
    );

    const currentMaximum = Math.max(...counts, 0);
    const minimumTarget = Math.max(
      Number(options.minimumGames || session.setup.minimumGames || 4),
      currentMaximum
    );

    const maxRounds = Math.max(
      1,
      Number(options.maxRounds || 80)
    );

    let compact = null;

    for (let rounds = 1; rounds <= maxRounds; rounds++) {
      const candidate = targetFeasible(
        counts,
        rounds,
        slots,
        false
      );

      if (
        candidate &&
        candidate.low >= minimumTarget &&
        !compact
      ) {
        compact = { rounds, ...candidate };
      }

      const exact = targetFeasible(
        counts,
        rounds,
        slots,
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
          slotsPerRound: slots,
          currentCounts: counts
        };
      }
    }

    if (compact) {
      return {
        available: true,
        rounds: compact.rounds,
        exact: false,
        minGames: compact.low,
        maxGames: compact.high,
        entityCount: entities.length,
        courts,
        slotsPerRound: slots,
        currentCounts: counts
      };
    }

    return {
      available: false,
      reason:
        "Pemerataan belum ditemukan. Kurangi minimum game atau periksa roster."
    };
  }

  function fairness(session) {
    const entities = getEntities(session);
    const counts = countAppearances(
      session,
      entities,
      session.rounds
    );

    if (!counts.length) {
      return {
        score: 0,
        min: 0,
        max: 0,
        difference: 0
      };
    }

    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const difference = max - min;

    return {
      min,
      max,
      difference,
      score: Math.max(0, 100 - difference * 25)
    };
  }

  window.PFScheduler = {
    getEntities,
    entitiesPerCourt,
    usableCourts,
    matchEntityIds,
    buildRounds,
    recommend,
    fairness
  };
})();
