import { ExternalLink } from 'lucide-react'

/**
 * Inline portal walkthroughs for the legacy token paste flow. Removed in PR4
 * together with the paste UI itself.
 */
export function LegacySetupGuides() {
  return (
    <>
      <section className="template-card settings-section guide-panel">
        <h2>X setup checklist</h2>
        <ol className="friendly-steps">
          <li>
            <strong>Portal:</strong> sign in at{' '}
            <a
              href="https://developer.x.com/en/portal/dashboard"
              rel="noreferrer"
              target="_blank"
            >
              developer.x.com
            </a>{' '}
            (same as console.x.com) and create a Project with an App.
          </li>
          <li>
            <strong>Authentication settings:</strong> choose Read and write, Type of App →
            Web App, Automated App or Bot, and fill required Callback URI and Website URL
            (e.g. <code>http://127.0.0.1:5173/</code>) before Save Changes will work.
          </li>
          <li>
            <strong>Ignore for this field:</strong> API Key (Consumer Key), API Key Secret,
            and the app-only Bearer Token on the main Keys and tokens tab.
          </li>
          <li>
            <strong>Generate:</strong> under Authentication Tokens → Access Token and
            Secret → Generate, then copy the <strong>Access Token</strong>.
          </li>
          <li>
            <strong>Paste here:</strong> access token in X user access token; refresh token
            (if generated) in X refresh token; then publish a test draft.
          </li>
        </ol>
        <div className="guide-link-list always-visible">
          <a
            href="https://docs.x.com/fundamentals/authentication/oauth-2-0/overview"
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" size={15} />
            X OAuth 2.0
          </a>
          <a
            href="https://docs.x.com/x-api/posts/create-post"
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" size={15} />
            Create Post API
          </a>
        </div>
      </section>

      <section className="template-card settings-section guide-panel">
        <h2>LinkedIn setup checklist</h2>
        <ol className="friendly-steps">
          <li>
            <strong>Create an app:</strong> open{' '}
            <a href="https://www.linkedin.com/developers/apps" rel="noreferrer" target="_blank">
              LinkedIn Developer Apps
            </a>{' '}
            and create a new app.
          </li>
          <li>
            <strong>Add products:</strong> add Share on LinkedIn for profile posting. Add
            Sign in with LinkedIn if you need profile/email identity.
          </li>
          <li>
            <strong>Company Page:</strong> if posting for a company, confirm your LinkedIn
            member manages the Page and review Marketing API access.
          </li>
          <li>
            <strong>Authorize:</strong> complete LinkedIn OAuth and request posting
            permission such as <code>w_member_social</code>.
          </li>
          <li>
            <strong>Paste here:</strong> save the access token, author URN, and API version
            in this settings form.
          </li>
        </ol>
        <div className="guide-link-list always-visible">
          <a
            href="https://learn.microsoft.com/linkedin/shared/authentication/getting-access?context=linkedin%2Fcontext"
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" size={15} />
            Getting access to LinkedIn APIs
          </a>
          <a
            href="https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication"
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" size={15} />
            LinkedIn OAuth 2.0
          </a>
          <a
            href="https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin"
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" size={15} />
            Share on LinkedIn
          </a>
          <a
            href="https://learn.microsoft.com/en-us/linkedin/marketing/?view=li-lms-2026-04"
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" size={15} />
            Marketing API docs
          </a>
        </div>
      </section>
    </>
  )
}
