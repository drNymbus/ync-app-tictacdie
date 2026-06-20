// render.ts — rendu DOM de la vue de partie (joueurs, board, jokers, prompt, fin).
import { S } from "./state.ts";
import { el } from "./dom.ts";
import { symbolAsset, jokerAsset, JOKER_ART } from "./config.ts";
import { transitioning } from "./anim.ts";
import { onCellClick, onJokerSelect, onSymbolSelect, onNomadDirection, onResizeCorner } from "./interactions.ts";

export function renderAll() {
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
	const existing = S.root.querySelector("#gameover");
	if (existing) existing.remove();
	if (S.gameOverResult === null) return;

	const overlay = el("div", { id: "gameover" });
	if (S.gameOverResult === 0) {
		overlay.appendChild(el("div", { className: "go-text", textContent: "MATCH NUL" }));
	} else {
		const win = S.gameOverResult === S.myIndex;
		overlay.appendChild(el("img", {
			className: "go-art",
			src: `/assets/${win ? "VICTOIRE" : "DEFAITE"}.png`,
			alt: win ? "Victoire" : "Défaite",
		}));
	}
	S.root.appendChild(overlay);
}

function renderPlayers() {
	const wrap = S.root.querySelector("#players");
	wrap.innerHTML = "";
	const live = S.gameOverResult === null;
	// Le joueur dont c'est le tour a son symbole en surbrillance.
	wrap.appendChild(chip(S.myName, S.mySymbol, live && S.myTurn, false));
	wrap.appendChild(el("div", { id: "turn" }));
	wrap.appendChild(chip(S.oppName, S.oppSymbol, live && !S.myTurn, true));
}

// Pastille joueur : symbole (APNG XOXO) + nom. mirror = nom à gauche du symbole (adversaire).
function chip(name, sym, active, mirror) {
	// chip-x / chip-o : couleur d'allumage de l'encart selon le symbole du joueur.
	const c = el("div", { className: `chip chip-${sym === "X" ? "x" : "o"}${active ? " active" : ""}` });
	const icon = el("img", { className: "sym-icon", src: symbolAsset(sym), alt: sym });
	const nm = el("span", { className: active ? "pname" : "pname dim", textContent: name || "—" });
	if (mirror) c.append(nm, icon);
	else c.append(icon, nm);
	return c;
}

function renderTurn() {
	const node = S.root.querySelector("#turn");
	if (S.gameOverResult !== null) {
		node.textContent = S.gameOverResult === 0 ? "Match nul"
			: S.gameOverResult === S.myIndex ? "Victoire !" : "Défaite";
		return;
	}
	node.textContent = S.myTurn ? "À toi de jouer" : "Tour de l'adversaire";
}

function renderBoard() {
	const boardEl = S.root.querySelector("#board");
	boardEl.innerHTML = "";
	const n = S.board.length;
	boardEl.style.gridTemplateColumns = `repeat(${n}, 96px)`;
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < S.board[y].length; x++) {
			const cellEl = document.createElement("div");
			cellEl.className = cellIsSelected(x, y) ? "cell selected" : "cell";
			cellEl.dataset.x = x;
			cellEl.dataset.y = y;
			fillCell(cellEl, S.board[y][x], x, y);
			cellEl.addEventListener("click", () => onCellClick(x, y));
			boardEl.appendChild(cellEl);
		}
	}
}

