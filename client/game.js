// game.js — vue de partie (SPA).
// Pilotée par lobby.js : à la réception de "start", lobby.js appelle init(ws, startMsg).

// ⚠️ Intégration Game (shared/tictacdie.ts) en suspens :
// le navigateur ne peut pas importer du TypeScript tel quel, et main.ts sert les
// fichiers en brut. En attendant la décision de serving/transpile (Victor), le
// squelette tient un `board` local pour le rendu statique.
// import { Game } from "../shared/tictacdie.ts";

// --- État du module ---
let ws = null;
let game = null;          // future instance de Game (shared/tictacdie.ts)
let board = [];           // Cell[][] courant (placeholder tant que Game n'est pas branché)
let myIndex = 0;          // 1 | 2
let mySymbol = "";        // "X" | "O"
let oppSymbol = "";
let myName = "";
let myTurn = false;
let myJokers = [];             // 4 jokers tirés via la seed
let selectedJokerIndex = null; // index du joker sélectionné dans myJokers
let symbolSelected = false;    // true si la 5e carte (pose de symbole) est sélectionnée
let flow = null;               // état du sous-flux multi-étapes en cours
let pendingAction = null;      // dernière action envoyée (pour rollback éventuel sur ko)
let gameOverResult = null;     // null tant que la partie n'est pas finie ; 0/1/2 ensuite

let root = null;          // racine DOM de la vue game

// --- Cycle de vie ---
export function init(socket, startMsg) {
	ws = socket;

	// Identité : matching pseudo <-> player1/player2 (cf. protocol.ts)
	myName = sessionStorage.getItem("nickname") ?? "";
	myIndex = (myName === startMsg.player1) ? 1 : 2;

	// TODO(seed): dériver symbole / qui commence / 4 jokers depuis startMsg.seed
	// via la logique partagée. Placeholders pour le rendu statique :
	mySymbol = (myIndex === 1) ? "X" : "O";
	oppSymbol = (mySymbol === "X") ? "O" : "X";
	myTurn = (myIndex === 1);
	// TEMP : types réels en attendant la dérivation par seed, pour tester les sous-flux.
	myJokers = ["trap", "nomad", "invert", "resize"];

	// Board de départ : 3x3 vide — sera remplacé par game.board une fois Game branché.
	board = [["", "", ""], ["", "", ""], ["", "", ""]];

	buildLayout();
	renderAll();

	// Réseau : le serveur envoie du JSON (cf. handler.ts). ws peut être null en bootstrap local.
	if (ws) ws.onmessage = (e) => onServerMessage(JSON.parse(e.data));
}

export function teardown() {
	if (root) root.remove();
	root = null;
}

// --- Construction du layout (une seule fois) ---
function buildLayout() {
	root = document.createElement("div");
	root.id = "game";
	root.innerHTML = `
		<div id="players"></div>
		<div id="turn"></div>
		<div id="prompt"></div>
		<div id="board"></div>
		<div id="jokers"></div>
	`;
	// mise en forme dans game.css
	document.getElementById("app").appendChild(root);
}

// --- Rendu ---
function renderAll() {
	renderPlayers();
	renderTurn();
	renderBoard();
	renderJokers();
	renderPrompt();
	renderFlowControls();
}

function renderPlayers() {
	const el = root.querySelector("#players");
	el.innerHTML = `
		<span class="me">${myName} (${mySymbol})</span>
		<span class="opp">Adversaire (${oppSymbol})</span>
	`;
}

function renderTurn() {
	const el = root.querySelector("#turn");
	if (gameOverResult !== null) {
		el.textContent = gameOverResult === 0 ? "Match nul"
			: gameOverResult === myIndex ? "Victoire !" : "Défaite";
		return;
	}
	el.textContent = myTurn ? "À toi de jouer" : "Tour de l'adversaire";
}

function renderBoard() {
	const el = root.querySelector("#board");
	el.innerHTML = "";
	const n = board.length;
	el.style.gridTemplateColumns = `repeat(${n}, 48px)`;
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < board[y].length; x++) {
			const cellEl = document.createElement("div");
			cellEl.className = cellIsSelected(x, y) ? "cell selected" : "cell";
			cellEl.dataset.x = x;
			cellEl.dataset.y = y;
			cellEl.textContent = renderCell(board[y][x]);
			cellEl.addEventListener("click", () => onCellClick(x, y));
			el.appendChild(cellEl);
		}
	}
}

