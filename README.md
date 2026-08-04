# Multi Chat Overlay

A local and optionally hosted OBS browser-source overlay that combines Twitch, Kick and YouTube Live Chat in one view. YouTube is available in the hosted variant. The overlay supports native platform emotes, 7TV, BetterTTV, FrankerFaceZ, moderation filters, role badges and channel-specific subscriber/member badges.

The local variant uses `config.js`. The hosted variant stores the complete configuration inside the generated OBS URL. Neither variant requires an account, a database, configuration storage or `localStorage`. Hosted YouTube support uses the bundled, narrowly scoped PHP proxy because browsers cannot call YouTube's internal chat endpoints directly across origins.

## Features

### Chat platforms

- Display Twitch, Kick and YouTube Live Chat in one overlay (YouTube is hosted-only)
- Connect to YouTube by entering the channel handle once
- Find the currently running and future YouTube livestreams automatically
- Read Twitch chat anonymously with only a channel name
- Resolve the Kick chatroom ID automatically from a Kick channel name
- Skip platforms that have not been configured
- Keep optional Twitch OAuth and Kick connection overrides for advanced setups

### Emotes and badges

- Native Twitch and Kick emotes
- Global and channel-specific 7TV emotes
- Global and channel-specific BetterTTV emotes
- Global and channel-specific FrankerFaceZ emotes
- Automatic 7TV and BetterTTV channel lookup through the Twitch channel ID
- Twitch broadcaster, moderator, VIP and other role badges
- Channel-specific Twitch subscriber and founder badges
- The global badge selected by each Twitch user
- Supported Kick moderator and VIP badges
- YouTube owner, moderator and channel-member badges
- Independent switches for platform icons, all badges, subscriber/member badges and global badges
- Separate Twitch, Kick and YouTube message colors with color pickers and editable hex values
- Optional text shadow for improved readability

### Configuration and moderation

- Local graphical configuration editor
- Load an existing adjacent `config.js`
- Save through the File System Access API where supported
- Download fallback for other browsers
- Static online editor that generates a ready-to-use OBS URL
- Import an existing online overlay URL for further editing
- Keep hosted settings exclusively inside the URL fragment
- Configurable message limit
- Block users, commands and links
- Disable individual command entry while all `!` commands are blocked

## Online quick start

1. Open the hosted editor:

   ```text
   https://multichat.romestylez.dev/config
   ```

2. Configure Twitch, Kick and/or YouTube, plus emotes, appearance and filters.

3. Click **Overlay-Link erzeugen** and copy the generated URL.

4. Add an OBS **Browser Source**, leave **Local file** disabled and paste the URL.

5. To change an existing configuration, open the editor, click **Konfiguration importieren** and paste the current URL from OBS. Generate a new URL after editing and replace the old URL in OBS.

The hosted editor does not upload or retain the configuration. The generated URL is the configuration. Losing that URL means the settings cannot be recovered by the service.

## Local quick start

1. Clone or download the repository:

   ```bash
   git clone https://github.com/romestylez/multi-chat-overlay.git
   cd multi-chat-overlay
   ```

2. Open `config.html` in Chrome or Edge.

3. Configure at least one platform:

   - For Twitch, enter the channel name.
   - For Kick, enter the channel name. The chatroom ID is resolved automatically when saving.

4. Configure emotes, display options and moderation filters as needed.

5. Click **config.js speichern** and save the file as `config.js` next to `config.html`.

   If direct saving is unavailable, click **config.js herunterladen** and move the downloaded file into the project directory.

6. Add an OBS **Browser Source**:

   - Enable **Local file**.
   - Select `index.html`.
   - Set the desired dimensions, for example `800x600`.

7. Refresh the OBS browser source after changing `config.js`.

## Configuration editor

### Local mode

The editor automatically loads an existing `config.js` from the same directory. Reloading `config.html` restores the values from that file and displays `config.js geladen` when loading succeeded.

The editor does not store configuration in `localStorage`. This makes `config.js` easy to back up, copy to another computer or edit manually.

Chrome and Edge can use the File System Access API after explicit permission from the user. Browsers without this API receive a regular `config.js` download instead.

The editor supports:

