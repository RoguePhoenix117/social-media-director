/**
 * Shown when the dashboard loader cannot reach Postgres. We surface the exact
 * `psql` commands the deployer needs to apply the migrations so a fresh
 * clone never feels stuck on a generic "connection error" page.
 */
export function DatabaseSetupScreen({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Database setup</p>
        <h1>Postgres is not reachable</h1>
        <p className="setup-copy">
          The app tried to connect to Postgres while loading the dashboard, but the
          database refused the connection. Start Postgres, check DATABASE_URL in your
          .env file, then apply the migrations from the README.
        </p>
        <div className="setup-commands" aria-label="Database setup commands">
          <code>psql "$DATABASE_URL" -f migrations/0001_initial.sql</code>
          <code>psql "$DATABASE_URL" -f migrations/0002_onboarding.sql</code>
          <code>psql "$DATABASE_URL" -f migrations/0003_stepwise_onboarding.sql</code>
          <code>psql "$DATABASE_URL" -f migrations/0004_x_linkedin_onboarding_steps.sql</code>
          <code>psql "$DATABASE_URL" -f migrations/0005_onboarding_dismissed.sql</code>
          <code>psql "$DATABASE_URL" -f migrations/0006_operator_ai_settings.sql</code>
          <code>psql "$DATABASE_URL" -f migrations/0007_projects_oauth.sql</code>
        </div>
        <button onClick={onRetry} type="button">
          Retry connection
        </button>
      </section>
    </main>
  )
}
