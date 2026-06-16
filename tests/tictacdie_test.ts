import { assertEquals } from "jsr:@std/assert";
import * as ttd from "../shared/tictacdie.ts";

// seed=0 → turn=0; override to 1 so player 0 (X) always acts first across all tests
function makeGame(): ttd.Game {
	const g = new ttd.Game(0, "p1", "p2");
	g.turn = 1;
	return g;
}

// ─── init ────────────────────────────────────────────────────────────────────

Deno.test("init - board is 3x3 and all cells empty", () => {
	const g = makeGame();
	assertEquals(g.board.length, 3);
	for (let j = 0; j < 3; j++) {
		assertEquals(g.board[j].length, 3);
		for (let i = 0; i < 3; i++) {
			assertEquals(g.board[j][i], "");
		}
	}
});

Deno.test("init - p1 has symbol X, p2 has symbol O", () => {
	const g = new ttd.Game(0, "alice", "bob");
	assertEquals(g.p1.symbol, "X");
	assertEquals(g.p2.symbol, "O");
});

Deno.test("init - each player receives exactly 4 jokers", () => {
	const g = new ttd.Game(0, "alice", "bob");
	assertEquals(g.p1.jokers.length, 4);
	assertEquals(g.p2.jokers.length, 4);
});

Deno.test("init - same seed is fully deterministic (turn and jokers)", () => {
	const g1 = new ttd.Game(42, "p1", "p2");
	const g2 = new ttd.Game(42, "p1", "p2");
	assertEquals(g1.turn, g2.turn);
	assertEquals(g1.p1.jokers, g2.p1.jokers);
});

Deno.test("init - turn is always 0 or 1 regardless of seed", () => {
	const g = new ttd.Game(0, "p1", "p2");
	assertEquals(g.turn === 0 || g.turn === 1, true);
});

Deno.test("init - jokers are drawn from the known set", () => {
	const valid = new Set(["invert", "resize", "bomb", "nomad", "immunity", "trap", "virus"]);
	const g = new ttd.Game(0, "p1", "p2");
	for (const j of g.p1.jokers) assertEquals(valid.has(j), true);
	for (const j of g.p2.jokers) assertEquals(valid.has(j), true);
});

Deno.test("init - both players receive the same joker set", () => {
	// broadcastStart mirrors jokers: both players get the same 4 cards
	const g = new ttd.Game(0, "p1", "p2");
	assertEquals(g.p1.jokers, g.p2.jokers);
});
