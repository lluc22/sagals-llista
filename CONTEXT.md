# Sagals Llista — Document de Context i Arquitectura

## Domini del problema

Els **Sagals d'Osona** és una colla castellera. Quan fan actuacions fora, organitzen busos per als membres. Prèviament a l'actuació, els castellers responen un Google Form indicant si venen amb bus o amb transport propi.

El formulari genera un Excel amb columnes tipus:
- Nom, Cognom, Segon cognom, Sobrenom
- Transport (valors lliures: "Autobus anada i tornada post actuació", "Vaig amb el meu propi transport", etc.)
- Dinar, Aspectes a tenir en compte, Acompanyants (columnes secundàries)

**El problema:** Quan arriba el dia de l'actuació, cal passar llista als busos. Avui es fa manualment, en paper o amb l'Excel, amb tots els problemes que comporta (qui té la llista? s'ha actualitzat?). A més, si hi ha múltiples busos i/o tornades a hores diferents, la gestió es complica.

---

## Requisits funcionals

### Flux d'administració (preparació prèvia)

1. **Crear un event** amb nom i data
2. **Configurar busos**: quants busos hi ha, etiqueta de cada bus (p.ex. "Bus 1 - 8:00h"), hora de sortida, direcció (`anada` / `tornada` / `anada i tornada`)
3. **Importar Excel** del Google Forms
4. **Mapejar columnes**: el sistema intenta detectar automàticament quines columnes són nom, cognoms, sobrenom i transport. L'admin pot corregir el mapatge manualment
5. **Mapejar valors de transport**: per cada valor únic detectat a la columna transport, l'admin indica:
   - Va amb bus? Sí / No
   - Si sí: quin bus? (si n'hi ha més d'un) i quina direcció (anada / tornada / ambdues)
6. **Generar link** únic i compartible per passar llista

### Flux de passar llista (dia de l'actuació)

- Accés via link únic, sense login, mobile-friendly
- Es pot passar llista per a cada **viatge** per separat (anada bus 1, tornada bus 1, tornada bus 2, etc.)
- Vista de llista amb cerca ràpida per nom/sobrenom
- Marcar cada persona: `present` / `absent` / `pendent` (per defecte)
- Comptador en temps real: `X / N persones (XX%)`
- **Multiusuari simultani**: diverses persones poden passar llista alhora i veuen els canvis dels altres en temps real
- Possibilitat de veure tota la llista d'un bus (anada + tornada) en una sola pantalla

### Opcionals / fase 2

- Export de la llista final (qui ha vingut, qui no)
- Notificació si algú marca "no vinc" a última hora
- Vista resum per l'organitzador (tots els busos d'un cop d'ull)

---

## Requisits no funcionals

- **Self-hosted**: tota la infraestructura és pròpia, sense dependències de serveis externs de pagament
- **Mobile-first**: la interfície de passar llista s'usa principalment des del mòbil
- **Real-time**: canvis visibles instantàniament a tots els dispositius connectats
- **Accés per link per als passadors de llista**: el link únic conté un token d'accés; el backend valida via JWT estàndard
- **Robustesa offline-light**: si es perd connexió momentàniament, no es perd l'estat

---

## Arquitectura

### Stack tecnològic

| Capa | Tecnologia | Motiu |
|---|---|---|
| Backend | **Go + PocketBase com a library** | Lògica de negoci en Go tipat; PocketBase aporta SQLite, SSE real-time, REST API i Admin UI |
| DB + Real-time + API | **PocketBase** (embedded) | Built-in, zero configuració addicional |
| Frontend | **React + Vite + TypeScript** | Ecosistema modern, component-based, ideal per UI reactiva |
| Estils | **Tailwind CSS** | Mobile-first ràpid, utilitats atòmiques |
| Parsing Excel | **SheetJS (xlsx)** al frontend | Client-side, no cal endpoint de servidor |
| Comunicació real-time | **PocketBase SSE** (subscripcions a col·leccions) | Built-in, no cal configuració addicional |
| Tests backend | **`go test`** | Estàndard de Go |
| Tests frontend | **Vitest** | Natiu de Vite |

### Diagrama d'arquitectura

```
┌─────────────────────────────────────────┐
│              VPS / Servidor              │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │         PocketBase binary          │  │
│  │  ┌──────────┐  ┌────────────────┐  │  │
│  │  │ REST API │  │  SSE real-time │  │  │
│  │  └──────────┘  └────────────────┘  │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │        SQLite (data.db)      │  │  │
│  │  └──────────────────────────────┘  │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │    /pb_public (React build)  │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
         ↑↓ HTTPS (Nginx o PocketBase built-in)

┌──────────┐    ┌──────────┐    ┌──────────┐
│  Mòbil A │    │  Mòbil B │    │ Admin PC │
│ (llista) │    │ (llista) │    │  (setup) │
└──────────┘    └──────────┘    └──────────┘
```

> PocketBase pot servir els fitxers estàtics del build de React directament des de `pb_public/`. Això significa **un sol procés, un sol port**.

### Autenticació i autorització

#### Dos rols diferenciats

| Rol | Accés | Mecanisme |
|---|---|---|
| **Admin** | Crea events, importa Excel, configura busos | Email + password → JWT (col·lecció `users` de PocketBase) |
| **Passador de llista** | Marca assistència el dia de l'actuació | Link únic → autenticació automàtica → JWT |

#### Col·lecció `list_access` (auth collection)

Un registre per event, creat automàticament quan l'admin activa l'event:

| Camp | Valor |
|---|---|
| `username` | `eventSlug` (p.ex. `festa-major-vic-2025`) |
| `password` | Token aleatori generat (p.ex. `x7k2m9p4q...`) |
| `event` | Relació → `events` |

**Flow d'accés per link:**

```
Link = /list/festa-major-vic-2025/x7k2m9p4q...
    ↓
Frontend extreu slug + token de la URL
    ↓
pb.collection('list_access').authWithPassword("festa-major-vic-2025@sagals.local", token)
    ↓
PocketBase retorna JWT estàndard (Bearer token)
    ↓
Totes les peticions porten Authorization: Bearer <jwt>
    ↓
Regla attendance: @request.auth != null
         + @request.auth.event = participant.event
```

> **Detall d'implementació:** PocketBase auth collections requereixen email com a camp d'identitat. S'usa un email sintètic intern `{slug}@sagals.local` — invisible per l'usuari final. El slug és el que apareix a la URL i identifica l'event humanament.

#### Regles d'accés per col·lecció

| Col·lecció | Llegir | Crear | Editar | Eliminar |
|---|---|---|---|---|
| `events` | `@request.auth.collectionName = "users"` | ídem | ídem | ídem |
| `buses` | ídem | ídem | ídem | ídem |
| `participants` | `@request.auth != null` | `@request.auth.collectionName = "users"` | ídem | ídem |
| `attendance` | `@request.auth != null` | `@request.auth != null` | `@request.auth != null` | `@request.auth.collectionName = "users"` |
| `list_access` | — | `@request.auth.collectionName = "users"` | ídem | ídem |

> Els passadors de llista (auth via `list_access`) poden llegir participants i editar attendance del seu event. Els admins (auth via `users`) tenen accés total.

#### Seguretat del token

- El token de la URL és el **password** per obtenir un JWT, no és el JWT en si
- Si cal revocar accés (p.ex. el link s'ha compartit on no toca): l'admin regenera el token des del panel → tots els JWTs existents caduquen en menys de 7 dies (TTL per defecte de PocketBase)
- El JWT es guarda en memòria (no localStorage) durant la sessió

---

### Col·leccions PocketBase (esquema de dades)

#### `events`
| Camp | Tipus | Notes |
|---|---|---|
| `name` | text | Nom de l'actuació (p.ex. "Festa Major Vic 2025") |
| `date` | date | Data de l'actuació |
| `slug` | text (unique) | Identificador URL-friendly generat automàticament |
| `column_mapping` | json | `{firstName, lastName, lastName2, nickname, transport}` → índex de columna de l'Excel |
| `transport_mapping` | json | `{[valorOriginal]: {busId, direction}}` |
| `status` | select | `draft` / `active` / `closed` |

#### `buses`
| Camp | Tipus | Notes |
|---|---|---|
| `event` | relation → events | |
| `label` | text | P.ex. "Bus 1 - 8:00h" |
| `departure_time` | text | Hora de sortida |
| `direction` | select | `anada` / `tornada` / `ambdues` |
| `order` | number | Per ordenar la llista de viatges |

#### `participants`
| Camp | Tipus | Notes |
|---|---|---|
| `event` | relation → events | |
| `first_name` | text | |
| `last_name` | text | |
| `last_name2` | text | |
| `nickname` | text | Sobrenom (nom de colla) |
| `transport_raw` | text | Valor original de l'Excel |
| `bus` | relation → buses (nullable) | Null si va amb transport propi |
| `direction` | select | `anada` / `tornada` / `ambdues` / `propi` |

#### `attendance`
| Camp | Tipus | Notes |
|---|---|---|
| `participant` | relation → participants | |
| `bus` | relation → buses | A quin viatge concret |
| `trip_direction` | select | `anada` / `tornada` (un registre per viatge) |
| `status` | select | `pendent` / `present` / `absent` |
| `marked_at` | datetime | Quan s'ha marcat |
| `marked_by` | text | Identificador del dispositiu (opcional) |

### Rutes del frontend

| Ruta | Descripció | Usuari |
|---|---|---|
| `/` | Llistat d'events | Admin |
| `/events/new` | Crear nou event + configurar busos | Admin |
| `/events/:id/setup` | Importar Excel + mapejar columnes + transport | Admin |
| `/events/:id/admin` | Vista general de l'event (links, estat) | Admin |
| `/list/:slug/:busId/:direction` | **Passar llista** (mobile, real-time) | Passadors de llista |

### Flux real-time (SSE de PocketBase)

```
Passador marca "Pau → present"
    │
    ▼
PATCH /api/collections/attendance/records/{id}
    │
    ▼
PocketBase actualitza SQLite
    │
    ▼
PocketBase emet event SSE a tots els subscriptors
    │
    ├──▶ Mòbil A actualitza la fila de Pau → ✓
    ├──▶ Mòbil B actualitza la fila de Pau → ✓
    └──▶ Mòbil C actualitza el comptador → 12/34 (35%)
```

Subscripció des del React:
```typescript
pb.collection('attendance').subscribe('*', (e) => {
  // e.action: 'create' | 'update' | 'delete'
  // e.record: el registre actualitzat
  updateLocalState(e.record)
})
```

---

## Testing — TDD

### Stack de testing

| Eina | Rol |
|---|---|
| **Vitest** | Test runner (natiu de Vite, mateixa config) |
| **@testing-library/react** | Renderitzar i interactuar amb components |
| **@testing-library/user-event** | Simular events d'usuari realistes |
| **@testing-library/jest-dom** | Matchers addicionals (`toBeInTheDocument`, etc.) |
| **jsdom** | Entorn DOM fals per als tests |

### Workflow TDD

Per cada funcionalitat nova:
1. Escriure el test que descriu el comportament esperat (falla)
2. Implementar el mínim codi per fer-lo passar
3. Refactoritzar si cal

```bash
npm run test       # mode watch (durant desenvolupament)
npm run test:run   # una sola passada (CI)
```

### Què es testa

| Mòdul | Fitxer de test | Prioritat |
|---|---|---|
| Detecció automàtica de columnes Excel | `src/lib/excel.test.ts` | Alta |
| Parsing i normalització de l'Excel | `src/lib/excel.test.ts` | Alta |
| Lògica de mapatge de transport | `src/lib/transport.test.ts` | Alta |
| Generació de slug | `src/lib/slug.test.ts` | Mitjana |
| Lògica de comptador d'assistència | `src/lib/attendance.test.ts` | Mitjana |
| Components React | `src/components/*.test.tsx` | Baixa (MVP) |

> Les crides a PocketBase es mocken amb `vi.mock('../lib/pb')`. Els tests de lògica pura (parsing, detecció, mapatge) no necessiten mock.

---

## Decisions de disseny

- **Auth via link amb JWT estàndard**: els passadors de llista s'autentiquen automàticament en obrir el link. El token de la URL és el password per obtenir un JWT real de PocketBase. El backend valida `@request.auth != null` a totes les operacions d'attendance.
- **Col·lecció `list_access` separada de `users`**: permet distingir a nivell de regles si qui fa la petició és un admin o un passador de llista, sense lògica addicional.
- **Un registre d'attendance per participant per viatge**: permet tenir l'anada i tornada independents, i afegir fàcilment nous busos/viatges sense canviar l'esquema.
- **Excel parsing al frontend**: SheetJS és madur i no cal endpoint. Es parseja, es mostren les columnes, l'admin fa el mapatge, i es fa un batch POST a PocketBase.
- **PocketBase serveix el frontend**: posar el build de React a `pb_public/` elimina la necessitat de Nginx o un segon servei. Per producció amb HTTPS, PocketBase té suport natiu via Let's Encrypt.

---

## Estructura del projecte

```
sagals-llista/
├── main.go                      ← entrada, registra hooks i migracions
├── go.mod / go.sum
├── internal/
│   ├── migrations/              ← migracions de col·leccions en Go
│   ├── hooks/                   ← hooks de PocketBase (events, auto-tokens, etc.)
│   └── api/                     ← endpoints HTTP custom si cal
├── pb_data/                     ← SQLite + uploads (auto-generat, no versionar)
├── pb_public/                   ← build del frontend React (producció)
└── frontend/
    ├── src/
    │   ├── lib/
    │   │   ├── pb.ts            ← client PocketBase
    │   │   └── *.test.ts        ← tests TDD
    │   ├── pages/
    │   ├── components/
    │   ├── types/index.ts
    │   └── App.tsx
    └── package.json
```

## Deploy

```bash
# 1. Build del frontend
cd frontend && npm run build
cp -r dist/* ../pb_public/

# 2. Compilar el backend Go
cd .. && go build -o sagals-llista .

# 3. Arrencar (amb HTTPS automàtic via Let's Encrypt)
./sagals-llista serve --http="0.0.0.0:80" --https="tudomini.com"
```

Per producció recomanada: `systemd` service o Docker amb volum per `pb_data/`.

---

## Fases d'implementació

### Fase 1 — MVP
- [ ] Setup PocketBase + col·leccions
- [ ] Frontend: crear event + configurar busos
- [ ] Frontend: importar Excel + mapejar columnes
- [ ] Frontend: mapejar valors de transport
- [ ] Frontend: vista de passar llista (mobile) amb real-time
- [ ] Comptador en temps real

### Fase 2
- [ ] Vista resum admin (tots els busos)
- [ ] Export llista final
- [ ] PWA (funciona com app al mòbil)
- [ ] Gestió de múltiples actuacions
