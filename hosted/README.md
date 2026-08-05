# Hosted deployment bundle

This directory contains the complete online variant of Multi Chat Overlay. Twitch and Kick run entirely in the browser. YouTube Live Chat uses the included same-origin PHP proxy because YouTube does not expose the required endpoints to cross-origin browser requests.

Upload the contents of this directory, including `.htaccess`, into the document root of `multichat.romestylez.dev`. Apache must allow `.htaccess` overrides and have `mod_rewrite` enabled. YouTube requires PHP 8.1 or newer with the cURL extension.

After deployment:

```text
https://multichat.romestylez.dev/config
https://multichat.romestylez.dev/chat#c=...
```

Verify the PHP file on the server before enabling YouTube links:

```bash
php -l <document-root>/youtube-proxy.php
curl -sS -X POST https://multichat.romestylez.dev/youtube-proxy.php \
  -H 'Content-Type: application/json' \
  --data '{"action":"discover","handle":"LofiGirl"}'
```

The first command must report no syntax errors. The second command must return JSON containing a `channelId`, the current public InnerTube client values and either a `videoId` or `null` when the selected channel is offline.

No database, personal YouTube API key or writable project directory is required. `youtube-proxy.php` stores no configurations; it uses PHP's system temporary directory only for short-lived hashed rate-limit counters. Do not add a personal `config.js` to this directory.

Security headers must be configured at the outer web server so they also cover files served directly by nginx. The production deployment enforces `Content-Security-Policy`. `default-src 'none'` is sufficient because every script and stylesheet is same-origin and no markup uses inline `<style>` blocks or `style` attributes; the overlay only sets styles through the CSSOM, which CSP does not intercept. `connect-src` must list every platform and emote endpoint plus both WebSocket hosts; `connect-src 'self'` covers the same-origin YouTube proxy. `img-src https:` stays deliberately broad because emote and avatar CDNs vary per provider — the overlay validates image hosts against its own allowlist before rendering.

The PHP endpoint accepts only `discover`, `status`, `continuation` and `poll`. It validates the YouTube handle, channel/video IDs, InnerTube client values and continuation tokens, caps bodies and upstream responses, uses HTTPS-only fixed YouTube hosts, applies network timeouts and rate-limits each action. It is not a general-purpose proxy.

This is a standalone deployment package. Its HTML, CSS, JavaScript and image files do not load files from the local variant in the repository root. Local and hosted files are maintained independently.