// Mappe un Cell vers son visuel. Narrowing via la propriété `kind` (cf. shared/tictacdie.ts).
function renderCell(cell) {
	if (cell === "") return "";
	if (cell === "X" || cell === "O") return cell;
	switch (cell.kind) {
		case "nomad":    return cell.content;        // affiche le symbole en transit
		case "immunity": return "🛡";
		case "virus":    return cell.content || "☣"; // neutre si pas de majorité
		case "trap":     return "";                  // invisible pour tous
		case "ttt":      return "?";
		default:         return "";
	}
}

function renderJokers() {
	const el = root.querySelector("#jokers");
	el.innerHTML = "";

	// 4 jokers
	myJokers.forEach((j, i) => {
		const card = makeCard(j, i === selectedJokerIndex);
		card.addEventListener("click", () => onJokerSelect(i));
		el.appendChild(card);
	});

	// 5e carte : pose de symbole, légèrement décalée — "soit un joker, soit ton symbole".
	const symCard = makeCard(mySymbol, symbolSelected);
	symCard.classList.add("symbol");
	symCard.addEventListener("click", () => onSymbolSelect());
	el.appendChild(symCard);
}

function makeCard(label, selected) {
	const card = document.createElement("div");
	card.className = selected ? "card selected" : "card";
	card.textContent = label;
	return card;
}

// Texte de guidage du sous-flux en cours.
function renderPrompt() {
	const p = root.querySelector("#prompt");
	p.innerHTML = "";
	if (!flow) return;
	// switch : évite d'évaluer flow.cells.length quand le joker n'est pas invert.
	let msg = "";
	switch (flow.card) {
		case "trap":     msg = flow.step === 1 ? "Trap : clique la case piège" : "Trap : clique la case de redirection"; break;
		case "nomad":    msg = flow.step === 1 ? "Nomad : clique la case de pose" : "Nomad : choisis une direction"; break;
		case "invert":   msg = `Invert : sélectionne 3 cases alignées (${flow.cells.length}/3)`; break;
		case "resize":   msg = "Resize : choisis un coin"; break;
		case "bomb":     msg = "Bomb : clique une case"; break;
		case "immunity": msg = "Immunity : clique une case"; break;
		case "virus":    msg = "Virus : clique une case"; break;
	}
	p.textContent = msg;
}

// Contrôles dynamiques d'un sous-flux (flèches de direction / coins de resize).
function renderFlowControls() {
	if (!flow) return;
	if (flow.card === "nomad" && flow.step === 2) renderNomadArrows();
	if (flow.card === "resize") renderResizeCorners();
}

function renderNomadArrows() {
	const p = root.querySelector("#prompt");
	[["↑", 0, -1], ["↓", 0, 1], ["←", -1, 0], ["→", 1, 0]].forEach(([label, dx, dy]) => {
		const b = document.createElement("button");
		b.textContent = label;
		b.className = "arrow";
		b.addEventListener("click", () => onNomadDirection(dx, dy));
		p.appendChild(b);
	});
}

function renderResizeCorners() {
	const boardEl = root.querySelector("#board");
	// [label, top, bottom, left, right, classe de coin (cf. game.css)]
	[
		["↖", true,  false, true,  false, "corner-tl"],
		["↗", true,  false, false, true,  "corner-tr"],
		["↙", false, true,  true,  false, "corner-bl"],
		["↘", false, true,  false, true,  "corner-br"],
	].forEach(([label, top, bottom, left, right, cls]) => {
		const b = document.createElement("button");
		b.textContent = label;
		b.className = "corner " + cls;
		b.addEventListener("click", () => onResizeCorner(top, bottom, left, right));
		boardEl.appendChild(b);
	});
}

// --- État de sélection ---
function currentCard() {
	if (symbolSelected) return "symbol";
	return (selectedJokerIndex === null) ? null : myJokers[selectedJokerIndex];
}

