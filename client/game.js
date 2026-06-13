// Protocole WebSocket — à aligner avec Victor :
//
// Client → Serveur :
//   { type: "action", card, x, y, opt1, opt2, opt3 }
//
// Serveur → Client :
//   { type: "action_ok",    card, x, y, opt1, opt2, opt3 }  — diffusé aux deux joueurs
//   { type: "action_error", message }                         — seulement à l'expéditeur
//   { type: "your_turn" }                                     — au joueur qui doit jouer
//   { type: "game_over",    winner: string | null }           — aux deux joueurs (null = nul)

const WS_URL = "ws://localhost:8000";

// ─── Paramètres URL (passés depuis lobby.html) ───────────────────────────────

const params   = new URLSearchParams(window.location.search);
const mySymbol = params.get("symbol"); // "X" ou "O"
const myPseudo = params.get("pseudo");
const roomId   = params.get("room");

// ─── État ────────────────────────────────────────────────────────────────────

let ws          = null;
let myTurn      = false;
let boardSize   = 3;
let board       = makeBoard(boardSize);
let activeJoker = null; // joker actuellement sélectionné
let trapPhase   = null; // { x, y } mémorisé pendant le 2e clic du trap
let invertAxis  = 0;    // 0 = row, 1 = col (toggle dans le prompt invert)

const usedJokers = new Set();

const JOKER_PROMPTS = {
    symbol:   "Clique une case pour poser ton symbole.",
    bomb:     "Clique la case à bombarder.",
    immunity: "Clique la case à immuniser.",
    virus:    "Clique la case où poser le virus.",
    ttt:      "Clique une case pour lancer le sous-jeu.",
    trap:     "Clique la case où poser le piège.",
    invert:   "Clique une case de la ligne à inverser.",
    resize:   "Choisis un coin pour agrandir le plateau.",
    nomad:    "Clique une case en bordure pour le voyageur.",
};

// ─── DOM ─────────────────────────────────────────────────────────────────────

const boardEl        = document.getElementById("board");
const jokerListEl    = document.getElementById("joker-list");
const jokerPromptEl  = document.getElementById("joker-prompt");
const jokerPromptTxt = document.getElementById("joker-prompt-text");
const jokerCancelBtn = document.getElementById("joker-cancel");
const turnIndicator  = document.getElementById("current-player");
const mySymbolEl     = document.getElementById("my-symbol");
const resultOverlay  = document.getElementById("result-overlay");
const resultMsg      = document.getElementById("result-message");
const btnBackLobby   = document.getElementById("btn-back-lobby");

// ─── WebSocket ───────────────────────────────────────────────────────────────

function connect() {
    ws = new WebSocket(`${WS_URL}?room=${roomId}&pseudo=${myPseudo}`);
    ws.addEventListener("message", onMessage);
    ws.addEventListener("close", () => setTurnLabel("Connexion perdue."));
}

