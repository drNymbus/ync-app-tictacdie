import { assertEquals } from "jsr:@std/assert";
import * as ttd from "../shared/tictacdie.ts";

// turn=1 → player_index 0 (X) acts first in all tests
function makeGame(): ttd.Game {
	const g = new ttd.Game(0, "p1", "p2");
	g.turn = 1;
	return g;
}

// ─── action - general validation ─────────────────────────────────────────────

Deno.test("action - wrong turn: returns false, no board change", () => {
	const g = makeGame();
	// turn=1 → player_index must be 0; player_index=1 is wrong
	const [ok] = g.action(1, "symbol", 0, 0, 0, 0, "O");
	assertEquals(ok, false);
	assertEquals(g.board[0][0], "");
});

Deno.test("action - wrong turn: tick is NOT called (early return)", () => {
	const g = makeGame();
	const turnBefore = g.turn;
	g.action(1, "symbol", 0, 0, 0, 0, "O"); // wrong turn → early return
	assertEquals(g.turn, turnBefore); // turn unchanged
});

Deno.test("action - player_index -1 is invalid", () => {
	const g = makeGame();
	assertEquals(g.action(-1, "symbol", 0, 0, 0, 0, "X")[0], false);
});

Deno.test("action - player_index 2 is invalid", () => {
	const g = makeGame();
	assertEquals(g.action(2, "symbol", 0, 0, 0, 0, "X")[0], false);
});

Deno.test("action - unknown card: returns false, tick still runs", () => {
	const g = makeGame();
	const turnBefore = g.turn;
	const [ok] = g.action(0, "unknown_card", 0, 0, 0, 0, "");
	assertEquals(ok, false);
	assertEquals(g.turn, turnBefore + 1); // tick ran
});

// ─── action - turn management ─────────────────────────────────────────────────

Deno.test("action - turn passes to opponent after success", () => {
	const g = makeGame();
	g.action(0, "symbol", 0, 0, 0, 0, "X");
	const [ok] = g.action(1, "symbol", 1, 1, 0, 0, "O");
	assertEquals(ok, true);
	assertEquals(g.board[1][1], "O");
});

Deno.test("action - tick always runs when card is valid even if card fails", () => {
	// placeSymbol fails on occupied cell, but tick() is still called
	const g = makeGame();
	g.board[0][0] = "O";
	const turnBefore = g.turn;
	g.action(0, "symbol", 0, 0, 0, 0, "X"); // occupied → placeSymbol returns false
	assertEquals(g.turn, turnBefore + 1);
	assertEquals(g.board[0][0], "O");
});

Deno.test("action - opponent cannot place on an occupied cell", () => {
	const g = makeGame();
	g.action(0, "symbol", 0, 0, 0, 0, "X");
	const [ok] = g.action(1, "symbol", 0, 0, 0, 0, "O");
	assertEquals(ok, false);
});

// ─── action symbol ───────────────────────────────────────────────────────────

Deno.test("action symbol - player 0 places X", () => {
	const g = makeGame();
	const [ok] = g.action(0, "symbol", 1, 1, 0, 0, "X");
	assertEquals(ok, true);
	assertEquals(g.board[1][1], "X");
});

Deno.test("action symbol - player 1 places O after player 0", () => {
	const g = makeGame();
	g.action(0, "symbol", 0, 0, 0, 0, "X");
	const [ok] = g.action(1, "symbol", 1, 1, 0, 0, "O");
	assertEquals(ok, true);
	assertEquals(g.board[1][1], "O");
});

Deno.test("action symbol - occupied cell returns false", () => {
	const g = makeGame();
	g.board[1][1] = "O";
	const [ok] = g.action(0, "symbol", 1, 1, 0, 0, "X");
	assertEquals(ok, false);
});

Deno.test("action symbol - out of bounds returns false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "symbol", 99, 0,  0, 0, "X")[0], false);
	assertEquals(g.action(0, "symbol", 0,  99, 0, 0, "X")[0], false);
});

// ─── action invert ───────────────────────────────────────────────────────────

Deno.test("action invert - inverts a row", () => {
	const g = makeGame();
	g.board[0] = ["X", "O", "X"];
	const [ok] = g.action(0, "invert", 1, 0, 0, 0, "");
	assertEquals(ok, true);
	assertEquals(g.board[0], ["O", "X", "O"]);
});

Deno.test("action invert - inverts a column", () => {
	const g = makeGame();
	g.board[0][0] = "X"; g.board[1][0] = "O"; g.board[2][0] = "X";
	// x=0 → row param=0 (column mode), y=0 → index=0 (column 0)
	const [ok] = g.action(0, "invert", 0, 0, 1, 0, "");
	assertEquals(ok, true);
	assertEquals(g.board[0][0], "O");
	assertEquals(g.board[1][0], "X");
	assertEquals(g.board[2][0], "O");
});

