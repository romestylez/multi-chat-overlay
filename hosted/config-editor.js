(async function () {
  "use strict";

  const codec = window.MultiChatConfig;
  const defaults = codec?.DEFAULTS || {
    TWITCH_CHANNEL: "",
    KICK_CHANNEL: "",
    KICK_CHATROOM_ID: 0,
    ENABLE_7TV: true,
    ENABLE_BTTV: true,
    ENABLE_FFZ: true,
    MAX_MESSAGES: 20,
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

  let loadedConfig = {};
  let values = { ...defaults, ...loadedConfig };

  const elements = {
    form: document.getElementById("config-form"),
    twitchChannel: document.getElementById("twitch-channel"),
    kickChannel: document.getElementById("kick-channel"),
    kickChatroomId: document.getElementById("kick-chatroom-id"),
    resolveKick: document.getElementById("resolve-kick"),
    kickStatus: document.getElementById("kick-status"),
    enable7TV: document.getElementById("enable-7tv"),
    enableBTTV: document.getElementById("enable-bttv"),
    enableFFZ: document.getElementById("enable-ffz"),
    maxMessages: document.getElementById("max-messages"),
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
    importConfig: document.getElementById("import-config"),
    importDialog: document.getElementById("import-dialog"),
    importUrl: document.getElementById("import-url"),
    importStatus: document.getElementById("import-status"),
    confirmImport: document.getElementById("confirm-import"),
    linkDialog: document.getElementById("link-dialog"),
    generatedOverlayUrl: document.getElementById("generated-overlay-url"),
    copyOverlayUrl: document.getElementById("copy-overlay-url"),
    copyStatus: document.getElementById("copy-status"),
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

  function setDialogStatus(element, message, kind) {
    element.textContent = message;
    element.className = `dialog-status${kind ? ` status-${kind}` : ""}`;
  }

  function showDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function syncBlockedCommandsAvailability() {
    const blockAllCommands = elements.blockPrefixCommands.checked;
    elements.blockedCommands.disabled = blockAllCommands;
    elements.blockedCommandsHint.textContent = blockAllCommands
      ? "Deaktiviert, weil alle !-Befehle blockiert werden."
      : "Ein Befehl inklusive Präfix pro Zeile.";
  }

  function applyMode() {
    document.body.dataset.editorMode = "online";
    document.title = "Multi Chat Overlay – Online-Konfiguration";
  }

  function populateForm(source) {
    elements.twitchChannel.value = values.TWITCH_CHANNEL || "";
    elements.kickChannel.value = values.KICK_CHANNEL || "";
    elements.kickChatroomId.value = values.KICK_CHATROOM_ID || "";
    elements.enable7TV.checked = values.ENABLE_7TV !== false;
    elements.enableBTTV.checked = values.ENABLE_BTTV !== false;
    elements.enableFFZ.checked = values.ENABLE_FFZ !== false;
    elements.maxMessages.value = values.MAX_MESSAGES || 20;

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

    if (source === "import") {
      setSaveStatus("Konfiguration wurde aus dem Overlay-Link geladen.", "success");
      elements.saveHint.textContent = "Nach Änderungen erzeugst du einen neuen Link und ersetzt ihn in OBS.";
    } else {
      setSaveStatus("Noch kein Overlay-Link erzeugt.", "neutral");
      elements.saveHint.textContent = "Die Einstellungen werden nur im erzeugten Link gespeichert.";
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

      if (!response.ok) throw new Error(`Kick antwortet mit HTTP ${response.status}.`);
      readKickResponse(await response.json());
    } catch (error) {
      setKickStatus("Die automatische Abfrage wurde blockiert. Bitte die Chatroom-ID manuell eintragen.", "error");
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

    const config = {
      TWITCH_CHANNEL: twitchChannel,
      KICK_CHANNEL: kickChannel,
      KICK_CHATROOM_ID: Number.isInteger(kickChatroomId) && kickChatroomId > 0 ? kickChatroomId : 0,
      ENABLE_7TV: elements.enable7TV.checked,
      ENABLE_BTTV: elements.enableBTTV.checked,
      ENABLE_FFZ: elements.enableFFZ.checked,
      MAX_MESSAGES: maxMessages,
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

    return config;
  }

  function generateOverlayLink() {
    if (!codec) throw new Error("Die Online-Konfiguration konnte nicht geladen werden.");
    const url = codec.overlayUrl(buildConfig(), window.location.href);
    elements.generatedOverlayUrl.value = url;
    setDialogStatus(elements.copyStatus, "Der Link enthält die vollständige Konfiguration.", "neutral");
    showDialog(elements.linkDialog);
    elements.generatedOverlayUrl.focus();
    elements.generatedOverlayUrl.select();
    setSaveStatus("Overlay-Link wurde erzeugt.", "success");
    elements.saveHint.textContent = "Kopiere den neuen Link und ersetze damit die URL deiner OBS-Browserquelle.";
  }

  function handleSubmit(event) {
    event.preventDefault();

    try {
      generateOverlayLink();
    } catch (error) {
      setSaveStatus(error.message || "Die Konfiguration konnte nicht verarbeitet werden.", "error");
      console.error("[Config Editor] Action failed:", error);
    }
  }

  function openImportDialog() {
    elements.importUrl.value = "";
    setDialogStatus(elements.importStatus, "", "neutral");
    showDialog(elements.importDialog);
    elements.importUrl.focus();
  }

  function importOverlayLink() {
    try {
      if (!codec) throw new Error("Die Importfunktion konnte nicht geladen werden.");
      loadedConfig = codec.decodeFromInput(elements.importUrl.value);
      values = { ...defaults, ...loadedConfig };
      populateForm("import");
      closeDialog(elements.importDialog);
      elements.twitchChannel.focus();
    } catch (error) {
      setDialogStatus(elements.importStatus, error.message || "Der Overlay-Link konnte nicht importiert werden.", "error");
    }
  }

  async function copyOverlayLink() {
    const text = elements.generatedOverlayUrl.value;
    if (!text) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        elements.generatedOverlayUrl.focus();
        elements.generatedOverlayUrl.select();
        if (!document.execCommand("copy")) throw new Error("copy failed");
      }
      setDialogStatus(elements.copyStatus, "Overlay-Link wurde kopiert.", "success");
    } catch {
      setDialogStatus(elements.copyStatus, "Kopieren wurde blockiert. Markiere den Link und kopiere ihn manuell.", "error");
    }
  }

  elements.form.addEventListener("submit", handleSubmit);
  elements.importConfig.addEventListener("click", openImportDialog);
  elements.confirmImport.addEventListener("click", importOverlayLink);
  elements.copyOverlayUrl.addEventListener("click", copyOverlayLink);
  elements.resolveKick.addEventListener("click", resolveKickChatroom);
  elements.blockPrefixCommands.addEventListener("change", syncBlockedCommandsAvailability);
  bindColorInputs(elements.twitchMessageColor, elements.twitchMessageColorHex);
  bindColorInputs(elements.kickMessageColor, elements.kickMessageColorHex);
  elements.twitchChannel.addEventListener("blur", () => {
    elements.twitchChannel.value = normalizeChannel(elements.twitchChannel.value, "twitch");
  });
  elements.kickChannel.addEventListener("blur", () => {
    elements.kickChannel.value = normalizeChannel(elements.kickChannel.value, "kick");
  });

  applyMode();
  populateForm("initial");

  if (window.location.hash.includes("c=")) {
    try {
      loadedConfig = codec.decodeFromInput(window.location.href);
      values = { ...defaults, ...loadedConfig };
      populateForm("import");
    } catch (error) {
      setSaveStatus(error.message, "error");
    }
  }
})();
