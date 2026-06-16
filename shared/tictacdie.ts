import * as rand from "./random.ts";

export type Empty = "";
export type Symbol = "X" | "O";

export type Nomad = {kind: "nomad", cooldown: number, dirx: number, diry: number, content: Symbol, old_content: Cell};
export type Immunity = {kind: "immunity", cooldown: number, content: Cell};
export type Trap = {kind: "trap", newx: number, newy: number};
export type Virus = {kind: "virus", content: Empty | Symbol};
export type TTT = {kind: "ttt"}; // TODO

export type Cell = Empty | Symbol | Nomad | Immunity | Trap | Virus | TTT;
	
export type Player = {
	name: string,
	symbol: Symbol
	jokers: string[]
}; // class Player

export class Game {
	board: Cell[][];
	turn: number;
	p1: Player;
	p2: Player;

	constructor(seed: number, p1: string, p2: string) {
		this.board = [
			["", "", ""],
			["", "", ""],
			["", "", ""]
		];
		this.p1 = {name: p1, symbol: "X", jokers: []} as Player;
		this.p2 = {name: p2, symbol: "O", jokers: []} as Player;
		this.turn = rand.randInt(seed, 0,1);
		
		const jokers = ["invert", "resize", "bomb", "nomad", "immunity", "trap", "virus"]; //, "ttt"];
		for (let i = 0; i < 4; i++) {
			const idx = rand.randInt(seed, 0, jokers.length);
			this.p1.jokers.push(jokers[idx]);
			this.p2.jokers.push(jokers[idx]);
			jokers.splice(idx, 1);
		}
	}; // constructor

	tick() {
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
		this.turn++;
	}; // tick	