Deno.test("action invert - out of bounds index returns false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "invert", 99, 0, 0, 0, "")[0], false);
	assertEquals(g.action(0, "invert", 99, 0, 1, 0, "")[0], false);
});

// ─── action bomb ─────────────────────────────────────────────────────────────

Deno.test("action bomb - clears cross around (x, y)", () => {
	const g = makeGame();
	g.board = [["X", "O", "X"], ["O", "X", "O"], ["X", "O", "X"]];
	const [ok] = g.action(0, "bomb", 1, 1, 0, 0, "");
	assertEquals(ok, true);
	assertEquals(g.board[1][1], "");
	assertEquals(g.board[0][1], "");
	assertEquals(g.board[2][1], "");
	assertEquals(g.board[1][0], "");
	assertEquals(g.board[1][2], "");
	assertEquals(g.board[0][0], "X"); // corners untouched
});

Deno.test("action bomb - out of bounds center returns false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "bomb", 99, 0,  0, 0, "")[0], false);
	assertEquals(g.action(0, "bomb", 0,  99, 0, 0, "")[0], false);
});

// ─── action resize ───────────────────────────────────────────────────────────

Deno.test("action resize - top-left corner: board becomes 4x4", () => {
	const g = makeGame();
	const [ok] = g.action(0, "resize", 1, 0, 1, 0, "");
	assertEquals(ok, true);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
});

Deno.test("action resize - bottom-right corner: board becomes 4x4", () => {
	const g = makeGame();
	const [ok] = g.action(0, "resize", 0, 1, 0, 1, "");
	assertEquals(ok, true);
	assertEquals(g.board.length, 4);
});

Deno.test("action resize - no corner selected: returns false, board unchanged", () => {
	const g = makeGame();
	const [ok] = g.action(0, "resize", 0, 0, 0, 0, "");
	assertEquals(ok, false);
	assertEquals(g.board.length, 3);
});

// ─── action trap ─────────────────────────────────────────────────────────────

Deno.test("action trap - places trap at (x,y) with redirect (opt1, opt2)", () => {
	const g = makeGame();
	const [ok] = g.action(0, "trap", 0, 0, 2, 2, "");
	assertEquals(ok, true);
	assertEquals(g.board[0][0], {kind: "trap", newx: 2, newy: 2});
});

Deno.test("action trap - occupied trap cell returns false", () => {
	const g = makeGame();
	g.board[0][0] = "X";
	assertEquals(g.action(0, "trap", 0, 0, 2, 2, "")[0], false);
});

Deno.test("action trap - redirect out of bounds returns false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "trap", 0, 0, 99, 0, "")[0], false);
	assertEquals(g.action(0, "trap", 0, 0, 0, 99, "")[0], false);
});

Deno.test("action trap - trap position out of bounds returns false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "trap", 99, 0, 1, 1, "")[0], false);
});

// ─── action nomad ────────────────────────────────────────────────────────────

Deno.test("action nomad - places nomad on border (tick runs, cooldown 1→0)", () => {
	const g = makeGame();
	const [ok] = g.action(0, "nomad", 0, 0, 1, 0, "X");
	assertEquals(ok, true);
	assertEquals((g.board[0][0] as unknown as ttd.Nomad).kind, "nomad");
	assertEquals((g.board[0][0] as unknown as ttd.Nomad).content, "X");
	assertEquals((g.board[0][0] as unknown as ttd.Nomad).cooldown, 0);
});

Deno.test("action nomad - interior position returns false", () => {
	const g = makeGame();
	const [ok] = g.action(0, "nomad", 1, 1, 1, 0, "X");
	assertEquals(ok, false);
});

Deno.test("action nomad - diagonal direction returns false", () => {
	const g = makeGame();
	const [ok] = g.action(0, "nomad", 0, 0, 1, 1, "X");
	assertEquals(ok, false);
});

// ─── action immunity ─────────────────────────────────────────────────────────

Deno.test("action immunity - places immunity on cell (tick runs, cooldown 2→1)", () => {
	const g = makeGame();
	const [ok] = g.action(0, "immunity", 0, 0, 0, 0, "");
	assertEquals(ok, true);
	assertEquals((g.board[0][0] as unknown as ttd.Immunity).kind, "immunity");
	assertEquals((g.board[0][0] as unknown as ttd.Immunity).cooldown, 1);
});

Deno.test("action immunity - out of bounds returns false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "immunity", 99, 0, 0, 0, "")[0], false);
	assertEquals(g.action(0, "immunity", 0, 99, 0, 0, "")[0], false);
});

// ─── action virus ────────────────────────────────────────────────────────────

Deno.test("action virus - places virus on cell", () => {
	const g = makeGame();
	const [ok] = g.action(0, "virus", 1, 1, 0, 0, "");
	assertEquals(ok, true);
	assertEquals((g.board[1][1] as unknown as ttd.Virus).kind, "virus");
});

