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
let oppName = "";
let myTurn = false;
let myJokers = [];             // 4 jokers tirés via la seed
let usedJokers = [];           // parallèle à myJokers : true = joker déjà consommé (usage unique)
let pendingJokerIndex = null;  // index du joker consommé en optimiste (rollback sur ko)
let selectedJokerIndex = null; // index du joker sélectionné dans myJokers
let jokerEls = [];             // cartes jokers persistantes [{card, img, base}] (pour animer hover/select/fade)
let symCardEl = null;          // carte symbole persistante (5e)
let symbolSelected = false;    // true si la 5e carte (pose de symbole) est sélectionnée
let flow = null;               // état du sous-flux multi-étapes en cours
let pendingAction = null;      // dernière action envoyée (pour rollback éventuel sur ko)
let gameOverResult = null;     // null tant que la partie n'est pas finie ; 0/1/2 ensuite
let soloDebug = false;         // true si lancé via le bouton solo debug (pas de serveur, garde la main)
let onExit = null;             // callback fourni par le lobby pour le reconstruire à la fin
let gameOverTimer = null;      // timer du fondu de fin -> lobby

const END_ANIM_MS = 6000;      // durée des APNG VICTOIRE/DEFAITE (mesurée)

let root = null;          // racine DOM de la vue game

// DEBUG : true => le joueur reçoit TOUS les jokers (pour tester chaque pouvoir).
// Repasser à false pour le tirage normal par seed. (à retirer en prod)
const DEBUG_ALL_JOKERS = true;
const ALL_JOKERS = ["invert", "resize", "bomb", "nomad", "immunity", "trap", "virus"];

// Correspondance joker -> base du nom de fichier APNG (client/assets/<BASE>_{IDLE,SELECTED}.png).
const JOKER_ART = {
	invert: "INVERT", resize: "SCALE", bomb: "BOMBOCLAAT", nomad: "NOMADE",
	immunity: "IMMUNITE", trap: "PIEGE", virus: "VIRUS",
	// ttt -> "BAGAR" (pas encore actif)
};
function jokerAsset(base, selected) {
	return `/assets/${base}_${selected ? "SELECTED" : "IDLE"}.png`;
}
// Asset APNG d'un symbole posé (X / O).
function symbolAsset(sym) {
	return `/assets/XOXO_${sym}.png`;
}

// --- Dérivation seed (réplique exacte de shared/random.ts + Game.constructor) ---
function seededRng(seed) {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) & 0xffffffff;
		return (state >>> 0) / 0xffffffff;
	};
}
function randInt(seed, min, max) {
	const rng = seededRng(seed);
	return Math.floor(rng() * (max - min + 1)) + min;
}
function deriveFromSeed(seed, isPlayer1) {
	const turn = randInt(seed, 0, 1);
	const pool = ["invert", "resize", "bomb", "nomad", "immunity", "trap", "virus"];
	const jokers = [...pool];
	const picked = [];
	for (let i = 0; i < 4; i++) {
		// clamp : max=jokers.length dans le serveur peut sortir des bornes, on sécurise
		const idx = Math.min(randInt(seed, 0, jokers.length), jokers.length - 1);
		picked.push(jokers[idx]);
		jokers.splice(idx, 1);
	}
	// 1 - turn%2 = index 0-based du joueur qui joue en premier
	const firstToPlay = 1 - turn % 2;
	return {
		symbol: isPlayer1 ? "X" : "O",
		myTurn: isPlayer1 ? firstToPlay === 0 : firstToPlay === 1,
		jokers: picked,
	};
}

