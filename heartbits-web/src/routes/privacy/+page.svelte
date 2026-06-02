<svelte:head>
  <title>Privacy Policy — HeartBits</title>
  <meta name="description" content="HeartBits privacy policy — how we handle your biometric and personal data." />
  <meta name="robots" content="index, follow" />
</svelte:head>

<div class="page">
  <div class="inner">
    <a href="/" class="back">← Back</a>
    <h1>Privacy Policy</h1>
    <p class="meta">Effective: 2 June 2026 · Version 1.1</p>

    <p>This policy explains what personal data HeartBits collects, why, how we protect it, and the rights you have. We designed HeartBits to collect as little as possible and to treat your most sensitive data — your heartbeat — with the highest level of protection.</p>

    <h2>1. Who we are</h2>
    <p>HeartBits ("we", "us") operates the HeartBits dating platform and associated mobile applications, and is the data controller for the personal data described here. For any privacy matter, contact <a href="mailto:privacy@what-if.io">privacy@what-if.io</a>.</p>

    <h2>2. Data we collect</h2>
    <ul>
      <li><strong>Account &amp; authentication</strong> — a stable account identifier from our authentication provider, plus your email and sign-in metadata (e.g. last login).</li>
      <li><strong>Heart rate (biometric)</strong> — real-time BPM transmitted to your match during a bond session. Relayed live and <strong>not stored</strong> on our servers.</li>
      <li><strong>Profile data</strong> — display name, date of birth (only an age band is shown to others), bio, gender, who you are seeking, and approximate location (geohash-6, ≈1.2 km — precise GPS coordinates are never stored).</li>
      <li><strong>Photos</strong> — images you upload, stored in a private bucket and served only via non-guessable URLs.</li>
      <li><strong>Activity</strong> — swipes, matches, bonds, and messages with your matches.</li>
      <li><strong>Consent records</strong> — that you consented, when, to which version, and the IP address at that time. Not the content of your heartbeat.</li>
      <li><strong>Technical data</strong> — IP address and basic device/session information needed to operate and secure the Service.</li>
    </ul>

    <h2>3. Special category data (GDPR Art. 9)</h2>
    <p>Heart rate is biometric data classified as special category under GDPR Article 9. We process it <strong>only with your explicit consent</strong>, which you grant in-app before any heart rate sharing begins, and which you may withdraw at any time from your profile — withdrawal immediately ends sharing.</p>

    <h2>4. Legal bases (GDPR Art. 6 &amp; 9)</h2>
    <ul>
      <li><strong>Explicit consent</strong> — for processing heart rate (biometric) data.</li>
      <li><strong>Performance of a contract</strong> — to create your account, show profiles, and enable matching and messaging.</li>
      <li><strong>Legitimate interests</strong> — to keep the Service secure, prevent abuse, and maintain an audit trail.</li>
      <li><strong>Legal obligation</strong> — where we must retain certain records to comply with the law.</li>
    </ul>

    <h2>5. How we use your data</h2>
    <p>To provide the core service (profiles, discovery, matching, and live heartbeat sharing between consenting matches), to keep accounts and the platform secure, to respond to your requests, and to comply with our legal obligations. We do <strong>not</strong> sell your personal data, and we do not use it for third-party advertising.</p>

    <h2>6. How we protect your data</h2>
    <ul>
      <li>Profile PII (name, date of birth, bio) is encrypted at rest using AES-256-GCM at the application layer.</li>
      <li>Heart rate data is relayed in real time and never persisted to our database.</li>
      <li>Location is stored only as a coarse geohash; precise GPS coordinates are rejected at the API boundary.</li>
      <li>Per-row access controls isolate each user's data; photos live in a private store behind expiring, non-guessable URLs.</li>
      <li>All data in transit is encrypted with TLS.</li>
    </ul>

    <h2>7. Who we share data with</h2>
    <p>Your profile and photos are visible to other users as part of discovery and to your matches. We share data with a small number of infrastructure providers (processors) strictly to run the Service — for example hosting, our authentication provider, and object storage — under appropriate data-processing terms. We do not sell or rent your data, and we share it with third parties only where required by law or to protect the rights and safety of users.</p>

    <h2>8. Retention</h2>
    <p>We keep your data for as long as your account is active. <strong>Pausing</strong> your account hides it but keeps your data intact so you can return. <strong>Deleting</strong> your account immediately erases your personal data (profile fields are overwritten) and schedules permanent removal — including photos — within 30 days. Limited, anonymised audit records may be retained where required for security or legal compliance.</p>

    <h2>9. Your rights</h2>
    <p>Under the GDPR and similar laws you have the right to:</p>
    <ul>
      <li>access the personal data we hold about you;</li>
      <li>rectify inaccurate data;</li>
      <li>erase your data ("right to be forgotten");</li>
      <li>export your data in a portable format;</li>
      <li>withdraw consent at any time (without affecting prior processing);</li>
      <li>object to or restrict certain processing;</li>
      <li>lodge a complaint with your local data protection authority.</li>
    </ul>
    <p>You can export or delete your data directly from your profile, or contact <a href="mailto:privacy@what-if.io">privacy@what-if.io</a>.</p>

    <h2>10. International transfers</h2>
    <p>Where data is processed outside your country, we rely on appropriate safeguards (such as adequacy decisions or standard contractual clauses) to protect it.</p>

    <h2>11. Cookies &amp; sessions</h2>
    <p>We use a single signed session cookie to keep you logged in. We do not use third-party advertising or tracking cookies.</p>

    <h2>12. Children</h2>
    <p>HeartBits is strictly for adults aged 18 and over. We do not knowingly collect data from anyone under 18; if we learn that we have, we will delete it.</p>

    <h2>13. Changes</h2>
    <p>We may update this policy; material changes will be announced in-app or by email before they take effect.</p>

    <h2>14. Contact</h2>
    <p>Privacy enquiries and data-rights requests: <a href="mailto:privacy@what-if.io">privacy@what-if.io</a></p>
  </div>
</div>

<style>
  .page { min-height: 100svh; padding: 80px 24px; }
  .inner { max-width: 680px; margin: 0 auto; }
  .back { font-size: 13px; color: rgba(255,255,255,0.35); text-decoration: none; display: block; margin-bottom: 48px; }
  .back:hover { color: rgba(255,255,255,0.6); }
  h1 { font-family: 'DM Serif Display', Georgia, serif; font-size: clamp(32px,5vw,48px); font-weight: 400; margin-bottom: 8px; }
  h2 { font-family: 'DM Serif Display', Georgia, serif; font-size: 20px; font-weight: 400; margin: 36px 0 12px; color: rgba(255,255,255,0.85); }
  .meta { font-size: 12px; color: rgba(255,255,255,0.25); margin-bottom: 48px; }
  p, li { font-size: 14px; font-weight: 300; color: rgba(255,255,255,0.45); line-height: 1.8; margin-bottom: 12px; }
  ul { padding-left: 20px; margin-bottom: 16px; }
  li { margin-bottom: 8px; }
  strong { color: rgba(255,255,255,0.7); font-weight: 500; }
  a { color: #FF6B6B; }
</style>
