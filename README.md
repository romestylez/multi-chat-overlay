# Multi Chat Overlay (Twitch + Kick + 7TV + BetterTTV + FrankerFaceZ)

A simple overlay for OBS that displays **Twitch chat** and **Kick chat** simultaneously, including **7TV**, **BetterTTV** and **FrankerFaceZ** emotes.  
The overlay runs completely locally in OBS as a **Browser Source** – no external service required.

---

## 🚀 Features
- Display Twitch and Kick chat
- Support for Twitch emotes, 7TV emotes, BetterTTV emotes and FrankerFaceZ emotes
- Unified layout with CSS (font, size, emote alignment)
- **Blacklist support**: ignore messages from specific users (e.g. bots)

---

## 📦 Installation
1. Clone or download the repository:
   ```bash
   git clone https://github.com/romestylez/multi-chat-overlay.git
   cd multi-chat-overlay
   ```

2. Copy the example config:

   Windows (PowerShell):

   ```powershell
   Copy-Item config_example.js config.js
   ```

   macOS/Linux:

   ```bash
   cp config_example.js config.js
   ```

3. Enter your own values in `config.js`:
   - **Twitch channel name**
   - **Twitch OAuth token**
   - **Kick App Key + Chatroom ID**
   - **7TV user ID**
   - **BTTV Twitch user ID**
   - **Maximum number of visible messages**
   - *(optional)* **Blocked users list**
   - *(optional)* **Blocked individual commands**
   - *(optional)* **Block all prefixed commands yes/no**
   - *(optional)* **Block links yes/no**
   - *(optional)* **Show badges yes/no**

4. In OBS, add a **Browser Source**:
   - Enable **Local file** and select `index.html`
   - Set the size, e.g., `800x600` or whatever fits your layout

---

## 🔑 Required Data

### Twitch
- `TWITCH_CHANNEL` = your Twitch channel name (e.g. `smtxlost`)  
- `TWITCH_OAUTH` = Chat token in the format `oauth:xxxxxxxxxxxx`  

👉 How to get your token:  
- Use: [https://twitchtokengenerator.com/](https://twitchtokengenerator.com/)  
- Select the scope: `chat:read` is sufficient  
- Copy the token and paste it into `config.js`  

⚠️ Note: Tokens can expire. If that happens, you’ll need to generate a new one.  

### Kick
- `KICK_APP_KEY` and `KICK_CLUSTER` → **public values used by Kick for all users** (not secret, usually `32cbd69e4b950bf97679` and `us2`)  
- `KICK_CHATROOM_ID` → unique per channel. Find it via the API:  
  `https://kick.com/api/v1/channels/YOUR_CHANNEL`  
  Look in the JSON for: `chatroom":{"id":...}`

### 7TV
- `SEVENTV_USER_ID` → your user ID from [https://7tv.app](https://7tv.app)  

### BTTV
- `BTTV_TWITCH_USER_ID` → your Twitch user ID  
  (e.g. via: [https://streamscharts.com/tools/convert-username](https://streamscharts.com/tools/convert-username))

### FrankerFaceZ (FFZ)
- `FFZ_CHANNEL` → your Twitch channel name (same as `TWITCH_CHANNEL`)  
  Used to load your channel-specific FrankerFaceZ emotes.

### Display
- `MAX_MESSAGES` → maximum number of messages visible at once.
- `SHOW_BADGES` → show or hide Twitch and Kick badges.

### Filters
- `BLOCKED_USERS` → an array of usernames to ignore (case-insensitive).  
  Example:
  ```js
  BLOCKED_USERS: ["nightbot", "streamelements", "moobot"]
  ```
  Messages from these users will not appear in the overlay.
- `BLOCK_ALL_PREFIX_COMMANDS` → ignore every message starting with `!`.
- `BLOCKED_COMMANDS` → ignore selected commands. Include the prefix in each entry.
  Example:
  ```js
  BLOCKED_COMMANDS: ["!discord", "!socials"]
  ```
- `BLOCK_LINKS` → ignore messages containing `http://`, `https://` or `www.`.

> `MAX_MESSAGES` is part of the configuration schema prepared for the upcoming configuration editor. The current overlay still uses its built-in value of `20` until the overlay integration is implemented.

---

## 📄 License
MIT License – free to use and adapt.
