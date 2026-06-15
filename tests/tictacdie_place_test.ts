import { assertEquals } from "jsr:@std/assert";
import * as ttd from "../shared/tictacdie.ts";

function makeGame(): ttd.Game {
	const g = new ttd.Game(0, "p1", "p2");
	g.turn = 1;
	return g;
}

// ─── placeSymbol ─────────────────────────────────────────────────────────────

Deno.test("placeSymbol - places X on empty cell", () => {
	const g = makeGame();
	g.placeSymbol(0, 0, "X");
	assertEquals(g.board[0][0], "X");
});

Deno.test("placeSymbol - places O on another empty cell", () => {
	const g = makeGame();
	g.placeSymbol(2, 1, "O");
	assertEquals(g.board[1][2], "O");
});

Deno.test("placeSymbol - occupied cell returns false, board unchanged", () => {
	const g = makeGame();
	g.board[0][0] = "O";
	const [ok] = g.placeSymbol(0, 0, "X");
	assertEquals(ok, false);
	assertEquals(g.board[0][0], "O");
});

Deno.test("placeSymbol - out of bounds returns false", () => {
	const g = makeGame();
	assertEquals(g.placeSymbol(99, 0, "X")[0], false);
	assertEquals(g.placeSymbol(0, 99, "X")[0], false);
});

// ─── placeSymbol on trap ──────────────────────────────────────────────────────

Deno.test("placeSymbol (trap) - empty redirect: symbol lands at redirect, trap cleared", () => {
	const g = makeGame();
	g.placeTrap(0, 0, 2, 2);
	g.placeSymbol(0, 0, "X");
	assertEquals(g.board[2][2], "X");
	assertEquals(g.board[0][0], "");
});

Deno.test("placeSymbol (trap) - occupied redirect: symbol lands on trap cell itself", () => {
	const g = makeGame();
	g.placeTrap(0, 0, 2, 2);
	g.board[2][2] = "O";
	g.placeSymbol(0, 0, "X");
	assertEquals(g.board[0][0], "X");
	assertEquals(g.board[2][2], "O");
});

Deno.test("placeSymbol (trap) - player can fall into their own trap", () => {
	const g = makeGame();
	g.placeTrap(1, 1, 0, 0);
	g.placeSymbol(1, 1, "X");
	assertEquals(g.board[0][0], "X");
	assertEquals(g.board[1][1], "");
});

Deno.test("placeSymbol (trap) - self-pointing trap places symbol on trap cell", () => {
	// redirect == trap cell → redirect is occupied → symbol placed on trap cell
	const g = makeGame();
	g.placeTrap(0, 0, 0, 0);
	g.placeSymbol(0, 0, "X");
	assertEquals(g.board[0][0], "X");
});

// ─── placeNomad ──────────────────────────────────────────────────────────────

Deno.test("placeNomad - moves right across the board and exits", () => {
	const g = makeGame();
	g.placeNomad(0, 0, 1, 0, "X");
	g.tick();
	assertEquals(g.board[0][0], {kind: "nomad", cooldown: 0, dirx: 1, diry: 0, content: "X", old_content: ""});
	g.tick();
	assertEquals(g.board[0][1], {kind: "nomad", cooldown: 0, dirx: 1, diry: 0, content: "X", old_content: ""});
	g.tick(); g.tick();
	assertEquals(g.board[0][2], ""); // nomad exits the board
});

Deno.test("placeNomad - displaces a symbol on impact", () => {
	const g = makeGame();
	g.placeSymbol(1, 1, "O");
	g.placeNomad(1, 2, 0, -1, "X");
	g.tick();
	assertEquals(g.board[2][1], {kind: "nomad", cooldown: 0, dirx: 0, diry: -1, content: "X", old_content: ""});
	g.tick();
	assertEquals(g.board[1][1], {kind: "nomad", cooldown: -1, dirx: 0, diry: -1, content: "X", old_content: "O"});
	g.tick(); g.tick();
	assertEquals(g.board[0][1], "");
});

Deno.test("placeNomad - interior position rejected", () => {
	const g = makeGame();
	const [ok] = g.placeNomad(1, 1, 1, 0, "X");
	assertEquals(ok, false);
});

