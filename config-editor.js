(function () {
  "use strict";

  const loadedConfig = typeof CONFIG !== "undefined" && CONFIG && typeof CONFIG === "object"
    ? CONFIG
    : {};

  const defaults = {
    TWITCH_CHANNEL: "",
    KICK_CHANNEL: "",
    KICK_CHATROOM_ID: "",
    ENABLE_7TV: true,
    ENABLE_BTTV: true,
    FFZ_CHANNEL: "",
    MAX_MESSAGES: 20,
    HIDE_BADGES: false,
    HIDE_SUB_BADGES: false,
    HIDE_GLOBAL_BADGE: false,
    HIDE_PLATFORM: false,
    BLOCKED_USERS: [],
    BLOCK_ALL_PREFIX_COMMANDS: false,
    BLOCKED_COMMANDS: [],
    BLOCK_LINKS: false
  };

  const values = { ...defaults, ...loadedConfig };
  let configFileHandle = null;

  const elements = {
    form: document.getElementById("config-form"),
    loadState: document.getElementById("load-state"),
    twitchChannel: document.getElementById("twitch-channel"),
    kickChannel: document.getElementById("kick-channel"),
    kickChatroomId: document.getElementById("kick-chatroom-id"),
    resolveKick: document.getElementById("resolve-kick"),
    kickStatus: document.getElementById("kick-status"),
    enable7TV: document.getElementById("enable-7tv"),
    enableBTTV: document.getElementById("enable-bttv"),
    ffzChannel: document.getElementById("ffz-channel"),
    maxMessages: document.getElementById("max-messages"),
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

  function setKickStatus(message, kind) {
    elements.kickStatus.textContent = message;
    elements.kickStatus.className = `inline-status${kind ? ` status-${kind}` : ""}`;
  }

  function setSaveStatus(message, kind) {
    elements.saveStatus.textContent = message;
    elements.saveStatus.className = `save-status${kind ? ` status-${kind}` : ""}`;
  }

  function syncBlockedCommandsAvailability() {
    const blockAllCommands = elements.blockPrefixCommands.checked;
    elements.blockedCommands.disabled = blockAllCommands;
    elements.blockedCommandsHint.textContent = blockAllCommands
      ? "Deaktiviert, weil alle !-Befehle blockiert werden."
      : "Ein Befehl inklusive Präfix pro Zeile.";
  }

  function populateForm() {
    elements.twitchChannel.value = values.TWITCH_CHANNEL || "";
    elements.kickChannel.value = values.KICK_CHANNEL || "";
    elements.kickChatroomId.value = values.KICK_CHATROOM_ID || "";
    elements.enable7TV.checked = values.ENABLE_7TV !== false;
    elements.enableBTTV.checked = values.ENABLE_BTTV !== false;
    elements.ffzChannel.value = values.FFZ_CHANNEL || "";
    elements.maxMessages.value = values.MAX_MESSAGES || 20;
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

    const hasConfig = Object.keys(loadedConfig).length > 0;
    elements.loadState.textContent = hasConfig ? "config.js geladen" : "Neue Konfiguration";
    elements.loadState.classList.add(hasConfig ? "state-success" : "state-neutral");
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

    elements.kickChatroomId.value = String(chatroomId);
    if (data.slug) elements.kickChannel.value = String(data.slug).toLowerCase();
    setKickStatus(`Chatroom-ID ${chatroomId} wurde übernommen.`, "success");
    return chatroomId;
  }

  async function resolveKickChatroom() {
    const channel = normalizeChannel(elements.kickChannel.value, "kick");
    if (!channel) {
      setKickStatus("Bitte zuerst einen Kick-Kanal eingeben.", "error");
      elements.kickChannel.focus();
      return;
    }

    elements.kickChannel.value = channel;
    setKickStatus("Kick-Chatroom-ID wird geladen …", "working");
    elements.resolveKick.disabled = true;

    try {
      const response = await fetch(`https://kick.com/api/v1/channels/${encodeURIComponent(channel)}`, {
        headers: { Accept: "application/json" },
        credentials: "omit"
      });

      if (!response.ok) {
        throw new Error(`Kick antwortet mit HTTP ${response.status}.`);
      }

      readKickResponse(await response.json());
    } catch (error) {
      setKickStatus(
        "Die automatische Abfrage wurde blockiert. Bitte die Chatroom-ID manuell eintragen.",
        "error"
      );
      console.warn("[Config Editor] Kick lookup failed:", error);
    } finally {
      elements.resolveKick.disabled = false;
    }
  }

  function buildConfig() {
    const twitchChannel = normalizeChannel(elements.twitchChannel.value, "twitch");
    const kickChannel = normalizeChannel(elements.kickChannel.value, "kick");
    const kickChatroomId = Number(elements.kickChatroomId.value);
    const maxMessages = Number(elements.maxMessages.value);

    if (!twitchChannel && !kickChatroomId) {
      throw new Error("Konfiguriere mindestens einen Twitch- oder Kick-Kanal.");
    }
    if (kickChannel && (!Number.isInteger(kickChatroomId) || kickChatroomId <= 0)) {
      throw new Error("Für den Kick-Kanal fehlt eine gültige Chatroom-ID.");
    }
    if (!Number.isInteger(maxMessages) || maxMessages < 1 || maxMessages > 200) {
      throw new Error("Die maximale Nachrichtenanzahl muss zwischen 1 und 200 liegen.");
    }

    const config = {
      TWITCH_CHANNEL: twitchChannel,
      KICK_CHANNEL: kickChannel,
      KICK_CHATROOM_ID: Number.isInteger(kickChatroomId) && kickChatroomId > 0 ? kickChatroomId : 0,
      ENABLE_7TV: elements.enable7TV.checked,
      ENABLE_BTTV: elements.enableBTTV.checked,
      FFZ_CHANNEL: normalizeChannel(elements.ffzChannel.value, "twitch"),
      MAX_MESSAGES: maxMessages,
      HIDE_BADGES: elements.hideBadges.checked,
      HIDE_SUB_BADGES: elements.hideSubBadges.checked,
      HIDE_GLOBAL_BADGE: elements.hideGlobalBadge.checked,
      HIDE_PLATFORM: elements.hidePlatform.checked,
      BLOCKED_USERS: linesToArray(elements.blockedUsers.value),
      BLOCK_ALL_PREFIX_COMMANDS: elements.blockPrefixCommands.checked,
      BLOCKED_COMMANDS: linesToArray(elements.blockedCommands.value),
      BLOCK_LINKS: elements.blockLinks.checked
    };

    if (loadedConfig.KICK_APP_KEY) config.KICK_APP_KEY = loadedConfig.KICK_APP_KEY;
    if (loadedConfig.KICK_CLUSTER) config.KICK_CLUSTER = loadedConfig.KICK_CLUSTER;

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

  async function saveConfig(event) {
    event.preventDefault();

    try {
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
    } catch (error) {
      if (error?.name === "AbortError") {
        setSaveStatus("Speichern wurde abgebrochen.", "neutral");
        return;
      }
      setSaveStatus(error.message || "config.js konnte nicht gespeichert werden.", "error");
      console.error("[Config Editor] Saving failed:", error);
    }
  }

  function forceDownload() {
    try {
      downloadConfig(serializeConfig(buildConfig()));
      setSaveStatus("config.js wurde heruntergeladen.", "success");
      elements.saveHint.textContent = "Verschiebe die Datei neben config.html und lade den Editor danach neu.";
    } catch (error) {
      setSaveStatus(error.message, "error");
    }
  }

  elements.form.addEventListener("submit", saveConfig);
  elements.downloadConfig.addEventListener("click", forceDownload);
  elements.resolveKick.addEventListener("click", resolveKickChatroom);
  elements.blockPrefixCommands.addEventListener("change", syncBlockedCommandsAvailability);
  elements.twitchChannel.addEventListener("blur", () => {
    elements.twitchChannel.value = normalizeChannel(elements.twitchChannel.value, "twitch");
  });
  elements.kickChannel.addEventListener("blur", () => {
    elements.kickChannel.value = normalizeChannel(elements.kickChannel.value, "kick");
  });

  populateForm();
})();
