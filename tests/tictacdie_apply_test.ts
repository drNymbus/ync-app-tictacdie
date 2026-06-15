import { assertEquals } from "jsr:@std/assert";
import * as ttd from "../shared/tictacdie.ts";

function makeGame(): ttd.Game {
	const g = new ttd.Game(0, "p1", "p2");
	g.turn = 1;
	return g;
}

// ─── applyInvert ─────────────────────────────────────────────────────────────

Deno.test("applyInvert - inverts a row (row=1)", () => {
	const g = makeGame();
	g.board[0] = ["X", "", "O"];
	g.applyInvert(1, 0);
	assertEquals(g.board[0], ["O", "", "X"]);
});

Deno.test("applyInvert - inverts a column (row=0)", () => {
	const g = makeGame();
	g.board[0][0] = "X"; g.board[1][0] = ""; g.board[2][0] = "O";
	g.applyInvert(0, 0);
	assertEquals(g.board[0][0], "O");
	assertEquals(g.board[1][0], "");
	assertEquals(g.board[2][0], "X");
});

Deno.test("applyInvert - flips content and old_content of a nomad cell", () => {
	const g = makeGame();
	g.placeSymbol(1, 0, "X");
	g.placeSymbol(0, 0, "O");
	g.placeNomad(0, 0, 1, 0, "X");
	g.placeImmunity(1, 0);
	g.applyInvert(0, 0); // invert column 0
	assertEquals(g.board[0], [
		{kind: "nomad", cooldown: 1, dirx: 1, diry: 0, content: "O", old_content: "X"},
		{kind: "immunity", cooldown: 2, content: "X"},
		""
	]);
});

Deno.test("applyInvert - trap and virus cells are unaffected by row inversion", () => {
	const g = makeGame();
	g.placeTrap(0, 0, 2, 2);
	g.placeVirus(2, 0);
	g.applyInvert(1, 0); // invert row 0
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
	assertEquals(g.board[0][2], {kind: "virus", content: ""});
});

Deno.test("applyInvert - row=2 is invalid (only 0 or 1 allowed)", () => {
	const g = makeGame();
	assertEquals(g.applyInvert(2, 0)[0], false);
});

Deno.test("applyInvert - row=-1 is invalid", () => {
	const g = makeGame();
	assertEquals(g.applyInvert(-1, 0)[0], false);
});

Deno.test("applyInvert - inverting row 0 leaves other rows unchanged", () => {
	const g = makeGame();
	g.board[0] = ["X", "O", "X"];
	g.board[1] = ["O", "X", "O"];
	g.applyInvert(1, 0);
	assertEquals(g.board[0], ["O", "X", "O"]);
	assertEquals(g.board[1], ["O", "X", "O"]); // untouched
});

Deno.test("applyInvert - inverting column 1 leaves other columns unchanged", () => {
	const g = makeGame();
	g.board[0][1] = "X"; g.board[1][1] = "O"; g.board[2][1] = "X";
	g.board[0][0] = "X"; g.board[0][2] = "O";
	g.applyInvert(0, 1);
	assertEquals(g.board[0][1], "O");
	assertEquals(g.board[1][1], "X");
	assertEquals(g.board[2][1], "O");
	assertEquals(g.board[0][0], "X"); // untouched
	assertEquals(g.board[0][2], "O"); // untouched
});

// ─── applyResize ─────────────────────────────────────────────────────────────

Deno.test("applyResize - top-left: board becomes 4x4, content shifts to bottom-right", () => {
	const g = makeGame();
	g.board[0][0] = "X";
	g.applyResize(true, false, true, false);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
	assertEquals(g.board[1][1], "X");
	assertEquals(g.board[0][0], "");
});

Deno.test("applyResize - top-right: board becomes 4x4, content shifts downward", () => {
	const g = makeGame();
	g.board[0][2] = "X";
	g.applyResize(true, false, false, true);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
	assertEquals(g.board[1][2], "X");
	assertEquals(g.board[0][3], "");
});

Deno.test("applyResize - bottom-left: board becomes 4x4, content shifts rightward", () => {
	const g = makeGame();
	g.board[2][0] = "X";
	g.applyResize(false, true, true, false);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
	assertEquals(g.board[2][1], "X");
	assertEquals(g.board[3][0], "");
});

