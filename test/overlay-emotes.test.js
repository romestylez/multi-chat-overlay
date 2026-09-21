const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadOverlay(relativePath, exportsSource) {
  const chat = { style: {} };
  const document = {
    baseURI: "https://multichat.example/chat",
    getElementById: () => chat,
    querySelectorAll: () => [],
    createTextNode: text => ({ type: "text", text: String(text) }),
    createElement: tagName => ({ type: tagName, className: "", src: "", alt: "", title: "" })
  };
  const context = {
    CONFIG: { ENABLE_7TV: false, ENABLE_BTTV: false, ENABLE_FFZ: false },
    URL,
    console,
    document,
    setTimeout,
    clearTimeout
  };
  context.window = { ...context, location: { origin: "https://multichat.example" } };
  context.globalThis = context;

  const filename = path.join(__dirname, "..", relativePath);
  const source = `${fs.readFileSync(filename, "utf8")}\n${exportsSource}`;
  vm.runInNewContext(source, context, { filename });
  return context.__overlayTest;
}

test("local Kick renderer merges native and 7TV emotes", () => {
  const overlay = loadOverlay(
    "overlay.js",
    "globalThis.__overlayTest = { renderKickText, kickEmoteMap };"
  );
  overlay.kickEmoteMap.SevenChannel = "https://cdn.7tv.app/emote/kick-7tv/4x.webp";

  const html = overlay.renderKickText("[emote:12345:KickWave] SevenChannel");

  assert.match(html, /files\.kick\.com\/emotes\/12345\/fullsize/);
  assert.match(html, /cdn\.7tv\.app\/emote\/kick-7tv\/4x\.webp/);
  assert.doesNotMatch(html, /\[emote:/);
});

test("hosted renderers keep native emotes and add platform-specific providers", () => {
  const overlay = loadOverlay(
    "hosted/overlay.js",
    "globalThis.__overlayTest = { appendKickText, appendYouTubeText, kickEmoteMap, youtubeEmoteMap };"
  );
  overlay.kickEmoteMap.SevenKick = "https://cdn.7tv.app/emote/kick-7tv/4x.webp";
  overlay.youtubeEmoteMap.SevenYouTube = "https://cdn.7tv.app/emote/youtube-7tv/4x.webp";

  const kickParent = { children: [], appendChild(node) { this.children.push(node); } };
  overlay.appendKickText(kickParent, "[emote:12345:KickWave] SevenKick");
  assert.deepEqual(
    kickParent.children.filter(node => node.type === "img").map(node => node.alt),
    ["KickWave", "SevenKick"]
  );

  const youtubeParent = { children: [], appendChild(node) { this.children.push(node); } };
  overlay.appendYouTubeText(youtubeParent, ":native: SevenYouTube", [
    { type: "emote", text: ":native:", url: "https://yt3.ggpht.com/native-emote" },
    { type: "text", text: " SevenYouTube" }
  ]);
  assert.deepEqual(
    youtubeParent.children.filter(node => node.type === "img").map(node => node.alt),
    [":native:", "SevenYouTube"]
  );
});
