// net.ts — réception des messages serveur + résync autoritatif + écrans de fin.
import { S } from "./state.ts";
import { DEBUG_ALL_JOKERS, END_ANIM_MS } from "./config.ts";
import { applyLocalTEMP, localTick } from "./logic.ts";
import { renderAll, setTurn } from "./render.ts";
import { resetSelection } from "./interactions.ts";

// Resync autoritatif depuis un message serveur portant turn + p1/p2 (cf. "ko" enrichi, protocol.ts).
// Remplace l'heuristique "la main me revient" + le rollback optimiste du joker par l'état réel serveur.
function syncFromServer(m) {
	// Tour : joueur actif côté serveur = 1 - turn%2 (cf. Game.action) ; mon index serveur = myIndex-1.
	if (typeof m.turn === "number") S.myTurn = (S.myIndex - 1) === (1 - m.turn % 2);
	else S.myTurn = true; // repli : pas de turn dans le message → la main me revient

	// Jokers : la liste serveur (p1/p2) ne contient que les jokers ENCORE disponibles → autoritatif.
	// Ignoré en DEBUG_ALL_JOKERS : le client a les 7 jokers, le serveur seulement les 4 de la seed,
	// donc un resync marquerait à tort les 3 hors-seed comme consommés. On garde alors le rollback optimiste.
	const mine = (S.myIndex === 1) ? m.p1 : m.p2;
	if (!DEBUG_ALL_JOKERS && mine && Array.isArray(mine.jokers)) {
		const remaining = [...mine.jokers];
		S.usedJokers = S.myJokers.map((j) => {
			const k = remaining.indexOf(j);
			if (k === -1) return true;   // absent de la liste serveur → consommé
			remaining.splice(k, 1);      // consomme l'occurrence (gère d'éventuels doublons)
			return false;
		});
	} else if (S.pendingJokerIndex !== null) {
		S.usedJokers[S.pendingJokerIndex] = false; // repli (debug / message sans p1-p2) : rollback optimiste
	}
	S.pendingJokerIndex = null;
}

// Messages serveur (cf. handler.ts) : "action" (coup adverse), "ko" (refus + board + turn/p1/p2),
// "gameover" (result, -1 = pas fini), "closing" (fermeture serveur).
export function onServerMessage(m) {
	switch (m.type) {
		case "ok":
			S.pendingJokerIndex = null; // action acceptée : la consommation du joker est confirmée
			break;

		case "action":
			// Coup de l'adversaire transmis tel quel : on l'applique, puis c'est à moi.
			applyLocalTEMP(m);
			localTick();
			setTurn(true);
			renderAll();
			break;

		case "ko":
			// Action refusée : resync autoritatif. On réaligne l'instance Game sur l'état serveur
			// (board + tour + jokers) pour que les poses optimistes suivantes repartent du bon état.
			if (m.board) S.game.board = m.board;
			if (typeof m.turn === "number") S.game.turn = m.turn;
			if (m.p1) S.game.p1 = m.p1;
			if (m.p2) S.game.p2 = m.p2;
			S.board = S.game.board;
			syncFromServer(m); // tour + jokers de l'UI (remplace setTurn(true) + rollback optimiste)
			console.warn("Action refusée :", m.message);
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

export function showGameOver(result) {
	S.gameOverResult = result;
	S.myTurn = false;
	resetSelection(); // coupe toute interaction en cours
	renderAll();
	// Quand l'animation de fin se termine (ou après un délai pour le match nul) : fondu -> lobby.
	clearTimeout(S.gameOverTimer);
	S.gameOverTimer = setTimeout(exitToLobby, result === 0 ? 2500 : END_ANIM_MS);
}

// Fondu plein écran du jeu, révélant le lobby reconstruit derrière (miroir du fondu lobby -> game).
function exitToLobby() {
	if (!S.root) return;
	if (S.onExit) S.onExit(); // reconstruit le lobby derrière le jeu
	const leaving = S.root;
	S.root = null;
	leaving.classList.add("leaving");
	requestAnimationFrame(() => requestAnimationFrame(() => leaving.classList.add("fade-out")));
	setTimeout(() => leaving.remove(), 2100);
}