function send(data) {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function onMessage(event) {
    const msg = JSON.parse(event.data);
    switch (msg.type) {
        case "your_turn":
            setMyTurn(true);
            break;
        case "action_ok":
            applyAction(msg);
            break;
        case "action_error":
            showPrompt(msg.message);
            setMyTurn(true); // action invalide → le joueur rejoue
            break;
        case "game_over":
            showGameOver(msg.winner);
            break;
    }
}

// ─── Application locale des actions confirmées ───────────────────────────────
// Miroir des fonctions de tictacdie.ts — le client reconstruit son état depuis les deltas.

function applyAction(msg) {
    const { card, x, y, opt1, opt2, opt3 } = msg;
    switch (card) {
        case "symbol":
            board[y][x] = opt3; // "X" ou "O"
            break;
        case "bomb":
            applyBombLocal(x, y);
            break;
        case "invert":
            applyInvertLocal(x, y); // x = axis, y = index
            break;
        case "resize":
            applyResizeLocal(x === 1, y === 1, opt1 === 1, opt2 === 1); // top, bottom, left, right
            break;
        case "trap":
            board[y][x] = { newx: opt1, newy: opt2 };
            break;
        case "immunity":
            board[y][x] = { cooldown: 2, content: board[y][x] };
            break;
        // virus, nomad, ttt : à compléter quand ces jokers seront finalisés
    }
    applyTickLocal();
    renderBoard();
}

function applyBombLocal(cx, cy) {
    const cross = [[0,0],[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dy, dx] of cross) {
        const ny = cy + dy, nx = cx + dx;
        if (ny < 0 || ny >= boardSize || nx < 0 || nx >= boardSize) continue;
        const cell = board[ny][nx];
        if (typeof cell === "object" && cell !== null && "cooldown" in cell) continue;
        board[ny][nx] = "";
    }
}

function applyInvertLocal(axis, index) {
    if (axis === 0) {
        board[index] = board[index].map(flipCell);
    } else {
        for (let r = 0; r < boardSize; r++) board[r][index] = flipCell(board[r][index]);
    }
}

function flipCell(cell) {
    if (cell === "X") return "O";
    if (cell === "O") return "X";
    return cell;
}

function applyResizeLocal(top, bottom, left, right) {
    if (!(top || bottom) || !(left || right)) return;
    const ro = top ? 1 : 0, co = left ? 1 : 0;
    const newSize = boardSize + 1;
    const newBoard = makeBoard(newSize);
    for (let r = 0; r < boardSize; r++)
        for (let c = 0; c < boardSize; c++)
            newBoard[r + ro][c + co] = board[r][c];
    board = newBoard;
    boardSize = newSize;
}

function applyTickLocal() {
    // Nettoyage caduc des pièges (miroir de tick() dans tictacdie.ts)
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const cell = board[y][x];
            if (typeof cell === "object" && cell !== null && "newx" in cell) {
                if (board[cell.newy]?.[cell.newx] !== "") board[y][x] = "";
            }
        }
    }
}

// ─── Rendu du board ──────────────────────────────────────────────────────────

function makeBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(""));
}

function renderBoard() {
    boardEl.style.setProperty("--board-size", boardSize);
    boardEl.innerHTML = "";
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.textContent = cellLabel(board[y][x]);
            setCellAttr(cell, board[y][x]);
            cell.addEventListener("click", () => onCellClick(x, y));
            boardEl.appendChild(cell);
        }
    }
}

function cellLabel(cell) {
    if (!cell || cell === "") return "";
    if (cell === "X" || cell === "O") return cell;
    if (typeof cell !== "object") return "";
    if ("dirx" in cell) return cell.content;             // Nomad
    if ("cooldown" in cell) return cell.content || "";   // Immunity : affiche le symbole protégé
    if ("newx" in cell) return "";                       // Trap : invisible
    if ("content" in cell) return "?";                   // Virus
    return "";                                           // TTT
}

function setCellAttr(el, cell) {
    if (typeof cell !== "object" || cell === null) return;
    if ("cooldown" in cell) el.dataset.type = "immunity";
    else if ("newx"    in cell) el.dataset.type = "trap";
    else if ("dirx"    in cell) el.dataset.type = "nomad";
    else if ("content" in cell) el.dataset.type = "virus";
    else if (Object.keys(cell).length === 0) el.dataset.type = "ttt";
}

// ─── Clics sur le board ──────────────────────────────────────────────────────

function onCellClick(x, y) {
    if (!myTurn) return;

    if (!activeJoker) {
        sendAction("symbol", x, y, 0, 0, mySymbol);
        return;
    }

    switch (activeJoker) {
        case "symbol":
            sendAction("symbol", x, y, 0, 0, mySymbol);
            cancelJoker();
            break;

        case "bomb":
        case "immunity":
        case "virus":
        case "ttt":
            sendAction(activeJoker, x, y, 0, 0, "");
            cancelJoker();
            break;

        case "invert":
            // x = axis (inversAxis), y = index de la ligne/colonne cliquée
            sendAction("invert", invertAxis, invertAxis === 0 ? y : x, 0, 0, "");
            cancelJoker();
            break;

        case "trap":
            if (!trapPhase) {
                trapPhase = { x, y };
                showPrompt("Clique maintenant la case de redirection.");
            } else {
                sendAction("trap", trapPhase.x, trapPhase.y, x, y, "");
                trapPhase = null;
                cancelJoker();
            }
            break;

        case "nomad":
            // TODO : sélection de direction après le clic de case (à implémenter)
            break;
    }
}

