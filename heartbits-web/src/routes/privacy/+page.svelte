<svelte:head>
  <title>Privacy Policy — HeartBits</title>
  <meta name="description" content="HeartBits privacy policy — how we handle your biometric and personal data." />
  <meta name="robots" content="index, follow" />
</svelte:head>

<div class="page">
  <div class="inner">
    <a href="/" class="back">← Back</a>
    <h1>Privacy Policy</h1>
    <p class="meta">Effective: 26 May 2026 · Version 1.0</p>

    <h2>1. Who we are</h2>
    <p>HeartBits ("we", "us") operates the HeartBits dating platform and associated mobile applications.</p>

    <h2>2. Data we collect</h2>
    <ul>
      <li><strong>Heart rate (biometric)</strong> — real-time BPM transmitted to your match during a bond session. Not stored on our servers.</li>
      <li><strong>Profile data</strong> — display name, date of birth (age band only shown), bio, gender, location (geohash-6, ≈1.2 km precision — GPS coordinates are never stored).</li>
      <li><strong>Match history</strong> — who you matched with and when.</li>
      <li><strong>Consent records</strong> — that you consented, when, and to which version. Not the content of your heartbeat.</li>
    </ul>

    <h2>3. Special category data (GDPR Art. 9)</h2>
    <p>Heart rate is biometric data classified as special category under GDPR Article 9. We process it <strong>only with your explicit consent</strong>, which you grant in-app before any heart rate sharing begins. You may withdraw consent at any time from your profile.</p>

    <h2>4. How we protect your data</h2>
    <ul>
      <li>Profile PII is encrypted at rest using AES-256-GCM at the application layer.</li>
      <li>Heart rate data is relayed in real time and never persisted to our database.</li>
      <li>Location is stored as a geohash only. GPS coordinates are rejected.</li>
      <li>All data in transit is encrypted with TLS 1.3.</li>
    </ul>

    <h2>5. Your rights</h2>
    <p>Under GDPR you have the right to access, rectify, export, and erase your data. To exercise these rights, contact us at <a href="mailto:privacy@heartbits.app">privacy@heartbits.app</a> or use the account deletion option in your profile.</p>

    <h2>6. Contact</h2>
    <p><a href="mailto:privacy@heartbits.app">privacy@heartbits.app</a></p>
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
