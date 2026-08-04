// ==== KONFIGURATION ==== (aus dem URL-Fragment laden)
const OVERLAY_CONFIG = typeof CONFIG !== "undefined" ? CONFIG : {};

const TWITCH_CHANNEL       = OVERLAY_CONFIG.TWITCH_CHANNEL || "";
const TWITCH_OAUTH         = OVERLAY_CONFIG.TWITCH_OAUTH || "";
const TWITCH_USERNAME      = OVERLAY_CONFIG.TWITCH_USERNAME || TWITCH_CHANNEL;

const KICK_APP_KEY         = OVERLAY_CONFIG.KICK_APP_KEY || "32cbd69e4b950bf97679";
const KICK_CLUSTER         = OVERLAY_CONFIG.KICK_CLUSTER || "us2";
const KICK_CHATROOM_ID     = Number(OVERLAY_CONFIG.KICK_CHATROOM_ID) || 0;
const YOUTUBE_CHANNEL      = OVERLAY_CONFIG.YOUTUBE_CHANNEL || "";

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
const YOUTUBE_MESSAGE_COLOR = configuredColor(OVERLAY_CONFIG.YOUTUBE_MESSAGE_COLOR, "#ffffff");
const ENABLE_TEXT_SHADOW   = OVERLAY_CONFIG.ENABLE_TEXT_SHADOW === true;

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

const EXTERNAL_REQUEST_TIMEOUT_MS = 8000;
const MAX_EXTERNAL_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_EMOTES = 20000;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const RECONNECT_STABLE_AFTER_MS = 60000;
const WEBSOCKET_CONNECT_TIMEOUT_MS = 15000;
const YOUTUBE_PROXY_TIMEOUT_MS = 15000;
const YOUTUBE_OFFLINE_POLL_MS = 30000;
const YOUTUBE_STREAM_END_POLL_MS = 15000;
const YOUTUBE_PROXY_URL = "youtube-proxy.php";
const TRUSTED_IMAGE_HOST_SUFFIXES = Object.freeze([
  "jtvnw.net",
  "twitch.tv",
  "7tv.app",
  "betterttv.net",
  "frankerfacez.com",
  "kick.com",
  "ggpht.com",
  "gstatic.com",
  "googleusercontent.com",
  "ytimg.com"
]);

// ==== State ====
const chatBox = document.getElementById("chat");
let emoteMap = Object.create(null);
let emoteCount = 0;
let twitchEmoteCache = Object.create(null);
let twitchBadgeMap = Object.create(null);
let twitchBadgeRoomId = "";
let twitchBadgeLoadPromise = null;
let sevenTvTwitchUserId = "";
let sevenTvChannelLoadPromise = null;
let bttvTwitchUserId = "";
let bttvChannelLoadPromise = null;
let twitchSocket = null;
let twitchReconnectTimer = null;
let twitchReconnectAttempts = 0;
let twitchConnectedAt = 0;
let kickSocket = null;
let kickReconnectTimer = null;
let kickReconnectAttempts = 0;
let kickConnectedAt = 0;
let youtubeTimer = null;
let youtubeClient = null;
let youtubeContinuation = "";
let youtubeVideoId = "";
let youtubeJoinedAt = 0;
let youtubeReconnectAttempts = 0;
let youtubeSeenMessageIds = new Set();

function isTrustedImageHost(hostname) {
  const normalizedHostname = String(hostname || "").toLowerCase();
  return TRUSTED_IMAGE_HOST_SUFFIXES.some(suffix =>
    normalizedHostname === suffix || normalizedHostname.endsWith(`.${suffix}`)
  );
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function safeImageUrl(value) {
  try {
    const url = new URL(String(value || ""), document.baseURI);
    const isSameOrigin = url.origin === window.location.origin;
    if (isSameOrigin && (url.protocol === "https:" || url.protocol === "http:")) return url.href;
    if (url.protocol === "https:" && isTrustedImageHost(url.hostname)) return url.href;
  } catch {
    // Nicht erlaubte Bild-URLs werden ignoriert.
  }
  return null;
}

function registerEmote(name, imageUrl) {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedUrl = safeImageUrl(imageUrl);
  if (!normalizedName || normalizedName.length > 100 || /\s|[\u0000-\u001F\u007F]/.test(normalizedName)) return false;
  if (!normalizedUrl) return false;

  if (!hasOwn(emoteMap, normalizedName)) {
    if (emoteCount >= MAX_EMOTES) return false;
    emoteCount++;
  }
  emoteMap[normalizedName] = normalizedUrl;
  return true;
}

async function fetchJson(url, label) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), EXTERNAL_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${label} antwortet mit HTTP ${response.status}.`);

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_EXTERNAL_RESPONSE_BYTES) {
      throw new Error(`${label} liefert eine zu umfangreiche Antwort.`);
    }
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`${label} hat zu lange nicht geantwortet.`);
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function youtubeProxy(action, payload = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), YOUTUBE_PROXY_TIMEOUT_MS);

  try {
    const response = await fetch(YOUTUBE_PROXY_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, ...payload }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal
    });

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_EXTERNAL_RESPONSE_BYTES) {
      throw new Error("Der YouTube-Proxy liefert eine zu umfangreiche Antwort.");
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      throw new Error("Der YouTube-Proxy hat keine gültige Antwort geliefert.");
    }

    if (!response.ok) {
      const error = new Error(data?.error || `Der YouTube-Proxy antwortet mit HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Der YouTube-Proxy hat zu lange nicht geantwortet.");
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function createImage(className, src, alt, title = "") {
  const safeSrc = safeImageUrl(src);
  if (!safeSrc) return null;

  const image = document.createElement("img");
  image.className = className;
  image.src = safeSrc;
  image.alt = String(alt || "").slice(0, 200);
  if (title) image.title = String(title).slice(0, 200);
  return image;
}

