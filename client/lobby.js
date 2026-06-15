// lobby.js — vue lobby (SPA).
// Créé par index.html : le WS unique est passé à init(ws). À la réception de "start",
// lobby fait son teardown puis passe la main à game.init(ws, startMsg).

import { init as gameInit } from "./game.js";

// --- État ---
let ws = null;
let view = "signin";   // "signin" | "browse" | "waiting"
let pending = null;    // action en attente d'un "ok" générique : "create" | "join" | "ready" | "leave"
let lobbies = [];      // LobbyView[] : {id, players[]}
let currentLobby = ""; // id du lobby créé/rejoint (affichage salle d'attente)
let myReady = false;

let root = null;

// --- Helpers ---
function send(obj) {
	ws.send(JSON.stringify(obj)); // le serveur attend du JSON (cf. protocol.ts)
}

// --- Cycle de vie ---
export function init(socket) {
	ws = socket;
	ws.onmessage = (e) => onMessage(JSON.parse(e.data));

	root = document.createElement("div");
	root.id = "lobby";
	document.getElementById("app").appendChild(root);

	view = "signin";
	render();
}

function teardown() {
	if (root) root.remove();
	root = null;
}

// --- Réseau ---
function onMessage(m) {
	switch (m.type) {
		case "lobbies":
			lobbies = m.lobbies ?? [];
			// "lobbies" = confirmation de signin (signin→browse) OU réponse implicite à leave (waiting→browse)
			if (view === "signin" || pending === "leave") {
				view = "browse";
				if (pending === "leave") { myReady = false; currentLobby = ""; }
				pending = null;
			}
			render();
			break;

		case "ok":
			handleOk();
			break;

		case "ko":
			console.warn("Lobby KO :", m.message);
			pending = null;
			render(m.message);
			break;

		case "start":
			// Handoff vers la vue de jeu : lobby disparaît, game prend le WS.
			teardown();
			gameInit(ws, m);
			break;

		case "closing":
			console.warn("Connexion fermée par le serveur");
			break;
	}
}

// Le serveur renvoie un "ok" générique : on s'appuie sur `pending` pour savoir quoi faire.
function handleOk() {
	switch (pending) {
		case "create":
		case "join":
			view = "waiting";
			myReady = false;
			break;
		case "ready":
			myReady = !myReady; // le serveur a togglé l'état
			break;
		case "leave":
			view = "browse";
			myReady = false;
			currentLobby = "";
			send({ type: "refresh" }); // rafraîchit la liste après être sorti
			break;
	}
	pending = null;
	render();
}

// --- Actions utilisateur ---
function onSignin(name) {
	if (!name) return;
	sessionStorage.setItem("nickname", name); // lu par game.js pour déduire myIndex
	send({ type: "signin", name });
}

function onCreate(id) {
	if (!id) return;
	currentLobby = id;
	pending = "create";
	send({ type: "create", id });
}

function onJoin(id) {
	if (!id) return;
	currentLobby = id;
	pending = "join";
	send({ type: "join", id });
}

function onReady() {
	pending = "ready";
	send({ type: "ready" });
}

function onLeave() {
	pending = "leave";
	send({ type: "leave" });
}

// --- Rendu (thème CRT Terminal, cf. lobby.css / maquette Pencil) ---
function render(errorMsg) {
	root.innerHTML = "";

	// Coquille commune : barre de statut + colonne centrée + pied de page.
	root.appendChild(statusBar());
	const wrap = el("div", { className: "crt-wrap" });
	const col = el("div", { className: "crt-col" });
	wrap.appendChild(col);
	root.appendChild(wrap);

	col.append(el("div", { className: "crt-title", textContent: "TIC_TAC_DIE" }), rule());

	if (view === "signin") renderSignin(col);
	else if (view === "browse") renderBrowse(col);
	else if (view === "waiting") renderWaiting(col);

	if (errorMsg) col.appendChild(el("div", { className: "crt-error", textContent: "// " + errorMsg }));

	col.append(rule(), footer());
}

function statusBar() {
	const bar = el("div", { className: "crt-statusbar" });
	bar.append(
		el("span", { className: "left", textContent: "TICTACDIE.EXE  [v1.0]" }),
		el("span", { className: "right", textContent: "● ONLINE" }),
	);
	return bar;
}

function footer() {
	const f = el("div", { className: "crt-footer" });
	f.append(
		el("span", { textContent: "SESSION: #8F2A91  ·  PING: 24ms" }),
		el("span", { textContent: "tictacdie // alpha" }),
	);
	return f;
}