// --- Cycle de vie ---
export function init(socket, startMsg, exitCb) {
	ws = socket;
	onExit = exitCb || null;

	// Identité : matching pseudo <-> player1/player2 (cf. protocol.ts)
	soloDebug = startMsg.debug === true;
	myName = sessionStorage.getItem("nickname") ?? "";
	myIndex = (myName === startMsg.player1) ? 1 : 2;
	oppName = (myIndex === 1) ? startMsg.player2 : startMsg.player1;

	const derived = deriveFromSeed(startMsg.seed, myIndex === 1);
	mySymbol = derived.symbol;
	oppSymbol = mySymbol === "X" ? "O" : "X";
	myTurn = soloDebug ? true : derived.myTurn; // en solo debug on garde la main pour tester
	myJokers = DEBUG_ALL_JOKERS ? [...ALL_JOKERS] : derived.jokers;
	usedJokers = myJokers.map(() => false); // aucun joker consommé au départ

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
// Structure thème CRT (cf. game.css / maquette "Game — Fullscreen").
function buildLayout() {
	jokerEls = [];      // réinitialise les cartes persistantes (nouvelle partie)
	symCardEl = null;
	root = document.createElement("div");
	root.id = "game";
	root.classList.add("intro"); // chorégraphie d'entrée (cf. game.css)
	root.innerHTML = `
		<video class="bg-video" autoplay loop muted playsinline>
			<source src="/assets/BACKGROUND_TILEABLE_CARD_SIZE.mp4" type="video/mp4">
		</video>
		<div class="statusbar">
			<span class="left">TICTACDIE.EXE  [v1.0]</span>
			<span class="right">● IN GAME</span>
		</div>
		<div class="wrap">
			<div class="col">
				<div id="players"></div>
				<div class="rule"></div>
				<div id="board-wrap"><div id="board"></div></div>
				<div id="prompt"></div>
				<div class="rule"></div>
				<div id="jokers"></div>
				<div class="footer">
					<span>SESSION: #8F2A91</span>
					<span>tictacdie // alpha</span>
				</div>
			</div>
		</div>
	`;
	document.getElementById("app").appendChild(root);

	// L'autoplay n'est pas fiable sur une <video> insérée via innerHTML : on force la lecture.
	const bg = root.querySelector(".bg-video");
	if (bg) bg.play().catch(() => {});

	// Retire la classe d'intro une fois toutes les animations terminées (cartes : 4,2s + 4s).
	setTimeout(() => { if (root) root.classList.remove("intro"); }, 8500);

	if (DEBUG_ALL_JOKERS) buildDebugPanel();
}

// DEBUG : panneau pour prévisualiser les écrans de fin (à retirer en prod).
function buildDebugPanel() {
	const panel = el("div", { id: "debug-panel" });
	const mk = (label, fn) => {
		const b = el("button", { className: "debug-btn", textContent: label });
		b.addEventListener("click", fn);
		return b;
	};
	panel.append(
		mk("Victoire", () => showGameOver(myIndex)),
		mk("Défaite", () => showGameOver(myIndex === 1 ? 2 : 1)),
		mk("Nul", () => showGameOver(0)),
		mk("Fermer", () => { clearTimeout(gameOverTimer); gameOverResult = null; if (root) renderAll(); }),
	);
	root.appendChild(panel);
}

// Petit helper DOM.
function el(tag, props = {}) {
	const e = document.createElement(tag);
	Object.assign(e, props);
	return e;
}

// --- Rendu ---
function renderAll() {
	renderPlayers();
	renderTurn();
	renderBoard();
	renderJokers();
	renderPrompt();
	renderFlowControls();
	renderGameOver();
}

// Overlay de fin : assombrit tout l'écran et affiche l'APNG VICTOIRE / DEFAITE au centre.
function renderGameOver() {
	const existing = root.querySelector("#gameover");
	if (existing) existing.remove();
	if (gameOverResult === null) return;

	const overlay = el("div", { id: "gameover" });
	if (gameOverResult === 0) {
		overlay.appendChild(el("div", { className: "go-text", textContent: "MATCH NUL" }));
	} else {
		const win = gameOverResult === myIndex;
		overlay.appendChild(el("img", {
			className: "go-art",
			src: `/assets/${win ? "VICTOIRE" : "DEFAITE"}.png`,
			alt: win ? "Victoire" : "Défaite",
		}));
	}
	root.appendChild(overlay);
}

function renderPlayers() {
	const wrap = root.querySelector("#players");
	wrap.innerHTML = "";
	const live = gameOverResult === null;
	// Le joueur dont c'est le tour a son symbole en surbrillance.
	wrap.appendChild(chip(myName, mySymbol, live && myTurn, false));
	wrap.appendChild(el("div", { id: "turn" }));
	wrap.appendChild(chip(oppName, oppSymbol, live && !myTurn, true));
}

// Pastille joueur : symbole (APNG XOXO) + nom. mirror = nom à gauche du symbole (adversaire).
function chip(name, sym, active, mirror) {
	const c = el("div", { className: active ? "chip active" : "chip" });
	const icon = el("img", { className: "sym-icon", src: symbolAsset(sym), alt: sym });
	const nm = el("span", { className: active ? "pname" : "pname dim", textContent: name || "—" });
	if (mirror) c.append(nm, icon);
	else c.append(icon, nm);
	return c;
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
	el.style.gridTemplateColumns = `repeat(${n}, 96px)`;
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < board[y].length; x++) {
			const cellEl = document.createElement("div");
			cellEl.className = cellIsSelected(x, y) ? "cell selected" : "cell";
			cellEl.dataset.x = x;
			cellEl.dataset.y = y;
			fillCell(cellEl, board[y][x]);
			cellEl.addEventListener("click", () => onCellClick(x, y));
			el.appendChild(cellEl);
		}
	}
}

