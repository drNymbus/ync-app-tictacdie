FROM denoland/deno:latest

WORKDIR /app

# Copy manifests first so the dependency install layer caches across
# source-only edits
COPY deno.json deno.lock package.json* ./
# Then copy the rest of the source
COPY . .

RUN deno transpile shared/protocol.ts
RUN deno transpile shared/random.ts
RUN deno transpile shared/tictacdie.ts

RUN deno ci --prod --skip-types

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "main.ts"]
