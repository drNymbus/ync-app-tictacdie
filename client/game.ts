// game.ts — vue de partie (SPA), point d'entrée appelé par lobby.ts.
// Pilotée par lobby.ts : à la réception de "start", lobby.ts appelle init(ws, startMsg).
//
// Le code est découpé en modules :
//   state.ts        état mutable partagé (objet S, dont l'instance Game)
//   config.ts       constantes (debug, jokers) + chemins d'assets
//   dom.ts          helper de création d'élément
//   anim.ts         animations d'effet (bombe/virus/immunité/invert)
//   logic.ts        application des actions + tick, délégués à l'instance Game partagée
//   render.ts       rendu DOM
//   interactions.ts sélection de carte + sous-flux + envoi d'action
//   net.ts          messages serveur + resync + écrans de fin
//
// La logique de jeu et la dérivation seed viennent directement de shared/ (résolu par le
// bundle Deno) : plus aucune duplication côté client.
import { S } from "./state.ts";
import { Game } from "../shared/tictacdie.ts";
import { DEBUG_ALL_JOKERS, ALL_JOKERS } from "./config.ts";
import { el } from "./dom.ts";
import { renderAll } from "./render.ts";
import { onServerMessage, showGameOver } from "./net.ts";

// --- Cycle de vie ---
export function init(socket, startMsg, exitCb) {
	S.ws = socket;
	S.onExit = exitCb || null;

	// Identité : matching pseudo <-> player1/player2 (cf. protocol.ts)
	S.soloDebug = startMsg.debug === true;
	S.myName = sessionStorage.getItem("nickname") ?? "";
	S.myIndex = (S.myName === startMsg.player1) ? 1 : 2;
	S.oppName = (S.myIndex === 1) ? startMsg.player2 : startMsg.player1;

	// Instance Game seedée (identique au serveur) : board + tour + jokers autoritatifs côté client.
	S.game = new Game(startMsg.seed, startMsg.player1, startMsg.player2);
	S.mySymbol = S.myIndex === 1 ? "X" : "O"; // p1 = X, p2 = O (cf. Game.constructor)
	S.oppSymbol = S.mySymbol === "X" ? "O" : "X";
	// joueur actif (0-based) = 1 - turn%2 ; mon index 0-based = myIndex - 1
	S.myTurn = S.soloDebug ? true : (S.myIndex - 1) === (1 - S.game.turn % 2);
	// p1.jokers et p2.jokers sont identiques (même tirage seed) ; en debug, on force les 7.
	S.myJokers = DEBUG_ALL_JOKERS ? [...ALL_JOKERS] : [...S.game.p1.jokers];
	S.usedJokers = S.myJokers.map(() => false); // aucun joker consommé au départ

	S.board = S.game.board;

	buildLayout();
	renderAll();

	// Réseau : le serveur envoie du JSON (cf. handler.ts). ws peut être null en bootstrap local.
	if (S.ws) S.ws.onmessage = (e) => onServerMessage(JSON.parse(e.data));
}

export function teardown() {
	if (S.root) S.root.remove();
	S.root = null;
}

// --- Construction du layout (une seule fois) ---
// Structure thème CRT (cf. game.css / maquette "Game — Fullscreen").
function buildLayout() {
	S.jokerEls = [];      // réinitialise les cartes persistantes (nouvelle partie)
	S.symCardEl = null;
	S.root = document.createElement("div");
	S.root.id = "game";
	S.root.classList.add("intro"); // chorégraphie d'entrée (cf. game.css)
	S.root.innerHTML = `
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
	document.getElementById("app").appendChild(S.root);

	// L'autoplay n'est pas fiable sur une <video> insérée via innerHTML : on force la lecture.
	const bg = S.root.querySelector(".bg-video");
	if (bg) bg.play().catch(() => {});

	// Retire la classe d'intro une fois toutes les animations terminées (cartes : 4,2s + 4s).
	setTimeout(() => { if (S.root) S.root.classList.remove("intro"); }, 8500);

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
		mk("Victoire", () => showGameOver(S.myIndex)),
		mk("Défaite", () => showGameOver(S.myIndex === 1 ? 2 : 1)),
		mk("Nul", () => showGameOver(0)),
		mk("Fermer", () => { clearTimeout(S.gameOverTimer); S.gameOverResult = null; if (S.root) renderAll(); }),
	);
	S.root.appendChild(panel);
}