// Remplit une case. Les symboles (X/O, y compris nomad/virus en cours) s'affichent
// via les APNG XOXO ; les jokers gardent un glyphe ; trap reste invisible.
function fillCell(cellEl, cell) {
	cellEl.textContent = "";
	if (cell === "X" || cell === "O") { putSymbol(cellEl, cell); return; }
	if (typeof cell !== "object" || !cell) return; // "" vide
	switch (cell.kind) {
		case "nomad": // symbole en transit
			if (cell.content === "X" || cell.content === "O") putSymbol(cellEl, cell.content);
			return;
		case "virus":
			if (cell.content === "X" || cell.content === "O") putSymbol(cellEl, cell.content);
			else cellEl.textContent = "☣"; // neutre
			return;
		case "immunity": cellEl.textContent = "🛡"; return;
		case "ttt":      cellEl.textContent = "?"; return;
		case "trap":     return; // invisible pour tous
	}
}

function putSymbol(cellEl, sym) {
	const img = document.createElement("img");
	img.className = "cell-sym";
	img.src = symbolAsset(sym);
	img.alt = sym;
	cellEl.appendChild(img);
}

// Construit les cartes UNE fois (éléments persistants → les anims hover/select/fade marchent).
function buildJokers() {
	const el = root.querySelector("#jokers");
	el.innerHTML = "";
	jokerEls = [];

	// Encart regroupant les 4 jokers.
	const jokerGroup = document.createElement("div");
	jokerGroup.className = "joker-group";
	myJokers.forEach((j, i) => {
		const card = document.createElement("div");
		card.className = "card joker";
		const base = JOKER_ART[j];
		let img = null;
		if (base) {
			img = document.createElement("img");
			img.className = "joker-art";
			img.alt = j;
			card.appendChild(img);
		} else {
			card.classList.add("text"); // fallback joker sans visuel (ex: ttt)
			card.textContent = j;
		}
		// Listener attaché une fois ; onJokerSelect ignore déjà les jokers consommés.
		card.addEventListener("click", () => onJokerSelect(i));
		// Survol : joue l'anim SELECTED (revient à IDLE en sortant, sauf si la carte est sélectionnée).
		if (img) {
			card.addEventListener("mouseenter", () => { if (!usedJokers[i]) img.src = jokerAsset(base, true); });
			card.addEventListener("mouseleave", () => { if (!usedJokers[i]) img.src = jokerAsset(base, i === selectedJokerIndex); });
		}
		jokerGroup.appendChild(card);
		jokerEls.push({ card, img, base });
	});
	el.appendChild(jokerGroup);

	// Encart séparé pour la carte symbole (APNG XOXO).
	const symGroup = document.createElement("div");
	symGroup.className = "symbol-group";
	symCardEl = document.createElement("div");
	symCardEl.className = "card symbol";
	const symImg = document.createElement("img");
	symImg.className = "sym-art";
	symImg.src = symbolAsset(mySymbol);
	symImg.alt = mySymbol;
	symCardEl.appendChild(symImg);
	symCardEl.addEventListener("click", () => onSymbolSelect());
	symGroup.appendChild(symCardEl);
	el.appendChild(symGroup);
}

// Met à jour l'état des cartes existantes (sélection, consommation, IDLE/SELECTED).
function renderJokers() {
	if (!jokerEls.length) buildJokers();

	jokerEls.forEach((je, i) => {
		const selected = i === selectedJokerIndex;
		je.card.classList.toggle("selected", selected);   // grossissement + visuel SELECTED
		je.card.classList.toggle("used", usedJokers[i]);   // fondu à l'opacité 0, incliquable
		if (je.img && je.base) je.img.src = jokerAsset(je.base, selected);
	});

	if (symCardEl) symCardEl.classList.toggle("selected", symbolSelected);
}

