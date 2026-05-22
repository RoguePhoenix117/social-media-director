# End-user guide

Audience: the **operator** — the person who drafts and publishes posts. If you're standing up the instance for the first time, start with [developer-oauth-setup.md](./developer-oauth-setup.md) instead.

This guide walks through the everyday flow: sign up, create a project, connect channels, draft a post, publish.

## OAuth only — no developer portals, no tokens to paste

As an operator you **never**:

- visit [console.x.com](https://console.x.com/) or [docs.x.com](https://docs.x.com/overview)
- create an X Developer app or LinkedIn developer app
- copy Client ID, Client Secret, Bearer Token, or Access Token into this app

Connecting a channel is always the same:

1. Open **Connect Channels** in this app
2. Click **X** or **LinkedIn**
3. Sign in on the **official** X or LinkedIn consent screen (if not already signed in)
4. Click **Authorize** / **Allow**
5. Return here — your profile appears under Connected Channels

The deployer already registered the app; you are only granting permission for **your** account on **this** project.

---

## 1. Sign up

Open the app URL the deployer gave you. The first time you visit you'll see the **first-run onboarding wizard**:

1. **Account** — enter email, password, and (optionally) a first name. This creates your operator account. The very first operator on an instance becomes the **instance owner** and can edit OAuth app credentials in Settings → Developers; subsequent operators see only their own settings.
2. After saving the account step, the wizard automatically advances to the next step.

If you already have an account, click **Log in** instead — the dashboard will resume any unfinished onboarding step.

---

## 2. Create your first project

A **project** is a workspace for one brand or persona. Each project has its own connected channels (one X account, one LinkedIn account), drafts, and publish history. You can switch between projects from the dropdown in the sidebar / top nav.

The wizard prefills the first project's name as `default-project`. You can rename it to anything — the slug is derived automatically. Press **Create project**, and the wizard advances to channel connection.

> **Multiple brands?** You can create more projects later from **Settings → Projects**. Each new project starts at zero channels and automatically opens the Connect Channels modal so you can authorize X / LinkedIn for it.

---

## 3. Connect your channels

The wizard auto-opens the **Connect Channels** modal once you have a project. From here:

- Click the **X** tile — you'll leave this app briefly, sign in on X if needed, and approve **Authorize app** on X's official consent screen. No developer console, no tokens to copy.
- Click the **LinkedIn** tile — same flow on LinkedIn's consent screen.

You'll see your connected accounts listed at the top of the modal with profile picture, display name, and handle. The sidebar / topbar shows a `N/2 Channels` progress button — click it any time to reopen the modal.

You can dismiss the modal four ways:
- click the **X** in the top-right corner
- click outside the modal panel (on the dimmed backdrop)
- press **Escape**
- press **Continue** / **Continue without channels** in the bottom-right

Skipping is fine — you can come back later. Just note that **publishing is gated**: you need at least one connected channel for the provider you want to publish to.

> All other social platforms appear as **Coming soon** tiles for visual parity. They're not clickable yet.

---

## 4. Finish AI setup

The wizard's last step is **AI setup** — point the app at an AI backend (OpenAI API key, or local Codex CLI). You can skip this step too; you can fill it in later from **Settings → AI generation**.

Once you complete or dismiss the AI step, the wizard closes and you land on the dashboard.

---

## 5. Draft and publish

From the dashboard:

1. Paste a public blog URL into the **Import a public post** field.
2. Click **Import & generate** — the app pulls the source content and asks your AI backend to draft X + LinkedIn variants.
3. Review each variant. Edit copy inline. Hit **Publish** on the variant you want to send.

Publishing posts straight to the provider using the OAuth token stored for the active project's connected channel. The publish result and provider URL show up in the dashboard panel.

---

## Managing projects

### Switching projects

In the sidebar (or top-nav, depending on your layout setting), open the project dropdown. Each entry shows its connected-channel count badge (e.g. `1/2`). Click another project to switch — the dashboard and Settings page reload with that project's channels, drafts, and status.

If the project you switch to has zero connected channels, the Connect Channels modal opens automatically so you don't have to hunt for it.

### Creating another project

Go to **Settings → Projects**, click **Create project**, give it a name, and submit. The new project is created, becomes active, and the Connect Channels modal opens so you can authorize X + LinkedIn for it.

### One account per provider per project (MVP)

In this release, each project can hold **one X account + one LinkedIn account**. If you manage multiple X handles, create one project per handle. Disconnect / multiple-channel-per-provider is on the roadmap but not in MVP.

---

## Settings overview

**AI generation** — choose between OpenAI or Codex CLI; set the model and (for OpenAI) the API key. Encrypted at rest.

**Developers** — *(instance owner only)* edit the X / LinkedIn OAuth app credentials. If the deployer set them via env vars, this section is read-only with a "Configured via environment" badge.

**Projects** — list / create projects, switch active project.

**Connected channels** — list of OAuth-connected accounts for the **active** project. Click **Manage channels** to reopen the Connect Channels modal.

**Appearance** — theme + sidebar/top-nav layout preferences.

---

## FAQ

**Where are my tokens stored?**
In your local Postgres database, encrypted with the instance's `APP_ENCRYPTION_KEY`. They are never written to disk in plain text and are never returned to the browser.

**Can I disconnect a channel?**
Not from the UI in MVP. As a workaround, the deployer can delete the row in `provider_accounts` for your project + provider, and you'll be able to reconnect.

**Why does the publish button say "X is not connected for this project"?**
You've switched to a project that doesn't have that provider connected. Open the Connect Channels modal from the topbar progress button and authorize the missing provider.

**Why does X say my callback URL is invalid?**
That's a deployer-side configuration issue — the OAuth app registered with X has the wrong callback URL. Ping whoever set up the instance and point them at [developer-oauth-setup.md](./developer-oauth-setup.md).

**I lost my password.**
There's no self-service password reset in MVP. The deployer can reset your `operators.password_hash` directly via SQL.
