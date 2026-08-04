(function () {
  "use strict";

  const chatBox = document.getElementById("chat");

  function showError(message) {
    const error = document.createElement("div");
    error.className = "overlay-error";
    error.textContent = message;
    chatBox.appendChild(error);
  }

  try {
    if (!window.MultiChatConfig) throw new Error("Der Konfigurations-Decoder konnte nicht geladen werden.");
    window.CONFIG = window.MultiChatConfig.decodeFromInput(window.location.href);
  } catch (error) {
    window.CONFIG = {
      ENABLE_7TV: false,
      ENABLE_BTTV: false,
      ENABLE_FFZ: false
    };
    showError(error.message || "Der Overlay-Link enthält keine gültige Konfiguration.");
    console.error("[Online Config] Loading failed:", error);
  }
})();