function cellIsSelected(x, y) {
	if (!flow) return false;
	if (flow.card === "invert") return flow.cells.some((c) => c.x === x && c.y === y);
	if (flow.card === "trap" && flow.origin) return flow.origin.x === x && flow.origin.y === y;
	if (flow.card === "nomad" && flow.cell) return flow.cell.x === x && flow.cell.y === y;
	return false;
}

function resetSelection() {
	selectedJokerIndex = null;
	symbolSelected = false;
	flow = null;
}

// --- Interactions ---
function onJokerSelect(index) {
	if (!myTurn) return;
	const wasSelected = (selectedJokerIndex === index);
	resetSelection();
	if (!wasSelected) { selectedJokerIndex = index; setupFlow(myJokers[index]); } // re-clic = désélection
	renderAll();
}

function onSymbolSelect() {
	if (!myTurn) return;
	const was = symbolSelected;
	resetSelection();
	symbolSelected = !was; // re-clic = désélection
	renderAll();
}

function setupFlow(card) {
	switch (card) {
		case "trap":   flow = { card, step: 1, origin: null }; break;
		case "nomad":  flow = { card, step: 1, cell: null };   break;
		case "invert": flow = { card, cells: [] };             break;
		case "resize": flow = { card };                        break;
		case "bomb":
		case "immunity":
		case "virus":  flow = { card };                        break;
		default:       flow = { card }; console.warn(`joker "${card}" non géré`);
	}
}

function onCellClick(x, y) {
	if (!myTurn) return;
	const card = currentCard();

	// Aucune carte sélectionnée : pas de pose tant qu'on n'a pas choisi une des 5 cartes.
	if (!card) return;

	// 5e carte : pose de symbole. opt3 = mon symbole (cf. action() côté shared).
	if (card === "symbol") {
		sendAction({ type: "action", card: "symbol", x, y, opt1: 0, opt2: 0, opt3: mySymbol });
		return;
	}

	switch (card) {
		// Cible unique : un clic suffit.
		case "bomb":
		case "immunity":
		case "virus":
			sendAction({ type: "action", card, x, y, opt1: 0, opt2: 0, opt3: "" });
			break;
		case "trap":   onTrapClick(x, y);   break;
		case "nomad":  if (flow.step === 1) onNomadClick(x, y); break; // étape 2 via flèches
		case "invert": onInvertClick(x, y); break;
		// resize : pas un clic de case, géré par les boutons de coin.
	}
}

// Trap : clic 1 = case piège (vide), clic 2 = case de redirection (opt1=ax, opt2=ay).
function onTrapClick(x, y) {
	if (flow.step === 1) {
		flow.origin = { x, y };
		flow.step = 2;
		renderAll();
	} else {
		const o = flow.origin;
		sendAction({ type: "action", card: "trap", x: o.x, y: o.y, opt1: x, opt2: y, opt3: "" });
	}
}

// Nomad : clic = case de pose (avec ou sans symbole), puis direction via les flèches.
function onNomadClick(x, y) {
	flow.cell = { x, y };
	flow.step = 2;
	renderAll();
}

function onNomadDirection(dx, dy) {
	const c = flow.cell;
	// opt3 = mon symbole, porté par le Nomad pendant son déplacement.
	sendAction({ type: "action", card: "nomad", x: c.x, y: c.y, opt1: dx, opt2: dy, opt3: mySymbol });
}

// Invert : 3 cases alignées => détermine l'axe + l'index.
// même y (ligne horizontale) -> applyInvert(row=1, index=y) ; même x (colonne) -> applyInvert(row=0, index=x).
function onInvertClick(x, y) {
	if (flow.cells.some((c) => c.x === x && c.y === y)) return; // déjà sélectionnée
	const next = [...flow.cells, { x, y }];
	const aligned = next.every((c) => c.y === next[0].y) || next.every((c) => c.x === next[0].x);
	if (!aligned) { flow.cells = [{ x, y }]; renderAll(); return; } // brise l'alignement : reset

	flow.cells = next;
	if (flow.cells.length < 3) { renderAll(); return; }

	const isRow = flow.cells.every((c) => c.y === flow.cells[0].y);
	const action = isRow
		? { type: "action", card: "invert", x: 1, y: flow.cells[0].y, opt1: 0, opt2: 0, opt3: "" }
		: { type: "action", card: "invert", x: 0, y: flow.cells[0].x, opt1: 0, opt2: 0, opt3: "" };
	sendAction(action);
}

