<script lang="ts">
  let email = $state('');
  let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
  let message = $state('');

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (status === 'loading' || !email.trim()) return;
    status = 'loading';
    try {
      const res = await fetch('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          source: 'landing',
          locale: typeof navigator !== 'undefined' ? navigator.language : undefined
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        status = 'done';
        message = data.message ?? "You're on the list — check your inbox.";
      } else {
        status = 'error';
        message = data.error ?? 'Something went wrong. Please try again.';
      }
    } catch {
      status = 'error';
      message = 'Network error. Please try again.';
    }
  }
</script>

{#if status === 'done'}
  <p class="wl-done">♥ {message}</p>
{:else}
  <form class="wl-form" onsubmit={submit}>
    <input
      class="wl-input"
      type="email"
      required
      placeholder="you@email.com"
      bind:value={email}
      autocomplete="email"
      aria-label="Email address"
    />
    <button class="wl-btn" type="submit" disabled={status === 'loading'}>
      {status === 'loading' ? 'Joining…' : 'Join the waitlist'}
    </button>
  </form>
  {#if status === 'error'}<p class="wl-err">{message}</p>{/if}
  <p class="wl-legal">By joining you agree to our <a href="/privacy">Privacy Policy</a>.</p>
{/if}

<style>
  .wl-form {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    width: 100%;
    max-width: 460px;
  }
  .wl-input {
    flex: 1 1 200px;
    padding: 14px 18px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: #fff;
    font-size: 15px;
    outline: none;
  }
  .wl-input:focus {
    border-color: rgba(255, 107, 107, 0.6);
    box-shadow: 0 0 0 3px rgba(255, 107, 107, 0.12);
  }
  .wl-input::placeholder { color: rgba(255, 255, 255, 0.3); }
  .wl-btn {
    padding: 14px 30px;
    border-radius: 999px;
    border: none;
    background: linear-gradient(135deg, #ff6b6b, #e81f8c 50%, #7b35de);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 0 30px rgba(255, 107, 107, 0.22), 0 4px 16px rgba(0, 0, 0, 0.3);
    transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  }
  .wl-btn:hover {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 0 50px rgba(255, 107, 107, 0.32), 0 8px 24px rgba(0, 0, 0, 0.4);
  }
  .wl-btn:active { transform: translateY(0); }
  .wl-btn:disabled { opacity: 0.6; cursor: default; transform: none; }
  .wl-done { color: #ff6b6b; font-size: 16px; font-weight: 500; }
  .wl-err { color: #ff8080; font-size: 13px; margin-top: 8px; width: 100%; }
  .wl-legal { font-size: 12px; color: rgba(255, 255, 255, 0.28); margin: 2px 0 0; width: 100%; }
  .wl-legal a { color: rgba(255, 255, 255, 0.45); text-decoration: underline; }
  .wl-legal a:hover { color: rgba(255, 255, 255, 0.7); }
</style>
