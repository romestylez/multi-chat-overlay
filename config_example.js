// Example configuration for Chat Overlay
const CONFIG = {
  // Twitch
  TWITCH_CHANNEL: "example_channel",
  TWITCH_OAUTH: "oauth:xxxxxxxxxxxxxxxxxxxxxxxxxxxx", // Token from https://antiscuff.com/oauth/

  // Kick
  KICK_APP_KEY: "xxxxxxxxxxxxxxxxxxxx",
  KICK_CLUSTER: "us2",
  KICK_CHATROOM_ID: 123456,

  // 7TV
  SEVENTV_USER_ID: "XXXXXXXXXXXXXXXXX",

  // BTTV
  BTTV_TWITCH_USER_ID: "XXXXXXXX",
  
  // FFZ
  FFZ_CHANNEL: "example_channel",
  
  // Show badges or not
  SHOW_BADGES: true,
  
  // Blacklist: users whose messages should be ignored
  BLOCKED_USERS: ["examplebot1", "examplebot2", "examplebot3"]
  
  // Blacklist: all commands which start with !
  BLOCK_ALL_PREFIX_COMMANDS: true,
  
  // Blacklist: all links (http, https, www)
  BLOCK_LINKS: true,
 
};
