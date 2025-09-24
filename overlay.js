// ==== KONFIGURATION ==== (aus config.js laden)
const TWITCH_CHANNEL       = CONFIG.TWITCH_CHANNEL;
const TWITCH_OAUTH         = CONFIG.TWITCH_OAUTH;

const KICK_APP_KEY         = CONFIG.KICK_APP_KEY;
const KICK_CLUSTER         = CONFIG.KICK_CLUSTER;
const KICK_CHATROOM_ID     = CONFIG.KICK_CHATROOM_ID;

const SEVENTV_USER_ID      = CONFIG.SEVENTV_USER_ID;
const BTTV_TWITCH_USER_ID  = CONFIG.BTTV_TWITCH_USER_ID;

// ====== Anzeige ======
const MAX_MESSAGES = 20;      

// ==== State ====
const chatBox = document.getElementById("chat");
let emoteMap = {};
let twitchEmoteCache = {};

// ===== 7TV laden =====
async function load7TVUser() {
  try {
    const res = await fetch(`https://7tv.io/v3/users/${SEVENTV_USER_ID}`);
    const data = await res.json();
    if (data?.connections?.[0]?.emote_set?.emotes) {
      data.connections[0].emote_set.emotes.forEach(e => {
        emoteMap[e.name] = `https:${e.data.host.url}/4x.webp`;
      });
      console.log("[7TV] User-Set geladen:", data.connections[0].emote_set.emotes.length);
    }
  } catch (err) {
    console.warn("[7TV] Fehler User-Set:", err);
  }
}

async function load7TVGlobal() {
  try {
    const res = await fetch("https://7tv.io/v3/emote-sets/global");
    const data = await res.json();
    if (data?.emotes) {
      data.emotes.forEach(e => {
        emoteMap[e.name] = `https:${e.data.host.url}/4x.webp`;
      });
      console.log("[7TV] Globale Emotes geladen:", data.emotes.length);
    }
  } catch (err) {
    console.warn("[7TV] Fehler Global:", err);
  }
}

// ===== BTTV laden =====
async function loadBTTVGlobal() {
  try {
    const res = await fetch("https://api.betterttv.net/3/cached/emotes/global");
    const data = await res.json();
    data.forEach(e => {
      emoteMap[e.code] = `https://cdn.betterttv.net/emote/${e.id}/3x`;
    });
    console.log("[BTTV] Globale Emotes geladen:", data.length);
  } catch (err) {
    console.warn("[BTTV] Fehler Global:", err);
  }
}

async function loadBTTVChannel(twitchUserId) {
  try {
    const res = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${twitchUserId}`);
    const data = await res.json();
    (data.channelEmotes || []).forEach(e => {
      emoteMap[e.code] = `https://cdn.betterttv.net/emote/${e.id}/3x`;
    });
    (data.sharedEmotes || []).forEach(e => {
      emoteMap[e.code] = `https://cdn.betterttv.net/emote/${e.id}/3x`;
    });
    console.log("[BTTV] Channel-Emotes geladen");
  } catch (err) {
    console.warn("[BTTV] Fehler Channel:", err);
  }
}

// ===== Text/Emotes =====
function renderTextWithTwitch(text, twitchEmotes) {
  if (!text) return "";
  let output = "";
  let lastIndex = 0;

  if (twitchEmotes && Object.keys(twitchEmotes).length > 0) {
    const positions = [];
    for (const emoteId in twitchEmotes) {
      twitchEmotes[emoteId].forEach(pos => {
        const [start, end] = pos.split("-").map(Number);
        positions.push({ emoteId, start, end });
      });
    }
    positions.sort((a, b) => a.start - b.start);

    positions.forEach(({ emoteId, start, end }) => {
      if (lastIndex < start) {
        output += renderText7TV_BTTV(text.substring(lastIndex, start));
      }
      const emoteUrl = getTwitchEmoteUrl(emoteId);
      output += `<img class="emote" src="${emoteUrl}" alt="emote">`;
      lastIndex = end + 1;
    });

    if (lastIndex < text.length) {
      output += renderText7TV_BTTV(text.substring(lastIndex));
    }
    return output;
  }
  return renderText7TV_BTTV(text);
}

function renderText7TV_BTTV(text) {
  const tokens = text.match(/(\w+|[^\w\s]+)/g) || [];
  return tokens.map(tok => {
    if (emoteMap.hasOwnProperty(tok)) {
      return `<img class="emote" src="${emoteMap[tok]}" alt="${tok}">`;
    }
    return escapeHtml(tok);
  }).join(" ");
}

