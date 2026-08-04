# Hosted deployment bundle

This directory contains the complete static online variant of Multi Chat Overlay.

Upload the contents of this directory, including `.htaccess`, into the document root of `multichat.romestylez.dev`. Apache must allow `.htaccess` overrides and have `mod_rewrite` enabled.

After deployment:

```text
https://multichat.romestylez.dev/config
https://multichat.romestylez.dev/chat#c=...
```

No PHP runtime, API, database or writable server directory is required. Do not add a personal `config.js` to this directory.

This is a standalone deployment package. Its HTML, CSS, JavaScript and image files do not load files from the local variant in the repository root. Local and hosted files are maintained independently.
