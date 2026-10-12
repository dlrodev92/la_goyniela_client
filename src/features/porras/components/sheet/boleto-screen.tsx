import { loadGroup } from "@/features/groups/server/queries";
import { hasFullBoleto } from "@/features/matchdays/domain/matchdays";
import type { Fixture } from "@/features/matchdays/domain/matchdays";
import { loadMatchday } from "@/features/matchdays/server/queries";
import { loadLosillaJornada } from "@/features/results/server/queries";
import { columnsDraftFromSheet, voteRulesOf } from "../../domain/columns";
import { buildMatchInfo, votingGate } from "../../domain/porra-view";
import { loadMyPorraPicks, loadPorra } from "../../server/queries";
import type { BoletoFixture } from "../boleto";
import { BoletoFlow } from "./boleto-flow";

/**
 * Fixtures for the boleto. The pleno match (position 15) shows the Spanish quiniela names ("España"), not the
 * English canonical ones; the other rows keep the club's short name over its full name.
 */
export function toBoletoFixtures(fixtures: readonly Fixture[]): BoletoFixture[] {
  return fixtures.map(fixture => {
    const pleno = fixture.position === 15;
    return {
      position: fixture.position,
      homeName: pleno ? fixture.home : fixture.homeFullName ?? fixture.home,
      awayName: pleno ? fixture.away : fixture.awayFullName ?? fixture.away,
      homeShort: pleno ? null : fixture.homeShortName ?? null,
      awayShort: pleno ? null : fixture.awayShortName ?? null,
      homeLogoUrl: fixture.homeLogoUrl,
      awayLogoUrl: fixture.awayLogoUrl,
    };
  });
}

/** Loads everything the member's boleto needs and renders it as a modal sheet or a full page. */
export async function BoletoScreen({ groupId, porraId, variant }: { groupId: string; porraId: string; variant: "modal" | "page" }) {
  const group = await loadGroup(groupId);
  const porra = await loadPorra(groupId, porraId);
  const [matchday, mine] = await Promise.all([loadMatchday(porra.jornadaId), loadMyPorraPicks(groupId, porraId)]);
  const losilla = await loadLosillaJornada(matchday);
  const gate = votingGate(porra, matchday, hasFullBoleto(matchday));
  const rules = voteRulesOf(porra);
  return (
    <BoletoFlow
      variant={variant}
      groupId={groupId}
      porraId={porraId}
      groupName={group.name}
      jornada={matchday.number}
      temporada={matchday.seasonLabel}
      fixtures={toBoletoFixtures(matchday.fixtures)}
      matchInfo={buildMatchInfo(matchday.fixtures, losilla.status === "ready" ? losilla.data : null, matchday.estimates)}
      rules={rules}
      initialDraft={columnsDraftFromSheet(mine, rules)}
      hasVoted={mine !== null}
      canVote={gate.open}
      closedReason={gate.reason}
    />
  );
}