	#getCellSymbol(cell: Cell): Empty | Symbol {
		if (typeof cell === "object") {
			if (cell.kind === "nomad") { return cell.content; }
			if (cell.kind === "immunity") { return this.#getCellSymbol(cell.content); }
			if (cell.kind === "virus") { return cell.content; }
			return "";
		} else {
			return cell;
		}
	}
	// -1: not over; 0: draw; 1: player1; 2: player2
	isGameOver(): number {
		let filled = true; // flag if board contains an empty cell

		let diagSymbol = this.#getCellSymbol(this.board[0][0]);
		let diag = (diagSymbol !== "");
		let inv_diagSymbol = this.#getCellSymbol(this.board[this.board.length-1][0]);
		let inv_diag = (inv_diagSymbol !== "");

		for (let i=0; i < this.board.length; i++) {
			let rowSymbol = this.#getCellSymbol(this.board[i][0]);
			let rowWinner = (rowSymbol !== "");
			let colSymbol = this.#getCellSymbol(this.board[0][i]);
			let colWinner = (colSymbol !== "");

			for (let j=1; j < this.board.length; j++) {
				if (filled && this.#getCellSymbol(this.board[i][j]) === "") filled = false;

				if (rowWinner && rowSymbol !== this.#getCellSymbol(this.board[i][j])) rowWinner = false;
				if (colWinner && colSymbol !== this.#getCellSymbol(this.board[j][i])) colWinner = false;
				if (!rowWinner && !colWinner) break;
			}
			
			if (rowWinner) return (rowSymbol === this.p1.symbol) ? 1 : 2;
			if (colWinner) return (colSymbol === this.p1.symbol) ? 1 : 2;

			if (diag && diagSymbol !== this.#getCellSymbol(this.board[i][i])) diag = false;
			if (inv_diag && inv_diagSymbol !== this.#getCellSymbol(this.board[this.board.length-1-i][i])) inv_diag = false;
		}

		if (diag) return (diagSymbol === this.p1.symbol) ? 1 : 2;
		if (inv_diag) return (inv_diagSymbol === this.p1.symbol) ? 1 : 2;

		return filled ? 0 : -1;
	}; // isGameOver

	action(player_index: number, card: string, x: number, y:number, opt1: number, opt2: number, opt3: string): [boolean, string] {
		if (player_index !== 1 - this.turn%2) return [false, "Not your turn"]; // not your turn

		if (player_index === 0 && !this.p1.jokers.include(card)) return [false, "You do not possess this joker"];
		if (player_index === 1 && !this.p2.jokers.include(card)) return [false, "You do not possess this joker"];

		let res = false;
		let message = "";

		if (card === "invert") {
			[res, message] = this.applyInvert(x, y);

		} else if (card === "resize") {
			[res, message] = this.applyResize(x === 1, y === 1, opt1 === 1, opt2 === 1);

		} else if (card === "bomb") {
			[res, message] = this.applyBomb(x, y);

		} else if (card === "symbol") {
			[res, message] = this.placeSymbol(x, y, opt3 as Symbol);

		} else if (card === "nomad") {
			[res, message] = this.placeNomad(x, y, opt1, opt2, opt3 as Symbol);

		} else if (card === "immunity") {
			[res, message] = this.placeImmunity(x, y);

		} else if (card === "trap") {
			[res, message] = this.placeTrap(x, y, opt1, opt2);

		} else if (card === "virus") {
			[res, message] = this.placeVirus(x, y);

		} else if (card === "ttt") {
			[res, message] = this.placeTTT(0, 0);
		}

		if (res) {
			this.tick();
			if (player_index === 0) this.p1.jokers.splice(this.p1.jokers.indexOf(card));
			if (player_index === 1) this.p2.jokers.splice(this.p1.jokers.indexOf(card));
		}
		return [res, message];
	} // action

	applyInvert(row: number, index: number): [boolean, string] {
		if (row !== 0 && row !== 1) return [false, "Invalid row parameter"];
		if (row === 1 && (index < 0 || index > this.board[0].length)) return [false, "Invalid index parameter"];
		if (row === 0 && (index < 0 || index > this.board.length)) return [false, "Invalid index parameter"];
		
		if (row === 1) {
			for (let x=0; x < this.board[0].length; x++) {
				let cell = this.board[index][x];
				if (typeof cell === "object" && cell.kind === "nomad") {
					cell.content = (cell.content === "X") ? "O" : "X";
					cell.old_content = (cell.old_content === "X") ? "O" : "X";
				} else if (typeof cell === "string" && cell !== "") {
					cell = (cell === "X") ? "O" : "X";
				}
				this.board[index][x] = cell;
			}
		} else {
			for (let y=0; y < this.board.length; y++) {
				let cell = this.board[y][index];
				if (typeof cell === "object" && cell.kind === "nomad") {
					cell.content = (cell.content === "X") ? "O" : "X";
					cell.old_content = (cell.old_content === "X") ? "O" : "X";
				} else if (typeof cell === "string" && cell !== "") {
					cell = (cell === "X") ? "O" : "X";
				}
				this.board[y][index] = cell;
			}
		}
		return [true, ""];
	}; // applyInvert
	
	applyResize(top: boolean, bottom: boolean, left: boolean, right: boolean): [boolean, string] {
		if (!(top || bottom) || !(left || right)) return [false, "Invalid parameter given"];

		const rowOffset = top ? 1 : 0;
		const colOffset = left ? 1 : 0;
		const oldRows = this.board.length;
		const oldCols = this.board[0].length;
		const newBoard: Cell[][] = Array.from({ length: oldRows + 1 }, () =>
		    Array(oldCols + 1).fill("") as Cell[]
		);
		for (let r = 0; r < oldRows; r++) {
		    for (let c = 0; c < oldCols; c++) {
			newBoard[r + rowOffset][c + colOffset] = this.board[r][c];
		    }
		}
		this.board = newBoard;	

		return [true, ""];
	}; // applyResize
	
	applyBomb(x: number, y: number): [boolean, string] {
		if (x < 0 || x > this.board[0].length) return [false, "Invalid x coordinate"];
		if (y < 0 || y > this.board.length) return [false, "Invalid y coordinate"];

		const cross = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]];
		for (const [dy, dx] of cross) {
		    const ny = y + dy;
		    const nx = x + dx;
		    if (ny < 0 || ny >= this.board.length) continue;
		    if (nx < 0 || nx >= this.board[0].length) continue;
		    const cell = this.board[ny][nx];
		    if (typeof cell === "object" && "cooldown" in cell) continue;
		    this.board[ny][nx] = "";
		}

		return [true, ""];
	}; // applyBomb

	placeSymbol(x: number, y: number, s: Symbol): [boolean, string] {
		if (x < 0 || x > this.board[0].length) return [false, "Invalid x coordinate"];
		if (y < 0 || y > this.board.length) return [false, "Invalid y coordinate"];

		const cell = this.board[y][x];
		if (typeof cell === "object" && cell.kind === "trap") {
			if (this.board[cell.newy][cell.newx] === "") {
				this.board[y][x] = "";
				this.board[cell.newy][cell.newx] = s;
			} else {
				this.board[y][x] = s;
			}
		} else if (typeof cell === "string" && cell === "") {
			this.board[y][x] = s;
		} else { return [false, "Cannot place a symbol in this cell"]; }
		return [true, ""];
	}; // placeSymbol

	placeNomad(x: number, y: number, dirx: number, diry: number, s: Symbol): [boolean, string] {
		if (x !== 0 && x !== this.board[0].length-1 && y !== 0 && y !== this.board.length-1) return [false, "Nomad can only placed on a border"];
		if ((diry === 0 && dirx !== -1 && dirx !== 1) || (dirx === 0 && diry !== -1 && diry !== 1)) return [false, "Invalid direction given"];
		if (diry !== 0 && dirx !== 0) return [false, "Invalid direction given"];

		const content = this.board[y][x];
		this.board[y][x] = {kind: "nomad", cooldown: 1, dirx: dirx, diry: diry, content: s, old_content: content};
		return [true, ""];
	}; // placeNomad

	placeImmunity(x: number, y: number): [boolean, string] {
		if (x < 0 || x > this.board[0].length-1) return [false, "Invalid x coordinate"];
		if (y < 0 || y > this.board.length-1) return [false, "Invalid y coordinate"];

		const content = this.board[y][x];
		this.board[y][x] = {kind: "immunity", cooldown: 2, content: content};
		return [true, ""];
	}; // placeImmunity

	placeVirus(x: number, y: number): [boolean, string] {
		if (x < 0 || x > this.board[0].length-1) return [false, "Invalid x coordinate"];
		if (y < 0 || y > this.board.length-1) return [false, "Invalid y coordinate"];
		this.board[y][x] = {kind: "virus", content: ""};
		return [true, ""];
	}; // placeVirus
	
	placeTrap(x: number, y: number, ax: number, ay: number): [boolean, string] {
		if (x < 0 || x >= this.board[0].length) return [false, "Invalid x coordinate"];
		if (y < 0 || y >= this.board.length) return [false, "Invalid y coordinate"];
		if (ax < 0 || ax >= this.board[0].length) return [false, "Invalid ax coordinate"];
		if (ay < 0 || ay >= this.board.length) return [false, "Invalid ay coordinate"];
		if (this.board[y][x] !== "") return [false, "Trap can only be placed on empty squares"];

		this.board[y][x] = {kind: "trap", newx: ax, newy: ay};
		return [true, ""];
	}; // placeTrap

	placeTTT(x: number, y: number): [boolean, string] { return [true, ""]; }; // placeTTT
}; // class Game
