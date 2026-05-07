FROM elixir:1.18-alpine AS build

WORKDIR /app

RUN apk add --no-cache build-base git

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV=prod

COPY mix.exs mix.lock ./
RUN mix deps.get --only prod
RUN mix deps.compile

COPY config config
COPY lib lib
COPY priv priv

RUN mix compile
RUN mix release

# ── runtime ───────────────────────────────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache libstdc++ openssl ncurses-libs

WORKDIR /app

COPY --from=build /app/_build/prod/rel/sagals ./

ENV PHX_SERVER=true

EXPOSE 4000

CMD ["/bin/sh", "-c", "/app/bin/sagals eval 'Sagals.Release.migrate()' && /app/bin/sagals start"]
