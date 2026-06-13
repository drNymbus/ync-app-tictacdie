export type Empty = "";
export type Symbol = "X" | "O";

export type Nomad = {kind: "nomad", cooldown: number, dirx: number, diry: number, content: Symbol, old_content: Cell};
export type Immunity = {kind: "immunity", cooldown: number, content: Cell};
export type Trap = {kind: "trap", newx: number, newy: number};
export type Virus = {kind: "virus", content: Empty | Symbol};
export type TTT = {kind: "ttt"}; // TODO

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

	tick() {
		// console.log("START", this.board);
		for (let j=0; j < this.board.length; j++) {
			for (let i=0; i < this.board[0].length; i++) {
				let cell = this.board[j][i];

				if (typeof cell === "object") {
					if (cell.kind === "nomad") {
						if (cell.cooldown >= 0) cell.cooldown--;
						if (cell.cooldown < 0) {
							this.board[j][i] = cell.old_content;

							const newx = i + cell.dirx, newy = j + cell.diry;
							if ((newx >= 0 && newx < this.board[0].length) && (newy >= 0 && newy < this.board.length)) {
								cell.old_content = this.board[newy][newx];
								this.board[newy][newx] = cell;
							} 
							if (cell.dirx > 0 || cell.diry > 0) cell.cooldown = 1;
						}

					} else if (cell.kind === "immunity") {
						cell.cooldown--;
						if (cell.cooldown < 0) this.board[j][i] = cell.content;

					} else if (cell.kind === "trap") {
					} else if (cell.kind === "virus") {
						let countX = 0, countO = 0;

						const cross = [[-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]];
						for (const [dy, dx] of cross) {
							if (i + dx >= 0 && i + dx < this.board[0].length
							    	&& j + dy >= 0 && j + dy < this.board.length) {
								if (this.board[j + dy][i + dx] === "X") countX++;
								if (this.board[j + dy][i + dx] === "O") countO++;
							}
						}
						if (countX > countO) {
							cell.content = "X";
						} else if (countX < countO) {
							cell.content = "O";
						} else { cell.content = ""; }

					} else if (cell.kind === "ttt") {
					}
				}

			}
		}
		// console.log("END", this.board);
	}; // tick	

	isGameOver(): number { return -1; }; // isGameOver

	applyInvert(row: number, column: number) {}; // applyInvert
	applyResize(top: boolean, bottom: boolean) {}; // applyResize
	applyBomb(x: number, y: number) {}; // applyBomb

	placeSymbol(x: number, y: number, s: Symbol): boolean {
		if (this.board[y][x] !== "") return false;
		this.board[y][x] = s;
		return true;
	}; // placeSymbol

	placeNomad(x: number, y: number, dirx: number, diry: number, s: Symbol): boolean {
		if (x !== 0 && x !== this.board[0].length-1 && y !== 0 && y !== this.board.length-1) return false;
		if ((diry === 0 && dirx !== -1 && dirx !== 1) || (dirx === 0 && diry !== -1 && diry !== 1)) return false;

		const content = this.board[y][x];
		this.board[y][x] = {kind: "nomad", cooldown: 1, dirx: dirx, diry: diry, content: s, old_content: content};
		return true;
	}; // placeNomad

	placeImmunity(x: number, y: number): boolean {
		if (x < 0 || x > this.board[0].length-1) return false;
		if (y < 0 || y > this.board.length-1) return false;

		const content = this.board[y][x];
		this.board[y][x] = {kind: "immunity", cooldown: 2, content: content};
		return true;
	}; // placeImmunity

	placeVirus(x: number, y: number): boolean {
		if (x < 0 || x > this.board[0].length-1) return false;
		if (y < 0 || y > this.board.length-1) return false;
		this.board[y][x] = {kind: "virus", content: ""};
		return true;
	}; // placeVirus
	
	placeTrap(x: number, y: number, ax: number, ay: number): boolean { return true; }; // placeTrap
	placeTTT(x: number, y: number) {}; // placeTTT
}; // class Game