Deno.test("placeNomad - diagonal direction rejected", () => {
	const g = makeGame();
	const [ok] = g.placeNomad(0, 0, 1, 1, "X");
	assertEquals(ok, false);
});

Deno.test("placeNomad - direction (0,0) rejected", () => {
	const g = makeGame();
	const [ok] = g.placeNomad(0, 0, 0, 0, "X");
	assertEquals(ok, false);
});

Deno.test("placeNomad - upward from bottom border accepted", () => {
	const g = makeGame();
	const [ok] = g.placeNomad(1, 2, 0, -1, "X");
	assertEquals(ok, true);
	assertEquals((g.board[2][1] as ttd.Nomad).kind, "nomad");
});

Deno.test("placeNomad - leftward from right border accepted", () => {
	const g = makeGame();
	const [ok] = g.placeNomad(2, 1, -1, 0, "O");
	assertEquals(ok, true);
	assertEquals((g.board[1][2] as ttd.Nomad).kind, "nomad");
});

// ─── placeImmunity ───────────────────────────────────────────────────────────

Deno.test("placeImmunity - cooldown decrements each tick and cell disappears", () => {
	const g = makeGame();
	g.placeImmunity(0, 0);
	assertEquals(g.board[0][0], {kind: "immunity", cooldown: 2, content: ""});
	g.tick();
	assertEquals(g.board[0][0], {kind: "immunity", cooldown: 1, content: ""});
	g.tick(); g.tick();
	assertEquals(g.board[0][0], "");
});

Deno.test("placeImmunity - restores wrapped content on expiry", () => {
	const g = makeGame();
	g.board[0][0] = "X";
	g.placeImmunity(0, 0);
	assertEquals((g.board[0][0] as unknown as ttd.Immunity).content, "X");
	g.tick(); g.tick(); g.tick();
	assertEquals(g.board[0][0], "X");
});

Deno.test("placeImmunity - x out of bounds rejected", () => {
	const g = makeGame();
	assertEquals(g.placeImmunity(99, 0)[0], false);
	assertEquals(g.placeImmunity(-1, 0)[0], false);
});

Deno.test("placeImmunity - y out of bounds rejected", () => {
	const g = makeGame();
	assertEquals(g.placeImmunity(0, 99)[0], false);
	assertEquals(g.placeImmunity(0, -1)[0], false);
});

Deno.test("placeImmunity - wraps occupied cell and preserves its symbol", () => {
	const g = makeGame();
	g.board[1][1] = "O";
	const [ok] = g.placeImmunity(1, 1);
	assertEquals(ok, true);
	const cell = g.board[1][1] as unknown as ttd.Immunity;
	assertEquals(cell.kind, "immunity");
	assertEquals(cell.content, "O");
	assertEquals(cell.cooldown, 2);
});

// ─── placeVirus ──────────────────────────────────────────────────────────────

Deno.test("placeVirus - starts with empty content", () => {
	const g = makeGame();
	g.placeVirus(0, 0);
	assertEquals(g.board[0][0], {kind: "virus", content: ""});
});

Deno.test("placeVirus - X majority: content becomes X", () => {
	const g = makeGame();
	g.placeVirus(0, 0);
	g.placeSymbol(1, 0, "X");
	g.tick();
	assertEquals(g.board[0][0], {kind: "virus", content: "X"});
});

Deno.test("placeVirus - equal X/O: content emptied", () => {
	const g = makeGame();
	g.placeVirus(0, 0);
	g.placeSymbol(1, 0, "X");
	g.tick();
	g.placeSymbol(0, 1, "O");
	g.tick();
	assertEquals((g.board[0][0] as unknown as ttd.Virus).content, "");
});

Deno.test("placeVirus - O majority: content becomes O", () => {
	const g = makeGame();
	g.placeVirus(1, 1);
	g.board[0][1] = "O"; g.board[2][1] = "O";
	g.board[1][0] = "X";
	g.tick();
	assertEquals((g.board[1][1] as unknown as ttd.Virus).content, "O");
});

Deno.test("placeVirus - x out of bounds rejected", () => {
	const g = makeGame();
	assertEquals(g.placeVirus(99, 0)[0], false);
	assertEquals(g.placeVirus(-1, 0)[0], false);
});