Deno.test("action virus - out of bounds returns false", () => {
	const g = makeGame();
	assertEquals(g.action(0, "virus", 99, 0, 0, 0, "")[0], false);
	assertEquals(g.action(0, "virus", 0, 99, 0, 0, "")[0], false);
});

// ─── action - multi-step sequences ───────────────────────────────────────────

Deno.test("action sequence - alternating players each place their symbol", () => {
	const g = makeGame();
	g.action(0, "symbol", 0, 0, 0, 0, "X");
	g.action(1, "symbol", 1, 1, 0, 0, "O");
	g.action(0, "symbol", 2, 0, 0, 0, "X");
	assertEquals(g.board[0][0], "X");
	assertEquals(g.board[1][1], "O");
	assertEquals(g.board[0][2], "X");
});

Deno.test("action sequence - player 0 wins via column", () => {
	const g = makeGame();
	// p0 builds col 0 (X), p1 occupies col 1 (O)
	g.action(0, "symbol", 0, 0, 0, 0, "X"); // board[0][0]=X
	g.action(1, "symbol", 1, 0, 0, 0, "O"); // board[0][1]=O
	g.action(0, "symbol", 0, 1, 0, 0, "X"); // board[1][0]=X
	g.action(1, "symbol", 1, 1, 0, 0, "O"); // board[1][1]=O
	g.action(0, "symbol", 0, 2, 0, 0, "X"); // board[2][0]=X → col 0 = X,X,X
	assertEquals(g.isGameOver(), 1);
});

Deno.test("action sequence - resize expands board, win requires full new row", () => {
	// p0 resizes top-left → 4x4; p1 then fills all 4 cells of row 0 with O
	const g = makeGame();
	g.action(0, "resize", 1, 0, 1, 0, ""); // turn 1→2; p1 next
	g.action(1, "symbol", 0, 0, 0, 0, "O"); // board[0][0]=O; turn 2→3
	g.action(0, "symbol", 0, 1, 0, 0, "X"); // board[1][0]=X; turn 3→4
	g.action(1, "symbol", 1, 0, 0, 0, "O"); // board[0][1]=O; turn 4→5
	g.action(0, "symbol", 1, 1, 0, 0, "X"); // board[1][1]=X; turn 5→6
	g.action(1, "symbol", 2, 0, 0, 0, "O"); // board[0][2]=O; turn 6→7
	g.action(0, "symbol", 2, 1, 0, 0, "X"); // board[1][2]=X; turn 7→8
	g.action(1, "symbol", 3, 0, 0, 0, "O"); // board[0][3]=O → row 0 = O,O,O,O
	assertEquals(g.isGameOver(), 2);
});

// ─── interactions ─────────────────────────────────────────────────────────────

Deno.test("interaction - bomb destroys a trap (trap has no cooldown)", () => {
	const g = makeGame();
	g.placeTrap(1, 0, 2, 2);
	g.applyBomb(1, 1);
	assertEquals(g.board[0][1], "");
});

Deno.test("interaction - immunity shields a cell from bomb", () => {
	const g = makeGame();
	g.board[0][1] = {kind: "immunity", cooldown: 1, content: "X"};
	g.applyBomb(1, 1);
	assertEquals((g.board[0][1] as unknown as ttd.Immunity).kind, "immunity");
});

Deno.test("interaction - resize after bomb: new board has correct dimensions", () => {
	const g = makeGame();
	g.board = [["X", "O", "X"], ["O", "X", "O"], ["X", "O", "X"]];
	g.applyBomb(1, 1);
	g.applyResize(true, false, true, false);
	assertEquals(g.board.length, 4);
	assertEquals(g.board[0].length, 4);
	assertEquals(g.board[0][0], "");
});

Deno.test("interaction - invert after virus placement: virus unaffected", () => {
	const g = makeGame();
	g.placeSymbol(0, 0, "X");
	g.placeVirus(2, 0);
	g.applyInvert(1, 0); // invert row 0
	assertEquals(g.board[0][0], "O"); // X → O
	assertEquals(g.board[0][2], {kind: "virus", content: ""}); // virus untouched
});

Deno.test("interaction - immunity expires mid-game and exposes wrapped symbol to win", () => {
	const g = makeGame();
	// Wrap the winning X in immunity; win only detectable after immunity resolves
	g.board[0][0] = {kind: "immunity", cooldown: 2, content: "X"};
	g.board[0][1] = "X";
	g.board[0][2] = "X";
	// isGameOver still sees X through getCellSymbol
	assertEquals(g.isGameOver(), 1);
	// After expiry, plain X remains, win is still detected
	g.tick(); g.tick(); g.tick();
	assertEquals(g.board[0][0] as unknown, "X");
	assertEquals(g.isGameOver(), 1);
});
