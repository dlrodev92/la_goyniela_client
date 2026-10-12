import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { cn } = require("../build/tests/lib/cn.js");
const { initialsOf, teamInitials, matchesConfirmText, progressPercent } = require("../build/tests/lib/ui-text.js");

test("cn joins truthy values and flattens arrays", () => {
  assert.equal(cn("a", false, null, undefined, "", "b", ["c", [false, "d"]], 0), "a b c d 0");
  assert.equal(cn(), "");
});

test("initialsOf takes up to two uppercase initials", () => {
  assert.equal(initialsOf("marta ruiz lópez"), "MR");
  assert.equal(initialsOf("  Peña  "), "P");
  assert.equal(initialsOf(""), "?");
  assert.equal(initialsOf("   "), "?");
});

test("teamInitials handles abbreviations, suffixes, accents and multi-word names", () => {
  assert.equal(teamInitials("R. Oviedo"), "OVI");
  assert.equal(teamInitials("At. Madrid"), "MAD");
  assert.equal(teamInitials("Real Sociedad B"), "RS");
  assert.equal(teamInitials("Barcelona(f)"), "BAR");
  assert.equal(teamInitials("Celta Fortuna"), "CF");
  assert.equal(teamInitials("Málaga"), "MAL");
  assert.equal(teamInitials("Rayo Vallecano de Madrid"), "RVM");
  assert.equal(teamInitials("Girona"), "GIR");
  assert.equal(teamInitials("  "), "?");
  assert.equal(teamInitials("(f)"), "?");
});

test("matchesConfirmText trims, is case-sensitive and rejects an empty expectation", () => {
  assert.equal(matchesConfirmText(" Peña El Rondo ", "Peña El Rondo"), true);
  assert.equal(matchesConfirmText("peña el rondo", "Peña El Rondo"), false);
  assert.equal(matchesConfirmText("", ""), false);
});

test("progressPercent clamps and guards invalid input", () => {
  assert.equal(progressPercent(5, 15), 33);
  assert.equal(progressPercent(20, 15), 100);
  assert.equal(progressPercent(-1, 15), 0);
  assert.equal(progressPercent(3, 0), 0);
  assert.equal(progressPercent(Number.NaN, 15), 0);
});
