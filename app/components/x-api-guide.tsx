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
    usedForPosting: false,
    pasteInApp: false,
  },
] as const

export const xGuideSteps = [
  {
    title: 'Register the app in the X console',
    summary:
      'Sign in at console.x.com with any X account that can create developer apps (it does not have to be the account that will publish). Create a Project and App — you are registering the application, not connecting an end-user account.',
    checklist: [
      'Open https://console.x.com/ and sign in as the deployer.',
      'Create a Project if needed, then add an App (e.g. social-media-director).',
      'Enable OAuth 2.0 User authentication — see OAuth 2.0 overview on docs.x.com.',
    ],
    links: [
      ['X console', 'https://console.x.com/'],
      ['X Developer Platform', 'https://docs.x.com/overview'],
      ['OAuth 2.0 overview', 'https://docs.x.com/fundamentals/authentication/oauth-2-0/overview'],
    ],
  },
  {
    title: 'Save Authentication settings (required fields)',
    summary:
      'The portal will not enable Save until OAuth 2.0 app metadata is filled in. Pick Web App and enter the callback URL below — end users connect channels via OAuth; deployers only register the app client ID and secret here.',
    checklist: [
      'App permissions: select Read and write.',
      'Type of App: select Web App, Automated App or Bot (confidential client)—not Native App.',
      'Callback URI / Redirect URL (required): {APP_ORIGIN}/integrations/social/x/callback (use 127.0.0.1 locally — X rejects localhost, e.g. http://127.0.0.1:5173/integrations/social/x/callback).',
      'Website URL (required): your APP_ORIGIN root (e.g. http://127.0.0.1:5173 — not localhost).',
      'Leave Request email from users unchecked unless you also add HTTPS Terms of Service and Privacy Policy URLs.',
      'Click Save Changes, then open Keys and tokens.',
    ],
    links: [
      ['OAuth 2.0 overview', 'https://docs.x.com/fundamentals/authentication/oauth-2-0/overview'],
      ['Create Post endpoint', 'https://docs.x.com/x-api/posts/create-post'],
    ],
  },
  {
    title: 'Map portal keys to Setup Mode / Developers settings',
    summary:
      'Deployers paste the OAuth 2.0 Client ID and Client Secret into Setup Mode or Settings → Developers. End users never paste tokens — they authorize via Connect Channels.',
    checklist: [
      'Paste Client ID and Client Secret only — not API Key labels from the wrong section, and not user Access Tokens.',
      'Do not connect your personal X account during developer setup.',
      'End users connect channels from the Connect Channels modal after sign-up.',
    ],
    links: [
      ['Authentication best practices', 'https://docs.x.com/resources/fundamentals/authentication/guides/authentication-best-practices'],
    ],
  },
] as const

export function XCredentialMappingTable() {
  return (
    <div className="credential-mapping-table-wrap">
      <table className="credential-mapping-table">
        <thead>
          <tr>
            <th scope="col">X console label (Keys &amp; tokens)</th>
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
