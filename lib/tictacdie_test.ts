import { assertEquals } from "jsr:@std/assert";
import * as ttd from "./tictacdie.ts";

Deno.test("init Game", () => {
	const g = new ttd.Game({name:"player1"}, {name:"player2"});	

	assertEquals(g.board.length, 3);
	assertEquals(g.board[0].length, 3);
	assertEquals(g.board[1].length, 3);
	assertEquals(g.board[2].length, 3);

	for (let j=0; j < g.board.length; j++) {
		for (let i=0; i < g.board[j].length; i++) {
			assertEquals(g.board[j][i], "");
		}
	}
});

Deno.test("placeSymbol", () => {
	const g = new ttd.Game({name:"player1"}, {name:"player2"});	
	g.placeSymbol(0, 0, "X");
	assertEquals(g.board[0][0], "X");

	g.placeSymbol(2, 1, "O");
	assertEquals(g.board[1][2], "O");
});

Deno.test("placeNomad", () => {
	const g = new ttd.Game({name:"player1"}, {name:"player2"});	

	g.placeNomad(0, 0, 1, 0, "X");
	g.tick();
	assertEquals(g.board[0][0], {kind: "nomad", cooldown: 0, dirx:1, diry:0, content: "X", old_content: ""});
	g.tick();
	assertEquals(g.board[0][1], {kind: "nomad", cooldown: 0, dirx:1, diry:0, content: "X", old_content: ""});
	g.tick();
	g.tick();
	assertEquals(g.board[0][2], "");

	g.placeSymbol(1, 1, "O");
	g.placeNomad(1, 2, 0, -1, "X");
	g.tick();
	assertEquals(g.board[2][1], {kind: "nomad", cooldown: 0, dirx:0, diry:-1, content:"X", old_content: ""});
	g.tick();
	assertEquals(g.board[1][1], {kind: "nomad", cooldown: -1, dirx:0, diry:-1, content:"X", old_content: "O"});
	g.tick();
	g.tick();
	assertEquals(g.board[0][1], "");
});

Deno.test("placeImmunity", () => {
	const g = new ttd.Game({name:"player1"}, {name:"player2"});	
	
	g.placeImmunity(0, 0);
	assertEquals(g.board[0][0], {kind: "immunity", cooldown:2, content: ""});
	g.tick();
	assertEquals(g.board[0][0], {kind: "immunity", cooldown:1, content: ""});
	g.tick();
	g.tick();
	assertEquals(g.board[0][0], "");
});

Deno.test("placeVirus", () => {
	const g = new ttd.Game({name:"player1"}, {name:"player2"});	

	g.placeVirus(0, 0);
	assertEquals(g.board[0][0], {kind: "virus", content: ""});

	g.placeSymbol(1, 0, "X");
	g.tick();
	assertEquals(g.board[0][0], {kind: "virus", content: "X"});

	g.placeSymbol(0, 1, "O");
	g.tick();
	assertEquals(g.board[0][0], {kind: "virus", content: ""});

	g.placeSymbol(1, 1, "O");
	g.tick();
	assertEquals(g.board[0][0], {kind: "virus", content: "O"});
});

Deno.test("placeTrap", () => {
});

Deno.test("placeTTT", () => {});

/*
	tick() {}; // tick
	isGameOver(): number {}; // isGameOver

	applyInvert(row: number, column: number) {}; // applyInvert
	applyResize(top: boolean, bottom: boolean, left: boolean, right: boolean) {}; // applyResize
	applyBomb(x: number, y: number) {}; // applyBomb

	placeSymbol(x: number, y: number, s: Symbol) {}; // placeSymbol
	placeNomad(x: number, y: number, dirx: number, diry: number) {}; // placeNomad
	placeImmunity(x: number, y: number) {}; // placeImmunity
	placeVirus(x: number, y: number) {}; // placeVirus
	placeTrap(x: number, y: number, ax: number, ay: number) {}; // placeTrap
	placeTTT(x: number, y: number) {}; // placeTTT
*/