function rule() {
	return el("div", { className: "crt-rule" });
}

// signin : connexion par pseudo.
function renderSignin(col) {
	const sec = section();
	sec.appendChild(el("div", { className: "crt-comment", textContent: "guest@arcade:~$ identifiez-vous_" }));

	const input = el("input", { className: "crt-input", placeholder: "Votre pseudo" });
	const submit = () => onSignin(input.value.trim());
	input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });

	const btn = el("button", { className: "crt-btn-primary", textContent: "> SE CONNECTER" });
	btn.addEventListener("click", submit);

	sec.append(input, btn);
	col.appendChild(sec);
}

// browse : créer une partie + rejoindre + liste des parties.
function renderBrowse(col) {
	// Création (input nom du salon + gros bouton vert)
	const createSec = section();
	const nameInput = el("input", { className: "crt-input", placeholder: "Nom du salon" });
	const createBtn = el("button", { className: "crt-btn-primary", textContent: "> CRÉER UNE PARTIE" });
	createBtn.addEventListener("click", () => onCreate(nameInput.value.trim()));
	createSec.append(nameInput, createBtn);
	col.append(createSec, rule());

	// Rejoindre par ID
	const joinSec = section();
	const joinRow = el("div", { className: "crt-join-row" });
	const idInput = el("input", { className: "crt-input", placeholder: "Enter Game ID" });
	const joinBtn = el("button", { className: "crt-btn-outline", textContent: "rejoindre" });
	joinBtn.addEventListener("click", () => onJoin(idInput.value.trim()));
	joinRow.append(idInput, joinBtn);
	joinSec.appendChild(joinRow);
	col.append(joinSec, rule());

	// Liste des parties en attente
	const listSec = section();
	listSec.appendChild(el("div", { className: "crt-meta", textContent: `PARTIES EN ATTENTE: ${lobbies.length}` }));
	listSec.appendChild(el("div", { className: "crt-comment", textContent: "# cliquez pour rejoindre" }));

	const games = el("div", { className: "crt-games" });
	if (lobbies.length === 0) {
		games.appendChild(el("div", { className: "crt-comment", textContent: "// aucune partie — créez la vôtre" }));
	}
	lobbies.forEach((l) => games.appendChild(gameRow(l)));
	listSec.appendChild(games);
	col.appendChild(listSec);
}

function gameRow(l) {
	const row = el("div", { className: "crt-game-row" });
	const info = el("div", { className: "info" });
	info.append(
		el("span", { className: "gid", textContent: `[${l.id}]` }),
		el("span", { className: "gname", textContent: l.players.join(", ") || "en attente" }),
	);
	const join = el("button", { className: "crt-join-small", textContent: "[ join ]" });
	join.addEventListener("click", () => onJoin(l.id));
	row.append(info, join);
	return row;
}

// waiting : salle d'attente avant le start.
function renderWaiting(col) {
	const sec = section();
	sec.append(
		el("div", { className: "crt-comment", textContent: "# salle d'attente" }),
		el("div", { className: "crt-meta", textContent: `SALON: ${currentLobby}` }),
		el("div", {
			className: "crt-meta",
			textContent: myReady ? "● PRÊT — en attente de l'adversaire…" : "○ en attente de votre confirmation",
		}),
	);

	const btnRow = el("div", { className: "crt-btn-row" });
	const ready = el("button", { className: "crt-btn-outline", textContent: myReady ? "annuler" : "prêt" });
	ready.addEventListener("click", () => onReady());
	const leave = el("button", { className: "crt-btn-outline", textContent: "quitter" });
	leave.addEventListener("click", () => onLeave());
	btnRow.append(ready, leave);
	sec.appendChild(btnRow);

	// DEBUG : lance la vue jeu sans adversaire (à retirer en prod)
	const debug = el("button", { className: "crt-debug", textContent: "⚙ lancer (solo debug)" });
	debug.addEventListener("click", () => {
		const name = sessionStorage.getItem("nickname") ?? "Joueur1";
		teardown();
		gameInit(ws, { type: "start", seed: 0, player1: name, player2: "Bot" });
	});
	sec.appendChild(debug);

	col.appendChild(sec);
}

// --- Petits helpers DOM ---
function el(tag, props = {}) {
	const e = document.createElement(tag);
	Object.assign(e, props);
	return e;
}
function section() {
	return el("div", { className: "crt-section" });
}