// ─── Envoi d'une action ──────────────────────────────────────────────────────

function sendAction(card, x, y, opt1, opt2, opt3) {
    send({ type: "action", card, x, y, opt1, opt2, opt3 });
    setMyTurn(false);
}

// ─── Jokers ──────────────────────────────────────────────────────────────────

const ALL_JOKERS = ["symbol", "invert", "resize", "bomb", "trap", "immunity", "nomad", "virus", "ttt"];

function renderJokers() {
    jokerListEl.innerHTML = "";
    for (const joker of ALL_JOKERS) {
        const btn = document.createElement("button");
        btn.textContent = joker;
        btn.dataset.joker = joker;
        btn.disabled = usedJokers.has(joker);
        btn.addEventListener("click", () => selectJoker(joker));
        jokerListEl.appendChild(btn);
    }
}

function selectJoker(joker) {
    if (!myTurn || usedJokers.has(joker)) return;
    activeJoker = joker;
    trapPhase = null;
    invertAxis = 0;

    if (joker === "resize") {
        showResizePicker();
        return;
    }

    showPrompt(JOKER_PROMPTS[joker] ?? "");

    if (joker === "invert") {
        // bouton toggle row/col
        const toggle = document.createElement("button");
        toggle.id = "invert-toggle";
        toggle.textContent = "Basculer → Colonne";
        toggle.addEventListener("click", () => {
            invertAxis = invertAxis === 0 ? 1 : 0;
            toggle.textContent = invertAxis === 0 ? "Basculer → Colonne" : "Basculer → Ligne";
            showPrompt(invertAxis === 0
                ? "Clique une case de la ligne à inverser."
                : "Clique une case de la colonne à inverser.");
            jokerPromptEl.appendChild(toggle);
        });
        jokerPromptEl.appendChild(toggle);
    }
}

function showResizePicker() {
    jokerPromptEl.hidden = false;
    jokerPromptTxt.textContent = "Choisis un coin :";
    const corners = [
        { label: "↖ Haut-gauche",  top: 1, bottom: 0, left: 1, right: 0 },
        { label: "↗ Haut-droit",   top: 1, bottom: 0, left: 0, right: 1 },
        { label: "↙ Bas-gauche",   top: 0, bottom: 1, left: 1, right: 0 },
        { label: "↘ Bas-droit",    top: 0, bottom: 1, left: 0, right: 1 },
    ];
    for (const c of corners) {
        const btn = document.createElement("button");
        btn.textContent = c.label;
        btn.addEventListener("click", () => {
            sendAction("resize", c.top, c.bottom, c.left, c.right, "");
            cancelJoker();
        });
        jokerPromptEl.appendChild(btn);
    }
}

function cancelJoker() {
    activeJoker = null;
    trapPhase = null;
    invertAxis = 0;
    jokerPromptEl.hidden = true;
    jokerPromptTxt.textContent = "";
    // supprime les boutons dynamiques du prompt
    jokerPromptEl.querySelectorAll("button:not(#joker-cancel)").forEach(b => b.remove());
}

jokerCancelBtn.addEventListener("click", cancelJoker);

// ─── UI helpers ──────────────────────────────────────────────────────────────

function setMyTurn(val) {
    myTurn = val;
    setTurnLabel(val ? myPseudo : "adversaire");
    boardEl.classList.toggle("my-turn", val);
}

function setTurnLabel(text) {
    turnIndicator.textContent = text;
}

function showPrompt(text) {
    jokerPromptTxt.textContent = text;
    jokerPromptEl.hidden = false;
}

function showGameOver(winner) {
    resultMsg.textContent = winner
        ? `${winner} remporte la partie !`
        : "Match nul !";
    resultOverlay.hidden = false;
}

btnBackLobby.addEventListener("click", () => {
    window.location.href = "lobby.html";
});

// ─── Init ────────────────────────────────────────────────────────────────────

mySymbolEl.textContent = mySymbol;
renderBoard();
renderJokers();
connect();