// Texte de guidage du sous-flux en cours.
function renderPrompt() {
	const p = root.querySelector("#prompt");
	p.innerHTML = "";
	if (!flow) {
		if (gameOverResult === null && myTurn) p.textContent = "# choisis une carte, puis une case";
		return;
	}
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
	if (usedJokers[index]) return; // joker déjà utilisé
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
		case "nomad":
			if (flow.step === 1 && (x === 0 || x === board[0].length - 1 || y === 0 || y === board.length - 1)) onNomadClick(x, y);
			break; // étape 2 via flèches
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

	// Usage unique : on consomme le joker en optimiste (rollback sur "ko").
	// La 5e carte (symbole) n'est pas un joker et reste toujours disponible.
	if (action.card !== "symbol" && selectedJokerIndex !== null) {
		pendingJokerIndex = selectedJokerIndex;
		usedJokers[selectedJokerIndex] = true;
	}

	if (ws && !soloDebug) {
		// Le serveur n'accuse pas le succès (pas de "ok" en jeu) : on applique en optimiste.
		// En cas de refus, le "ko" renvoie le board pour resync (cf. onServerMessage).
		ws.send(JSON.stringify(action));
		applyLocalTEMP(action);
		localTick();
		setTurn(false);
	} else {
		// Solo debug / bootstrap local : applique localement et garde la main pour tester l'UI.
		applyLocalTEMP(action);
		localTick();
	}

	resetSelection();
	renderAll();
}

// Réplique exacte de Game.tick() (shared/tictacdie.ts) pour maintenir le board client en sync.
function localTick() {
	const rows = board.length, cols = board[0].length;
	for (let j = 0; j < rows; j++) {
		for (let i = 0; i < cols; i++) {
			const cell = board[j][i];
			if (typeof cell !== "object") continue;
			if (cell.kind === "nomad") {
				if (cell.cooldown >= 0) cell.cooldown--;
				if (cell.cooldown < 0) {
					board[j][i] = cell.old_content;
					const nx = i + cell.dirx, ny = j + cell.diry;
					if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
						cell.old_content = board[ny][nx];
						board[ny][nx] = cell;
					}
					if (cell.dirx > 0 || cell.diry > 0) cell.cooldown = 1;
				}
			} else if (cell.kind === "immunity") {
				cell.cooldown--;
				if (cell.cooldown < 0) board[j][i] = cell.content;
			} else if (cell.kind === "virus") {
				let x = 0, o = 0;
				for (const [dy, dx] of [[-1,0],[1,0],[-1,-1],[0,-1],[1,-1],[-1,1],[0,1],[1,1]]) {
					const ni = i + dx, nj = j + dy;
					if (ni >= 0 && ni < cols && nj >= 0 && nj < rows) {
						if (board[nj][ni] === "X") x++;
						if (board[nj][ni] === "O") o++;
					}
				}
				cell.content = x > o ? "X" : o > x ? "O" : "";
			}
		}
	}
}

function applyLocalTEMP(a) {
	const { card, x, y, opt1, opt2, opt3 } = a;
	const flip = (c) => (c === "X" ? "O" : c === "O" ? "X" : c);
	if (card === "symbol") {
		// Réplique exacte de placeSymbol (shared/tictacdie.ts) : gère la redirection des pièges.
		const cell = board[y][x];
		if (typeof cell === "object" && cell.kind === "trap") {
			if (board[cell.newy][cell.newx] === "") {
				board[y][x] = "";                    // redirect libre : le piège disparaît
				board[cell.newy][cell.newx] = opt3;  // le symbole part sur la redirect
			} else {
				board[y][x] = opt3;                  // redirect occupée : le symbole reste sur le piège
			}
		} else if (cell === "") {
			board[y][x] = opt3;
		}
		// case occupée non-piège : rien (le serveur refusera, cf. placeSymbol)
	} else if (card === "trap") {
		// Piège invisible au rendu mais stocké pour reproduire la redirection localement.
		board[y][x] = { kind: "trap", newx: opt1, newy: opt2 };
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
		case "ok":
			pendingJokerIndex = null; // action acceptée : la consommation du joker est confirmée
			break;

		case "action":
			// Coup de l'adversaire transmis tel quel : on l'applique, puis c'est à moi.
			applyLocalTEMP(m);
			localTick();
			setTurn(true);
			renderAll();
			break;

		case "ko":
			// Action refusée : resync autoritatif via le board renvoyé, la main me revient.
			if (m.board) board = m.board;
			if (pendingJokerIndex !== null) { usedJokers[pendingJokerIndex] = false; pendingJokerIndex = null; } // rollback du joker
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
	// Quand l'animation de fin se termine (ou après un délai pour le match nul) : fondu -> lobby.
	clearTimeout(gameOverTimer);
	gameOverTimer = setTimeout(exitToLobby, result === 0 ? 2500 : END_ANIM_MS);
}

// Fondu plein écran du jeu, révélant le lobby reconstruit derrière (miroir du fondu lobby -> game).
function exitToLobby() {
	if (!root) return;
	if (onExit) onExit(); // reconstruit le lobby derrière le jeu
	const leaving = root;
	root = null;
	leaving.classList.add("leaving");
	requestAnimationFrame(() => requestAnimationFrame(() => leaving.classList.add("fade-out")));
	setTimeout(() => leaving.remove(), 2100);
}
