// state.ts — état mutable partagé de la vue de partie.
// Objet unique à référence stable, lu/écrit par tous les modules : contourne
// l'impossibilité de réassigner un binding ESM importé d'un fichier à l'autre.
// (on mute S.x, on ne réassigne jamais S lui-même)
export const S = {
	ws: null,                  // WebSocket | null
	game: null,                // instance Game (shared/tictacdie.ts) : logique + board autoritatifs côté client
	board: [],                 // Cell[][] courant (= S.game.board)
	myIndex: 0,                // 1 | 2
	mySymbol: "",              // "X" | "O"
	oppSymbol: "",
	myName: "",
	oppName: "",
	myTurn: false,
	myJokers: [],              // 4 jokers tirés via la seed
	usedJokers: [],            // parallèle à myJokers : true = joker déjà consommé (usage unique)
	pendingJokerIndex: null,   // index du joker consommé en optimiste (rollback sur ko)
	selectedJokerIndex: null,  // index du joker sélectionné dans myJokers
	jokerEls: [],              // cartes jokers persistantes [{card, img, base}]
	handCards: [],             // éléments .card des jokers (calcul de l'éventail)
	hoverIndex: null,          // index de la carte survolée
	symCardEl: null,           // jeton symbole (hors de la main)
	symbolSelected: false,     // true si la 5e carte (pose de symbole) est sélectionnée
	flow: null,                // état du sous-flux multi-étapes en cours
	pendingAction: null,       // dernière action envoyée (rollback éventuel sur ko)
	gameOverResult: null,      // null tant que la partie n'est pas finie ; 0/1/2 ensuite
	soloDebug: false,          // true si lancé via le bouton solo debug (pas de serveur)
	onExit: null,              // callback fourni par le lobby pour le reconstruire à la fin
	gameOverTimer: null,       // timer du fondu de fin -> lobby
	root: null,                // racine DOM de la vue game
};
