# CGS account invitation setup

The password setup page is `/account/setup`. It uses the existing browser-only Supabase authentication client and standard implicit-flow invitation or recovery emails. No dependencies or database schema changed.

`AccountInviteRedirect` is mounted in the root layout. It forwards invitation/recovery fragments from the configured site URL to the setup page without initializing an authentication client first. This supports the current base-URL redirect configuration. Explicit expired-link errors are also forwarded and rejected. The setup page verifies the user with Supabase before enabling the form and again before saving a password, and clears authentication fragments from the address bar.

An existing valid CGS session may use the page to change its password. Missing or expired links show a sign-in link and instructions to contact CGS for another invitation. This change does not add self-service password-reset emails or support PKCE email templates.

## CGL pilot account records

CGL tester identities are maintained in server-controlled `auth.users.app_metadata.cgl` using `sgt_username`, `sgt_id` (a string), and `membership_status: "trial"`. Trial status does not record a paid season entitlement or automatically synchronise SGT statistics. Existing CGS logins are reused; new login profiles are private with ordinary player permissions.

A tester without an email has a private, admin-managed pending CGS profile with no authentication account. Its `season_stats.cgl.roster_status` is an informational roster note, never an authorization source. No Top Dog or Ambrose competition membership is created. The existing Top Dog admin directory lists all CGS profiles, so shared directory entries are still visible to administrators.

Custom CGL achievement cards and points tables continue to use labelled fictional results. The later presentation pass reads the provisioned CGL identities for the real trial roster and public profiles, independent of password activation. Verified SGT results are displayed in their own embedded views; no custom results feed is established by account creation.

## Release scope and verification

The account-only release was prepared against production commit `d340e82e19837fc37e7f37b2c3a4d27c1a7868f0`. It adds the setup route and three account component/style files, with a two-line import and mount in `app/layout.tsx`. All other release source matches that production commit after line-ending normalization. It excludes the local CGL prototype, environment files, provisioning scripts, and tester contact details.

TypeScript, targeted ESLint, and the production build passed. Browser checks confirmed missing-link handling and base-URL forwarding of an expired invitation. Live data checks confirmed SGT IDs remain strings, profiles align with authentication IDs, new profiles are inaccessible to anonymous visitors, the pending tester has no email/login, and the existing managed competition profile was left untouched. No tester invitation links were consumed during verification.

The account-only update is published at https://crossodoggolf.com/account/setup. Final production deployment: `dpl_7p6WNJnoaKn9GvL3oSfy1o2GLyzm`. The original Singapore (`sin1`) function region was restored and verified from live response headers. Home, setup, and login pages return 200; unauthenticated account API access returns 401. The final deployment error log check was clean.

Two new-player invitations were accepted for sending on 30 October 2026 at approximately 6:13 pm Australia/Brisbane. Sam's invitation initially hit `over_email_send_rate_limit`. The authorised one-time retry completed on 31 October 2026 at approximately 6:01 am Australia/Brisbane, with its invitation timestamp verified. The completed retry automation was deleted so it cannot send again. Email acceptance does not establish inbox delivery. Existing logins are reused, and the tester without an email remains pending. Tim's additional account is provisioned with its SGT identity and private profile; no invitation email has been sent to that new address.
