(function (global) {
  "use strict";

  const FORMAT_VERSION = 1;
  const MAX_PAYLOAD_LENGTH = 16000;
  const MAX_LIST_ITEMS = 200;
  const MAX_LIST_ITEM_LENGTH = 128;

  const DEFAULTS = Object.freeze({
    TWITCH_CHANNEL: "",
    KICK_CHANNEL: "",
    KICK_CHATROOM_ID: 0,
    YOUTUBE_CHANNEL: "",
    ENABLE_7TV: true,
    ENABLE_BTTV: true,
    ENABLE_FFZ: true,
    MAX_MESSAGES: 20,
    TWITCH_MESSAGE_COLOR: "#FFFFFF",
    KICK_MESSAGE_COLOR: "#FFFFFF",
    YOUTUBE_MESSAGE_COLOR: "#FFFFFF",
    ENABLE_TEXT_SHADOW: false,
    HIDE_BADGES: false,
    HIDE_SUB_BADGES: false,
    HIDE_GLOBAL_BADGE: false,
    HIDE_PLATFORM: false,
    BLOCKED_USERS: [],
    BLOCK_ALL_PREFIX_COMMANDS: false,
    BLOCKED_COMMANDS: [],
    BLOCK_LINKS: false
  });

  const FIELD_DEFINITIONS = Object.freeze([
    ["TWITCH_CHANNEL", "t", "twitchChannel"],
    ["KICK_CHANNEL", "k", "kickChannel"],
    ["KICK_CHATROOM_ID", "ki", "positiveInteger"],
    ["YOUTUBE_CHANNEL", "y", "youtubeChannel"],
    ["ENABLE_7TV", "e7", "boolean"],
    ["ENABLE_BTTV", "eb", "boolean"],
    ["ENABLE_FFZ", "ef", "boolean"],
    ["MAX_MESSAGES", "m", "messageCount"],
    ["TWITCH_MESSAGE_COLOR", "tc", "color"],
    ["KICK_MESSAGE_COLOR", "kc", "color"],
    ["YOUTUBE_MESSAGE_COLOR", "yc", "color"],
    ["ENABLE_TEXT_SHADOW", "ts", "boolean"],
    ["HIDE_BADGES", "hb", "boolean"],
    ["HIDE_SUB_BADGES", "hs", "boolean"],
    ["HIDE_GLOBAL_BADGE", "hg", "boolean"],
    ["HIDE_PLATFORM", "hp", "boolean"],
    ["BLOCKED_USERS", "bu", "list"],
    ["BLOCK_ALL_PREFIX_COMMANDS", "ba", "boolean"],
    ["BLOCKED_COMMANDS", "bc", "list"],
    ["BLOCK_LINKS", "bl", "boolean"]
  ]);

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function cloneDefault(value) {
    return Array.isArray(value) ? [...value] : value;
  }

  function normalizeValue(value, type, fallback, strict) {
    if (type === "boolean") {
      if (typeof value === "boolean") return value;
      if (strict) throw new Error("Der Link enthält einen ungültigen Schalterwert.");
      return fallback;
    }

    if (type === "twitchChannel" || type === "kickChannel" || type === "youtubeChannel") {
      if (typeof value !== "string") {
        if (strict) throw new Error("Der Link enthält einen ungültigen Kanalnamen.");
        return fallback;
      }
      const channel = value.trim().toLowerCase();
      const pattern = type === "twitchChannel"
        ? /^[a-z0-9_]{0,25}$/
        : type === "kickChannel"
          ? /^[a-z0-9_-]{0,80}$/
          : /^[\p{L}\p{N}._-]{0,50}$/u;
      if (!pattern.test(channel)) {
        if (strict) throw new Error("Der Link enthält einen ungültigen Kanalnamen.");
        return fallback;
      }
      return channel;
    }

    if (type === "positiveInteger") {
      const number = Number(value);
      if (Number.isInteger(number) && number >= 0 && number <= Number.MAX_SAFE_INTEGER) return number;
      if (strict) throw new Error("Der Link enthält eine ungültige Kick-Chatroom-ID.");
      return fallback;
    }

    if (type === "messageCount") {
      const number = Number(value);
      if (Number.isInteger(number) && number >= 1 && number <= 200) return number;
      if (strict) throw new Error("Der Link enthält eine ungültige Nachrichtenanzahl.");
      return fallback;
    }

    if (type === "color") {
      if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())) {
        return value.trim().toUpperCase();
      }
      if (strict) throw new Error("Der Link enthält eine ungültige Nachrichtenfarbe.");
      return fallback;
    }

    if (type === "list") {
      if (!Array.isArray(value)) {
        if (strict) throw new Error("Der Link enthält eine ungültige Filterliste.");
        return cloneDefault(fallback);
      }
      if (value.length > MAX_LIST_ITEMS) {
        throw new Error(`Eine Filterliste darf höchstens ${MAX_LIST_ITEMS} Einträge enthalten.`);
      }
      const items = value.map(item => {
        if (typeof item !== "string") {
          if (strict) throw new Error("Eine Filterliste enthält einen ungültigen Eintrag.");
          return "";
        }
        const normalized = item.trim();
        if (normalized.length > MAX_LIST_ITEM_LENGTH) {
          throw new Error(`Ein Filtereintrag darf höchstens ${MAX_LIST_ITEM_LENGTH} Zeichen lang sein.`);
        }
        if (/[\u0000-\u001F\u007F]/.test(normalized)) {
          throw new Error("Eine Filterliste enthält unzulässige Steuerzeichen.");
        }
        return normalized;
      }).filter(Boolean);
      return [...new Set(items)];
    }

    return cloneDefault(fallback);
  }

  function normalizeConfig(input, options) {
    const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const strict = options?.strict === true;
    const normalized = {};

    FIELD_DEFINITIONS.forEach(([longKey, , type]) => {
      const fallback = DEFAULTS[longKey];
      normalized[longKey] = hasOwn(source, longKey)
        ? normalizeValue(source[longKey], type, fallback, strict)
        : cloneDefault(fallback);
    });

    if (!hasOwn(source, "HIDE_BADGES") && source.SHOW_BADGES === false) {
      normalized.HIDE_BADGES = true;
    }

    return normalized;
  }

  function valuesEqual(left, right) {
    if (Array.isArray(left) && Array.isArray(right)) {
      return left.length === right.length && left.every((value, index) => value === right[index]);
    }
    return left === right;
  }

  function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function fromBase64Url(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw new Error("Der Overlay-Link enthält ungültige Zeichen.");
    }
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function encode(config) {
    const normalized = normalizeConfig(config, { strict: true });
    const compact = {};

    FIELD_DEFINITIONS.forEach(([longKey, shortKey]) => {
      if (!valuesEqual(normalized[longKey], DEFAULTS[longKey])) {
        compact[shortKey] = normalized[longKey];
      }
    });

    const payload = toBase64Url(JSON.stringify({ v: FORMAT_VERSION, c: compact }));
    if (payload.length > MAX_PAYLOAD_LENGTH) {
      throw new Error("Die Konfiguration ist für einen zuverlässigen OBS-Link zu groß. Kürze bitte die Filterlisten.");
    }
    return payload;
  }

  function decode(payload) {
    const encoded = String(payload || "").trim();
    if (!encoded) throw new Error("Der Overlay-Link enthält keine Konfiguration.");
    if (encoded.length > MAX_PAYLOAD_LENGTH) throw new Error("Der Overlay-Link ist zu lang.");

    let parsed;
    try {
      parsed = JSON.parse(fromBase64Url(encoded));
    } catch (error) {
      if (error instanceof SyntaxError || error?.name === "InvalidCharacterError" || error?.name === "TypeError") {
        throw new Error("Die Konfiguration im Overlay-Link ist beschädigt oder unvollständig.");
      }
      throw error;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Der Overlay-Link enthält keine gültige Konfiguration.");
    }
    const version = hasOwn(parsed, "v") ? Number(parsed.v) : 1;
    if (version !== FORMAT_VERSION) {
      throw new Error(`Diese Konfigurationsversion (${version}) wird noch nicht unterstützt.`);
    }
    if (!parsed.c || typeof parsed.c !== "object" || Array.isArray(parsed.c)) {
      throw new Error("Der Overlay-Link enthält kein gültiges Konfigurationsobjekt.");
    }

    const expanded = {};
    FIELD_DEFINITIONS.forEach(([longKey, shortKey]) => {
      if (hasOwn(parsed.c, shortKey)) expanded[longKey] = parsed.c[shortKey];
    });
    return normalizeConfig(expanded, { strict: true });
  }

  function payloadFromInput(input) {
    const value = String(input || "").trim();
    if (!value) throw new Error("Füge zuerst einen bestehenden Overlay-Link ein.");
    if (value.length > MAX_PAYLOAD_LENGTH + 2048) throw new Error("Der eingefügte Overlay-Link ist zu lang.");

    if (/^[A-Za-z0-9_-]+$/.test(value)) return value;

    let url;
    try {
      url = new URL(value, global.location?.href || "https://multichat.romestylez.dev/config");
    } catch {
      throw new Error("Der eingefügte Text ist kein gültiger Overlay-Link.");
    }

    const hashParameters = new URLSearchParams(url.hash.replace(/^#/, ""));
    const payload = hashParameters.get("c") || url.searchParams.get("c");
    if (!payload) throw new Error("Im eingefügten Link wurde keine Konfiguration gefunden.");
    return payload;
  }

  function decodeFromInput(input) {
    return decode(payloadFromInput(input));
  }

  function overlayUrl(config, currentUrl) {
    const base = new URL(currentUrl || global.location?.href || "https://multichat.romestylez.dev/config");
    const basePath = base.pathname.replace(/\/(?:config|config\.html|chat|chat\.html)\/?$/i, "/");
    const target = new URL(`${basePath.replace(/\/$/, "")}/chat`, base.origin);
    target.hash = `c=${encode(config)}`;
    return target.href;
  }

  global.MultiChatConfig = Object.freeze({
    FORMAT_VERSION,
    DEFAULTS,
    MAX_PAYLOAD_LENGTH,
    normalizeConfig,
    encode,
    decode,
    decodeFromInput,
    overlayUrl
  });
})(window);
