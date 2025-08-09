// index.js

// === BLOCK 1: TOOLS & SETUP ===
const { Client, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
const cron = require("node-cron"); // Our new scheduler tool!

const client = new Client({
  puppeteer: {
    args: ["--no-sandbox"], // This helps it run on servers
  },
});

// === BLOCK 2: THE BOT'S MEMORY ===
// We need a place to store the memes we send. A Map is perfect for this.
// It will store a message ID and link it to the meme's URL.
// Think of it like: { "message_123": "http://meme-url.com/meme.jpg" }
const sentMemes = new Map();

// === BLOCK 3: CONFIGURATION ===
// IMPORTANT: You need to get the ID of the group you want the bot in.
// How to get it: Add the bot to the group. Send a message like "!groupid"
// We'll add code to handle this command below.
const TARGET_GROUP_ID = "1"; // e.g., "120363048915178893@g.us"

// === BLOCK 4: THE LOGIN PROCESS (Same as before) ===
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("Scan this QR code with your phone in WhatsApp > Linked Devices");
});

client.on("ready", () => {
  console.log(
    `Bot is ready! Current time in Abuja is ${new Date().toLocaleTimeString(
      "en-NG",
      { timeZone: "Africa/Lagos" }
    )}`
  );
  console.log(`Will send memes to group ID: ${TARGET_GROUP_ID}`);
  // Once the bot is ready, we start our scheduled task.
  startMemeScheduler();
});

// === BLOCK 5: THE MEME SCHEDULER ===
function startMemeScheduler() {
  // This cron schedule '0 */2 * * *' means "run at minute 0, every 2nd hour".
  // So it will run at 2:00, 4:00, 6:00, etc.
  cron.schedule(
    "0 */2 * * *",
    async () => {
      console.log(
        `It's time! Sending meme blast at ${new Date().toLocaleTimeString(
          "en-NG",
          { timeZone: "Africa/Lagos" }
        )}`
      );

      // Let's clear the old memory before sending new memes
      sentMemes.clear();
      console.log("Cleared old meme memory.");

      // Fetch and send 10 memes
      for (let i = 0; i < 10; i++) {
        try {
          const response = await axios.get("https://meme-api.com/gimme/memes");
          const memeUrl = response.data.url;

          const media = await MessageMedia.fromUrl(memeUrl, {
            unsafeMime: true,
          });

          // Send the message as VIEW ONCE and store its ID!
          const sentMsg = await client.sendMessage(TARGET_GROUP_ID, media, {
            isViewOnce: true,
          });

          // Now, we save it to our bot's memory
          sentMemes.set(sentMsg.id._serialized, memeUrl);

          // A small delay to avoid being flagged as spam
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (error) {
          console.error("Failed to send one of the memes in the blast:", error);
        }
      }
      console.log("Meme blast complete. Bot is now listening for replies.");
    },
    {
      scheduled: true,
      timezone: "Africa/Lagos", // Important to set our timezone!
    }
  );
}

// === BLOCK 6: LISTENING FOR REPLIES & COMMANDS ===
client.on("message_create", async (message) => {
  const chat = await message.getChat();
  const replyText = message.body.toLowerCase();

  // Helper command to get group ID
  if (replyText === "!groupid" && chat.isGroup) {
    message.reply(`This group's ID is: ${chat.id._serialized}`);
    return;
  }

  // Now, let's check for replies to our memes
  if (
    message.hasQuotedMsg &&
    (replyText === "send pls" || replyText === "send please")
  ) {
    const quotedMsg = await message.getQuotedMessage();

    // Check if the replied-to message is one of the ones in our memory
    if (sentMemes.has(quotedMsg.id._serialized)) {
      console.log("Valid reply detected. Preparing to send the full meme.");

      // Get the original meme URL from our memory
      const memeUrl = sentMemes.get(quotedMsg.id._serialized);

      try {
        const media = await MessageMedia.fromUrl(memeUrl, { unsafeMime: true });

        // Send it again, but this time as a normal image, not view-once
        await client.sendMessage(message.from, media, {
          caption: "Here you go! 😉",
        });

        // Optional: remove it from memory so it can't be requested again
        sentMemes.delete(quotedMsg.id._serialized);
      } catch (error) {
        console.error("Failed to re-send the meme:", error);
        message.reply(
          "Ah, sorry. I couldn't seem to find that one. Try again."
        );
      }
    }
  }
});

// === BLOCK 7: START THE BOT! ===
client.initialize();