- Twitch and Kick channel configuration
- Automatic Kick chatroom ID resolution
- Switches for enabling or disabling 7TV and BetterTTV
- Display and badge switches
- Maximum message count
- Blocked users, commands and links

When **Alle !-Befehle blockieren** is enabled, the individual blocked-command field is disabled. Existing entries are retained and become editable again after disabling the global command filter.

### Online mode

The standalone `hosted/config.html` operates as the online editor when deployed through HTTP or HTTPS. It does not load or create `config.js`. Instead it converts the visible form values into a compact, versioned JSON payload and stores that payload after `#c=` in the generated overlay URL.

The hosted editor places Twitch, Kick and YouTube next to each other at the top. YouTube accepts a channel handle such as `romestylez`. The handle remains unchanged in OBS while the overlay automatically discovers the channel's currently running livestream. No personal YouTube API key or OAuth login is required.

URL fragments are processed only in the browser and are not sent to Apache as part of the HTTP request. The online overlay decodes the fragment, validates every supported setting and then passes the resulting in-memory configuration to the same overlay code used by the local variant.

**Konfiguration importieren** reads an existing overlay URL locally and repopulates the form. Importing never requests the pasted address. Missing newer settings receive their current defaults, while unknown settings are ignored. Invalid values, damaged payloads and oversized filter lists are rejected.

Do not manually add Twitch OAuth values or other secrets to an online URL. URL payloads are encoded for transport, not encrypted.

## Twitch

### Anonymous read-only mode

Only `TWITCH_CHANNEL` is required for the default setup. The overlay joins Twitch IRC anonymously and can read public chat messages without a personal access token.

The overlay still supports manually configured `TWITCH_USERNAME` and `TWITCH_OAUTH` values for advanced authenticated setups. These fields are not exposed by the graphical editor.

If no Twitch channel is configured, the Twitch connection is skipped.

### Twitch badges

The overlay reads the Twitch channel ID automatically from IRC `ROOMSTATE` and message tags. It then loads channel-specific subscriber badges and the global Twitch badge catalog through the public IVR API. OAuth is not required for this badge lookup.

Badges are displayed in this order:

1. Platform icon
2. Broadcaster, moderator, VIP or another role badge
3. Subscriber or founder badge
4. User-selected global badge
5. Username
6. Message

Badge data may arrive after the first chat message. Pending role, subscriber and global badges are added automatically to messages that are already visible. If the badge service is unavailable, chat continues normally without the affected dynamic badge images.

The badge switches behave as follows:

- `HIDE_BADGES` hides every supported Twitch, Kick and YouTube badge.
- `HIDE_SUB_BADGES` hides Twitch subscriber/founder badges and YouTube channel-member badges.
- `HIDE_GLOBAL_BADGE` hides only the global badge selected by a Twitch user.
- `HIDE_PLATFORM` hides the Twitch, Kick or YouTube platform icon.

## Kick

Enter a Kick channel name. When **config.js speichern**, **config.js herunterladen** or **Overlay-Link erzeugen** is clicked, the corresponding chatroom ID is resolved automatically. The separate **ID ermitteln** button remains available for checking it immediately. The manual ID field stays hidden unless the automatic request fails. The editor requests:

```text
https://kick.com/api/v1/channels/YOUR_CHANNEL
```

The required value is `chatroom.id`, not the channel `id`. For example, the response for `smtxlost` contains channel ID `610944` and chatroom ID `610727`.

If Kick or the browser blocks the automatic request, no file or overlay link is generated and the manual chatroom ID field becomes visible as a fallback. When the Kick channel name is changed later, the old ID is discarded and resolved again so it cannot accidentally point to the previous channel.

The public Kick/Pusher application key and cluster are built into the overlay:

```text
App key: 32cbd69e4b950bf97679
Cluster: us2
```

Advanced users can override these values manually with `KICK_APP_KEY` and `KICK_CLUSTER`. If no valid Kick chatroom ID is configured, the Kick connection is skipped.

## YouTube (hosted variant)

Enter the YouTube handle without `@`, for example `romestylez`. The hosted overlay resolves the public channel ID, discovers the current livestream and follows YouTube Live Chat continuation tokens. When the channel is offline, it checks periodically and connects automatically when a future stream starts. The OBS URL does not need to be replaced for each stream.

