// Example configuration for Chat Overlay
const CONFIG = {
  // Twitch
  TWITCH_CHANNEL: "YOUR_TWITCH_NAME", 
  TWITCH_OAUTH: "oauth:YOUR_TWITCH_OAUTH_TOKEN", // Token from https://twitchapps.com/tmi/

  // Kick
  KICK_APP_KEY: "32cbd69e4b950bf97679",
  KICK_CLUSTER: "us2",   // e.g. "us2"
  KICK_CHATROOM_ID: 123456,            // your chatroom ID

  // 7TV
  SEVENTV_USER_ID: "YOUR_7TV_USER_ID",

  // BTTV
  BTTV_TWITCH_USER_ID: "YOUR_TWITCH_USER_ID",

  // FFZ
  FFZ_CHANNEL: "YOUR_FFZ_CHANNEL",     // usually same as Twitch channel

  // Show Twitch/Kick badges or not
  SHOW_BADGES: true,

  // Blacklist: users whose messages should be ignored
  BLOCKED_USERS: ["nightbot", "streamelements", "moobot"]
};