function getTwitchEmoteUrl(id) {
  if (!twitchEmoteCache[id]) {
    twitchEmoteCache[id] = `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0`;
  }
  return twitchEmoteCache[id];
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, s =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])
  );
}

// ===== Nachricht anzeigen =====
function addMessage(user, text, platform, twitchEmotes = null, nameColor = "#fff") {
  const el = document.createElement("div");
  el.className = "message";
  let icon = platform === "Twitch" ? "twitch.png" : "kick.png";

  let renderedText;
  if (platform === "Twitch") {
    renderedText = renderTextWithTwitch(text, twitchEmotes);
  } else if (platform === "Kick") {
    renderedText = text;
  }

  el.innerHTML = `
    <img src="img/${icon}" style="height:18px;margin-right:4px;vertical-align:middle">
    <span style="font-weight:bold;margin:0 6px;color:${nameColor}">${escapeHtml(user)}:</span>
    ${renderedText}
  `;

  chatBox.appendChild(el);
  chatBox.scrollTop = chatBox.scrollHeight;
  while (chatBox.childNodes.length > MAX_MESSAGES) {
    chatBox.removeChild(chatBox.firstChild);
  }
}

// ===== Twitch verbinden =====
function connectTwitch() {
  const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
  ws.onopen = () => {
    ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
    ws.send(`PASS ${TWITCH_OAUTH}`);
    ws.send(`NICK ${TWITCH_CHANNEL}`);
    ws.send(`JOIN #${TWITCH_CHANNEL}`);
    console.log("[Twitch] Verbunden");
  };
  ws.onmessage = (event) => {
    const lines = event.data.trim().split("\r\n");
    for (const msg of lines) {
      if (msg.startsWith("PING")) { ws.send("PONG :tmi.twitch.tv"); continue; }
      if (msg.includes("PRIVMSG")) {
        const tagsRaw = msg.startsWith("@") ? msg.split(" ")[0] : "";
        const tags = {};
        if (tagsRaw) {
          tagsRaw.substring(1).split(";").forEach(t => {
            const [k, v] = t.split("="); tags[k] = v ?? "";
          });
        }
        const user = tags["display-name"] || msg.split("!")[0].substring(1);
        const text = msg.split("PRIVMSG")[1].split(" :")[1] ?? "";
        let twitchEmotes = null;
        if (tags["emotes"]) {
          twitchEmotes = {};
          tags["emotes"].split("/").forEach(e => {
            const [id, positions] = e.split(":");
            twitchEmotes[id] = positions.split(",");
          });
        }
        addMessage(user, text, "Twitch", twitchEmotes, tags["color"] || "#fff");
      }
    }
  };
}

// ===== Kick verbinden =====
function connectKick() {
  const wsUrl = `wss://ws-${KICK_CLUSTER}.pusher.com/app/${KICK_APP_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("[Kick] Verbunden (Pusher)");
    const subMsg = {
      event: "pusher:subscribe",
      data: { channel: `chatrooms.${KICK_CHATROOM_ID}.v2` }
    };
    ws.send(JSON.stringify(subMsg));
  };

  ws.onmessage = (evt) => {
    try {
      const payload = JSON.parse(evt.data);
      if (payload.event === "App\\Events\\ChatMessageEvent") {
        const inner = JSON.parse(payload.data);
        const user = inner.sender?.username || "unknown";
        let text = inner.content || "";
        const color = inner.sender?.identity?.color || "#fff";

        // Kick-Emotes: [emote:ID:NAME] ersetzen
        text = text.replace(/\[emote:(\d+):([^\]]+)\]/g, (m, id, name) => {
          const url = `https://files.kick.com/emotes/${id}/fullsize`;
          return `<img class="emote" src="${url}" alt="${name}">`;
        });

        addMessage(user, text, "Kick", null, color);
      }
    } catch (e) {
      console.error("[Kick] Parse-Fehler:", e, evt.data);
    }
  };

  ws.onerror = (err) => console.error("[Kick] Fehler:", err);
  ws.onclose = () => console.warn("[Kick] Verbindung geschlossen");
}

// ===== Start =====
(async () => {
  await load7TVUser();
  await load7TVGlobal();
  await loadBTTVGlobal();
  await loadBTTVChannel(BTTV_TWITCH_USER_ID);
  connectTwitch();
  connectKick();
})();
