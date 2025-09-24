# Chat Overlay (Twitch + Kick + 7TV + BTTV)

A simple overlay for OBS that displays **Twitch chat** and **Kick chat** simultaneously, including **7TV** and **BTTV** emotes.  
The overlay runs completely locally in OBS as a **Browser Source** – no external service required.

---

## 🚀 Features
- Display Twitch and Kick chat
- Support for Twitch emotes, 7TV emotes, and BTTV emotes
- Unified layout with CSS (font, size, emote alignment)

---

## 📦 Installation
1. Clone or download the repository:
   ```bash
   git clone https://github.com/YOURNAME/chat-overlay.git
   cd chat-overlay
   ```

2. Copy the example config:
   ```bash
   cp config.js.example config.js
   ```

3. Enter your own values in `config.js`:
   - **Twitch channel name**
   - **Twitch OAuth token**
   - **Kick App Key + Chatroom ID**
   - **7TV user ID**
   - **BTTV Twitch user ID**

4. In OBS, add a **Browser Source**:
   - Select the local file: `overlay.html`
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

---

## 📄 License
MIT License – free to use and adapt.