YouTube's current public InnerTube key and web client version are read dynamically from the public channel page. These values are not personal credentials. The bundled `hosted/youtube-proxy.php` forwards only four predefined YouTube operations, validates all identifiers and tokens, limits request and response sizes, applies timeouts and rate-limits callers. It cannot be used as a general URL proxy.

YouTube support is intentionally limited to the hosted variant. The local file-based overlay continues to support Twitch and Kick without requiring a local web server or PHP runtime.

## Emotes

7TV, BetterTTV and FrankerFaceZ can be enabled or disabled independently in the editor. When enabled, their global emotes are loaded automatically.

For channel-specific emotes, the overlay reads the Twitch channel ID from IRC and uses it directly with the 7TV and BetterTTV APIs. FrankerFaceZ uses the configured Twitch channel name automatically. No separate emote-service IDs or channel names have to be entered.

- `ENABLE_7TV`: load global and channel-specific 7TV emotes
- `ENABLE_BTTV`: load global and channel-specific BetterTTV emotes
- `ENABLE_FFZ`: load global and channel-specific FrankerFaceZ emotes

A failed optional emote request does not stop the remaining overlay services or chat connections.

## Message appearance

The actual chat message text can use a different color for each platform. Usernames keep the colors supplied by Twitch or Kick; YouTube usernames use the platform accent color.

- `TWITCH_MESSAGE_COLOR`: Twitch message text color in `#RRGGBB` format
- `KICK_MESSAGE_COLOR`: Kick message text color in `#RRGGBB` format
- `YOUTUBE_MESSAGE_COLOR`: YouTube message text color in `#RRGGBB` format (hosted only)
- `ENABLE_TEXT_SHADOW`: add a dark shadow to usernames and message text for improved readability

The editor provides a visual color picker and an editable hex field for each platform. Both inputs stay synchronized. Invalid hex values are rejected when saving the configuration.

## Configuration reference

| Setting | Description | Default |
| --- | --- | --- |
| `TWITCH_CHANNEL` | Twitch channel to join | Empty |
| `TWITCH_USERNAME` | Optional username for an authenticated Twitch connection | Twitch channel |
| `TWITCH_OAUTH` | Optional Twitch OAuth value | Anonymous mode |
| `KICK_CHANNEL` | Kick channel used by the editor | Empty |
| `KICK_CHATROOM_ID` | Kick `chatroom.id` used by the overlay | `0` |
| `KICK_APP_KEY` | Optional override for the public Kick/Pusher app key | Built-in public value |
| `KICK_CLUSTER` | Optional override for the Kick/Pusher cluster | `us2` |
| `YOUTUBE_CHANNEL` | YouTube handle used for automatic livestream discovery (hosted only) | Empty |
| `ENABLE_7TV` | Load global and automatically resolved channel-specific 7TV emotes | `true` |
| `ENABLE_BTTV` | Load global and automatically resolved channel-specific BTTV emotes | `true` |
| `ENABLE_FFZ` | Load global and automatically resolved channel-specific FFZ emotes | `true` |
| `MAX_MESSAGES` | Maximum messages kept in the overlay | `20` |
| `TWITCH_MESSAGE_COLOR` | Twitch message text color | `#FFFFFF` |
| `KICK_MESSAGE_COLOR` | Kick message text color | `#FFFFFF` |
| `YOUTUBE_MESSAGE_COLOR` | YouTube message text color (hosted only) | `#FFFFFF` |
| `ENABLE_TEXT_SHADOW` | Add a dark readability shadow to chat text | `false` |
| `HIDE_BADGES` | Hide all supported badges | `false` |
| `HIDE_SUB_BADGES` | Hide Twitch subscriber/founder and YouTube member badges | `false` |
| `HIDE_GLOBAL_BADGE` | Hide user-selected global Twitch badges | `false` |
| `HIDE_PLATFORM` | Hide Twitch, Kick and YouTube platform icons | `false` |
| `BLOCKED_USERS` | Usernames whose messages are ignored | `[]` |
| `BLOCK_ALL_PREFIX_COMMANDS` | Ignore messages starting with `!` | `false` |
| `BLOCKED_COMMANDS` | Ignore messages beginning with selected commands | `[]` |
| `BLOCK_LINKS` | Ignore messages containing HTTP, HTTPS or WWW links | `false` |

