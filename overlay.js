// ==== KONFIGURATION ==== (aus config.js laden)
const OVERLAY_CONFIG = typeof CONFIG !== "undefined" ? CONFIG : {};

const TWITCH_CHANNEL       = OVERLAY_CONFIG.TWITCH_CHANNEL || "";
const TWITCH_OAUTH         = OVERLAY_CONFIG.TWITCH_OAUTH || "";
const TWITCH_USERNAME      = OVERLAY_CONFIG.TWITCH_USERNAME || TWITCH_CHANNEL;

const KICK_APP_KEY         = OVERLAY_CONFIG.KICK_APP_KEY || "32cbd69e4b950bf97679";
const KICK_CLUSTER         = OVERLAY_CONFIG.KICK_CLUSTER || "us2";
const KICK_CHATROOM_ID     = Number(OVERLAY_CONFIG.KICK_CHATROOM_ID) || 0;

const SEVENTV_USER_ID      = OVERLAY_CONFIG.SEVENTV_USER_ID || "";
const BTTV_TWITCH_USER_ID  = OVERLAY_CONFIG.BTTV_TWITCH_USER_ID || "";
const FFZ_CHANNEL          = OVERLAY_CONFIG.FFZ_CHANNEL || TWITCH_CHANNEL;
const ENABLE_7TV           = OVERLAY_CONFIG.ENABLE_7TV !== false;
const ENABLE_BTTV          = OVERLAY_CONFIG.ENABLE_BTTV !== false;
const ENABLE_FFZ           = OVERLAY_CONFIG.ENABLE_FFZ !== false;

function configuredColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

const TWITCH_MESSAGE_COLOR = configuredColor(OVERLAY_CONFIG.TWITCH_MESSAGE_COLOR, "#ffffff");
const KICK_MESSAGE_COLOR   = configuredColor(OVERLAY_CONFIG.KICK_MESSAGE_COLOR, "#ffffff");
const ENABLE_TEXT_SHADOW   = OVERLAY_CONFIG.ENABLE_TEXT_SHADOW === true;

const FONT_FAMILY_STACKS = Object.freeze({
  system: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  arial: "Arial, Helvetica, sans-serif",
  verdana: "Verdana, Geneva, sans-serif",
  tahoma: "Tahoma, Geneva, sans-serif",
  trebuchet: "'Trebuchet MS', Arial, sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  courier: "'Courier New', Courier, monospace"
});
const configuredFontSize = Number(OVERLAY_CONFIG.CHAT_FONT_SIZE);
const CHAT_FONT_SIZE = Number.isInteger(configuredFontSize) && configuredFontSize >= 12 && configuredFontSize <= 48 ? configuredFontSize : 20;
const CHAT_FONT_FAMILY = FONT_FAMILY_STACKS[OVERLAY_CONFIG.CHAT_FONT_FAMILY] || FONT_FAMILY_STACKS.system;
const configuredFontWeight = Number(OVERLAY_CONFIG.CHAT_FONT_WEIGHT);
const CHAT_FONT_WEIGHT = Number.isInteger(configuredFontWeight) && configuredFontWeight >= 300 && configuredFontWeight <= 900 && configuredFontWeight % 100 === 0
  ? configuredFontWeight
  : 800;

// ====== Anzeige ======
const configuredMaxMessages = Number(OVERLAY_CONFIG.MAX_MESSAGES);
const MAX_MESSAGES = Number.isInteger(configuredMaxMessages) && configuredMaxMessages > 0
  ? configuredMaxMessages
  : 20;
const HIDE_BADGES = Object.prototype.hasOwnProperty.call(OVERLAY_CONFIG, "HIDE_BADGES")
  ? OVERLAY_CONFIG.HIDE_BADGES === true
  : OVERLAY_CONFIG.SHOW_BADGES === false;
const SHOW_BADGES = !HIDE_BADGES;
const HIDE_SUB_BADGES = OVERLAY_CONFIG.HIDE_SUB_BADGES === true;
const HIDE_GLOBAL_BADGE = OVERLAY_CONFIG.HIDE_GLOBAL_BADGE === true;
const HIDE_PLATFORM = OVERLAY_CONFIG.HIDE_PLATFORM === true;

