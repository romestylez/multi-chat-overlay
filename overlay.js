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

// ===== FFZ laden =====
function normalizeFfzUrl(url) {
  return url.startsWith("//") ? `https:${url}` : url;
}

async function loadFFZChannel(channelName) {
  try {
    const res = await fetch(`https://api.frankerfacez.com/v1/room/${channelName}`);
    const data = await res.json();
    if (data.sets) {
      let count = 0;
      for (const set of Object.values(data.sets)) {
        set.emoticons.forEach(e => {
          const urls = e.urls || {};
          const url = urls["4"] || urls["2"] || urls["1"];
          if (url) {
            emoteMap[e.name] = normalizeFfzUrl(url);
            count++;
          }
        });
      }
      console.log(`[FFZ] Channel-Emotes geladen: ${count}`);
    }
  } catch (err) {
    console.warn("[FFZ] Fehler Channel:", err);
  }
}

async function loadFFZGlobal() {
  try {
    const res = await fetch("https://api.frankerfacez.com/v1/set/global");
    const data = await res.json();
    if (data.sets) {
      let count = 0;
      for (const set of Object.values(data.sets)) {
        set.emoticons.forEach(e => {
          const urls = e.urls || {};
          const url = urls["4"] || urls["2"] || urls["1"];
          if (url) {
            emoteMap[e.name] = normalizeFfzUrl(url);
            count++;
          }
        });
      }
      console.log(`[FFZ] Globale Emotes geladen: ${count}`);
    }
  } catch (err) {
    console.warn("[FFZ] Fehler Global:", err);
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
  if (!text) return "";
  const parts = text.split(/\s+/);
  return parts.map(part => {
    if (emoteMap.hasOwnProperty(part)) {
      return `<img class="emote" src="${emoteMap[part]}" alt="${part}">`;
    }
    return escapeHtml(part);
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

function addMessage(user, text, platform, twitchEmotes = null, nameColor = "#fff", badgesHtml = "") {
  // --- Filter: blockierte User ---
  if (CONFIG.BLOCKED_USERS && CONFIG.BLOCKED_USERS.map(u => u.toLowerCase()).includes(user.toLowerCase())) {
    return;
  }

  // --- Filter: Commands blockieren ---
  // 1) Alle Nachrichten blocken, die mit "!" beginnen
  if (CONFIG.BLOCK_ALL_PREFIX_COMMANDS && text && text.trim().startsWith("!")) {
    return;
  }

  // 2) Einzelne Commands blockieren
  if (CONFIG.BLOCKED_COMMANDS && text) {
    const lowered = text.toLowerCase().trim();
    for (const cmd of CONFIG.BLOCKED_COMMANDS) {
      if (lowered.startsWith(cmd.toLowerCase())) {
        return;
      }
    }
  }

  // ✅ --- Filter: Links blockieren ---
  if (CONFIG.BLOCK_LINKS && text && /(https?:\/\/|www\.)/i.test(text)) {
    return;
  }

  // ---------------------------------------

  const el = document.createElement("div");
  el.className = "message";
  let icon = platform === "Twitch" ? "twitch_icon.png" : "kick_icon.png";

  let renderedText;
  if (platform === "Twitch") {
    renderedText = renderTextWithTwitch(text, twitchEmotes);
  } else if (platform === "Kick") {
    renderedText = text;
  }

  el.innerHTML =
  `<img class="platform-icon" src="img/${icon}">
   ${CONFIG.SHOW_BADGES ? badgesHtml : ""}
   <span class="username" style="color:${nameColor}">${escapeHtml(user)}:</span>
   ${renderedText}`;


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

        // Twitch-Badges
let badgesHtml = "";
if (CONFIG.SHOW_BADGES && tags["badges"]) {
  tags["badges"].split(",").forEach(b => {
    const [type] = b.split("/");

    if (type === "lead_moderator") {
      badgesHtml += `<img class="badge" src="img/twitch_lead_mod.png" alt="lead-mod" style="height:18px;vertical-align:middle;margin-right:4px">`;
    } 
    else if (type === "moderator") {
      badgesHtml += `<img class="badge" src="img/twitch_mod.png" alt="mod" style="height:18px;vertical-align:middle;margin-right:4px">`;
    } 
    else if (type === "vip") {
      badgesHtml += `<img class="badge" src="img/twitch_vip.png" alt="vip" style="height:18px;vertical-align:middle;margin-right:4px">`;
    }
  });
}

        addMessage(user, text, "Twitch", twitchEmotes, tags["color"] || "#fff", badgesHtml);
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

        // Kick-Emotes
        text = text.replace(/\[emote:(\d+):([^\]]+)\]/g, (m, id, name) => {
          const url = `https://files.kick.com/emotes/${id}/fullsize`;
          return `<img class="emote" src="${url}" alt="${name}">`;
        });

        // Kick-Badges
        let badgesHtml = "";
        if (CONFIG.SHOW_BADGES) {
          (inner.sender.identity?.badges || []).forEach(b => {
            if (b.type === "moderator") {
              badgesHtml += `<img class="badge" src="img/kick_mod.svg" alt="mod" style="height:18px;vertical-align:middle;margin-right:4px">`;
            } else if (b.type === "vip") {
              badgesHtml += `<img class="badge" src="img/kick_vip.png" alt="vip" style="height:18px;vertical-align:middle;margin-right:4px">`;
            }
          });
        }

        addMessage(user, text, "Kick", null, color, badgesHtml);
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
  await loadFFZGlobal();
  await loadFFZChannel(CONFIG.FFZ_CHANNEL);
  connectTwitch();
  connectKick();
})();