// Remplit une case. Les symboles (X/O, y compris nomad/virus en cours) s'affichent
// via les APNG XOXO ; les jokers gardent un glyphe ; trap reste invisible.
function fillCell(cellEl, cell, x, y) {
	cellEl.textContent = "";
	if (cell === "X" || cell === "O") {
		if (transitioning.has(`${x},${y}`)) return; // symbole masqué : l'APNG de transition joue par-dessus
		putSymbol(cellEl, cell);
		return;
	}
	if (typeof cell !== "object" || !cell) return; // "" vide
	switch (cell.kind) {
		case "nomad": // symbole en transit
			if (cell.content === "X" || cell.content === "O") putSymbol(cellEl, cell.content);
			return;
		case "virus": {
			// displayContent = symbole affiché (en retard sur content le temps de l'anim de mutation).
			const shown = cell.displayContent !== undefined ? cell.displayContent : cell.content;
			if (shown === "X" || shown === "O") putSymbol(cellEl, shown);
			else cellEl.textContent = "☣"; // neutre
			return;
		}
		case "immunity": // visuel = APNG figé (cf. playImmunity) ; on garde juste le symbole protégé dessous
			if (cell.content === "X" || cell.content === "O") putSymbol(cellEl, cell.content);
			return;
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
	const wrap = S.root.querySelector("#jokers");
	wrap.innerHTML = "";
	S.jokerEls = [];

	S.handCards = [];
	S.hoverIndex = null;

	S.myJokers.forEach((j, i) => {
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
		card.addEventListener("click", () => onJokerSelect(i));
		// Survol : anim SELECTED + écarte les voisines (layoutFan).
		card.addEventListener("mouseenter", () => {
			if (S.usedJokers[i]) return;
			S.hoverIndex = i;
			if (img && base) img.src = jokerAsset(base, true);
			layoutFan();
		});
		card.addEventListener("mouseleave", () => {
			if (S.usedJokers[i]) return;
			S.hoverIndex = null;
			if (img && base) img.src = jokerAsset(base, i === S.selectedJokerIndex);
			layoutFan();
		});
		wrap.appendChild(card);
		S.jokerEls.push({ card, img, base });
		S.handCards.push(card);
	});

	// Jeton symbole : SORTI de la main, posé à droite (cf. .symbol-token dans game.css).
	S.symCardEl = document.createElement("div");
	S.symCardEl.className = "symbol-token";
	const symImg = document.createElement("img");
	symImg.className = "sym-art";
	symImg.src = symbolAsset(S.mySymbol);
	symImg.alt = S.mySymbol;
	S.symCardEl.appendChild(symImg);
	S.symCardEl.addEventListener("click", () => onSymbolSelect());
	S.root.appendChild(S.symCardEl);

	layoutFan();
}

// Éventail : transform par carte. Au survol, la carte survolée se redresse/lève au premier plan
// et les voisines s'écartent (vers la gauche/droite selon leur côté) pour la lisibilité.
function layoutFan() {
	const n = S.handCards.length;
	if (!n) return;
	const center = (n - 1) / 2;
	const ANGLE = 5, SPACING = 150, ARC = 18, PUSH = 80, LIFT = 70;
	S.handCards.forEach((c, i) => {
		const off = i - center;
		if (i === S.hoverIndex) {
			// garde sa position horizontale (pas de saut vers le centre) et se lève juste pour
			// révéler toute la carte -> très peu de déplacement, donc pas de conflit avec le survol.
			c.style.transform = `translateX(${(off * SPACING).toFixed(1)}px) translateY(${-LIFT}px) rotate(${(off * ANGLE * 0.5).toFixed(2)}deg) scale(1.05)`;
			c.style.zIndex = "200"; // au-dessus de TOUTES les autres
		} else {
			const push = S.hoverIndex != null ? (i < S.hoverIndex ? -PUSH : PUSH) : 0;
			const sel = (i === S.selectedJokerIndex) ? -34 : 0; // carte sélectionnée ressort
			c.style.transform = `translateX(${(off * SPACING + push).toFixed(1)}px) translateY(${(Math.abs(off) * ARC + sel).toFixed(1)}px) rotate(${(off * ANGLE).toFixed(2)}deg)`;
			c.style.zIndex = String(i === S.selectedJokerIndex ? 100 : 10 + i);
		}
	});
}

// Met à jour l'état des cartes existantes (sélection, consommation, IDLE/SELECTED).
function renderJokers() {
	if (!S.jokerEls.length) buildJokers();

	S.jokerEls.forEach((je, i) => {
		const selected = i === S.selectedJokerIndex;
		je.card.classList.toggle("used", S.usedJokers[i]);   // fondu à l'opacité 0, incliquable
		if (je.img && je.base && i !== S.hoverIndex) je.img.src = jokerAsset(je.base, selected); // pas pendant le survol
	});

	if (S.symCardEl) S.symCardEl.classList.toggle("selected", S.symbolSelected);
	layoutFan(); // applique positions + sélection + écartement courant
}

// Texte de guidage du sous-flux en cours.
function renderPrompt() {
	const p = S.root.querySelector("#prompt");
	p.innerHTML = "";
	if (!S.flow) {
		if (S.gameOverResult === null && S.myTurn) p.textContent = "# choisis une carte, puis une case";
		return;
	}
	// switch : évite d'évaluer flow.cells.length quand le joker n'est pas invert.
	let msg = "";
	switch (S.flow.card) {
		case "trap":     msg = S.flow.step === 1 ? "Trap : clique la case piège" : "Trap : clique la case de redirection"; break;
		case "nomad":    msg = S.flow.step === 1 ? "Nomad : clique la case de pose" : "Nomad : choisis une direction"; break;
		case "invert":   msg = `Invert : sélectionne 3 cases alignées (${S.flow.cells.length}/3)`; break;
		case "resize":   msg = "Resize : choisis un coin"; break;
		case "bomb":     msg = "Bomb : clique une case"; break;
		case "immunity": msg = "Immunity : clique une case"; break;
		case "virus":    msg = "Virus : clique une case"; break;
	}
	p.textContent = msg;
}

// Contrôles dynamiques d'un sous-flux (flèches de direction / coins de resize).
function renderFlowControls() {
	if (!S.flow) return;
	if (S.flow.card === "nomad" && S.flow.step === 2) renderNomadArrows();
	if (S.flow.card === "resize") renderResizeCorners();
}

function renderNomadArrows() {
	const p = S.root.querySelector("#prompt");
	[["↑", 0, -1], ["↓", 0, 1], ["←", -1, 0], ["→", 1, 0]].forEach(([label, dx, dy]) => {
		const b = document.createElement("button");
		b.textContent = label;
		b.className = "arrow";
		b.addEventListener("click", () => onNomadDirection(dx, dy));
		p.appendChild(b);
	});
}

function renderResizeCorners() {
	const boardEl = S.root.querySelector("#board");
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

function cellIsSelected(x, y) {
	if (!S.flow) return false;
	if (S.flow.card === "invert") return S.flow.cells.some((c) => c.x === x && c.y === y);
	if (S.flow.card === "trap" && S.flow.origin) return S.flow.origin.x === x && S.flow.origin.y === y;
	if (S.flow.card === "nomad" && S.flow.cell) return S.flow.cell.x === x && S.flow.cell.y === y;
	return false;
}

export function setTurn(b) {
	S.myTurn = b;
	renderTurn();
}
