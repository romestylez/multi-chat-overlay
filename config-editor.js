(async function () {
  "use strict";

  async function loadAdjacentConfig() {
    if (window.CONFIG && typeof window.CONFIG === "object") return;

    await new Promise(resolve => {
      const script = document.createElement("script");
      script.src = "config.js";
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  await loadAdjacentConfig();

  const defaults = {
    TWITCH_CHANNEL: "",
    KICK_CHANNEL: "",
    KICK_CHATROOM_ID: 0,
    ENABLE_7TV: true,
    ENABLE_BTTV: true,
    ENABLE_FFZ: true,
    MAX_MESSAGES: 20,
    CHAT_FONT_SIZE: 20,
    CHAT_FONT_FAMILY: "system",
    CHAT_FONT_WEIGHT: 800,
    TWITCH_MESSAGE_COLOR: "#FFFFFF",
    KICK_MESSAGE_COLOR: "#FFFFFF",
    ENABLE_TEXT_SHADOW: false,
    HIDE_BADGES: false,
    HIDE_SUB_BADGES: false,
    HIDE_GLOBAL_BADGE: false,
    HIDE_PLATFORM: false,
    BLOCKED_USERS: [],
    BLOCK_ALL_PREFIX_COMMANDS: false,
    BLOCKED_COMMANDS: [],
    BLOCK_LINKS: false
  };

  const loadedConfig = window.CONFIG && typeof window.CONFIG === "object"
    ? window.CONFIG
    : {};
  const values = { ...defaults, ...loadedConfig };
  let configFileHandle = null;
  let kickChatroomIdValue = 0;
  let kickChannelForChatroomId = "";

  const elements = {
    form: document.getElementById("config-form"),
    loadState: document.getElementById("load-state"),
    twitchChannel: document.getElementById("twitch-channel"),
    kickChannel: document.getElementById("kick-channel"),
    kickChatroomId: document.getElementById("kick-chatroom-id"),
    kickManualFallback: document.getElementById("kick-manual-fallback"),
    resolveKick: document.getElementById("resolve-kick"),
    kickStatus: document.getElementById("kick-status"),
    enable7TV: document.getElementById("enable-7tv"),
    enableBTTV: document.getElementById("enable-bttv"),
    enableFFZ: document.getElementById("enable-ffz"),
    maxMessages: document.getElementById("max-messages"),
    chatFontSize: document.getElementById("chat-font-size"),
    chatFontSizeValue: document.getElementById("chat-font-size-value"),
    chatFontFamily: document.getElementById("chat-font-family"),
    chatFontWeight: document.getElementById("chat-font-weight"),
    chatFontWeightValue: document.getElementById("chat-font-weight-value"),
    chatPreview: document.getElementById("chat-preview"),
    twitchMessageColor: document.getElementById("twitch-message-color"),
    twitchMessageColorHex: document.getElementById("twitch-message-color-hex"),
    kickMessageColor: document.getElementById("kick-message-color"),
    kickMessageColorHex: document.getElementById("kick-message-color-hex"),
    enableTextShadow: document.getElementById("enable-text-shadow"),
    hideBadges: document.getElementById("hide-badges"),
    hideSubBadges: document.getElementById("hide-sub-badges"),
    hideGlobalBadge: document.getElementById("hide-global-badge"),
    hidePlatform: document.getElementById("hide-platform"),
    blockedUsers: document.getElementById("blocked-users"),
    blockedCommands: document.getElementById("blocked-commands"),
    blockedCommandsHint: document.getElementById("blocked-commands-hint"),
    blockPrefixCommands: document.getElementById("block-prefix-commands"),
    blockLinks: document.getElementById("block-links"),
    downloadConfig: document.getElementById("download-config"),
    saveStatus: document.getElementById("save-status"),
    saveHint: document.getElementById("save-hint")
  };

  function normalizeChannel(value, platform) {
    let channel = String(value || "").trim();
    const host = platform === "kick" ? "kick.com" : "twitch.tv";
    channel = channel.replace(new RegExp(`^https?:\\/\\/(?:www\\.)?${host.replace(".", "\\.")}\\/`, "i"), "");
    channel = channel.split(/[/?#]/)[0].replace(/^@/, "");
    return channel.toLowerCase();
  }

  function linesToArray(value) {
    return [...new Set(String(value || "")
      .split(/\r?\n|,/)
      .map(item => item.trim())
      .filter(Boolean))];
  }

  function arrayToLines(value) {
    return Array.isArray(value) ? value.join("\n") : "";
  }

  function normalizedHexColor(value) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : null;
  }

  function readHexColor(input, label) {
    const color = normalizedHexColor(input.value);
    if (!color) throw new Error(`${label} muss als Hex-Farbe im Format #RRGGBB angegeben werden.`);
    return color;
  }

  const supportedFontFamilies = new Set(["system", "arial", "verdana", "tahoma", "trebuchet", "georgia", "courier"]);
  const fontFamilyStacks = {
    system: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    arial: "Arial, Helvetica, sans-serif",
    verdana: "Verdana, Geneva, sans-serif",
    tahoma: "Tahoma, Geneva, sans-serif",
    trebuchet: "'Trebuchet MS', Arial, sans-serif",
    georgia: "Georgia, 'Times New Roman', serif",
    courier: "'Courier New', Courier, monospace"
  };

  function fontWeightLabel(value) {
    return ({
      300: "Dünn",
      400: "Normal",
      500: "Mittel",
      600: "Halbfett",
      700: "Fett",
      800: "Extra fett",
      900: "Sehr fett"
    })[value] || "Extra fett";
  }

  function syncTypographyOutputs() {
    const fontSize = Number(elements.chatFontSize.value);
    const fontWeight = Number(elements.chatFontWeight.value);
    elements.chatFontSizeValue.textContent = `${fontSize} px`;
    elements.chatFontWeightValue.textContent = `${fontWeightLabel(fontWeight)} (${fontWeight})`;
  }

  function syncPreview() {
    const preview = elements.chatPreview;
    const fontSize = Number(elements.chatFontSize.value);
    const fontWeight = Number(elements.chatFontWeight.value);
    preview.style.fontSize = `${fontSize}px`;
    preview.style.fontFamily = fontFamilyStacks[elements.chatFontFamily.value] || fontFamilyStacks.system;
    preview.style.fontWeight = String(fontWeight);
    preview.classList.toggle("text-shadow-enabled", elements.enableTextShadow.checked);

    const platformColors = {
      twitch: normalizedHexColor(elements.twitchMessageColorHex.value) || elements.twitchMessageColor.value,
      kick: normalizedHexColor(elements.kickMessageColorHex.value) || elements.kickMessageColor.value
    };
    preview.querySelectorAll("[data-preview-platform]").forEach(message => {
      const text = message.querySelector(".preview-message-text");
      if (text) text.style.color = platformColors[message.dataset.previewPlatform] || "#FFFFFF";
    });
    preview.querySelectorAll(".preview-platform-icon").forEach(icon => {
      icon.hidden = elements.hidePlatform.checked;
    });
    preview.querySelectorAll(".preview-role-badge").forEach(badge => {
      badge.hidden = elements.hideBadges.checked;
    });
    preview.querySelectorAll(".preview-sub-badge").forEach(badge => {
      badge.hidden = elements.hideBadges.checked || elements.hideSubBadges.checked;
    });
    preview.querySelectorAll(".preview-global-badge").forEach(badge => {
      badge.hidden = elements.hideBadges.checked || elements.hideGlobalBadge.checked;
    });
  }

  function bindColorInputs(picker, textInput) {
    picker.addEventListener("input", () => {
      textInput.value = picker.value.toUpperCase();
    });
    textInput.addEventListener("input", () => {
      const color = normalizedHexColor(textInput.value);
      if (color) picker.value = color.toLowerCase();
    });
    textInput.addEventListener("blur", () => {
      const color = normalizedHexColor(textInput.value);
      if (color) textInput.value = color;
    });
  }

  function setKickStatus(message, kind) {
    elements.kickStatus.textContent = message;
    elements.kickStatus.className = `inline-status${kind ? ` status-${kind}` : ""}`;
  }

  function setSaveStatus(message, kind) {
    elements.saveStatus.textContent = message;
    elements.saveStatus.className = `save-status${kind ? ` status-${kind}` : ""}`;
  }

  function setLoadState(message, kind) {
    elements.loadState.textContent = message;
    elements.loadState.className = `state-pill${kind ? ` state-${kind}` : ""}`;
  }

  function syncBlockedCommandsAvailability() {
    const blockAllCommands = elements.blockPrefixCommands.checked;
    elements.blockedCommands.disabled = blockAllCommands;
    elements.blockedCommandsHint.textContent = blockAllCommands
      ? "Deaktiviert, weil alle !-Befehle blockiert werden."
      : "Ein Befehl inklusive Präfix pro Zeile.";
  }

  function applyMode() {
    document.body.dataset.editorMode = "local";
    document.title = "Multi Chat Overlay – Konfiguration";
  }

  function populateForm(source) {
    elements.twitchChannel.value = values.TWITCH_CHANNEL || "";
    elements.kickChannel.value = values.KICK_CHANNEL || "";
    kickChatroomIdValue = Number.isInteger(Number(values.KICK_CHATROOM_ID)) && Number(values.KICK_CHATROOM_ID) > 0
      ? Number(values.KICK_CHATROOM_ID)
      : 0;
    elements.kickChatroomId.value = kickChatroomIdValue || "";
    elements.kickManualFallback.hidden = true;
    elements.resolveKick.hidden = true;
    kickChannelForChatroomId = kickChatroomIdValue > 0
      ? normalizeChannel(values.KICK_CHANNEL, "kick")
      : "";
    elements.enable7TV.checked = values.ENABLE_7TV !== false;
    elements.enableBTTV.checked = values.ENABLE_BTTV !== false;
    elements.enableFFZ.checked = values.ENABLE_FFZ !== false;
    elements.maxMessages.value = values.MAX_MESSAGES || 20;
    const chatFontSize = Number(values.CHAT_FONT_SIZE);
    const chatFontWeight = Number(values.CHAT_FONT_WEIGHT);
    elements.chatFontSize.value = Number.isInteger(chatFontSize) && chatFontSize >= 12 && chatFontSize <= 48 ? chatFontSize : 20;
    elements.chatFontFamily.value = supportedFontFamilies.has(values.CHAT_FONT_FAMILY) ? values.CHAT_FONT_FAMILY : "system";
    elements.chatFontWeight.value = Number.isInteger(chatFontWeight) && chatFontWeight >= 300 && chatFontWeight <= 900 && chatFontWeight % 100 === 0
      ? chatFontWeight
      : 800;
    syncTypographyOutputs();

    const twitchMessageColor = normalizedHexColor(values.TWITCH_MESSAGE_COLOR) || "#FFFFFF";
    const kickMessageColor = normalizedHexColor(values.KICK_MESSAGE_COLOR) || "#FFFFFF";
    elements.twitchMessageColor.value = twitchMessageColor.toLowerCase();
    elements.twitchMessageColorHex.value = twitchMessageColor;
    elements.kickMessageColor.value = kickMessageColor.toLowerCase();
    elements.kickMessageColorHex.value = kickMessageColor;
    elements.enableTextShadow.checked = Boolean(values.ENABLE_TEXT_SHADOW);
    elements.hideBadges.checked = Object.prototype.hasOwnProperty.call(loadedConfig, "HIDE_BADGES")
      ? Boolean(loadedConfig.HIDE_BADGES)
      : loadedConfig.SHOW_BADGES === false;
    elements.hideSubBadges.checked = Boolean(values.HIDE_SUB_BADGES);
    elements.hideGlobalBadge.checked = Boolean(values.HIDE_GLOBAL_BADGE);
    elements.hidePlatform.checked = Boolean(values.HIDE_PLATFORM);
    elements.blockedUsers.value = arrayToLines(values.BLOCKED_USERS);
    elements.blockedCommands.value = arrayToLines(values.BLOCKED_COMMANDS);
    elements.blockPrefixCommands.checked = Boolean(values.BLOCK_ALL_PREFIX_COMMANDS);
    elements.blockLinks.checked = Boolean(values.BLOCK_LINKS);
    syncBlockedCommandsAvailability();
    syncPreview();

    const hasConfig = Object.keys(loadedConfig).length > 0;
    setLoadState(hasConfig ? "config.js geladen" : "Neue Konfiguration", hasConfig ? "success" : "neutral");
    if (hasConfig) {
      setSaveStatus("config.js geladen.", "success");
      elements.saveHint.textContent = "Die angezeigten Werte wurden aus der vorhandenen Konfiguration eingelesen.";
    } else {
      setSaveStatus("Noch nicht gespeichert.", "neutral");
      elements.saveHint.textContent = "Speichere die Datei als config.js neben config.html.";
    }
  }

  function readKickResponse(data) {
    const chatroomId = Number(data?.chatroom?.id);
    if (!Number.isInteger(chatroomId) || chatroomId <= 0) {
      throw new Error("In der Antwort wurde keine gültige chatroom.id gefunden.");
    }

    kickChatroomIdValue = chatroomId;
    elements.kickChatroomId.value = String(chatroomId);
    elements.kickManualFallback.hidden = true;
    elements.resolveKick.hidden = true;
    if (data.slug) elements.kickChannel.value = String(data.slug).toLowerCase();
    kickChannelForChatroomId = normalizeChannel(elements.kickChannel.value, "kick");
    setKickStatus(`Chatroom-ID ${chatroomId} wurde übernommen.`, "success");
    return chatroomId;
  }

  async function resolveKickChatroom() {
    const channel = normalizeChannel(elements.kickChannel.value, "kick");
    if (!channel) {
      setKickStatus("Bitte zuerst einen Kick-Kanal eingeben.", "error");
      elements.kickChannel.focus();
      return 0;
    }

    elements.kickChannel.value = channel;
    setKickStatus("Kick-Chatroom-ID wird geladen …", "working");
    elements.resolveKick.disabled = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`https://kick.com/api/v1/channels/${encodeURIComponent(channel)}`, {
        headers: { Accept: "application/json" },
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`Kick antwortet mit HTTP ${response.status}.`);
      return readKickResponse(await response.json());
    } catch (error) {
      const message = error?.name === "AbortError"
        ? "Kick hat zu lange nicht geantwortet. Versuche es bitte erneut."
        : "Die automatische Abfrage ist fehlgeschlagen. Versuche es bitte erneut.";
      setKickStatus(message, "error");
      elements.kickManualFallback.hidden = false;
      elements.resolveKick.hidden = false;
      console.warn("[Config Editor] Kick lookup failed:", error);
      return 0;
    } finally {
      window.clearTimeout(timeoutId);
      elements.resolveKick.disabled = false;
    }
  }

  async function ensureKickChatroomId() {
    const channel = normalizeChannel(elements.kickChannel.value, "kick");
    elements.kickChannel.value = channel;
    if (!channel) return;
    if (!/^[a-z0-9_-]{1,80}$/.test(channel)) {
      throw new Error("Der Kick-Kanal enthält ungültige Zeichen.");
    }

    const chatroomId = kickChatroomIdValue;
    if (Number.isInteger(chatroomId) && chatroomId > 0 && kickChannelForChatroomId === channel) return;

    const resolvedId = await resolveKickChatroom();
    if (!resolvedId) {
      elements.kickChatroomId.focus();
      throw new Error("Die Kick-Chatroom-ID konnte nicht automatisch ermittelt werden. Es wurde keine Konfiguration erstellt.");
    }
  }

  function buildConfig() {
    const twitchChannel = normalizeChannel(elements.twitchChannel.value, "twitch");
    const kickChannel = normalizeChannel(elements.kickChannel.value, "kick");
    const kickChatroomId = kickChatroomIdValue;
    const maxMessages = Number(elements.maxMessages.value);
    const chatFontSize = Number(elements.chatFontSize.value);
    const chatFontFamily = elements.chatFontFamily.value;
    const chatFontWeight = Number(elements.chatFontWeight.value);

    if (!twitchChannel && !kickChatroomId) {
      throw new Error("Konfiguriere mindestens einen Twitch- oder Kick-Kanal.");
    }
    if (twitchChannel && !/^[a-z0-9_]{1,25}$/.test(twitchChannel)) {
      throw new Error("Der Twitch-Kanal enthält ungültige Zeichen.");
    }
    if (kickChannel && !/^[a-z0-9_-]{1,80}$/.test(kickChannel)) {
      throw new Error("Der Kick-Kanal enthält ungültige Zeichen.");
    }
    if (kickChannel && (!Number.isInteger(kickChatroomId) || kickChatroomId <= 0)) {
      throw new Error("Für den Kick-Kanal fehlt eine gültige Chatroom-ID.");
    }
    if (!Number.isInteger(maxMessages) || maxMessages < 1 || maxMessages > 200) {
      throw new Error("Die maximale Nachrichtenanzahl muss zwischen 1 und 200 liegen.");
    }
    if (!Number.isInteger(chatFontSize) || chatFontSize < 12 || chatFontSize > 48) {
      throw new Error("Die Schriftgröße muss zwischen 12 und 48 Pixeln liegen.");
    }
    if (!supportedFontFamilies.has(chatFontFamily)) {
      throw new Error("Die ausgewählte Schriftart ist ungültig.");
    }
    if (!Number.isInteger(chatFontWeight) || chatFontWeight < 300 || chatFontWeight > 900 || chatFontWeight % 100 !== 0) {
      throw new Error("Die Schriftstärke ist ungültig.");
    }

    const config = {
      TWITCH_CHANNEL: twitchChannel,
      KICK_CHANNEL: kickChannel,
      KICK_CHATROOM_ID: Number.isInteger(kickChatroomId) && kickChatroomId > 0 ? kickChatroomId : 0,
      ENABLE_7TV: elements.enable7TV.checked,
      ENABLE_BTTV: elements.enableBTTV.checked,
      ENABLE_FFZ: elements.enableFFZ.checked,
      MAX_MESSAGES: maxMessages,
      CHAT_FONT_SIZE: chatFontSize,
      CHAT_FONT_FAMILY: chatFontFamily,
      CHAT_FONT_WEIGHT: chatFontWeight,
      TWITCH_MESSAGE_COLOR: readHexColor(elements.twitchMessageColorHex, "Die Twitch-Nachrichtenfarbe"),
      KICK_MESSAGE_COLOR: readHexColor(elements.kickMessageColorHex, "Die Kick-Nachrichtenfarbe"),
      ENABLE_TEXT_SHADOW: elements.enableTextShadow.checked,
      HIDE_BADGES: elements.hideBadges.checked,
      HIDE_SUB_BADGES: elements.hideSubBadges.checked,
      HIDE_GLOBAL_BADGE: elements.hideGlobalBadge.checked,
      HIDE_PLATFORM: elements.hidePlatform.checked,
      BLOCKED_USERS: linesToArray(elements.blockedUsers.value),
      BLOCK_ALL_PREFIX_COMMANDS: elements.blockPrefixCommands.checked,
      BLOCKED_COMMANDS: linesToArray(elements.blockedCommands.value),
      BLOCK_LINKS: elements.blockLinks.checked
    };

    [
      "TWITCH_USERNAME",
      "TWITCH_OAUTH",
      "KICK_APP_KEY",
      "KICK_CLUSTER",
      "SEVENTV_USER_ID",
      "BTTV_TWITCH_USER_ID",
      "FFZ_CHANNEL"
    ].forEach(key => {
      if (loadedConfig[key]) config[key] = loadedConfig[key];
    });

    return config;
  }

  function serializeConfig(config) {
    return `// Generated by config.html\nwindow.CONFIG = ${JSON.stringify(config, null, 2)};\n`;
  }

  function downloadConfig(text) {
    const blob = new Blob([text], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "config.js";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function saveLocalConfig() {
    await ensureKickChatroomId();
    const text = serializeConfig(buildConfig());

    if (!("showSaveFilePicker" in window) || !window.isSecureContext) {
      downloadConfig(text);
      setSaveStatus("config.js wurde heruntergeladen. Verschiebe sie neben config.html.", "success");
      elements.saveHint.textContent = "Lade config.html danach neu, um die gespeicherten Werte einzulesen.";
      return;
    }

    if (!configFileHandle) {
      configFileHandle = await window.showSaveFilePicker({
        suggestedName: "config.js",
        types: [{
          description: "JavaScript-Konfiguration",
          accept: { "text/javascript": [".js"] }
        }]
      });
    }

    const writable = await configFileHandle.createWritable();
    await writable.write(text);
    await writable.close();
    setSaveStatus("config.js wurde gespeichert. Aktualisiere jetzt die Browser Source in OBS.", "success");
    elements.saveHint.textContent = "Beim nächsten Laden wird die vorhandene config.js automatisch eingelesen.";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      await saveLocalConfig();
    } catch (error) {
      if (error?.name === "AbortError") {
        setSaveStatus("Speichern wurde abgebrochen.", "neutral");
        return;
      }
      setSaveStatus(error.message || "Die Konfiguration konnte nicht verarbeitet werden.", "error");
      console.error("[Config Editor] Action failed:", error);
    }
  }

  async function forceDownload() {
    try {
      await ensureKickChatroomId();
      downloadConfig(serializeConfig(buildConfig()));
      setSaveStatus("config.js wurde heruntergeladen.", "success");
      elements.saveHint.textContent = "Verschiebe die Datei neben config.html und lade den Editor danach neu.";
    } catch (error) {
      setSaveStatus(error.message, "error");
    }
  }

  elements.form.addEventListener("submit", handleSubmit);
  elements.downloadConfig.addEventListener("click", forceDownload);
  elements.resolveKick.addEventListener("click", () => void resolveKickChatroom());
  elements.blockPrefixCommands.addEventListener("change", syncBlockedCommandsAvailability);
  bindColorInputs(elements.twitchMessageColor, elements.twitchMessageColorHex);
  bindColorInputs(elements.kickMessageColor, elements.kickMessageColorHex);
  elements.chatFontSize.addEventListener("input", () => {
    syncTypographyOutputs();
    syncPreview();
  });
  elements.chatFontWeight.addEventListener("input", () => {
    syncTypographyOutputs();
    syncPreview();
  });
  elements.chatFontFamily.addEventListener("change", syncPreview);
  [elements.twitchMessageColor, elements.twitchMessageColorHex, elements.kickMessageColor, elements.kickMessageColorHex]
    .forEach(input => input.addEventListener("input", syncPreview));
  [elements.enableTextShadow, elements.hideBadges, elements.hideSubBadges, elements.hideGlobalBadge, elements.hidePlatform]
    .forEach(input => input.addEventListener("change", syncPreview));
  elements.twitchChannel.addEventListener("blur", () => {
    elements.twitchChannel.value = normalizeChannel(elements.twitchChannel.value, "twitch");
  });
  elements.kickChannel.addEventListener("blur", () => {
    elements.kickChannel.value = normalizeChannel(elements.kickChannel.value, "kick");
  });
  elements.kickChannel.addEventListener("input", () => {
    const channel = normalizeChannel(elements.kickChannel.value, "kick");
    if (!elements.kickManualFallback.hidden || !elements.resolveKick.hidden) {
      kickChatroomIdValue = 0;
      kickChannelForChatroomId = "";
      elements.kickChatroomId.value = "";
      elements.kickManualFallback.hidden = true;
      elements.resolveKick.hidden = true;
      setKickStatus("", "neutral");
    }
    if (kickChatroomIdValue > 0 && kickChannelForChatroomId && channel !== kickChannelForChatroomId) {
      kickChatroomIdValue = 0;
      elements.kickChatroomId.value = "";
      elements.kickManualFallback.hidden = true;
      elements.resolveKick.hidden = true;
      kickChannelForChatroomId = "";
      setKickStatus("Kanal geändert – die Chatroom-ID wird beim Speichern neu ermittelt.", "neutral");
    }
  });
  elements.kickChatroomId.addEventListener("input", () => {
    kickChatroomIdValue = Number.isInteger(Number(elements.kickChatroomId.value)) && Number(elements.kickChatroomId.value) > 0
      ? Number(elements.kickChatroomId.value)
      : 0;
    kickChannelForChatroomId = kickChatroomIdValue > 0
      ? normalizeChannel(elements.kickChannel.value, "kick")
      : "";
  });

  applyMode();
  populateForm("initial");
})();