Deno.test("placeVirus - y out of bounds rejected", () => {
	const g = makeGame();
	assertEquals(g.placeVirus(0, 99)[0], false);
	assertEquals(g.placeVirus(0, -1)[0], false);
});

// ─── placeTrap ───────────────────────────────────────────────────────────────

Deno.test("placeTrap - normal placement on empty cell", () => {
	const g = makeGame();
	const [ok] = g.placeTrap(0, 0, 2, 2);
	assertEquals(ok, true);
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
});

Deno.test("placeTrap - refuses if trap cell is occupied", () => {
	const g = makeGame();
	g.board[0][0] = "X";
	const [ok] = g.placeTrap(0, 0, 2, 2);
	assertEquals(ok, false);
});

Deno.test("placeTrap - refuses if trap (x,y) out of bounds", () => {
	const g = makeGame();
	assertEquals(g.placeTrap(99, 0, 1, 1)[0], false);
	assertEquals(g.placeTrap(0, 99, 1, 1)[0], false);
});

Deno.test("placeTrap - refuses if redirect (ax,ay) out of bounds", () => {
	const g = makeGame();
	assertEquals(g.placeTrap(0, 0, 99, 1)[0], false);
	assertEquals(g.placeTrap(0, 0, 1, 99)[0], false);
});

Deno.test("placeTrap - occupied redirect at placement time is accepted (lazy check)", () => {
	const g = makeGame();
	g.board[2][2] = "X";
	const [ok] = g.placeTrap(0, 0, 2, 2);
	assertEquals(ok, true);
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
});

// ─── tick ────────────────────────────────────────────────────────────────────

Deno.test("tick - trap unchanged when redirect is empty", () => {
	const g = makeGame();
	g.placeTrap(0, 0, 2, 2);
	g.tick();
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
});

Deno.test("tick - trap unchanged when redirect is occupied", () => {
	const g = makeGame();
	g.placeTrap(0, 0, 2, 2);
	g.board[2][2] = "O";
	g.tick();
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
});

Deno.test("tick - increments turn counter by 1", () => {
	const g = makeGame();
	const before = g.turn;
	g.tick();
	assertEquals(g.turn, before + 1);
	g.tick();
	assertEquals(g.turn, before + 2);
});

Deno.test("tick - immunity expires after exactly 3 ticks and restores content", () => {
	// cooldown starts at 2: tick1 2→1, tick2 1→0, tick3 0→-1 (<0) → restore
	const g = makeGame();
	g.board[1][1] = "X";
	g.placeImmunity(1, 1);
	g.tick();
	assertEquals((g.board[1][1] as unknown as ttd.Immunity).cooldown, 1);
	g.tick();
	assertEquals((g.board[1][1] as unknown as ttd.Immunity).cooldown, 0);
	g.tick();
	assertEquals(g.board[1][1], "X");
});

Deno.test("tick - virus persists and updates content based on current neighbours", () => {
	const g = makeGame();
	g.placeVirus(1, 1);
	g.board[0][1] = "O"; g.board[2][1] = "O";
	g.tick();
	assertEquals((g.board[1][1] as ttd.Virus).content, "O");
	// swap neighbours: X majority now
	g.board[0][1] = "X"; g.board[2][1] = "X"; g.board[1][0] = "X";
	g.tick();
	assertEquals((g.board[1][1] as ttd.Virus).content, "X");
});

Deno.test("tick - virus shows empty when X and O neighbour counts are equal", () => {
	const g = makeGame();
	g.placeVirus(1, 1);
	g.board[0][1] = "X";
	g.board[2][1] = "O";
	g.tick();
	assertEquals((g.board[1][1] as ttd.Virus).content, "");
});

Deno.test("tick - nomad at border moving outward disappears, old_content restored", () => {
	// nomad at (0,1) moving left: next step is (-1,1) → out of bounds → cell cleared
	const g = makeGame();
	g.board[1][0] = {kind: "nomad", cooldown: 0, dirx: -1, diry: 0, content: "X", old_content: ""};
	g.tick();
	assertEquals(g.board[1][0] as unknown, "");
});
