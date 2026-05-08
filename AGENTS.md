# Sagals Llista

## Test-Driven Development

- **Always** write tests **first** before implementing any feature
- Designing tests first ensures the feature is testable and the structure supports testability
- No need to write failing tests and watch them fail — just design the test, then implement
- After implementing, run the tests to verify they pass
- **No feature without its corresponding tests**

## Test Infrastructure

### Backend (Elixir/Phoenix)

- Run with: `mix test` or `mix precommit` (also formats/compiles)
- Coverage: `mix test --cover` (94%+ with `Sagals.Release` and `SagalsWeb.Gettext` excluded)
- Coverage threshold: 90%
- Test files in `backend/test/`
- Use `SagalsWeb.ConnCase` for controller tests, `SagalsWeb.ChannelCase` for channel tests, `Sagals.DataCase` for domain tests
- For Tenimaleta stubs: `Req.Test.stub(:tenimaleta, fn conn -> ... end)` + `Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})` with `on_exit` cleanup
- For list token auth: `Auth.generate_list_token(event_id)` in `Authorization: Bearer <token>` header
- Channel tests: `connect(SagalsWeb.UserSocket, %{"token" => token})` then `subscribe_and_join(socket, "attendance:#{bus_id}:#{direction}")`

### Frontend (React/Vite/Vitest)

- Run with: `npx vitest run` (requires Node 22+, use Docker: `docker run --rm -v "$(pwd)":/app -w /app node:22-alpine sh -c "npm install --silent && npx vitest run"`)
- 59 tests across 8 test files
- Testing Library + jsdom environment
- Mock `react-router-dom` (`useNavigate`) and `../lib/api` in page tests
- Mock `../lib/socket` for ListPage channel tests

## Project Conventions

### Language

- UI text and commit messages in **Catalan**
- Code comments and variable names in English

### Brand & Design

- Corporate orange: `#E0763A` exposed as Tailwind `sagals-*` custom colors
- Header: orange background (`bg-sagals`), currently full-height
- Buttons: text+icon for actions, no pills for status badges
- Destructive actions: red text, trash icon, consistent placement
- Bus direction: only `anada` or `tornada` — no `ambdues`
- Status badge: `Esborrany` / `Actiu` pill on header

### Backend Patterns

- `replace_participant_trips/2` returns `{:ok, participant}` with preloaded trips
- `import_form_participants/2` does NOT skip empty-name rows
- Form sync: delete participants + redirect to import-form with pre-filled mapping
- `import_participants/3` uses fuzzy whitespace matching on transport values
- Tenimaleta proxy endpoints under `/api/tenimaleta/` (admin-only)

### Frontend Patterns

- No email validation on usernames — accept any string
- Confirm dialogs before deletions
- Buttons always visible on mobile (not hover-only)
- Long observations/companions text not truncated
- "Esborrar participants" replaces "Reimportar" — stays on admin page, doesn't navigate
- "Des de formulari" button only shown when no participants exist
- When participants exist + event has form_id, show "Sincronitzar" button

## Key Files

### Backend

- `backend/lib/sagals/events.ex`: Core domain logic — `build_trips`, `import_form_participants/2`, `import_participants/3`, `replace_participant_trips/2`
- `backend/lib/sagals/tenimaleta.ex`: Tenimaleta API proxy (`get_forms`, `get_form_responses`, `get_castellers`)
- `backend/lib/sagals_web/controllers/list_controller.ex`: Public list API (buses, participants, attendance, castellers, profile_pic)
- `backend/lib/sagals_web/controllers/participant_controller.ex`: Admin participant CRUD + import + form import
- `backend/lib/sagals_web/channels/attendance_channel.ex`: WebSocket channel for real-time attendance updates

### Frontend

- `frontend/src/pages/EventAdmin.tsx`: Admin page with participants, buses, sync, delete
- `frontend/src/pages/FormImport.tsx`: Step-by-step form import with deferred event creation
- `frontend/src/pages/ListPage.tsx`: Public attendance list with WebSocket updates
- `frontend/src/pages/EventSetup.tsx`: Excel import
- `frontend/src/lib/api.ts`: HTTP client with auth token management
- `frontend/src/lib/socket.ts`: Phoenix Channels wrapper for attendance updates