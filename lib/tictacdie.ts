export type Empty = "";
export type Symbol = "X" | "O";

export type Nomad = {dirx: number, diry: number, content: Symbol, old_content: Empty | Symbol};
export type Immunity = {cooldown: number, content: Empty | Symbol};
export type Trap = {newx: number, newy: number};
export type Virus = {content: Symbol};
export type TTT = {}; // TODO

export type Cell = Empty | Symbol | Nomad | Immunity | Trap | Virus | TTT;

function flipSymbol(s: Symbol): Symbol {
    return s === "X" ? "O" : "X";
}

function invertCell(cell: Cell): Cell {
    if (cell === "" || cell === "X" || cell === "O") {
        return cell === "" ? "" : flipSymbol(cell);
    }
    if ("cooldown" in cell) return cell; // Immunity — inchangée
    if ("newx" in cell) return cell;     // Trap — toujours vide, inchangée
    if (Object.keys(cell).length === 0) return cell; // TTT — invincible
    if ("dirx" in cell) {                // Nomad — on inverse les deux symboles
        const n = cell as Nomad;
        return {
            ...n,
            content: flipSymbol(n.content),
            old_content: n.old_content === "" ? "" : flipSymbol(n.old_content),
        };
    }
    if ("content" in cell) return cell;  // Virus — inchangé
    return cell;
}

function invertRow(board: Cell[][], index: number): boolean {
    if (index < 0 || index >= board.length) return false;
    board[index] = board[index].map(invertCell);
    return true;
}

function invertCol(board: Cell[][], index: number): boolean {
    if (index < 0 || index >= board[0].length) return false;
    for (let y = 0; y < board.length; y++) {
        board[y][index] = invertCell(board[y][index]);
    }
    return true;
}

export type Player = {
    name: string;
}; // Player

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
        for (let y = 0; y < this.board.length; y++) {
            for (let x = 0; x < this.board[0].length; x++) {
                const cell = this.board[y][x];
                if (typeof cell === "object" && "newx" in cell) {
                    const trap = cell as Trap;
                    if (this.board[trap.newy][trap.newx] !== "") this.board[y][x] = "";
                }
            }
        }
    }; // tick
    isGameOver(): number { return -1; }; // isGameOver

    applyInvert(axis: 0 | 1, index: number): boolean {
        if (axis === 0) return invertRow(this.board, index);
        return invertCol(this.board, index);
    }; // applyInvert
    applyResize(top: boolean, bottom: boolean, left: boolean, right: boolean) {
        if (!(top || bottom) || !(left || right)) return;
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
    }; // applyResize

    applyBomb(x: number, y: number) {
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
    }; // applyBomb

    placeSymbol(x: number, y: number, s: Symbol): boolean {
        const cell = this.board[y][x];
        if (typeof cell === "object" && "newx" in cell) {
            const trap = cell as Trap;
            if (this.board[trap.newy][trap.newx] === "") {
                this.board[trap.newy][trap.newx] = s;
                this.board[y][x] = "";
            } else {
                this.board[y][x] = s;
            }
            return true;
        }
        if (cell !== "") return false;
        this.board[y][x] = s;
        return true;
    }; // placeSymbol

    placeNomad(x: number, y: number, dirx: number, diry: number, s: Symbol): boolean {
        if (x !== 0 && x !== this.board[0].length-1 && y !== 0 && y !== this.board.length-1) return false;
        if ((diry === 0 && dirx !== -1 && dirx !== 1) || (dirx === 0 && diry !== -1 && diry !== 1)) return false;

        this.board[y][x] = {dirx: dirx, diry: diry, content: s, old_content: this.board[y][x] as Empty | Symbol};
        return true;
    }; // placeNomad

    placeImmunity(x: number, y: number): boolean {
        if (x < 0 || x > this.board[0].length-1) return false;
        if (y < 0 || y > this.board.length-1) return false;

        const content = this.board[y][x] as Empty | Symbol;
        this.board[y][x] = {cooldown: 2, content: content};
        return true;
    }; // placeImmunity

    placeVirus(x: number, y: number): boolean { return true; }; // placeVirus
    placeTrap(x: number, y: number, ax: number, ay: number): boolean {
        if (x < 0 || x >= this.board[0].length) return false;
        if (y < 0 || y >= this.board.length) return false;
        if (ax < 0 || ax >= this.board[0].length) return false;
        if (ay < 0 || ay >= this.board.length) return false;
        if (this.board[y][x] !== "") return false;
        this.board[y][x] = { newx: ax, newy: ay };
        return true;
    }; // placeTrap
    placeTTT(x: number, y: number) {}; // placeTTT
}; // Game
