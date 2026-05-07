# Sagals Llista

Gestió d'assistència als busos dels Sagals d'Osona. L'admin crea events i busos, importa participants des d'un Excel i activa la llista. Els apuntadors marquen l'assistència en temps real des del mòbil amb un codi QR.

## Stack

| Capa | Tecnologia |
|------|-----------|
| Backend | Elixir / Phoenix (API JSON + WebSockets) |
| Base de dades | PostgreSQL |
| Frontend | React + TypeScript + Vite + Tailwind |
| Web server | Caddy (dins Docker) |
| Fotos / noms | API Tenimaleta |

---

## Desenvolupament local

### Requisits

- Elixir 1.18+ i Erlang/OTP 27+
- Node.js 22+
- PostgreSQL 16 (o Docker per aixecar-lo)

### Base de dades

```bash
# Amb Docker (recomanat per no instal·lar Postgres localment)
docker run -d --name sagals-db \
  -e POSTGRES_USER=sagals \
  -e POSTGRES_PASSWORD=sagals \
  -e POSTGRES_DB=sagals_dev \
  -p 5432:5432 \
  postgres:16-alpine
```

### Backend

```bash
cd backend
mix deps.get
mix ecto.create && mix ecto.migrate
mix phx.server        # arrenca a http://localhost:4000
```

Per crear un usuari de prova:

```bash
mix run -e 'Sagals.Accounts.create_user(%{email: "admin@sagals.cat", password: "sagals123"})'
```

### Frontend

```bash
cd frontend
npm install
npm run dev           # arrenca a http://localhost:5173
```

La variable `VITE_API_URL` per defecte és `http://localhost:4000` en dev. No cal configurar res.

### Tests

```bash
# Backend
cd backend && mix test

# Frontend
cd frontend && npm test          # mode watch
cd frontend && npm run test:run  # una sola passada (CI)
```

---

## Desplegament

### Requisits al servidor

- Docker i Docker Compose
- Caddy instal·lat a nivell de host (gestiona HTTPS i actua de reverse proxy)

### Configuració inicial

**1. Copia el codi al servidor:**

```bash
git clone <repo> /opt/sagals-llista
cd /opt/sagals-llista
```

**2. Crea el fitxer `.env` a partir de l'exemple:**

```bash
cp .env.example .env
```

Edita `.env`:

```env
DB_PASSWORD=una_contrasenya_segura
SECRET_KEY_BASE=genera_amb_mix_phx_gen_secret   # veure més avall
TENIMALETA_API_KEY=453dabb4-7645-4626-a1bb-477dff3aa557
```

Per generar `SECRET_KEY_BASE` (necessites Elixir al servidor o localment):

```bash
mix phx.gen.secret
```

**3. Configura Caddy al host** (`/etc/caddy/Caddyfile` o equivalent):

```
sagals.exemple.com {
    reverse_proxy localhost:8080
}
```

Recarrega Caddy:

```bash
caddy reload --config /etc/caddy/Caddyfile
```

**4. Arrenca els contenidors:**

```bash
docker compose up -d --build
```

Això:
- Aixeca PostgreSQL
- Compila i arrenca el backend Phoenix (i executa les migracions automàticament)
- Compila el frontend i l'aixeca amb Caddy al port 8080

**5. Crea el primer usuari admin:**

```bash
docker compose exec backend /app/bin/sagals eval \
  'Sagals.Release.create_user("admin@sagals.cat", "contrasenya_segura")'
```

---

## Actualitzar a una nova versió

```bash
git pull
docker compose up -d --build
```

Les migracions s'executen automàticament en arrencar el backend.

---

## Gestió d'usuaris

Tots els usuaris registrats tenen accés admin. No hi ha registre públic: els usuaris només es poden crear des del servidor.

```bash
# Llistar usuaris
docker compose exec backend /app/bin/sagals eval 'Sagals.Release.list_users()'

# Crear usuari
docker compose exec backend /app/bin/sagals eval \
  'Sagals.Release.create_user("nom@exemple.com", "contrasenya")'

# Canviar contrasenya
docker compose exec backend /app/bin/sagals eval \
  'Sagals.Release.update_password("nom@exemple.com", "nova_contrasenya")'

# Eliminar usuari
docker compose exec backend /app/bin/sagals eval \
  'Sagals.Release.delete_user("nom@exemple.com")'
```

---

## Logs i monitoratge

```bash
# Logs de tots els serveis
docker compose logs -f

# Logs només del backend
docker compose logs -f backend

# Estat dels contenidors
docker compose ps
```

---

## Estructura del projecte

```
sagals-llista/
├── backend/          # API Phoenix (Elixir)
│   ├── lib/
│   │   ├── sagals/           # lògica de negoci (contextos, esquemes)
│   │   └── sagals_web/       # controladors, router, plugs
│   ├── priv/repo/migrations/ # migracions de base de dades
│   └── Dockerfile
├── frontend/         # SPA React
│   ├── src/
│   │   ├── pages/    # pàgines principals
│   │   ├── components/
│   │   └── lib/      # socket, api client
│   └── Dockerfile
├── Caddyfile         # configuració Caddy dins Docker
├── docker-compose.yml
└── .env.example
```

---

## Variables d'entorn

| Variable | Descripció |
|----------|-----------|
| `DB_DATA_PATH` | Ruta on es guarden les dades de PostgreSQL (per defecte `./data/postgres`) |
| `DB_PASSWORD` | Contrasenya de PostgreSQL |
| `SECRET_KEY_BASE` | Clau secreta Phoenix (64+ caràcters) |
| `TENIMALETA_API_KEY` | Clau API per fotos i noms de castelleres |

---

## Solució de problemes

**El backend no arrenca:**
```bash
docker compose logs backend
```
Causa habitual: `DATABASE_URL` incorrecte o la base de dades encara no està llesta.

**Error de migració:**
```bash
docker compose exec backend /app/bin/sagals eval 'Sagals.Release.migrate()'
```

**Caddy del host no enruta bé:**
Comprova que el port 8080 és accessible: `curl http://localhost:8080`.

**Reconstruir des de zero:**
```bash
docker compose down -v   # elimina també els volums (perd les dades!)
docker compose up -d --build
```
