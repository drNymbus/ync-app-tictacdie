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
			if (view === "signin") view = "browse"; // 1er "lobbies" = signin accepté
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

// --- Rendu (mise en forme minimale TEMP, à reprendre avec la maquette Pencil) ---
function render(errorMsg) {
	root.innerHTML = "";
	if (view === "signin") renderSignin();
	else if (view === "browse") renderBrowse();
	else if (view === "waiting") renderWaiting();
	if (errorMsg) {
		const err = document.createElement("div");
		err.textContent = "⚠ " + errorMsg;
		err.style.color = "#c33";
		root.appendChild(err);
	}
}

function renderSignin() {
	const input = el("input", { placeholder: "Ton pseudo" });
	const btn = el("button", { textContent: "Valider" });
	btn.addEventListener("click", () => onSignin(input.value.trim()));
	root.append(h2("Connexion"), input, btn);
}

function renderBrowse() {
	root.append(h2("Salons"));

	// Liste des salons disponibles
	if (lobbies.length === 0) {
		root.append(el("div", { textContent: "Aucun salon. Crée le tien." }));
	}
	lobbies.forEach((l) => {
		const line = el("div");
		line.textContent = `${l.id} (${l.players.join(", ") || "vide"}) `;
		const join = el("button", { textContent: "Rejoindre" });
		join.addEventListener("click", () => onJoin(l.id));
		line.appendChild(join);
		root.appendChild(line);
	});

	const refresh = el("button", { textContent: "Rafraîchir" });
	refresh.addEventListener("click", () => send({ type: "refresh" }));

	// Création
	const idInput = el("input", { placeholder: "Nom du salon" });
	const create = el("button", { textContent: "Créer" });
	create.addEventListener("click", () => onCreate(idInput.value.trim()));

	root.append(refresh, el("hr"), h2("Créer un salon"), idInput, create);
}

function renderWaiting() {
	root.append(
		h2("Salle d'attente"),
		el("div", { textContent: `Salon : ${currentLobby}` }),
		el("div", { textContent: myReady ? "Prêt — en attente de l'adversaire…" : "Clique sur Prêt quand tu es prêt." }),
	);
	const ready = el("button", { textContent: myReady ? "Annuler prêt" : "Prêt" });
	ready.addEventListener("click", () => onReady());
	const leave = el("button", { textContent: "Quitter" });
	leave.addEventListener("click", () => onLeave());
	root.append(ready, leave);
}

// --- Petits helpers DOM ---
function el(tag, props = {}) {
	const e = document.createElement(tag);
	Object.assign(e, props);
	return e;
}
function h2(text) {
	return el("h2", { textContent: text });
}