The editor accepts a `MAX_MESSAGES` value between `1` and `200`.

### Backward compatibility

Existing configurations using `SHOW_BADGES` remain supported:

- `SHOW_BADGES: true` behaves like `HIDE_BADGES: false`.
- `SHOW_BADGES: false` behaves like `HIDE_BADGES: true`.

When `HIDE_BADGES` is present, it takes precedence over the legacy setting. Missing newer options use their visible/default behavior.

The legacy `SEVENTV_USER_ID`, `BTTV_TWITCH_USER_ID` and `FFZ_CHANNEL` settings are still accepted as optional manual overrides by the overlay. They are no longer required or generated by the graphical editor.

## Manual configuration

The graphical editor is recommended. To configure the overlay manually, copy the example file.

Windows PowerShell:

```powershell
Copy-Item config_example.js config.js
```

macOS/Linux:

```bash
cp config_example.js config.js
```

Edit `config.js` and then refresh the OBS browser source. The personal file is excluded from Git so local channel settings are not committed accidentally.

## Troubleshooting

### Existing settings are not loaded

Make sure the file is named exactly `config.js` and is located next to `config.html` and `index.html`. Reload `config.html` after replacing the file.

### OBS still shows the old configuration

Refresh the browser source or use **Refresh cache of current page** in OBS after saving `config.js`.

### The Kick chatroom ID cannot be resolved

Make sure the Kick channel exists and try generating the configuration again. If Kick or the browser blocks the public channel endpoint, the editor reports the error, reveals the manual chatroom ID field and does not create a file or overlay link with an invalid ID.

### A Twitch badge is missing

- Make sure **Badges ausblenden** and the relevant individual badge switch are disabled.
- Make sure the sender is not listed under **Blockierte Benutzer**. A blocked message is discarded before badges are rendered.
- Refresh the OBS browser source after updating the configuration.
- If the external badge catalog is temporarily unavailable, chat remains visible but dynamic badge images may be missing.

### A configured platform is not connecting

- Twitch requires a non-empty channel name.
- Kick requires a valid numeric chatroom ID.
- YouTube requires a valid channel handle and is available only in the hosted variant.
- 7TV, BetterTTV and FrankerFaceZ can be disabled without affecting the Twitch connection.

### YouTube Live Chat does not appear

- Make sure the channel is currently live and that Live Chat is enabled for the stream. The overlay keeps checking an offline channel automatically, so the OBS URL can remain unchanged between streams.
- Verify that `youtube-proxy.php` was uploaded with the other files from `hosted` and that the server provides PHP 8.1 or newer with the cURL extension.
- Run the syntax and discovery checks documented in `hosted/README.md`. A proxy error is also written to the browser console and, for upstream cURL failures, to the PHP error log.

## External services

The overlay connects directly to Twitch, Kick and the configured emote/badge APIs to receive chat data and media. Hosted YouTube requests pass through the bundled same-origin PHP proxy solely to work around browser CORS restrictions. The service stores no overlay configuration and uses no database.

## Self-hosting the online variant

The self-contained `hosted` directory includes an Apache `.htaccess` file with these routes:

```text
/config  -> config.html
/chat    -> chat.html
```

Deploy only the contents of `hosted` into the document root of an Apache site with `mod_rewrite` enabled. `config.html` becomes the default page. Twitch and Kick remain static browser integrations. YouTube additionally requires PHP 8.1 or newer with the cURL extension. No database or project API key is required. The proxy writes only short-lived, hashed request counters into PHP's system temporary directory for abuse protection.

Self-hosted instances generate links relative to their own origin and deployment path. The directory contains its own HTML, CSS, JavaScript, images and license and does not reference files from the local variant in the repository root. Never add or upload a personal `config.js` to the public directory.

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE).

You may use, modify and self-host the project. If you operate a modified version as a network service, its corresponding source code must also be made available to the users of that service under the AGPL-3.0 terms.
