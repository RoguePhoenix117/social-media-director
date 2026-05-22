# Manual test checklist — Social Media Director

Use this after a fresh migration (`0007_projects_oauth.sql` applied). Requires real X and LinkedIn developer apps — see [`developer-oauth-setup.md`](developer-oauth-setup.md).

**Prerequisites**

- [ ] Postgres running (`pnpm db:up`)
- [ ] `.env` has `SESSION_SECRET`, `APP_ENCRYPTION_KEY`, `DATABASE_URL`, `APP_ORIGIN`
- [ ] Either OAuth app creds in `.env` **or** you will complete Setup Mode UI
- [ ] `pnpm dev` running at `APP_ORIGIN` (default `http://localhost:5173`)

---

## Phase 1 — Developer / instance setup

| # | Step | Expected | Pass |
|---|------|----------|------|
| 1.1 | Open `/` on a fresh DB (no operators) | Redirect to `/setup` | ☐ |
| 1.2 | Read welcome copy | Says you register **app** credentials, not personal channels | ☐ |
| 1.3 | Step through X + LinkedIn credential forms | Callback URLs shown with copy buttons | ☐ |
| 1.4 | Save setup | Redirect to sign-up / login; revisiting `/setup` no longer required | ☐ |
| 1.5 | Settings → Developers (after sign-up as first user) | Visible as instance owner; secrets never shown in full | ☐ |
| 1.6 | (Optional) Set creds via env instead | Developers section shows "Configured via environment" badge | ☐ |

---

## Phase 2 — Sign up & first project

| # | Step | Expected | Pass |
|---|------|----------|------|
| 2.1 | Create operator account (email, password, name) | Advances to project step | ☐ |
| 2.2 | Create first project | Default name `default-project` prefilled; submit creates project | ☐ |
| 2.3 | Connect Channels modal opens | Centered modal, not full screen; grid shows X + LinkedIn active | ☐ |
| 2.4 | Dismiss modal via **X** | Modal closes | ☐ |
| 2.5 | Reopen via progress button | Dashboard/header shows `0/2 Channels`; click reopens modal | ☐ |
| 2.6 | Dismiss via **click outside** | Modal closes | ☐ |
| 2.7 | Dismiss via **Continue without channels** | Modal closes; onboarding can continue | ☐ |
| 2.8 | Complete AI setup step (or skip) | Reach dashboard | ☐ |

---

## Phase 3 — Connect X (OAuth — requires real credentials)

| # | Step | Expected | Pass |
|---|------|----------|------|
| 3.1 | Open Connect Channels → click **X** | Redirect to `twitter.com/i/oauth2/authorize` | ☐ |
| 3.2 | Authorize app on X | "Adding Channel…" interstitial, then return to app | ☐ |
| 3.3 | Connected list | Shows your X name + avatar | ☐ |
| 3.4 | Progress button | Shows `1/2 Channels` | ☐ |
| 3.5 | Click X again when already connected | Friendly error or disabled state (one X per project) | ☐ |

---

## Phase 4 — Connect LinkedIn (OAuth)

| # | Step | Expected | Pass |
|---|------|----------|------|
| 4.1 | Connect Channels → click **LinkedIn** | Redirect to LinkedIn consent | ☐ |
| 4.2 | Allow permissions | Return via adding interstitial; channel appears in list | ☐ |
| 4.3 | Progress button | Shows `2/2 Channels` | ☐ |

---

## Phase 5 — Import, draft, publish

| # | Step | Expected | Pass |
|---|------|----------|------|
| 5.1 | Configure AI backend (Settings or dashboard) if not done | Model step green / active backend selected | ☐ |
| 5.2 | Paste a public blog URL → Import and generate | Source preview + X/LinkedIn draft variants appear | ☐ |
| 5.3 | Publish X variant | Success message with post URL (real tweet) | ☐ |
| 5.4 | Publish LinkedIn variant | Success message with LinkedIn post URL | ☐ |
| 5.5 | Publish without connected channel | Clear error pointing to Connect Channels | ☐ |

---

## Phase 6 — Multi-project isolation

| # | Step | Expected | Pass |
|---|------|----------|------|
| 6.1 | Settings → Projects → Create project (new name) | New project created; Connect Channels modal auto-opens | ☐ |
| 6.2 | New project channel count | `0/2 Channels`; no channels from first project listed | ☐ |
| 6.3 | Connect different X/LinkedIn on new project | Channels saved only for new project | ☐ |
| 6.4 | Project switcher on dashboard | Switch back to first project → `2/2` (or prior count) restored | ☐ |
| 6.5 | Import workspace on switch | Draft area clears when switching projects (empty until new import) | ☐ |
| 6.6 | Publish after switch | Uses **active** project's connected accounts only | ☐ |

---

## Phase 7 — Settings & regression

| # | Step | Expected | Pass |
|---|------|----------|------|
| 7.1 | Settings → Connected channels | Opens same Connect Channels modal; no token paste fields | ☐ |
| 7.2 | Search codebase / UI for "paste" token fields | None in onboarding or settings | ☐ |
| 7.3 | Log out / log back in | Session restores; active project and channels intact | ☐ |
| 7.4 | README doc links | `developer-oauth-setup.md` and `end-user-guide.md` open correctly | ☐ |

---

## Automated checks (already run by Agent G)

- [x] `pnpm lint` — 0 errors (23 pre-existing warnings)
- [x] `pnpm typecheck` — pass
- [x] `pnpm test` — 82/82 pass
- [x] `app/routes/index.tsx` — 43 lines (thin route)

---

## Known gaps (not blocking manual OAuth testing)

| Gap | Notes |
|-----|-------|
| `publish_attempts` table | Publish succeeds but rows are not written yet (plan PR3 follow-up) |
| Draft history per project | Imports persist to DB with `project_id`, but UI does not reload past drafts on project switch — workspace resets visually only |
| Token refresh job | Refresh tokens stored; automatic refresh before expiry not implemented |
| Disconnect channel | No disconnect UI in MVP |

---

## Requires your credentials (cannot automate)

- X Developer Portal app registration + OAuth consent
- LinkedIn Developer Portal app + product approval + OAuth consent
- Live publish to X and LinkedIn APIs
- `INSTANCE_SETUP_KEY` gate on non-localhost host (production deploy test)