// Resize : coin choisi -> top/bottom/left/right (x=top, y=bottom, opt1=left, opt2=right).
function onResizeCorner(top, bottom, left, right) {
	sendAction({
		type: "action", card: "resize",
		x: top ? 1 : 0, y: bottom ? 1 : 0, opt1: left ? 1 : 0, opt2: right ? 1 : 0, opt3: "",
	});
}

function sendAction(action) {
	action.player = myIndex; // requis par ClientGameMessage (cf. protocol.ts)
	pendingAction = action;

	if (ws) {
		// Le serveur n'accuse pas le succès (pas de "ok" en jeu) : on applique en optimiste.
		// En cas de refus, le "ko" renvoie le board pour resync (cf. onServerMessage).
		ws.send(JSON.stringify(action));
		applyLocalTEMP(action); // TODO: remplacer par game.action(myIndex - 1, ...) une fois Game branché
		setTurn(false);         // la main passe à l'adversaire
	} else {
		// Bootstrap local (pas de serveur) : applique et garde la main pour tester l'UI.
		console.log("ACTION ->", action);
		applyLocalTEMP(action);
	}

	resetSelection();
	renderAll();
}

// TEMP : mutation locale grossière pour visualiser, à supprimer une fois Game branché.
function applyLocalTEMP(a) {
	const { card, x, y, opt1, opt2, opt3 } = a;
	const flip = (c) => (c === "X" ? "O" : c === "O" ? "X" : c);
	if (card === "symbol") {
		board[y][x] = opt3;
	} else if (card === "immunity") {
		board[y][x] = { kind: "immunity", cooldown: 2, content: board[y][x] };
	} else if (card === "virus") {
		board[y][x] = { kind: "virus", content: "" };
	} else if (card === "nomad") {
		board[y][x] = { kind: "nomad", cooldown: 1, dirx: opt1, diry: opt2, content: opt3, old_content: board[y][x] };
	} else if (card === "bomb") {
		for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const nx = x + dx, ny = y + dy;
			if (ny >= 0 && ny < board.length && nx >= 0 && nx < board[ny].length) board[ny][nx] = "";
		}
	} else if (card === "invert") {
		if (x === 1) for (let i = 0; i < board[y].length; i++) board[y][i] = flip(board[y][i]);
		else for (let j = 0; j < board.length; j++) board[j][y] = flip(board[j][y]);
	} else if (card === "resize") {
		const rowOff = x === 1 ? 1 : 0, colOff = opt1 === 1 ? 1 : 0;
		const old = board, n = old.length;
		const nb = Array.from({ length: n + 1 }, () => Array(n + 1).fill(""));
		for (let r = 0; r < n; r++) for (let c = 0; c < old[r].length; c++) nb[r + rowOff][c + colOff] = old[r][c];
		board = nb;
	}
	// trap : invisible, rien à afficher.
}

function setTurn(b) {
	myTurn = b;
	renderTurn();
}

// --- Réseau ---
// Messages serveur (cf. handler.ts) : "action" (coup adverse), "ko" (refus + board),
// "gameover" (result, -1 = pas fini), "closing" (fermeture serveur).
function onServerMessage(m) {
	switch (m.type) {
		case "action":
			// Coup de l'adversaire transmis tel quel : on l'applique, puis c'est à moi.
			applyLocalTEMP(m); // TODO: game.action(m.player - 1, m.card, ...) une fois Game branché
			setTurn(true);
			renderAll();
			break;

		case "ko":
			// Action refusée : resync autoritatif via le board renvoyé, la main me revient.
			if (m.board) board = m.board;
			console.warn("Action refusée :", m.message);
			setTurn(true);
			renderAll();
			break;

		case "gameover":
			// Envoyé après chaque coup ; -1 = partie non terminée → on ignore.
			if (m.result !== -1) showGameOver(m.result);
			break;

		case "closing":
			console.warn("Connexion fermée par le serveur");
			break;
	}
}

function showGameOver(result) {
	gameOverResult = result;
	myTurn = false;
	resetSelection(); // coupe toute interaction en cours
	renderAll();
}
