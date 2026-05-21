import { BookOpen, ExternalLink, ListChecks, ShieldCheck, X as XIcon } from 'lucide-react'
import { useState } from 'react'

export const xPortalCredentialRows = [
  {
    portalLabel: 'API Key (Consumer Key)',
    alsoKnownAs: 'OAuth 2.0 Client ID',
    usedForPosting: false,
    pasteInApp: false,
  },
  {
    portalLabel: 'API Key Secret (Consumer Secret)',
    alsoKnownAs: 'OAuth 2.0 Client Secret',
    usedForPosting: false,
    pasteInApp: false,
  },
  {
    portalLabel: 'Bearer Token (top of Keys and tokens)',
    alsoKnownAs: 'App-only Bearer Token',
    usedForPosting: false,
    pasteInApp: false,
  },
  {
    portalLabel: 'Access Token (Authentication Tokens → Generate)',
    alsoKnownAs: 'OAuth 2.0 user access token',
    usedForPosting: true,
    pasteInApp: true,
  },
] as const

export const xGuideSteps = [
  {
    title: 'Use the X Developer Portal',
    summary:
      'Sign in at developer.x.com (or console.x.com) with the X account that should publish posts. Create a Project, then an App inside that project. That is the correct place for API credentials.',
    checklist: [
      'Open https://developer.x.com/en/portal/dashboard and sign in.',
      'Create a Project if you do not have one, then add an App under that project.',
      'Keep the app on a paid API tier if your account requires it for posting (check your portal entitlements).',
    ],
    links: [
      ['X Developer Portal', 'https://developer.x.com/en/portal/dashboard'],
      ['X API documentation', 'https://docs.x.com/'],
    ],
  },
  {
    title: 'Save Authentication settings (required fields)',
    summary:
      'The portal will not enable Save until OAuth 2.0 app metadata is filled in—even if you only plan to paste a token into this dashboard. Pick Web App and enter minimal URLs; Social Media Director does not run an X OAuth redirect flow yet, but X still requires these fields.',
    checklist: [
      'App permissions: select Read and write.',
      'Type of App: select Web App, Automated App or Bot (confidential client)—not Native App.',
      'Callback URI / Redirect URL (required): use http://127.0.0.1:5173/ for local dev (X prefers 127.0.0.1 over localhost). Use your real https:// origin in production.',
      'Website URL (required): same origin as above, e.g. http://127.0.0.1:5173 or your deployed site URL.',
      'Leave Request email from users unchecked unless you also add HTTPS Terms of Service and Privacy Policy URLs.',
      'Click Save Changes, then open Keys and tokens.',
    ],
    links: [
      ['OAuth 2.0 overview', 'https://docs.x.com/fundamentals/authentication/oauth-2-0/overview'],
      ['Create Post endpoint', 'https://docs.x.com/x-api/posts/create-post'],
    ],
  },
  {
    title: 'Map portal keys to this dashboard',
    summary:
      'The three values on the main Keys and tokens screen are not interchangeable. Only the user Access Token from Authentication Tokens is pasted into Social Media Director.',
    checklist: [
      'Do not paste API Key, API Key Secret, or the App-only Bearer Token into this app—they will not publish posts.',
      'Scroll to Authentication Tokens → Access Token and Secret → Generate.',
      'Copy both the Access Token and Refresh Token when Include refresh token (offline.access) is enabled.',
    ],
    links: [
      ['Authentication best practices', 'https://docs.x.com/resources/fundamentals/authentication/guides/authentication-best-practices'],
    ],
  },
  {
    title: 'Save the token in Settings',
    summary:
      'Paste the user access token into X user access token below, save settings, and use Publish on a draft to verify the connection.',
    checklist: [
      'Open Settings → X publishing in this dashboard.',
      'Paste the access token into X user access token, and the refresh token into X refresh token (if you generated one).',
      'Click Save settings, then publish a test draft from the post review screen.',
    ],
    links: [],
  },
] as const

export function XCredentialMappingTable() {
  return (
    <div className="credential-mapping-table-wrap">
      <table className="credential-mapping-table">
        <thead>
          <tr>
            <th scope="col">X Developer Portal label</th>
            <th scope="col">Also called</th>
            <th scope="col">Posts for you?</th>
            <th scope="col">Paste in this app?</th>
          </tr>
        </thead>
        <tbody>
          {xPortalCredentialRows.map((row) => (
            <tr key={row.portalLabel}>
              <td>{row.portalLabel}</td>
              <td>{row.alsoKnownAs}</td>
              <td>{row.usedForPosting ? 'Yes' : 'No'}</td>
              <td>{row.pasteInApp ? 'Yes — use this field' : 'No — keep in portal only'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function XApiGuide({ compact = false }: { compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const step = xGuideSteps[stepIndex]
  const isLastStep = stepIndex === xGuideSteps.length - 1

  function openGuide() {
    setStepIndex(0)
    setIsOpen(true)
  }

  function closeGuide() {
    setIsOpen(false)
  }

  return (
    <>
      {compact ? (
        <button className="secondary-button" onClick={openGuide} type="button">
          <BookOpen aria-hidden="true" size={17} />
          X setup guide
        </button>
      ) : (
        <aside className="linkedin-guide-card">
          <div className="panel-heading">
            <ShieldCheck aria-hidden="true" size={22} />
            <div>
              <h2>X API access guide</h2>
              <p>
                Which portal keys to use, how to generate a user token with write access, and
                what to paste into Settings.
              </p>
            </div>
          </div>
          <div className="guide-actions">
            <button onClick={openGuide} type="button">
              <BookOpen aria-hidden="true" size={17} />
              Start tutorial
            </button>
            <a
              className="secondary-link"
              href="https://docs.x.com/"
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" size={16} />
              X API docs
            </a>
          </div>
        </aside>
      )}

      {isOpen ? (
        <div aria-labelledby="x-guide-title" aria-modal="true" className="modal-backdrop" role="dialog">
          <section className="guide-modal">
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  X tutorial {stepIndex + 1} of {xGuideSteps.length}
                </p>
                <h2 id="x-guide-title">{step.title}</h2>
              </div>
              <button aria-label="Close X tutorial" className="icon-button" onClick={closeGuide} type="button">
                <XIcon aria-hidden="true" size={18} />
              </button>
            </div>
            <p className="setup-copy">{step.summary}</p>
            {stepIndex === 2 ? <XCredentialMappingTable /> : null}
            <ul className="guide-checklist">
              {step.checklist.map((item) => (
                <li key={item}>
                  <ListChecks aria-hidden="true" size={17} />
                  {item}
                </li>
              ))}
            </ul>
            {step.links.length > 0 ? (
              <div className="guide-link-list">
                {step.links.map(([label, href]) => (
                  <a href={href} key={href} rel="noreferrer" target="_blank">
                    <ExternalLink aria-hidden="true" size={15} />
                    {label}
                  </a>
                ))}
              </div>
            ) : null}
            <div className="modal-footer">
              <button
                className="secondary-button"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                type="button"
              >
                Back
              </button>
              {isLastStep ? (
                <button onClick={closeGuide} type="button">
                  Done
                </button>
              ) : (
                <button onClick={() => setStepIndex((current) => current + 1)} type="button">
                  Next
                </button>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
