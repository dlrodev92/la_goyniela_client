import { type Money, type NewPorra, type PorraChanges, type PorrasGateway, type Vote } from "../domain/porras";
import { moneyUnits, type FieldErrors } from "../domain/logic";
import { SINGLE_COLUMN_RULES, boletoInputFromColumns, validateColumnsVote, voteFromColumns, type ColumnsDraft, type VoteRules } from "../domain/columns";
import { isValidSpec } from "../domain/modes";
import { ServiceError } from "../../../lib/http/errors";
import { isRouteId } from "../../../lib/route-id";

/** Thrown when a draft is incomplete; carries Spanish per-field messages (`pick-N`, `pleno-home`, `pleno-away`, `columnas`). */
export class VoteValidationError extends Error {
  readonly fields: FieldErrors;
  constructor(fields: FieldErrors) {
    super("Invalid vote");
    this.name = "VoteValidationError";
    this.fields = fields;
  }
}

/** Route ids must be positive integers; anything else is a not-found without calling the backend. */
function ids(...values: string[]) {
  if (!values.every(isRouteId)) throw new ServiceError("not-found");
}

/** The wire-ready vote for the porra's rules (one free column, or N columns of one sign per row); the Spanish per-field errors otherwise. */
export function voteOrThrow(draft: ColumnsDraft, rules: VoteRules = SINGLE_COLUMN_RULES): Vote {
  const vote = voteFromColumns(draft, rules);
  if (!vote) throw new VoteValidationError(validateColumnsVote(draft, rules));
  return vote;
}

export async function listPorras(gateway: PorrasGateway, groupId: string, jornadaId?: string) {
  ids(groupId, ...(jornadaId ? [jornadaId] : []));
  return gateway.list(groupId, jornadaId);
}
export async function getPorra(gateway: PorrasGateway, groupId: string, porraId: string) {
  ids(groupId, porraId);
  return gateway.get(groupId, porraId);
}
export async function submitVote(gateway: PorrasGateway, groupId: string, porraId: string, draft: ColumnsDraft, rules: VoteRules = SINGLE_COLUMN_RULES) {
  ids(groupId, porraId);
  return gateway.submitPicks(groupId, porraId, voteOrThrow(draft, rules));
}
export async function loadMyPicks(gateway: PorrasGateway, groupId: string, porraId: string) {
  ids(groupId, porraId);
  return gateway.myPicks(groupId, porraId);
}
export async function loadBoleto(gateway: PorrasGateway, groupId: string, porraId: string) {
  ids(groupId, porraId);
  return gateway.getBoleto(groupId, porraId);
}

const isMoney = (value: Money) => {
  const units = moneyUnits(value);
  return units !== null && units > BigInt(0);
};
/** Admin: the (dobles, triples) pairs the backend lists for a budget. Invalid input never reaches the backend. */
export async function listFormats(gateway: PorrasGateway, groupId: string, jornadaId: string, budgetEur: Money) {
  ids(groupId, jornadaId);
  if (!isMoney(budgetEur)) throw new ServiceError("invalid-porra");
  return gateway.formats(groupId, jornadaId, budgetEur);
}

/** Any member: the Intuición options that fit a budget. */
export async function listIntuicionOptions(gateway: PorrasGateway, groupId: string, budgetEur: Money) {
  ids(groupId);
  if (!isMoney(budgetEur)) throw new ServiceError("invalid-porra");
  return gateway.intuicionOptions(groupId, budgetEur);
}

/** Admin: creates the porra in one of the four modes. The price is not sent: the backend resolves it from the jornada. */
export async function createPorra(gateway: PorrasGateway, groupId: string, input: NewPorra) {
  ids(groupId, input.jornadaId);
  if (!isMoney(input.budgetEur) || !isValidSpec(input.spec)) throw new ServiceError("invalid-porra");
  return gateway.create(groupId, input);
}

/** Admin: changes the budget and/or the mode and its parameters of an open porra. */
export async function patchPorra(gateway: PorrasGateway, groupId: string, porraId: string, changes: PorraChanges) {
  ids(groupId, porraId);
  const valid = (changes.budgetEur === undefined || isMoney(changes.budgetEur))
    && (changes.spec === undefined || isValidSpec(changes.spec))
    && (changes.budgetEur !== undefined || changes.spec !== undefined);
  if (!valid) throw new ServiceError("invalid-porra");
  return gateway.patch(groupId, porraId, changes);
}

/** Admin: removes the final boleto so the format can change. */
export async function removeBoleto(gateway: PorrasGateway, groupId: string, porraId: string) {
  ids(groupId, porraId);
  return gateway.deleteBoleto(groupId, porraId);
}

/** The PDF of the final boleto, for any member. */
export async function loadBoletoPdf(gateway: PorrasGateway, groupId: string, porraId: string) {
  ids(groupId, porraId);
  return gateway.boletoPdf(groupId, porraId);
}

/** Admin: the computed proposal (never saved). */
export async function getPropuesta(gateway: PorrasGateway, groupId: string, porraId: string) {
  ids(groupId, porraId);
  return gateway.propuesta(groupId, porraId);
}

/** Admin: saves the final boleto of the peña from a complete draft (one column or several). */
export async function saveFinalBoleto(gateway: PorrasGateway, groupId: string, porraId: string, draft: ColumnsDraft) {
  ids(groupId, porraId);
  const input = boletoInputFromColumns(draft);
  if (!input) throw new VoteValidationError(columnsErrors(draft));
  return gateway.putBoleto(groupId, porraId, input);
}

/** Which rows of which column are still empty, as `pick-N` fields of the first incomplete column (plus the pleno). */
function columnsErrors(draft: ColumnsDraft): FieldErrors {
  const errors: FieldErrors = {};
  const at = draft.columns.findIndex(rows => rows.some(signs => signs.length === 0));
  const rows = at < 0 ? [] : draft.columns[at];
  rows.forEach((signs, row) => { if (signs.length === 0) errors[`pick-${row + 1}`] = `Partido ${row + 1}: marca un signo en la columna ${at + 1}.`; });
  if (!draft.pleno.home) errors["pleno-home"] = "Pleno al 15: elige los goles del equipo local.";
  if (!draft.pleno.away) errors["pleno-away"] = "Pleno al 15: elige los goles del equipo visitante.";
  return errors;
}
