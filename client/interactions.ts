// interactions.ts — sélection de carte, sous-flux multi-étapes et envoi d'action.
import { S } from "./state.ts";
import { renderAll, setTurn } from "./render.ts";
import { applyLocalTEMP, localTick } from "./logic.ts";

// --- État de sélection ---
function currentCard() {
	if (S.symbolSelected) return "symbol";
	return (S.selectedJokerIndex === null) ? null : S.myJokers[S.selectedJokerIndex];
}

export function resetSelection() {
	S.selectedJokerIndex = null;
	S.symbolSelected = false;
	S.flow = null;
}

// --- Interactions ---
export function onJokerSelect(index) {
	if (!S.myTurn) return;
	if (S.usedJokers[index]) return; // joker déjà utilisé
	const wasSelected = (S.selectedJokerIndex === index);
	resetSelection();
	if (!wasSelected) { S.selectedJokerIndex = index; setupFlow(S.myJokers[index]); } // re-clic = désélection
	renderAll();
}

export function onSymbolSelect() {
	if (!S.myTurn) return;
	const was = S.symbolSelected;
	resetSelection();
	S.symbolSelected = !was; // re-clic = désélection
	renderAll();
}

function setupFlow(card) {
	switch (card) {
		case "trap":   S.flow = { card, step: 1, origin: null }; break;
		case "nomad":  S.flow = { card, step: 1, cell: null };   break;
		case "invert": S.flow = { card, cells: [] };             break;
		case "resize": S.flow = { card };                        break;
		case "bomb":
		case "immunity":
		case "virus":  S.flow = { card };                        break;
		default:       S.flow = { card }; console.warn(`joker "${card}" non géré`);
	}
}

export function onCellClick(x, y) {
	if (!S.myTurn) return;
	const card = currentCard();

	// Aucune carte sélectionnée : pas de pose tant qu'on n'a pas choisi une des 5 cartes.
	if (!card) return;

	// 5e carte : pose de symbole. opt3 = mon symbole (cf. action() côté shared).
	if (card === "symbol") {
		sendAction({ type: "action", card: "symbol", x, y, opt1: 0, opt2: 0, opt3: S.mySymbol });
		return;
	}

	switch (card) {
		// L'immunité ne se pose que sur un symbole déjà présent (cf. placeImmunity côté shared).
		case "immunity":
			if (S.board[y][x] !== "X" && S.board[y][x] !== "O") return; // case invalide : on n'envoie rien, joker non consommé
			sendAction({ type: "action", card, x, y, opt1: 0, opt2: 0, opt3: "" });
			break;
		// Cible unique : un clic suffit.
		case "bomb":
		case "virus":
			sendAction({ type: "action", card, x, y, opt1: 0, opt2: 0, opt3: "" });
			break;
		case "trap":   onTrapClick(x, y);   break;
		case "nomad":
			if (S.flow.step === 1 && (x === 0 || x === S.board[0].length - 1 || y === 0 || y === S.board.length - 1)) onNomadClick(x, y);
			break; // étape 2 via flèches
		case "invert": onInvertClick(x, y); break;
		// resize : pas un clic de case, géré par les boutons de coin.
	}
}

// Trap : clic 1 = case piège (vide), clic 2 = case de redirection (opt1=ax, opt2=ay).
function onTrapClick(x, y) {
	if (S.flow.step === 1) {
		S.flow.origin = { x, y };
		S.flow.step = 2;
		renderAll();
	} else {
		const o = S.flow.origin;
		sendAction({ type: "action", card: "trap", x: o.x, y: o.y, opt1: x, opt2: y, opt3: "" });
	}
}

// Nomad : clic = case de pose (avec ou sans symbole), puis direction via les flèches.
function onNomadClick(x, y) {
	S.flow.cell = { x, y };
	S.flow.step = 2;
	renderAll();
}

export function onNomadDirection(dx, dy) {
	const c = S.flow.cell;
	// opt3 = mon symbole, porté par le Nomad pendant son déplacement.
	sendAction({ type: "action", card: "nomad", x: c.x, y: c.y, opt1: dx, opt2: dy, opt3: S.mySymbol });
}

// Invert : 3 cases alignées => détermine l'axe + l'index.
// même y (ligne horizontale) -> applyInvert(row=1, index=y) ; même x (colonne) -> applyInvert(row=0, index=x).
function onInvertClick(x, y) {
	if (S.flow.cells.some((c) => c.x === x && c.y === y)) return; // déjà sélectionnée
	const next = [...S.flow.cells, { x, y }];
	const aligned = next.every((c) => c.y === next[0].y) || next.every((c) => c.x === next[0].x);
	if (!aligned) { S.flow.cells = [{ x, y }]; renderAll(); return; } // brise l'alignement : reset

	S.flow.cells = next;
	if (S.flow.cells.length < 3) { renderAll(); return; }

	const isRow = S.flow.cells.every((c) => c.y === S.flow.cells[0].y);
	const action = isRow
		? { type: "action", card: "invert", x: 1, y: S.flow.cells[0].y, opt1: 0, opt2: 0, opt3: "" }
		: { type: "action", card: "invert", x: 0, y: S.flow.cells[0].x, opt1: 0, opt2: 0, opt3: "" };
	sendAction(action);
}

// Resize : coin choisi -> top/bottom/left/right (x=top, y=bottom, opt1=left, opt2=right).
export function onResizeCorner(top, bottom, left, right) {
	sendAction({
		type: "action", card: "resize",
		x: top ? 1 : 0, y: bottom ? 1 : 0, opt1: left ? 1 : 0, opt2: right ? 1 : 0, opt3: "",
	});
}

function sendAction(action) {
	action.player = S.myIndex; // requis par ClientGameMessage (cf. protocol.ts)
	S.pendingAction = action;

	// Usage unique : on consomme le joker en optimiste (rollback sur "ko").
	// La 5e carte (symbole) n'est pas un joker et reste toujours disponible.
	if (action.card !== "symbol" && S.selectedJokerIndex !== null) {
		S.pendingJokerIndex = S.selectedJokerIndex;
		S.usedJokers[S.selectedJokerIndex] = true;
	}

	if (S.ws && !S.soloDebug) {
		// Le serveur n'accuse pas le succès (pas de "ok" en jeu) : on applique en optimiste.
		// En cas de refus, le "ko" renvoie le board pour resync (cf. onServerMessage).
		S.ws.send(JSON.stringify(action));
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
