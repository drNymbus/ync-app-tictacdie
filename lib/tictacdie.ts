export type Empty = "";
export type Symbol = "X" | "O";

export type Nomad = {dirx: number, diry: number, old_value: Empty | Symbol};
export type Immunity = {cooldown: number};
export type Trap = {newx: number, newy: number};
export type Virus = {content: Symbol};
export type TTT = {}; // TODO

export type Cell = Empty | Symbol | Nomad | Immunity | Trap | Virus | TTT;
	
export type Player = {
	name: string;
}; // class Player

export class Game {
	board: Cell[][];
	p1: Player;
	p2: Player;

	constructor(p1: Player, p2: Player) {
		this.board = [
			["", "", ""],
			["", "", ""],
			["", "", ""]
		];
		this.p1 = p1; this.p2 = p2;
	}; // constructor

	tick() {}; // tick
	isGameOver(): number { return -1; }; // isGameOver

	applyInvert(row: number, column: number) {}; // applyInvert
	applyResize(top: boolean, bottom: boolean, left: boolean, right: boolean) {}; // applyResize
	applyBomb(x: number, y: number) {}; // applyBomb

	placeSymbol(x: number, y: number, s: Symbol) {}; // placeSymbol
	placeNomad(x: number, y: number, dirx: number, diry: number) {}; // placeNomad
	placeImmunity(x: number, y: number) {}; // placeImmunity
	placeVirus(x: number, y: number) {}; // placeVirus
	placeTrap(x: number, y: number, ax: number, ay: number) {}; // placeTrap
	placeTTT(x: number, y: number) {}; // placeTTT
}; // class Game
