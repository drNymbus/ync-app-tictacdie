// Protocole WebSocket — à aligner avec Victor :
//
// Client → Serveur :
//   { type: "set_pseudo",  pseudo: string }
//   { type: "create_room" }
//   { type: "join_room",   room_id: string }
//   { type: "ready" }
//   { type: "leave_room" }
//
// Serveur → Client :
//   { type: "pseudo_ok",      pseudo: string }
//   { type: "pseudo_error",   message: string }
//   { type: "rooms_update",   rooms: Array<{ id: string, players: string[] }> }
//   { type: "room_joined",    room_id: string, players: string[] }
//   { type: "player_joined",  pseudo: string }
//   { type: "player_left",    pseudo: string }
//   { type: "player_ready",   pseudo: string }
//   { type: "start",          symbol: "X" | "O" }
//   { type: "error",          message: string }

const WS_URL = "ws://localhost:8000"; // à ajuster selon Victor

// ─── État ────────────────────────────────────────────────────────────────────

let ws = null;
let myPseudo = null;
let currentRoomId = null;

// ─── DOM ─────────────────────────────────────────────────────────────────────

const pseudoInput    = document.getElementById("pseudo-input");
const btnSavePseudo  = document.getElementById("btn-save-pseudo");
const pseudoStatus   = document.getElementById("pseudo-status");

const lobbyMain      = document.getElementById("lobby-main");
const gamesList      = document.getElementById("games-list");
const createZone     = document.getElementById("create-zone");

const roomView       = document.getElementById("room-view");
const roomIdDisplay  = document.getElementById("room-id");
const btnCopyId      = document.getElementById("btn-copy-id");
const playersList    = document.getElementById("players-list");
const btnReady       = document.getElementById("btn-ready");
const btnLeaveRoom   = document.getElementById("btn-leave-room");

// ─── WebSocket ───────────────────────────────────────────────────────────────

function connect() {
  ws = new WebSocket(WS_URL);
  ws.addEventListener("message", onMessage);
  ws.addEventListener("close", () => setStatus("Connexion perdue."));
  ws.addEventListener("error", () => setStatus("Impossible de joindre le serveur."));
}

function send(data) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function onMessage(event) {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "pseudo_ok":
      myPseudo = msg.pseudo;
      setStatus(`Connecté en tant que ${myPseudo}`);
      break;

    case "pseudo_error":
      setStatus(msg.message);
      break;

    case "rooms_update":
      renderRoomsList(msg.rooms);
      break;

    case "room_joined":
      currentRoomId = msg.room_id;
      showRoomView(msg.room_id, msg.players);
      break;

    case "player_joined":
      addPlayer(msg.pseudo, false);
      break;

    case "player_left":
      removePlayer(msg.pseudo);
      break;

    case "player_ready":
      markReady(msg.pseudo);
      break;

    case "start": {
      const params = new URLSearchParams({
        room:     currentRoomId,
        symbol:   msg.symbol,
        pseudo:   myPseudo,
      });
      window.location.href = `game.html?${params}`;
      break;
    }

    case "error":
      setStatus(msg.message);
      break;
  }
}

// ─── Pseudo ──────────────────────────────────────────────────────────────────

btnSavePseudo.addEventListener("click", savePseudo);
pseudoInput.addEventListener("keydown", (e) => { if (e.key === "Enter") savePseudo(); });

function savePseudo() {
  const pseudo = pseudoInput.value.trim();
  if (!pseudo) return setStatus("Entre un pseudo.");
  send({ type: "set_pseudo", pseudo });
}

// ─── Liste des parties ───────────────────────────────────────────────────────

function renderRoomsList(rooms) {
  gamesList.innerHTML = "";
  if (rooms.length === 0) {
    gamesList.innerHTML = "<li class='empty'>Aucune partie en attente.</li>";
    return;
  }
  for (const room of rooms) {
    const li = document.createElement("li");
    li.textContent = `${room.players[0]} — ${room.players.length}/2 joueur(s)`;
    li.addEventListener("click", () => joinRoom(room.id));
    gamesList.appendChild(li);
  }
}

function joinRoom(roomId) {
  if (!myPseudo) return setStatus("Enregistre ton pseudo d'abord.");
  send({ type: "join_room", room_id: roomId });
}

// ─── Créer une partie ────────────────────────────────────────────────────────

createZone.addEventListener("click", createRoom);
createZone.addEventListener("keydown", (e) => { if (e.key === "Enter") createRoom(); });

function createRoom() {
  if (!myPseudo) return setStatus("Enregistre ton pseudo d'abord.");
  send({ type: "create_room" });
}

// ─── Vue salle d'attente ─────────────────────────────────────────────────────

function showRoomView(roomId, players) {
  lobbyMain.hidden = true;
  roomView.hidden = false;
  roomIdDisplay.textContent = roomId;
  playersList.innerHTML = "";
  for (const pseudo of players) addPlayer(pseudo, false);
}

function addPlayer(pseudo, ready) {
  const li = document.createElement("li");
  li.id = `player-${pseudo}`;
  li.dataset.pseudo = pseudo;
  li.textContent = pseudo;
  if (ready) li.dataset.ready = "true";
  playersList.appendChild(li);
}

function removePlayer(pseudo) {
  document.getElementById(`player-${pseudo}`)?.remove();
}

function markReady(pseudo) {
  const li = document.getElementById(`player-${pseudo}`);
  if (li) li.dataset.ready = "true";
}

btnCopyId.addEventListener("click", () => {
  navigator.clipboard.writeText(roomIdDisplay.textContent);
});

btnReady.addEventListener("click", () => {
  send({ type: "ready" });
  btnReady.disabled = true;
  markReady(myPseudo);
});

btnLeaveRoom.addEventListener("click", () => {
  send({ type: "leave_room" });
  currentRoomId = null;
  roomView.hidden = true;
  lobbyMain.hidden = false;
  btnReady.disabled = false;
});

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function setStatus(msg) {
  pseudoStatus.textContent = msg;
}

// ─── Init ────────────────────────────────────────────────────────────────────

connect();