// ==== State ====
const chatBox = document.getElementById("chat");
chatBox.style.fontSize = `${CHAT_FONT_SIZE}px`;
chatBox.style.fontFamily = CHAT_FONT_FAMILY;
chatBox.style.fontWeight = String(CHAT_FONT_WEIGHT);
let emoteMap = {};
let twitchEmoteCache = {};
let twitchBadgeMap = {};
let twitchBadgeRoomId = "";
let twitchBadgeLoadPromise = null;
let sevenTvTwitchUserId = "";
let sevenTvChannelLoadPromise = null;
let bttvTwitchUserId = "";
let bttvChannelLoadPromise = null;

// ===== Twitch-Badges laden =====
function resolvePendingTwitchBadges() {
  document.querySelectorAll("[data-twitch-badge-key]").forEach(element => {
    const badge = twitchBadgeMap[element.dataset.twitchBadgeKey];
    if (!badge) return;

    element.src = badge.imageUrl;
    element.alt = badge.title;
    element.title = badge.title;
    element.classList.remove("twitch-badge-pending");
    element.removeAttribute("data-twitch-badge-key");
  });
}

function indexTwitchBadgeSets(data) {
  const badgeSets = Array.isArray(data) ? data : [data];

  badgeSets.forEach(set => {
    if (!set?.set_id || !Array.isArray(set.versions)) return;

    set.versions.forEach(version => {
      const imageUrl = version?.image_url_2x || version?.image_url_1x;
      if (!version?.id || !imageUrl) return;

      twitchBadgeMap[`${set.set_id}/${version.id}`] = {
        imageUrl,
        title: version.title || set.set_id
      };
    });
  });

  resolvePendingTwitchBadges();
}

async function loadTwitchBadges(roomId) {
  const normalizedRoomId = String(roomId || "").trim();
  if (!SHOW_BADGES || !normalizedRoomId) return;
  if (twitchBadgeRoomId === normalizedRoomId && twitchBadgeLoadPromise) {
    return twitchBadgeLoadPromise;
  }

  twitchBadgeRoomId = normalizedRoomId;
  twitchBadgeMap = {};
  twitchBadgeLoadPromise = (async () => {
    const requests = [
      fetch(`https://api.ivr.fi/v2/twitch/badges/channel?id=${encodeURIComponent(normalizedRoomId)}`),
      fetch("https://api.ivr.fi/v2/twitch/badges/global")
    ];
    const results = await Promise.allSettled(requests);
    let loadedSets = 0;

    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value.ok) continue;

      try {
        const data = await result.value.json();
        indexTwitchBadgeSets(data);
        loadedSets++;
      } catch (error) {
        console.warn("[Twitch] Badge-Antwort konnte nicht gelesen werden:", error);
      }
    }

    if (loadedSets > 0) {
      console.log("[Twitch] Badge-Katalog geladen");
    } else {
      console.warn("[Twitch] Badge-Katalog nicht verfügbar; Chat läuft ohne dynamische Badges weiter");
    }
  })().catch(error => {
    console.warn("[Twitch] Badge-Katalog konnte nicht geladen werden:", error);
  });

  return twitchBadgeLoadPromise;
}

// ===== 7TV laden =====
function index7TVEmotes(emotes, label) {
  if (!Array.isArray(emotes)) return;

  emotes.forEach(e => {
    emoteMap[e.name] = `https:${e.data.host.url}/4x.webp`;
  });
  console.log(`[7TV] ${label} geladen:`, emotes.length);
}

async function load7TVUser() {
  try {
    const res = await fetch(`https://7tv.io/v3/users/${SEVENTV_USER_ID}`);
    const data = await res.json();
    index7TVEmotes(data?.connections?.[0]?.emote_set?.emotes, "Manuelles User-Set");
  } catch (err) {
    console.warn("[7TV] Fehler User-Set:", err);
  }
}

