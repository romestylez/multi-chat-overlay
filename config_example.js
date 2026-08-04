// Example configuration for Chat Overlay
window.CONFIG = {
  // Twitch
  TWITCH_CHANNEL: "example_channel",

  // Optional authenticated Twitch login. Anonymous read-only mode is used when empty.
  TWITCH_USERNAME: "",
  TWITCH_OAUTH: "",

  // Kick
  KICK_CHANNEL: "example_channel",
  KICK_CHATROOM_ID: 123456,

  // Automatically load global and channel-specific emotes
  ENABLE_7TV: true,
  ENABLE_BTTV: true,
  ENABLE_FFZ: true,

  // Maximum number of messages visible at once
  MAX_MESSAGES: 20,

  // Chat typography
  CHAT_FONT_SIZE: 20,
  CHAT_FONT_FAMILY: "system",
  CHAT_FONT_WEIGHT: 800,

  // Platform-specific message colors and optional readability shadow
  TWITCH_MESSAGE_COLOR: "#FFFFFF",
  KICK_MESSAGE_COLOR: "#FFFFFF",
  ENABLE_TEXT_SHADOW: false,

  // Hide all badges, only subscriber/founder badges, or platform icons
  HIDE_BADGES: false,
  HIDE_SUB_BADGES: false,
  HIDE_GLOBAL_BADGE: false,
  HIDE_PLATFORM: false,

  // Blacklist: users whose messages should be ignored
  BLOCKED_USERS: ["examplebot1", "examplebot2", "examplebot3"],

  // Blacklist: all commands which start with !
  BLOCK_ALL_PREFIX_COMMANDS: true,

  // Blacklist: individual commands (including their prefix)
  BLOCKED_COMMANDS: ["!examplecommand", "!anothercommand"],

  // Blacklist: all links (http, https, www)
  BLOCK_LINKS: true
};