function appendText(parent, value) {
  parent.appendChild(document.createTextNode(String(value || "")));
}

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

  badgeSets.slice(0, 500).forEach(set => {
    if (!set?.set_id || !Array.isArray(set.versions)) return;
    const setId = String(set.set_id).slice(0, 100);

    set.versions.slice(0, 500).forEach(version => {
      const versionId = String(version?.id || "").slice(0, 100);
      const imageUrl = safeImageUrl(version?.image_url_2x || version?.image_url_1x);
      if (!versionId || !imageUrl) return;

      twitchBadgeMap[`${setId}/${versionId}`] = {
        imageUrl,
        title: String(version.title || setId).slice(0, 200)
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
  twitchBadgeMap = Object.create(null);
  twitchBadgeLoadPromise = (async () => {
    const requests = [
      fetchJson(`https://api.ivr.fi/v2/twitch/badges/channel?id=${encodeURIComponent(normalizedRoomId)}`, "Twitch-Kanalbadges"),
      fetchJson("https://api.ivr.fi/v2/twitch/badges/global", "Globale Twitch-Badges")
    ];
    const results = await Promise.allSettled(requests);
    let loadedSets = 0;

    for (const result of results) {
      if (result.status !== "fulfilled") continue;

      try {
        indexTwitchBadgeSets(result.value);
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

  let count = 0;
  emotes.slice(0, MAX_EMOTES).forEach(e => {
    const hostUrl = e?.data?.host?.url;
    if (typeof hostUrl === "string" && hostUrl && registerEmote(e?.name, `https:${hostUrl}/4x.webp`)) count++;
  });
  console.log(`[7TV] ${label} geladen:`, count);
}

async function load7TVUser() {
  try {
    const data = await fetchJson(`https://7tv.io/v3/users/${encodeURIComponent(SEVENTV_USER_ID)}`, "7TV-User-Set");
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
      const data = await fetchJson(`https://7tv.io/v3/users/twitch/${encodeURIComponent(normalizedUserId)}`, "7TV-Kanal-Emotes");
      index7TVEmotes(data?.emote_set?.emotes, "Channel-Emotes");
    } catch (err) {
      console.warn("[7TV] Fehler Channel:", err);
    }
  })();

  return sevenTvChannelLoadPromise;
}

async function load7TVGlobal() {
  try {
    const data = await fetchJson("https://7tv.io/v3/emote-sets/global", "Globale 7TV-Emotes");
    index7TVEmotes(data?.emotes, "Globale Emotes");
  } catch (err) {
    console.warn("[7TV] Fehler Global:", err);
  }
}

// ===== BTTV laden =====
async function loadBTTVGlobal() {
  try {
    const data = await fetchJson("https://api.betterttv.net/3/cached/emotes/global", "Globale BetterTTV-Emotes");
    let count = 0;
    (Array.isArray(data) ? data : []).slice(0, MAX_EMOTES).forEach(e => {
      if (registerEmote(e?.code, `https://cdn.betterttv.net/emote/${encodeURIComponent(String(e?.id || ""))}/3x`)) count++;
    });
    console.log("[BTTV] Globale Emotes geladen:", count);
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
      const data = await fetchJson(`https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(normalizedUserId)}`, "BetterTTV-Kanal-Emotes");
      (Array.isArray(data?.channelEmotes) ? data.channelEmotes : []).slice(0, MAX_EMOTES).forEach(e => {
        registerEmote(e?.code, `https://cdn.betterttv.net/emote/${encodeURIComponent(String(e?.id || ""))}/3x`);
      });
      (Array.isArray(data?.sharedEmotes) ? data.sharedEmotes : []).slice(0, MAX_EMOTES).forEach(e => {
        registerEmote(e?.code, `https://cdn.betterttv.net/emote/${encodeURIComponent(String(e?.id || ""))}/3x`);
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
  const value = String(url || "");
  return value.startsWith("//") ? `https:${value}` : value;
}

async function loadFFZChannel(channelName) {
  try {
    const data = await fetchJson(`https://api.frankerfacez.com/v1/room/${encodeURIComponent(channelName)}`, "FrankerFaceZ-Kanal-Emotes");
    if (data.sets) {
      let count = 0;
      for (const set of Object.values(data.sets).slice(0, 500)) {
        (Array.isArray(set?.emoticons) ? set.emoticons : []).slice(0, MAX_EMOTES).forEach(e => {
          const urls = e?.urls || {};
          const url = urls["4"] || urls["2"] || urls["1"];
          if (url && registerEmote(e?.name, normalizeFfzUrl(url))) count++;
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
    const data = await fetchJson("https://api.frankerfacez.com/v1/set/global", "Globale FrankerFaceZ-Emotes");
    if (data.sets) {
      let count = 0;
      for (const set of Object.values(data.sets).slice(0, 500)) {
        (Array.isArray(set?.emoticons) ? set.emoticons : []).slice(0, MAX_EMOTES).forEach(e => {
          const urls = e?.urls || {};
          const url = urls["4"] || urls["2"] || urls["1"];
          if (url && registerEmote(e?.name, normalizeFfzUrl(url))) count++;
        });
      }
      console.log(`[FFZ] Globale Emotes geladen: ${count}`);
    }
  } catch (err) {
    console.warn("[FFZ] Fehler Global:", err);
  }
}

// ===== Text/Emotes =====
function createEmoteImage(src, alt) {
  return createImage("emote", src, alt);
}

function appendTextWithThirdPartyEmotes(parent, text) {
  const content = String(text || "");
  if (!content) return;

  const parts = content.split(/\s+/);
  parts.forEach((part, index) => {
    if (index > 0) appendText(parent, " ");

    if (hasOwn(emoteMap, part)) {
      const image = createEmoteImage(emoteMap[part], part);
      if (image) {
        parent.appendChild(image);
        return;
      }
    }
    appendText(parent, part);
  });
}

function appendTwitchText(parent, text, twitchEmotes) {
  const content = String(text || "");
  if (!content) return;

  const positions = [];
  if (twitchEmotes && typeof twitchEmotes === "object") {
    for (const [emoteId, ranges] of Object.entries(twitchEmotes)) {
      if (!/^\d+$/.test(emoteId) || !Array.isArray(ranges)) continue;

      ranges.slice(0, 100).forEach(range => {
        const match = /^(\d+)-(\d+)$/.exec(String(range));
        if (!match) return;
        const start = Number(match[1]);
        const end = Number(match[2]);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= content.length) return;
        positions.push({ emoteId, start, end });
      });
    }
  }

  positions.sort((left, right) => left.start - right.start);
  let lastIndex = 0;

  positions.forEach(({ emoteId, start, end }) => {
    if (start < lastIndex) return;
    appendTextWithThirdPartyEmotes(parent, content.substring(lastIndex, start));

    const image = createEmoteImage(getTwitchEmoteUrl(emoteId), content.substring(start, end + 1) || "emote");
    if (image) parent.appendChild(image);
    else appendText(parent, content.substring(start, end + 1));
    lastIndex = end + 1;
  });

  appendTextWithThirdPartyEmotes(parent, content.substring(lastIndex));
}

function appendKickText(parent, text) {
  const content = String(text || "");
  const emotePattern = /\[emote:(\d+):([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = emotePattern.exec(content)) !== null) {
    appendText(parent, content.slice(lastIndex, match.index));
    const [, id, name] = match;
    const image = createEmoteImage(`https://files.kick.com/emotes/${id}/fullsize`, name);
    if (image) parent.appendChild(image);
    else appendText(parent, match[0]);
    lastIndex = match.index + match[0].length;
  }

  appendText(parent, content.slice(lastIndex));
}

function bestYouTubeThumbnail(thumbnails) {
  if (!Array.isArray(thumbnails)) return "";
  return thumbnails
    .filter(thumbnail => typeof thumbnail?.url === "string" && thumbnail.url)
    .sort((left, right) => ((right.width || 0) * (right.height || 0)) - ((left.width || 0) * (left.height || 0)))[0]?.url || "";
}

function appendYouTubeText(parent, text, segments) {
  if (!Array.isArray(segments) || segments.length === 0 || segments.length > 100) {
    appendTextWithThirdPartyEmotes(parent, text);
    return;
  }

  segments.forEach(segment => {
    if (segment?.type === "emote") {
      const image = createEmoteImage(segment.url, segment.text || "Emote");
      if (image) parent.appendChild(image);
      else appendText(parent, segment.text || "");
      return;
    }
    appendTextWithThirdPartyEmotes(parent, segment?.text || "");
  });
}

function buildYouTubeBadges(authorBadges) {
  const fragment = document.createDocumentFragment();
  if (!SHOW_BADGES || !Array.isArray(authorBadges)) return fragment;

  let roleBadge = null;
  let memberBadge = null;
  authorBadges.slice(0, 20).forEach(entry => {
    const badge = entry?.liveChatAuthorBadgeRenderer;
    if (!badge) return;

    const iconType = badge.icon?.iconType;
    const title = String(badge.tooltip || "YouTube-Badge").slice(0, 100);
    if (!roleBadge && iconType === "OWNER") {
      roleBadge = createImage("badge", "img/youtube_owner.svg", title, title);
    } else if (!roleBadge && iconType === "MODERATOR") {
      roleBadge = createImage("badge", "img/youtube_mod.svg", title, title);
    } else if (!memberBadge && badge.customThumbnail) {
      const imageUrl = bestYouTubeThumbnail(badge.customThumbnail.thumbnails);
      memberBadge = createImage("badge", imageUrl || "img/youtube_member.svg", title, title);
    }
  });

  if (roleBadge) fragment.appendChild(roleBadge);
  if (!HIDE_SUB_BADGES && memberBadge) fragment.appendChild(memberBadge);
  return fragment;
}

function getTwitchEmoteUrl(id) {
  const normalizedId = String(id || "");
  if (!/^\d+$/.test(normalizedId)) return null;
  if (!hasOwn(twitchEmoteCache, normalizedId)) {
    twitchEmoteCache[normalizedId] = `https://static-cdn.jtvnw.net/emoticons/v2/${normalizedId}/default/dark/3.0`;
  }
  return twitchEmoteCache[normalizedId];
}

function parseTwitchTags(message) {
  const tagsRaw = message.startsWith("@") ? message.split(" ")[0] : "";
  const tags = Object.create(null);

  if (tagsRaw) {
    tagsRaw.substring(1).split(";").forEach(tag => {
      const separatorIndex = tag.indexOf("=");
      const key = separatorIndex === -1 ? tag : tag.substring(0, separatorIndex);
      const value = separatorIndex === -1 ? "" : tag.substring(separatorIndex + 1);
      tags[key] = value;
    });
  }

  return tags;
}

function twitchBadgeImage(src, alt) {
  return createImage("badge", src, alt, alt);
}

function pendingTwitchBadgeImage(type, version) {
  const key = `${type}/${version}`;
  const image = document.createElement("img");
  image.className = "badge twitch-badge-pending";
  image.dataset.twitchBadgeKey = key.slice(0, 201);
  image.alt = "";
  return image;
}

function buildTwitchBadges(tags) {
  const fragment = document.createDocumentFragment();
  if (!SHOW_BADGES || typeof tags.badges !== "string") return fragment;

  const badges = new Map();
  tags.badges.slice(0, 2000).split(",").slice(0, 50).forEach(badge => {
    const [type, version = "0"] = badge.split("/");
    if (/^[a-z0-9_-]{1,100}$/i.test(type) && /^[a-z0-9_-]{1,100}$/i.test(version)) {
      badges.set(type, version);
    }
  });

  let roleBadge = null;
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
      roleBadge = twitchBadgeImage(dynamicBadge.imageUrl, dynamicBadge.title);
    } else if (type === "lead_moderator") {
      roleBadge = twitchBadgeImage("img/twitch_lead_mod.png", "Lead Moderator");
    } else if (type === "moderator") {
      roleBadge = twitchBadgeImage("img/twitch_mod.png", "Moderator");
    } else if (type === "vip") {
      roleBadge = twitchBadgeImage("img/twitch_vip.png", "VIP");
    } else {
      roleBadge = pendingTwitchBadgeImage(type, version);
    }
    break;
  }
  if (roleBadge) fragment.appendChild(roleBadge);

  if (!HIDE_SUB_BADGES) {
    const subType = badges.has("founder") ? "founder" : badges.has("subscriber") ? "subscriber" : "";
    if (subType) {
      const version = badges.get(subType);
      const dynamicBadge = twitchBadgeMap[`${subType}/${version}`];
      const subBadge = dynamicBadge
        ? twitchBadgeImage(dynamicBadge.imageUrl, dynamicBadge.title)
        : pendingTwitchBadgeImage(subType, version);
      if (subBadge) fragment.appendChild(subBadge);
    }
  }

  if (!HIDE_GLOBAL_BADGE) {
    const reservedTypes = new Set([...rolePriority, "subscriber", "founder"]);
    for (const [type, version] of badges) {
      if (reservedTypes.has(type)) continue;

      const dynamicBadge = twitchBadgeMap[`${type}/${version}`];
      const globalBadge = dynamicBadge
        ? twitchBadgeImage(dynamicBadge.imageUrl, dynamicBadge.title)
        : pendingTwitchBadgeImage(type, version);
      if (globalBadge) fragment.appendChild(globalBadge);
      break;
    }
  }

  return fragment;
}

function addMessage(user, text, platform, platformData = null, nameColor = "#fff", badges = null, msgId = null) {
  const normalizedUser = String(user || "unknown").slice(0, 100);
  const normalizedText = String(text || "").slice(0, 5000);
  if (platform !== "Twitch" && platform !== "Kick" && platform !== "YouTube") return;

  if (Array.isArray(OVERLAY_CONFIG.BLOCKED_USERS)
      && OVERLAY_CONFIG.BLOCKED_USERS.some(blockedUser => String(blockedUser).toLowerCase() === normalizedUser.toLowerCase())) {
    return;
  }

  if (OVERLAY_CONFIG.BLOCK_ALL_PREFIX_COMMANDS && normalizedText.trim().startsWith("!")) return;

  if (Array.isArray(OVERLAY_CONFIG.BLOCKED_COMMANDS) && normalizedText) {
    const lowered = normalizedText.toLowerCase().trim();
    for (const command of OVERLAY_CONFIG.BLOCKED_COMMANDS) {
      if (lowered.startsWith(String(command).toLowerCase())) return;
    }
  }

  if (OVERLAY_CONFIG.BLOCK_LINKS && /(https?:\/\/|www\.)/i.test(normalizedText)) return;

  const element = document.createElement("div");
  element.className = "message";
  if (ENABLE_TEXT_SHADOW) element.classList.add("text-shadow-enabled");
  if (msgId) element.dataset.msgId = String(msgId).slice(0, 200);
  element.dataset.user = normalizedUser.toLowerCase();

  if (!HIDE_PLATFORM) {
    const icon = platform === "Twitch"
      ? "twitch_icon.png"
      : platform === "Kick"
        ? "kick_icon.png"
        : "youtube_icon.svg";
    const platformIcon = createImage("platform-icon", `img/${icon}`, platform);
    if (platformIcon) element.appendChild(platformIcon);
  }

  if (SHOW_BADGES && badges) element.appendChild(badges);

  const username = document.createElement("span");
  username.className = "username";
  username.style.color = configuredColor(nameColor, "#ffffff");
  username.textContent = `${normalizedUser}:`;
  element.appendChild(username);

  const messageText = document.createElement("span");
  messageText.className = "message-text";
  messageText.style.color = platform === "Twitch"
    ? TWITCH_MESSAGE_COLOR
    : platform === "Kick"
      ? KICK_MESSAGE_COLOR
      : YOUTUBE_MESSAGE_COLOR;
  if (platform === "Twitch") appendTwitchText(messageText, normalizedText, platformData);
  else if (platform === "Kick") appendKickText(messageText, normalizedText);
  else appendYouTubeText(messageText, normalizedText, platformData);
  element.appendChild(messageText);

  chatBox.appendChild(element);
  chatBox.scrollTop = chatBox.scrollHeight;
  while (chatBox.childNodes.length > MAX_MESSAGES) chatBox.removeChild(chatBox.firstChild);
}


function reconnectDelay(attempt) {
  const exponentialDelay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * (2 ** Math.min(attempt, 5)));
  return exponentialDelay + Math.floor(Math.random() * 250);
}

function findMessageById(messageId) {
  const normalizedId = String(messageId || "");
  return [...chatBox.querySelectorAll(".message")].find(element => element.dataset.msgId === normalizedId) || null;
}

function removeMessagesByUser(username) {
  const normalizedUser = String(username || "").toLowerCase();
  chatBox.querySelectorAll(".message").forEach(element => {
    if (element.dataset.user === normalizedUser) element.remove();
  });
}

function scheduleTwitchReconnect() {
  if (!TWITCH_CHANNEL || twitchReconnectTimer) return;
  if (twitchConnectedAt && Date.now() - twitchConnectedAt >= RECONNECT_STABLE_AFTER_MS) twitchReconnectAttempts = 0;

  const delay = reconnectDelay(twitchReconnectAttempts++);
  console.warn(`[Twitch] Verbindung getrennt; neuer Versuch in ${(delay / 1000).toFixed(1)} Sekunden`);
  twitchReconnectTimer = window.setTimeout(() => {
    twitchReconnectTimer = null;
    connectTwitch();
  }, delay);
}

// ===== Twitch verbinden =====
function connectTwitch() {
  if (!TWITCH_CHANNEL) return;
  if (twitchSocket && (twitchSocket.readyState === WebSocket.CONNECTING || twitchSocket.readyState === WebSocket.OPEN)) return;

  let ws;
  try {
    ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
  } catch (error) {
    console.error("[Twitch] Verbindung konnte nicht erstellt werden:", error);
    scheduleTwitchReconnect();
    return;
  }

  twitchSocket = ws;
  twitchConnectedAt = 0;
  const connectTimeout = window.setTimeout(() => {
    if (ws.readyState === WebSocket.CONNECTING) ws.close();
  }, WEBSOCKET_CONNECT_TIMEOUT_MS);
  const nickname = TWITCH_OAUTH
    ? TWITCH_USERNAME
    : `justinfan${Math.floor(Math.random() * 900000 + 100000)}`;

  ws.onopen = () => {
    if (twitchSocket !== ws) return;
    window.clearTimeout(connectTimeout);
    twitchConnectedAt = Date.now();
    ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership");
    ws.send(`PASS ${TWITCH_OAUTH || "SCHMOOPIIE"}`);
    ws.send(`NICK ${nickname}`);
    ws.send(`JOIN #${TWITCH_CHANNEL}`);
    console.log(`[Twitch] Verbunden (${TWITCH_OAUTH ? "OAuth" : "anonym"})`);
  };
  
  ws.onmessage = (event) => {
    if (twitchSocket !== ws) return;
    const lines = String(event.data || "").trim().split("\r\n");

    for (const msg of lines) {

      // PING
      if (msg.startsWith("PING")) {
        if (ws.readyState === WebSocket.OPEN) ws.send("PONG :tmi.twitch.tv");
        continue;
      }

      // CLEARMSG (einzelne Nachricht gelöscht)
      if (msg.includes("CLEARMSG")) {
        const tags = parseTwitchTags(msg);

        const targetMsgId = tags["target-msg-id"];
        if (targetMsgId) {
          const el = findMessageById(targetMsgId);
          if (el) el.remove();
        }
        continue;
      }

      // ROOMSTATE liefert die Twitch-Kanal-ID für den Badge-Katalog.
      if (msg.includes("ROOMSTATE")) {
        const tags = parseTwitchTags(msg);
        if (tags["room-id"]) {
          loadTwitchBadges(tags["room-id"]);
          loadAutomaticTwitchChannelEmotes(tags["room-id"]);
        }
        continue;
      }

      // CLEARCHAT (Ban / Timeout / /clear)
      if (msg.includes("CLEARCHAT")) {
        const parts = msg.split("CLEARCHAT")[1];
        const username = parts?.split(" :")[1]?.trim();

        if (username) {
          removeMessagesByUser(username);
        } else {
          while (chatBox.firstChild) chatBox.removeChild(chatBox.firstChild);
        }
        continue;
      }

      // PRIVMSG (normale Nachricht)
      if (msg.includes("PRIVMSG")) {
        const tags = parseTwitchTags(msg);
        if (tags["room-id"]) {
          loadTwitchBadges(tags["room-id"]);
          loadAutomaticTwitchChannelEmotes(tags["room-id"]);
        }

        const privmsgData = msg.split("PRIVMSG")[1] || "";
        const textSeparator = privmsgData.indexOf(" :");
        if (textSeparator === -1) continue;

        const user = tags["display-name"] || msg.split("!")[0].substring(1);
        const text = privmsgData.substring(textSeparator + 2);
        const msgId = tags["id"] || null;

        let twitchEmotes = null;
        if (typeof tags.emotes === "string" && tags.emotes.length <= 5000) {
          twitchEmotes = Object.create(null);
          tags.emotes.split("/").slice(0, 100).forEach(entry => {
            const [id, positions = ""] = entry.split(":");
            if (/^\d+$/.test(id)) twitchEmotes[id] = positions.split(",").slice(0, 100);
          });
        }

        addMessage(user, text, "Twitch", twitchEmotes, tags["color"] || "#fff", buildTwitchBadges(tags), msgId);
      }
    }
  };

  ws.onerror = error => console.error("[Twitch] Fehler:", error);
  ws.onclose = () => {
    window.clearTimeout(connectTimeout);
    if (twitchSocket !== ws) return;
    twitchSocket = null;
    scheduleTwitchReconnect();
  };
}


function scheduleKickReconnect() {
  if (!KICK_CHATROOM_ID || kickReconnectTimer) return;
  if (kickConnectedAt && Date.now() - kickConnectedAt >= RECONNECT_STABLE_AFTER_MS) kickReconnectAttempts = 0;

  const delay = reconnectDelay(kickReconnectAttempts++);
  console.warn(`[Kick] Verbindung getrennt; neuer Versuch in ${(delay / 1000).toFixed(1)} Sekunden`);
  kickReconnectTimer = window.setTimeout(() => {
    kickReconnectTimer = null;
    connectKick();
  }, delay);
}

function buildKickBadges(identity) {
  const fragment = document.createDocumentFragment();
  if (!SHOW_BADGES || !Array.isArray(identity?.badges)) return fragment;

  identity.badges.slice(0, 20).forEach(badge => {
    let image = null;
    if (badge?.type === "moderator") image = createImage("badge", "img/kick_mod.svg", "Moderator", "Moderator");
    else if (badge?.type === "vip") image = createImage("badge", "img/kick_vip.svg", "VIP", "VIP");
    if (image) fragment.appendChild(image);
  });
  return fragment;
}

// ===== Kick verbinden =====
function connectKick() {
  if (!KICK_CHATROOM_ID) return;
  if (kickSocket && (kickSocket.readyState === WebSocket.CONNECTING || kickSocket.readyState === WebSocket.OPEN)) return;

  const wsUrl = `wss://ws-${KICK_CLUSTER}.pusher.com/app/${KICK_APP_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;
  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch (error) {
    console.error("[Kick] Verbindung konnte nicht erstellt werden:", error);
    scheduleKickReconnect();
    return;
  }

  kickSocket = ws;
  kickConnectedAt = 0;
  const connectTimeout = window.setTimeout(() => {
    if (ws.readyState === WebSocket.CONNECTING) ws.close();
  }, WEBSOCKET_CONNECT_TIMEOUT_MS);

  ws.onopen = () => {
    if (kickSocket !== ws) return;
    window.clearTimeout(connectTimeout);
    kickConnectedAt = Date.now();
    console.log("[Kick] Verbunden (Pusher)");
    const subMsg = {
      event: "pusher:subscribe",
      data: { channel: `chatrooms.${KICK_CHATROOM_ID}.v2` }
    };
    ws.send(JSON.stringify(subMsg));
  };

  ws.onmessage = (evt) => {
    if (kickSocket !== ws) return;
    try {
      const payload = JSON.parse(String(evt.data || ""));
      if (payload.event === "pusher:ping") {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: "pusher:pong", data: {} }));
        return;
      }
      if (payload.event === "App\\Events\\ChatMessageEvent") {
        const inner = typeof payload.data === "string" ? JSON.parse(payload.data) : payload.data;
        const identity = inner?.sender?.identity;
        addMessage(
          inner?.sender?.username || "unknown",
          inner?.content || "",
          "Kick",
          null,
          identity?.color || "#fff",
          buildKickBadges(identity)
        );
      }
    } catch (e) {
      console.error("[Kick] Parse-Fehler:", e, evt.data);
    }
  };

  ws.onerror = error => console.error("[Kick] Fehler:", error);
  ws.onclose = () => {
    window.clearTimeout(connectTimeout);
    if (kickSocket !== ws) return;
    kickSocket = null;
    scheduleKickReconnect();
  };
}

// ===== YouTube Live Chat =====
function parseYouTubeRuns(runs) {
  const segments = [];
  let text = "";

  (Array.isArray(runs) ? runs : []).slice(0, 100).forEach(run => {
    if (typeof run?.text === "string") {
      const value = run.text.slice(0, 5000);
      text += value;
      segments.push({ type: "text", text: value });
      return;
    }

    const emoji = run?.emoji;
    if (!emoji) return;
    const emojiText = String(emoji.shortcuts?.[0] || (emoji.emojiId ? `:${String(emoji.emojiId).split("/").pop()}:` : "")).slice(0, 100);
    if (!emojiText) return;
    const imageUrl = bestYouTubeThumbnail(emoji.image?.thumbnails);
    text += emojiText;
    segments.push(imageUrl
      ? { type: "emote", text: emojiText, url: imageUrl }
      : { type: "text", text: emojiText });
  });

  return { text: text.slice(0, 5000), segments };
}

function rememberYouTubeMessage(messageId) {
  const normalizedId = String(messageId || "").slice(0, 200);
  if (!normalizedId) return false;
  if (youtubeSeenMessageIds.has(normalizedId)) return true;
  youtubeSeenMessageIds.add(normalizedId);
  if (youtubeSeenMessageIds.size > 500) youtubeSeenMessageIds.delete(youtubeSeenMessageIds.values().next().value);
  return false;
}

function processYouTubeActions(actions) {
  let addedMessages = 0;
  (Array.isArray(actions) ? actions : []).slice(0, 500).forEach(action => {
    const removedMessageId = action?.removeChatItemAction?.targetItemId;
    if (removedMessageId) {
      const element = findMessageById(removedMessageId);
      if (element) element.remove();
      return;
    }

    const item = action?.addChatItemAction?.item;
    if (!item) return;

    let renderer = item.liveChatTextMessageRenderer;
    let fallbackText = "";
    if (!renderer && item.liveChatPaidMessageRenderer) {
      renderer = item.liveChatPaidMessageRenderer;
      fallbackText = "Super Chat";
    }
    if (!renderer && item.liveChatPaidStickerRenderer) {
      renderer = item.liveChatPaidStickerRenderer;
      fallbackText = "Super Sticker";
    }
    if (!renderer && item.liveChatMembershipItemRenderer) {
      renderer = item.liveChatMembershipItemRenderer;
      fallbackText = "Neues Kanalmitglied";
    }
    if (!renderer || rememberYouTubeMessage(renderer.id)) return;

    const timestampMs = Number(renderer.timestampUsec) / 1000;
    if (Number.isFinite(timestampMs) && timestampMs < youtubeJoinedAt - 5000) return;

    const parsed = parseYouTubeRuns(renderer.message?.runs || renderer.headerSubtext?.runs || []);
    const amount = String(renderer.purchaseAmountText?.simpleText || "").slice(0, 100);
    const baseText = parsed.text.trim() ? parsed.text : fallbackText;
    const messageText = amount ? `${amount} · ${baseText || "Super Chat"}` : baseText;
    if (!messageText) return;

    const segments = amount
      ? [{ type: "text", text: `${amount} · ` }, ...(parsed.segments.length ? parsed.segments : [{ type: "text", text: baseText }])]
      : parsed.segments;
    addMessage(
      String(renderer.authorName?.simpleText || "Unknown").replace(/^@/, ""),
      messageText,
      "YouTube",
      segments,
      "#ff4e45",
      buildYouTubeBadges(renderer.authorBadges),
      renderer.id
    );
    addedMessages++;
  });
  return addedMessages;
}

function youtubeClientPayload() {
  return {
    apiKey: youtubeClient?.apiKey || "",
    clientVersion: youtubeClient?.clientVersion || "",
    visitorData: youtubeClient?.visitorData || ""
  };
}

function scheduleYouTube(callback, delay) {
  if (youtubeTimer) window.clearTimeout(youtubeTimer);
  youtubeTimer = window.setTimeout(() => {
    youtubeTimer = null;
    void callback();
  }, Math.max(1000, delay));
}

function scheduleYouTubeRetry(callback, error, label) {
  youtubeReconnectAttempts++;
  const rateLimited = error?.status === 429;
  const delay = rateLimited
    ? Math.min(60000, 30000 + youtubeReconnectAttempts * 5000)
    : reconnectDelay(youtubeReconnectAttempts);
  console.warn(`[YouTube] ${label}; neuer Versuch in ${(delay / 1000).toFixed(1)} Sekunden:`, error);
  scheduleYouTube(callback, delay);
}

function resetYouTubeStream() {
  youtubeContinuation = "";
  youtubeVideoId = "";
  youtubeJoinedAt = 0;
  youtubeSeenMessageIds = new Set();
}

async function discoverYouTube() {
  if (!YOUTUBE_CHANNEL) return;
  try {
    const result = await youtubeProxy("discover", { handle: YOUTUBE_CHANNEL });
    youtubeClient = {
      channelId: result?.channelId || "",
      apiKey: result?.apiKey || "",
      clientVersion: result?.clientVersion || "",
      visitorData: result?.visitorData || "",
      discoveredAt: Date.now()
    };
    youtubeReconnectAttempts = 0;

    if (result?.videoId) {
      await startYouTubeStream(result.videoId);
    } else {
      console.log(`[YouTube] @${YOUTUBE_CHANNEL} ist derzeit nicht live`);
      scheduleYouTube(checkYouTubeStatus, YOUTUBE_OFFLINE_POLL_MS);
    }
  } catch (error) {
    youtubeClient = null;
    scheduleYouTubeRetry(discoverYouTube, error, "Kanaldaten konnten nicht geladen werden");
  }
}

async function checkYouTubeStatus() {
  if (!YOUTUBE_CHANNEL) return;
  if (!youtubeClient?.channelId || Date.now() - Number(youtubeClient.discoveredAt || 0) > 6 * 60 * 60 * 1000) {
    await discoverYouTube();
    return;
  }

  try {
    const result = await youtubeProxy("status", {
      channelId: youtubeClient.channelId,
      ...youtubeClientPayload()
    });
    youtubeReconnectAttempts = 0;
    if (result?.videoId) await startYouTubeStream(result.videoId);
    else scheduleYouTube(checkYouTubeStatus, YOUTUBE_OFFLINE_POLL_MS);
  } catch (error) {
    if (youtubeReconnectAttempts >= 4) youtubeClient = null;
    scheduleYouTubeRetry(youtubeClient ? checkYouTubeStatus : discoverYouTube, error, "Live-Status konnte nicht geprüft werden");
  }
}

async function startYouTubeStream(videoId) {
  const normalizedVideoId = String(videoId || "");
  if (!/^[A-Za-z0-9_-]{11}$/.test(normalizedVideoId)) {
    scheduleYouTube(checkYouTubeStatus, YOUTUBE_OFFLINE_POLL_MS);
    return;
  }

  try {
    const result = await youtubeProxy("continuation", {
      videoId: normalizedVideoId,
      ...youtubeClientPayload()
    });
    if (!result?.continuation) {
      console.warn(`[YouTube] Für ${normalizedVideoId} ist kein Live-Chat verfügbar`);
      resetYouTubeStream();
      scheduleYouTube(checkYouTubeStatus, YOUTUBE_OFFLINE_POLL_MS);
      return;
    }

    youtubeVideoId = normalizedVideoId;
    youtubeContinuation = result.continuation;
    if (typeof result.visitorData === "string") youtubeClient.visitorData = result.visitorData;
    youtubeJoinedAt = Date.now();
    youtubeSeenMessageIds = new Set();
    youtubeReconnectAttempts = 0;
    console.log(`[YouTube] Live-Chat verbunden (${normalizedVideoId})`);
    scheduleYouTube(pollYouTube, 1000);
  } catch (error) {
    scheduleYouTubeRetry(() => startYouTubeStream(normalizedVideoId), error, "Live-Chat konnte nicht gestartet werden");
  }
}

async function pollYouTube() {
  if (!youtubeContinuation || !youtubeVideoId || !youtubeClient) {
    scheduleYouTube(checkYouTubeStatus, YOUTUBE_STREAM_END_POLL_MS);
    return;
  }

  try {
    const result = await youtubeProxy("poll", {
      continuation: youtubeContinuation,
      ...youtubeClientPayload()
    });
    if (typeof result?.visitorData === "string") youtubeClient.visitorData = result.visitorData;
    const liveChat = result?.liveChatContinuation;
    if (!liveChat || typeof liveChat !== "object") {
      console.log("[YouTube] Livestream oder Live-Chat wurde beendet");
      resetYouTubeStream();
      scheduleYouTube(checkYouTubeStatus, YOUTUBE_STREAM_END_POLL_MS);
      return;
    }

    processYouTubeActions(liveChat.actions);
    const continuationEntry = Array.isArray(liveChat.continuations) ? liveChat.continuations[0] : null;
    const continuationData = continuationEntry?.timedContinuationData
      || continuationEntry?.invalidationContinuationData
      || continuationEntry?.reloadContinuationData;
    const nextContinuation = continuationData?.continuation;
    if (!nextContinuation) {
      console.log("[YouTube] Keine weitere Chat-Continuation; Live-Status wird erneut geprüft");
      resetYouTubeStream();
      scheduleYouTube(checkYouTubeStatus, YOUTUBE_STREAM_END_POLL_MS);
      return;
    }

    youtubeContinuation = nextContinuation;
    youtubeReconnectAttempts = 0;
    const requestedDelay = Number(continuationData.timeoutMs);
    const pollDelay = Number.isFinite(requestedDelay) ? Math.min(15000, Math.max(1000, requestedDelay)) : 5000;
    scheduleYouTube(pollYouTube, pollDelay);
  } catch (error) {
    if (youtubeReconnectAttempts >= 5) {
      resetYouTubeStream();
      youtubeClient = null;
      scheduleYouTubeRetry(discoverYouTube, error, "Chat-Verbindung wird vollständig neu aufgebaut");
      return;
    }
    scheduleYouTubeRetry(pollYouTube, error, "Chat-Abfrage fehlgeschlagen");
  }
}

// ===== Start =====
(() => {
  if (TWITCH_CHANNEL) connectTwitch();
  else console.warn("[Twitch] Kein Kanal konfiguriert");

  if (KICK_CHATROOM_ID) connectKick();
  else console.warn("[Kick] Keine Chatroom-ID konfiguriert");

  if (YOUTUBE_CHANNEL) void discoverYouTube();
  else console.warn("[YouTube] Kein Kanal konfiguriert");

  const optionalTasks = [];
  if (ENABLE_7TV) {
    if (SEVENTV_USER_ID) optionalTasks.push(load7TVUser());
    optionalTasks.push(load7TVGlobal());
  }
  if (ENABLE_BTTV) {
    optionalTasks.push(loadBTTVGlobal());
    if (BTTV_TWITCH_USER_ID) optionalTasks.push(loadBTTVChannel(BTTV_TWITCH_USER_ID));
  }
  if (ENABLE_FFZ) {
    optionalTasks.push(loadFFZGlobal());
    if (FFZ_CHANNEL) optionalTasks.push(loadFFZChannel(FFZ_CHANNEL));
  }

  void Promise.allSettled(optionalTasks);
})();