Deno.test("applyResize - bottom-right: board becomes 4x4, content position unchanged", () => {
	const g = makeGame();
	g.board[2][2] = "X";
	g.applyResize(false, true, false, true);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
	assertEquals(g.board[2][2], "X");
	assertEquals(g.board[3][3], "");
});

Deno.test("applyResize - no corner selected: board unchanged (both row and col axis must have a side)", () => {
	const g = makeGame();
	g.applyResize(false, false, false, false);
	assertEquals(g.board.length, 3);
	assertEquals(g.board[0].length, 3);
});

Deno.test("applyResize - complex cells are preserved and shifted correctly", () => {
	const g = makeGame();
	g.board[1][1] = {kind: "immunity", cooldown: 2, content: "X"};
	g.applyResize(true, false, true, false);
	assertEquals(g.board[2][2], {kind: "immunity", cooldown: 2, content: "X"});
});

// ─── applyBomb ───────────────────────────────────────────────────────────────

Deno.test("applyBomb - center (1,1): clears center and cross, leaves corners", () => {
	const g = makeGame();
	g.board = [["X", "O", "X"], ["O", "X", "O"], ["X", "O", "X"]];
	g.applyBomb(1, 1);
	assertEquals(g.board[1][1], "");
	assertEquals(g.board[0][1], "");
	assertEquals(g.board[2][1], "");
	assertEquals(g.board[1][0], "");
	assertEquals(g.board[1][2], "");
	assertEquals(g.board[0][0], "X"); // corners unaffected
	assertEquals(g.board[2][2], "X");
});

Deno.test("applyBomb - corner (0,0): only in-bounds neighbours cleared", () => {
	const g = makeGame();
	g.board = [["X", "O", "X"], ["O", "X", "O"], ["X", "O", "X"]];
	g.applyBomb(0, 0);
	assertEquals(g.board[0][0], "");
	assertEquals(g.board[0][1], "");
	assertEquals(g.board[1][0], "");
	assertEquals(g.board[1][1], "X"); // not in cross
});

Deno.test("applyBomb - top edge (1,0): no crash on out-of-bounds", () => {
	const g = makeGame();
	g.board = [["X", "O", "X"], ["O", "X", "O"], ["X", "O", "X"]];
	g.applyBomb(1, 0);
	assertEquals(g.board[0][1], "");
	assertEquals(g.board[0][0], "");
	assertEquals(g.board[0][2], "");
	assertEquals(g.board[1][1], "");
});

Deno.test("applyBomb - immune cell in cross is not destroyed", () => {
	const g = makeGame();
	g.board[0][1] = {kind: "immunity", cooldown: 2, content: "X"};
	g.applyBomb(1, 1);
	assertEquals(g.board[0][1], {kind: "immunity", cooldown: 2, content: "X"});
	assertEquals(g.board[1][1], "");
});

Deno.test("applyBomb - immune center: bomb fires, only cross neighbours cleared", () => {
	const g = makeGame();
	g.board = [
		["X", "O", "X"],
		["O", {kind: "immunity", cooldown: 3, content: "X"}, "O"],
		["X", "O", "X"],
	];
	g.applyBomb(1, 1);
	assertEquals(g.board[1][1], {kind: "immunity", cooldown: 3, content: "X"});
	assertEquals(g.board[0][1], "");
	assertEquals(g.board[2][1], "");
	assertEquals(g.board[1][0], "");
	assertEquals(g.board[1][2], "");
	assertEquals(g.board[0][0], "X"); // corners untouched
});

Deno.test("applyBomb - trap in cross is destroyed (trap has no cooldown property)", () => {
	// `"cooldown" in cell` is false for traps, so they are cleared by the blast
	const g = makeGame();
	g.placeTrap(1, 0, 2, 2); // trap at board[0][1]
	g.applyBomb(1, 1);
	assertEquals(g.board[0][1], "");
});

Deno.test("applyBomb - x out of bounds returns false", () => {
	const g = makeGame();
	assertEquals(g.applyBomb(99, 0)[0], false);
	assertEquals(g.applyBomb(-1, 0)[0], false);
});

Deno.test("applyBomb - y out of bounds returns false", () => {
	const g = makeGame();
	assertEquals(g.applyBomb(0, 99)[0], false);
	assertEquals(g.applyBomb(0, -1)[0], false);
});