async function load7TVTwitchUser(twitchUserId) {
  const normalizedUserId = String(twitchUserId || "").trim();
  if (!normalizedUserId) return;
  if (sevenTvTwitchUserId === normalizedUserId && sevenTvChannelLoadPromise) {
    return sevenTvChannelLoadPromise;
  }

  sevenTvTwitchUserId = normalizedUserId;
  sevenTvChannelLoadPromise = (async () => {
    try {
      const res = await fetch(`https://7tv.io/v3/users/twitch/${encodeURIComponent(normalizedUserId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      index7TVEmotes(data?.emote_set?.emotes, "Channel-Emotes");
    } catch (err) {
      console.warn("[7TV] Fehler Channel:", err);
    }
  })();

  return sevenTvChannelLoadPromise;
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
  const normalizedUserId = String(twitchUserId || "").trim();
  if (!normalizedUserId) return;
  if (bttvTwitchUserId === normalizedUserId && bttvChannelLoadPromise) {
    return bttvChannelLoadPromise;
  }

  bttvTwitchUserId = normalizedUserId;
  bttvChannelLoadPromise = (async () => {
    try {
      const res = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(normalizedUserId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
  })();

  return bttvChannelLoadPromise;
}

function loadAutomaticTwitchChannelEmotes(roomId) {
  if (ENABLE_7TV && !SEVENTV_USER_ID) load7TVTwitchUser(roomId);
  if (ENABLE_BTTV && !BTTV_TWITCH_USER_ID) loadBTTVChannel(roomId);
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

function renderKickText(text) {
  const content = String(text || "");
  const emotePattern = /\[emote:(\d+):([^\]]+)\]/g;
  let output = "";
  let lastIndex = 0;
  let match;

  while ((match = emotePattern.exec(content)) !== null) {
    output += escapeHtml(content.slice(lastIndex, match.index));
    const [, id, name] = match;
    output += `<img class="emote" src="https://files.kick.com/emotes/${id}/fullsize" alt="${escapeHtml(name)}">`;
    lastIndex = match.index + match[0].length;
  }

  output += escapeHtml(content.slice(lastIndex));
  return output;
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

function parseTwitchTags(rawTags) {
  const tags = {};

  String(rawTags || "").split(";").forEach(tag => {
    if (!tag) return;
    const separatorIndex = tag.indexOf("=");
    const key = separatorIndex === -1 ? tag : tag.substring(0, separatorIndex);
    const value = separatorIndex === -1 ? "" : tag.substring(separatorIndex + 1);
    if (key) tags[key] = value;
  });

  return tags;
}

// Zerlegt eine IRC-Zeile in "@tags :prefix COMMAND params :trailing". Das Kommando
// darf nur aus diesem Feld gelesen werden: Nachrichtentexte, Anzeigenamen und Tags
// wie reply-parent-msg-body enthalten beliebigen Text und dürfen kein Ereignis auslösen.
const IRC_LINE_PATTERN = /^(?:@(\S*) )?(?::(\S*) )?([A-Za-z0-9]+)(?: (.*))?$/;

function parseIrcLine(line) {
  const match = IRC_LINE_PATTERN.exec(String(line || ""));
  if (!match) return null;

  const [, rawTags = "", prefix = "", command = "", rawParams = ""] = match;
  const trailingIndex = rawParams.startsWith(":") ? 0 : rawParams.indexOf(" :");
  const middle = trailingIndex === -1 ? rawParams : rawParams.slice(0, trailingIndex);
  const trailing = trailingIndex === -1 ? "" : rawParams.slice(trailingIndex === 0 ? 1 : trailingIndex + 2);

  return {
    tags: parseTwitchTags(rawTags),
    prefix,
    command: command.toUpperCase(),
    params: middle.trim() ? middle.trim().split(" ") : [],
    trailing,
    // Moderationsereignisse stammen immer vom Server, nie von einem Nutzer-Prefix.
    fromServer: prefix === "tmi.twitch.tv"
  };
}

function twitchBadgeImage(src, alt) {
  return `<img class="badge" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" title="${escapeHtml(alt)}">`;
}

function pendingTwitchBadgeImage(type, version) {
  const key = `${type}/${version}`;
  return `<img class="badge twitch-badge-pending" data-twitch-badge-key="${escapeHtml(key)}" alt="">`;
}

function buildTwitchBadgesHtml(tags) {
  if (!SHOW_BADGES || !tags.badges) return "";

  const badges = new Map();
  tags.badges.split(",").forEach(badge => {
    const [type, version = "0"] = badge.split("/");
    if (type) badges.set(type, version);
  });

  let roleBadgeHtml = "";
  const rolePriority = [
    "broadcaster",
    "lead_moderator",
    "moderator",
    "vip",
    "artist-badge",
    "staff",
    "admin",
    "global_mod"
  ];

  for (const type of rolePriority) {
    if (!badges.has(type)) continue;

    const version = badges.get(type);
    const dynamicBadge = twitchBadgeMap[`${type}/${version}`];
    if (dynamicBadge) {
      roleBadgeHtml = twitchBadgeImage(dynamicBadge.imageUrl, dynamicBadge.title);
    } else if (type === "lead_moderator") {
      roleBadgeHtml = twitchBadgeImage("img/twitch_lead_mod.png", "Lead Moderator");
    } else if (type === "moderator") {
      roleBadgeHtml = twitchBadgeImage("img/twitch_mod.png", "Moderator");
    } else if (type === "vip") {
      roleBadgeHtml = twitchBadgeImage("img/twitch_vip.png", "VIP");
    } else {
      roleBadgeHtml = pendingTwitchBadgeImage(type, version);
    }
    break;
  }

  let subBadgeHtml = "";
  if (!HIDE_SUB_BADGES) {
    const subType = badges.has("founder") ? "founder" : badges.has("subscriber") ? "subscriber" : "";
    if (subType) {
      const version = badges.get(subType);
      const dynamicBadge = twitchBadgeMap[`${subType}/${version}`];
      if (dynamicBadge) {
        subBadgeHtml = twitchBadgeImage(dynamicBadge.imageUrl, dynamicBadge.title);
      } else {
        subBadgeHtml = pendingTwitchBadgeImage(subType, version);
      }
    }
  }

  let globalBadgeHtml = "";
  if (!HIDE_GLOBAL_BADGE) {
    const reservedTypes = new Set([...rolePriority, "subscriber", "founder"]);
    for (const [type, version] of badges) {
      if (reservedTypes.has(type)) continue;

      const dynamicBadge = twitchBadgeMap[`${type}/${version}`];
      if (dynamicBadge) {
        globalBadgeHtml = twitchBadgeImage(dynamicBadge.imageUrl, dynamicBadge.title);
      } else {
        globalBadgeHtml = pendingTwitchBadgeImage(type, version);
      }
      break;
    }
  }

  return roleBadgeHtml + subBadgeHtml + globalBadgeHtml;
}

function addMessage(user, text, platform, twitchEmotes = null, nameColor = "#fff", badgesHtml = "", msgId = null) {
  // --- Filter: blockierte User ---
  if (OVERLAY_CONFIG.BLOCKED_USERS && OVERLAY_CONFIG.BLOCKED_USERS.map(u => u.toLowerCase()).includes(user.toLowerCase())) {
    return;
  }

  // --- Filter: Commands blockieren ---
  // 1) Alle Nachrichten blocken, die mit "!" beginnen
  if (OVERLAY_CONFIG.BLOCK_ALL_PREFIX_COMMANDS && text && text.trim().startsWith("!")) {
    return;
  }

  // 2) Einzelne Commands blockieren
  if (OVERLAY_CONFIG.BLOCKED_COMMANDS && text) {
    const lowered = text.toLowerCase().trim();
    for (const cmd of OVERLAY_CONFIG.BLOCKED_COMMANDS) {
      if (lowered.startsWith(cmd.toLowerCase())) {
        return;
      }
    }
  }

  // ✅ --- Filter: Links blockieren ---
  if (OVERLAY_CONFIG.BLOCK_LINKS && text && /(https?:\/\/|www\.)/i.test(text)) {
    return;
  }

  // ---------------------------------------

  const el = document.createElement("div");
  el.className = "message";
  if (ENABLE_TEXT_SHADOW) el.classList.add("text-shadow-enabled");
  let icon = platform === "Twitch" ? "twitch_icon.png" : "kick_icon.png";
if (msgId) {
  el.dataset.msgId = msgId;
  el.dataset.user = user.toLowerCase();
}


  let renderedText;
  if (platform === "Twitch") {
    renderedText = renderTextWithTwitch(text, twitchEmotes);
  } else if (platform === "Kick") {
    renderedText = renderKickText(text);
  }

  const platformIconHtml = HIDE_PLATFORM
    ? ""
    : `<img class="platform-icon" src="img/${icon}" alt="${platform}">`;
  const messageColor = platform === "Twitch" ? TWITCH_MESSAGE_COLOR : KICK_MESSAGE_COLOR;
  const safeNameColor = configuredColor(nameColor, "#ffffff");

  el.innerHTML =
  `${platformIconHtml}
   ${SHOW_BADGES ? badgesHtml : ""}
   <span class="username" style="color:${safeNameColor}">${escapeHtml(user)}:</span>
   <span class="message-text" style="color:${messageColor}">${renderedText}</span>`;


  chatBox.appendChild(el);
  chatBox.scrollTop = chatBox.scrollHeight;
  while (chatBox.childNodes.length > MAX_MESSAGES) {
    chatBox.removeChild(chatBox.firstChild);
  }
}


// ===== Twitch verbinden =====
function connectTwitch() {
  const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
  const nickname = TWITCH_OAUTH
    ? TWITCH_USERNAME
    : `justinfan${Math.floor(Math.random() * 900000 + 100000)}`;

  ws.onopen = () => {
    ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
    ws.send(`PASS ${TWITCH_OAUTH || "SCHMOOPIIE"}`);
    ws.send(`NICK ${nickname}`);
    ws.send(`JOIN #${TWITCH_CHANNEL}`);
    console.log(`[Twitch] Verbunden (${TWITCH_OAUTH ? "OAuth" : "anonym"})`);
  };
  
    ws.onmessage = (event) => {
    const lines = event.data.trim().split("\r\n");

    for (const line of lines) {
      const message = parseIrcLine(line);
      if (!message) continue;
      const tags = message.tags;

      // PING
      if (message.command === "PING") {
        ws.send("PONG :tmi.twitch.tv");
        continue;
      }

      // CLEARMSG (einzelne Nachricht gelöscht)
      if (message.command === "CLEARMSG" && message.fromServer) {
        const targetMsgId = tags["target-msg-id"];
        if (targetMsgId) {
          const el = [...document.querySelectorAll("[data-msg-id]")]
            .find(element => element.dataset.msgId === targetMsgId);
          if (el) el.remove();
        }
        continue;
      }

      // ROOMSTATE liefert die Twitch-Kanal-ID für den Badge-Katalog.
      if (message.command === "ROOMSTATE" && message.fromServer) {
        if (tags["room-id"]) {
          loadTwitchBadges(tags["room-id"]);
          loadAutomaticTwitchChannelEmotes(tags["room-id"]);
        }
        continue;
      }

      // CLEARCHAT (Ban / Timeout / /clear)
      if (message.command === "CLEARCHAT" && message.fromServer) {
        const username = message.trailing.trim().toLowerCase();

        if (username) {
          [...document.querySelectorAll("[data-user]")]
            .filter(element => element.dataset.user === username)
            .forEach(el => el.remove());
        } else {
          chatBox.innerHTML = "";
        }
        continue;
      }

      // PRIVMSG (normale Nachricht)
      if (message.command === "PRIVMSG") {
        if (tags["room-id"]) {
          loadTwitchBadges(tags["room-id"]);
          loadAutomaticTwitchChannelEmotes(tags["room-id"]);
        }

        const user = tags["display-name"] || message.prefix.split("!")[0];
        const text = message.trailing;
        const msgId = tags["id"] || null;

        let twitchEmotes = null;
        if (tags["emotes"]) {
          twitchEmotes = {};
          tags["emotes"].split("/").forEach(e => {
            const [id, positions] = e.split(":");
            twitchEmotes[id] = positions.split(",");
          });
        }

        const badgesHtml = buildTwitchBadgesHtml(tags);

        addMessage(user, text, "Twitch", twitchEmotes, tags["color"] || "#fff", badgesHtml, msgId);
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
        const text = inner.content || "";
        const color = inner.sender?.identity?.color || "#fff";

        // Kick-Badges
        let badgesHtml = "";
        if (SHOW_BADGES) {
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
  if (ENABLE_7TV) {
    if (SEVENTV_USER_ID) await load7TVUser();
    await load7TVGlobal();
  }
  if (ENABLE_BTTV) {
    await loadBTTVGlobal();
    if (BTTV_TWITCH_USER_ID) await loadBTTVChannel(BTTV_TWITCH_USER_ID);
  }
  if (ENABLE_FFZ) {
    await loadFFZGlobal();
    if (FFZ_CHANNEL) await loadFFZChannel(FFZ_CHANNEL);
  }

  if (TWITCH_CHANNEL) {
    connectTwitch();
  } else {
    console.warn("[Twitch] Kein Kanal konfiguriert");
  }

  if (KICK_CHATROOM_ID) {
    connectKick();
  } else {
    console.warn("[Kick] Keine Chatroom-ID konfiguriert");
  }
})();
