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

  function countAppearances(
    session,
    entities,
    rounds,
    fromRound = 1
  ) {
    const counts = new Map(
      entities.map(entity => [entity.id, 0])
    );

    rounds.forEach(round => {
      if (Number(round.number || 0) < Number(fromRound || 1)) {
        return;
      }

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


  function roundEntitySet(
    session,
    round
  ) {
    return new Set(
      round.matches.flatMap(match =>
        matchEntityIds(session, match)
      )
    );
  }

  function getRecentRoundSets(
    session,
    rounds,
    count
  ) {
    if (count <= 0) return [];

    return [...rounds]
      .filter(round => round.matches?.length)
      .sort((a, b) =>
        Number(a.number || 0) - Number(b.number || 0)
      )
      .slice(-count)
      .map(round =>
        roundEntitySet(session, round)
      );
  }

  function overlapCount(
    selectedIds,
    previousSet
  ) {
    if (!previousSet) return 0;

    return selectedIds.reduce(
      (total, id) =>
        total + (previousSet.has(id) ? 1 : 0),
      0
    );
  }

  function candidateRestPenalty(
    selectedIds,
    recentSets,
    requiredRest
  ) {
    if (requiredRest <= 0) return 0;

    return recentSets
      .slice(-requiredRest)
      .reverse()
      .reduce((penalty, previousSet, index) => {
        const weight =
          requiredRest - index;

        return (
          penalty +
          overlapCount(selectedIds, previousSet) *
          weight
        );
      }, 0);
  }

  function optimizePlanRestOrder(
    plan,
    requiredRest,
    initialRecentSets = []
  ) {
    if (
      requiredRest <= 0 ||
      plan.length <= 1
    ) {
      return {
        plan: plan.map(round => [...round]),
        restPenalty: 0
      };
    }

    const remaining = plan.map(
      (selectedIds, index) => ({
        selectedIds: [...selectedIds],
        index
      })
    );

    const ordered = [];
    const recentSets = initialRecentSets.map(
      set => new Set(set)
    );

    let totalPenalty = 0;

    while (remaining.length) {
      remaining.sort((a, b) => {
        const penaltyA = candidateRestPenalty(
          a.selectedIds,
          recentSets,
          requiredRest
        );

        const penaltyB = candidateRestPenalty(
          b.selectedIds,
          recentSets,
          requiredRest
        );

        return (
          penaltyA - penaltyB ||
          a.index - b.index
        );
      });

      const next = remaining.shift();

      totalPenalty += candidateRestPenalty(
        next.selectedIds,
        recentSets,
        requiredRest
      );

      ordered.push(next.selectedIds);
      recentSets.push(new Set(next.selectedIds));

      if (recentSets.length > requiredRest) {
        recentSets.shift();
      }
    }

    return {
      plan: ordered,
      restPenalty: totalPenalty
    };
  }

  function buildSequentialRestPlan(
    participants,
    capacities,
    requiredRest,
    initialRecentSets,
    attempt = 0
  ) {
    const remaining = new Map(
      participants.map(item => [
        item.id,
        item.deficit
      ])
    );

    const selectedCount = new Map(
      participants.map(item => [
        item.id,
        0
      ])
    );

    const recentSets = initialRecentSets.map(
      set => new Set(set)
    );

    const plan = [];

    for (
      let roundIndex = 0;
      roundIndex < capacities.length;
      roundIndex++
    ) {
      const slots = capacities[roundIndex];
      const roundsLeft =
        capacities.length - roundIndex;

      const mustPlay = participants
        .filter(item => {
          const deficit =
            remaining.get(item.id) || 0;

          return (
            deficit > 0 &&
            deficit >= roundsLeft
          );
        });

      if (mustPlay.length > slots) {
        return null;
      }

      const selected = mustPlay.map(
        item => item.id
      );

      const selectedSet = new Set(selected);

      const candidates = participants
        .filter(item =>
          !selectedSet.has(item.id) &&
          (remaining.get(item.id) || 0) > 0
        )
        .map((item, index) => ({
          item,
          deficit:
            remaining.get(item.id) || 0,
          restPenalty:
            candidateRestPenalty(
              [item.id],
              recentSets,
              requiredRest
            ),
          selected:
            selectedCount.get(item.id) || 0,
          tie:
            (
              index * 37 +
              attempt * 53 +
              roundIndex * 17
            ) % 997
        }))
        .sort((a, b) =>
          a.restPenalty - b.restPenalty ||
          b.deficit - a.deficit ||
          a.item.current - b.item.current ||
          a.selected - b.selected ||
          b.item.joinedAtRound - a.item.joinedAtRound ||
          a.tie - b.tie ||
          a.item.name.localeCompare(b.item.name)
        );

      for (const candidate of candidates) {
        if (selected.length >= slots) break;

        selected.push(candidate.item.id);
        selectedSet.add(candidate.item.id);
      }

      if (selected.length !== slots) {
        return null;
      }

      for (const id of selected) {
        const deficit =
          remaining.get(id) || 0;

        if (deficit <= 0) {
          return null;
        }

        remaining.set(id, deficit - 1);
        selectedCount.set(
          id,
          (selectedCount.get(id) || 0) + 1
        );
      }

      plan.push(selected);
      recentSets.push(new Set(selected));

      if (recentSets.length > requiredRest) {
        recentSets.shift();
      }
    }

    if (
      [...remaining.values()]
        .some(value => value !== 0)
    ) {
      return null;
    }

    return plan;
  }

  function simulateAdaptivePlan(
    entities,
    currentCounts,
    finalTargets,
    maxCourts,
    perCourt,
    maxRounds,
    requiredRest = 0,
    initialRecentSets = []
  ) {
    const participants = entities.map((entity, index) => ({
      id: entity.id,
      name: String(entity.name || ""),
      joinedAtRound: entity.joinedAtRound || 1,
      current: currentCounts[index],
      deficit: finalTargets[index] - currentCounts[index]
    }));

    if (participants.some(item => item.deficit < 0)) {
      return null;
    }

    const totalAppearances = participants.reduce(
      (total, item) => total + item.deficit,
      0
    );

    if (totalAppearances === 0) {
      return {
        plan: [],
        restPenalty: 0
      };
    }

    if (totalAppearances % perCourt !== 0) {
      return null;
    }

    const totalMatches =
      totalAppearances / perCourt;

    const maximumDeficit = Math.max(
      ...participants.map(item => item.deficit),
      0
    );

    const minimumRounds = Math.max(
      maximumDeficit,
      Math.ceil(totalMatches / maxCourts)
    );

    const maximumRounds = Math.min(
      totalMatches,
      maxRounds
    );

    let bestPlan = null;

    for (
      let roundCount = minimumRounds;
      roundCount <= maximumRounds;
      roundCount++
    ) {
      if (
        participants.some(
          item => item.deficit > roundCount
        )
      ) {
        continue;
      }

      const baseMatches =
        Math.floor(totalMatches / roundCount);

      const extraRounds =
        totalMatches % roundCount;

      if (
        baseMatches < 1 ||
        baseMatches > maxCourts ||
        (
          extraRounds > 0 &&
          baseMatches + 1 > maxCourts
        )
      ) {
        continue;
      }

      const capacities = Array.from(
        { length: roundCount },
        (_, index) =>
          (
            baseMatches +
            (index < extraRounds ? 1 : 0)
          ) * perCourt
      );

      for (let attempt = 0; attempt < 80; attempt++) {
        const rawPlan = buildSequentialRestPlan(
          participants,
          capacities,
          requiredRest,
          initialRecentSets,
          attempt
        );

        if (!rawPlan) continue;

        const optimized = optimizePlanRestOrder(
          rawPlan,
          requiredRest,
          initialRecentSets
        );

        const candidate = {
          plan: optimized.plan,
          restPenalty: optimized.restPenalty
        };

        if (
          !bestPlan ||
          candidate.restPenalty < bestPlan.restPenalty ||
          (
            candidate.restPenalty === bestPlan.restPenalty &&
            candidate.plan.length < bestPlan.plan.length
          )
        ) {
          bestPlan = candidate;
        }

        if (candidate.restPenalty === 0) {
          return candidate;
        }
      }
    }

    return bestPlan;
  }

  function buildRecommendedRounds(
    session,
    recommendation,
    startNumber,
    preservedRounds
  ) {
    if (
      !recommendation ||
      !recommendation.available ||
      !Array.isArray(recommendation.plan)
    ) {
      return [];
    }

    const entities = getEntities(session);
    const entityMap = new Map(
      entities.map(entity => [entity.id, entity])
    );
    const perCourt = entitiesPerCourt(session);
    const metrics = createMetrics(session, preservedRounds);
    const rounds = [];

    recommendation.plan.forEach((selectedIds, offset) => {
      const number = startNumber + offset;
      const selected = selectedIds
        .map(id => entityMap.get(id))
        .filter(Boolean);
      const courts = Math.floor(selected.length / perCourt);

      if (courts < 1) return;

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
    });

    return rounds;
  }

  function recommend(
    session,
    preservedRounds,
    options = {}
  ) {
    const entities = getEntities(session);
    const maxCourts = usableCourts(session);
    const perCourt = entitiesPerCourt(session);

    if (entities.length < perCourt || maxCourts < 1) {
      return {
        available: false,
        reason:
          session.setup.randomMode === "team"
            ? "Minimal 2 tim aktif."
            : "Minimal 4 pemain aktif."
      };
    }

    const balanceEpochRound = Math.max(
      1,
      Number(session.balanceEpochRound || 1)
    );

    const currentCounts = countAppearances(
      session,
      entities,
      preservedRounds,
      balanceEpochRound
    );

    const currentMaximum = Math.max(...currentCounts, 0);
    const minimumTarget = Math.max(
      Number(options.minimumGames || session.setup.minimumGames || 4),
      currentMaximum
    );

    const maxRounds = Math.max(
      1,
      Number(options.maxRounds || 80)
    );

    const maxSlots = maxCourts * perCourt;
    const requiredRest = Math.max(
      0,
      Number(session.setup.minRestRounds ?? 1)
    );

    const recentRoundSets = getRecentRoundSets(
      session,
      preservedRounds,
      requiredRest
    );

    let best = null;

    for (
      let baseTarget = minimumTarget;
      baseTarget <= minimumTarget + maxRounds;
      baseTarget++
    ) {
      const targetPriority = entities
        .map((entity, index) => ({
          index,
          current: currentCounts[index],
          joinedAtRound: entity.joinedAtRound || 1,
          name: String(entity.name || "")
        }))
        .sort((a, b) =>
          a.current - b.current ||
          b.joinedAtRound - a.joinedAtRound ||
          a.name.localeCompare(b.name)
        );

      for (let highCount = 0; highCount < entities.length; highCount++) {
        const finalTargets = entities.map(() => baseTarget);

        for (let index = 0; index < highCount; index++) {
          finalTargets[targetPriority[index].index] = baseTarget + 1;
        }

        const totalDeficit = finalTargets.reduce(
          (total, target, index) =>
            total + target - currentCounts[index],
          0
        );

        if (totalDeficit < 0 || totalDeficit % perCourt !== 0) {
          continue;
        }

        const simulation = simulateAdaptivePlan(
          entities,
          currentCounts,
          finalTargets,
          maxCourts,
          perCourt,
          maxRounds,
          requiredRest,
          recentRoundSets
        );

        if (!simulation) continue;

        const plan = simulation.plan;

        const courtPattern = plan.map(
          selectedIds => selectedIds.length / perCourt
        );

        const candidate = {
          available: true,
          rounds: plan.length,
          exact: highCount === 0,
          minGames: baseTarget,
          maxGames: highCount === 0
            ? baseTarget
            : baseTarget + 1,
          entityCount: entities.length,
          courts: maxCourts,
          minCourts: courtPattern.length
            ? Math.min(...courtPattern)
            : 0,
          maxCourtsUsed: courtPattern.length
            ? Math.max(...courtPattern)
            : 0,
          variableCourts:
            new Set(courtPattern).size > 1 ||
            courtPattern.some(value => value !== maxCourts),
          courtPattern,
          slotsPerRound: maxSlots,
          currentCounts,
          finalTargets,
          plan,
          requiredRest,
          restPenalty: simulation.restPenalty,
          balanceEpochRound
        };

        if (
          !best ||
          candidate.maxGames < best.maxGames ||
          (
            candidate.maxGames === best.maxGames &&
            candidate.exact &&
            !best.exact
          ) ||
          (
            candidate.maxGames === best.maxGames &&
            candidate.exact === best.exact &&
            candidate.restPenalty < best.restPenalty
          ) ||
          (
            candidate.maxGames === best.maxGames &&
            candidate.exact === best.exact &&
            candidate.restPenalty === best.restPenalty &&
            candidate.rounds < best.rounds
          )
        ) {
          best = candidate;
        }
      }

      if (best) {
        break;
      }
    }

    if (best) return best;

    return {
      available: false,
      reason:
        "Pemerataan belum ditemukan. Kurangi minimum game atau periksa roster."
    };
  }

  function fairness(session) {
    const entities = getEntities(session);
    const balanceEpochRound = Math.max(
      1,
      Number(session.balanceEpochRound || 1)
    );

    const counts = countAppearances(
      session,
      entities,
      session.rounds,
      balanceEpochRound
    );

    if (!counts.length) {
      return {
        score: 0,
        min: 0,
        max: 0,
        difference: 0,
        balanceEpochRound
      };
    }

    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const difference = max - min;

    return {
      min,
      max,
      difference,
      score: Math.max(0, 100 - difference * 25),
      balanceEpochRound
    };
  }

  window.PFScheduler = {
    getEntities,
    matchEntityIds,
    buildRecommendedRounds,
    recommend,
    fairness
  };
})();
