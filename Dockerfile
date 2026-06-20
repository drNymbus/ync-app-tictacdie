FROM denoland/deno:latest

WORKDIR /app

# Copy manifests first so the dependency install layer caches across
# source-only edits
COPY deno.json deno.lock package.json* ./
# Then copy the rest of the source
COPY . .

# Bundle tout le client TS (lobby.ts -> game.ts -> ses modules) en UN seul JS
# servi au navigateur (client/app.js). Réponse à "tout transpiler dans un fichier commun".
RUN deno bundle --platform browser client/lobby.ts -o client/app.js

# Pré-cache les dépendances du serveur.
RUN deno cache main.ts

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "main.ts"]
