const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
} = require("discord.js");
const OpenAI = require("openai");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages, // Required for DM functionality
  ],
  partials: ["CHANNEL"], // Required to receive DM events
});

const dotenv = require("dotenv");

dotenv.config();

const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

// Store conversations with timestamps for cleanup
const userConversations = new Map();
const CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY = 10; // Keep last 10 messages per user

// Function to convert common HTML/formatting to Discord Markdown
function convertHtmlToMarkdown(text) {
  // First, convert markdown tables to Discord-friendly format
  text = convertMarkdownTables(text);

  return (
    text
      // Remove HTML tags that don't have markdown equivalents
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<p>/gi, "")
      .replace(/<div>/gi, "")
      .replace(/<\/div>/gi, "\n")

      // Convert headers
      .replace(/<h1>(.*?)<\/h1>/gi, "# $1\n")
      .replace(/<h2>(.*?)<\/h2>/gi, "## $1\n")
      .replace(/<h3>(.*?)<\/h3>/gi, "### $1\n")

      // Convert bold and italic
      .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
      .replace(/<b>(.*?)<\/b>/gi, "**$1**")
      .replace(/<em>(.*?)<\/em>/gi, "*$1*")
      .replace(/<i>(.*?)<\/i>/gi, "*$1*")

      // Convert code blocks
      .replace(/<code>(.*?)<\/code>/gi, "`$1`")
      .replace(/<pre>(.*?)<\/pre>/gis, "```\n$1\n```")

      // Convert links
      .replace(/<a\s+href=["'](.*?)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)")

      // Convert lists
      .replace(/<li>(.*?)<\/li>/gi, "• $1\n")
      .replace(/<ul>/gi, "")
      .replace(/<\/ul>/gi, "\n")
      .replace(/<ol>/gi, "")
      .replace(/<\/ol>/gi, "\n")

      // Remove any remaining HTML tags
      .replace(/<[^>]+>/g, "")

      // Clean up extra whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// Convert markdown tables to Discord-friendly numbered list format
function convertMarkdownTables(text) {
  // Match markdown table pattern
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;

  return text.replace(tableRegex, (match, headerRow, bodyRows) => {
    // Parse headers
    const headers = headerRow
      .split("|")
      .map((h) => h.trim())
      .filter((h) => h);

    // Parse body rows
    const rows = bodyRows
      .trim()
      .split("\n")
      .map((row) =>
        row
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell)
      );

    // Format as numbered list with code blocks and separators
    let formatted = "\n```\n";

    rows.forEach((row, idx) => {
      // Use the first column as the number/identifier if it looks like a number
      const identifier = row[0].match(/^\d+$/) ? row[0] : idx + 1;

      formatted += `${identifier}. `;

      // Add the rest of the columns
      for (let i = 1; i < row.length && i < headers.length; i++) {
        const header = headers[i];
        const value = row[i];

        if (value && value !== "-") {
          if (i > 1) formatted += "\n   ";
          formatted += `${header}: ${value}`;
        }
      }

      // Add separator between items (except for last item)
      if (idx < rows.length - 1) {
        formatted += "\n\n---\n\n";
      } else {
        formatted += "\n";
      }
    });

    formatted += "```\n";
    return formatted;
  });
}

// Split long responses into multiple chunks at natural break points
function splitResponse(text, maxLength = 4090) {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let currentChunk = "";

  // Split by paragraphs first (double newlines)
  const paragraphs = text.split(/\n\n+/);

  for (const paragraph of paragraphs) {
    // If a single paragraph is too long, split by sentences
    if (paragraph.length > maxLength) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];

      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > maxLength) {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
          }

          // If single sentence is still too long, split by character limit
          if (sentence.length > maxLength) {
            chunks.push(sentence.substring(0, maxLength - 20) + "...");
            currentChunk = "..." + sentence.substring(maxLength - 20);
          } else {
            currentChunk = sentence;
          }
        } else {
          currentChunk += sentence;
        }
      }
    } else {
      // Check if adding this paragraph exceeds limit
      if ((currentChunk + "\n\n" + paragraph).length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = paragraph;
        }
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }
    }
  }

  // Add remaining chunk
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text.substring(0, maxLength)];
}

// Cleanup old conversations
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of userConversations.entries()) {
    if (now - data.lastActivity > CONVERSATION_TIMEOUT) {
      userConversations.delete(userId);
      console.log(`Cleared conversation for user ${userId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on(Events.MessageCreate, async (msg) => {
  // Ignore bot messages
  if (msg.author.bot) return;

  // Check if this is a command first
  const command = msg.content.toLowerCase().trim();

  // Reset command
  if (command === "!reset") {
    if (userConversations.has(msg.author.id)) {
      userConversations.delete(msg.author.id);

      const embed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ Conversation Reset")
        .setDescription("Your conversation history has been cleared!")
        .setFooter({
          text: msg.author.username,
          iconURL: msg.author.displayAvatarURL({ dynamic: true }),
        });

      await msg.reply({ embeds: [embed] });
    } else {
      await msg.reply("You don't have an active conversation to reset.");
    }
    return;
  }

  // Help command
  if (command === "!help") {
    const helpEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("🤖 Bot Commands & Usage")
      .setDescription("Here's how to interact with me:")
      .addFields(
        {
          name: "💬 Chat in Server",
          value:
            "• Mention me: `@BotName your message`\n• Reply to my messages for follow-ups",
          inline: false,
        },
        {
          name: "📨 Private Chat",
          value:
            "• Type `!dm` to start a private conversation\n• In DMs, just send messages directly (no mention needed)",
          inline: false,
        },
        {
          name: "🔄 Commands",
          value:
            "`!reset` - Clear your conversation history\n`!dm` - Start private DM conversation (server only)\n`!help` - Show this help message",
          inline: false,
        }
      )
      .setFooter({
        text: msg.author.username,
        iconURL: msg.author.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    await msg.reply({ embeds: [helpEmbed] });
    return;
  }

  // DM command (only works in servers, not in DMs)
  if (command === "!dm") {
    if (msg.channel.isDMBased()) {
      await msg.reply(
        "You're already in a DM with me! Just send your message directly. 😊"
      );
      return;
    }

    try {
      const dmChannel = await msg.author.createDM();

      const welcomeEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("👋 Private Conversation Started!")
        .setDescription(
          "Hello! I'm here to chat with you privately.\n\n" +
            "**How to use:**\n" +
            "• Just send me any message to chat\n" +
            "• Type `!reset` to clear conversation history\n" +
            "• Type `!help` for more information\n\n" +
            "I'll remember our conversation context, so feel free to ask follow-up questions!"
        )
        .setFooter({
          text: "Your private AI assistant",
          iconURL: client.user.displayAvatarURL(),
        })
        .setTimestamp();

      await dmChannel.send({ embeds: [welcomeEmbed] });

      const confirmEmbed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ DM Sent!")
        .setDescription(
          "Check your DMs! I've sent you a message to start our private conversation."
        )
        .setFooter({
          text: msg.author.username,
          iconURL: msg.author.displayAvatarURL({ dynamic: true }),
        });

      await msg.reply({ embeds: [confirmEmbed] });
    } catch (error) {
      console.error("Failed to DM user:", error);

      const errorEmbed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("❌ Cannot Send DM")
        .setDescription(
          "I couldn't send you a DM. Please check that:\n" +
            "• You have DMs enabled for this server\n" +
            "• You haven't blocked me\n" +
            "• Your privacy settings allow DMs from server members"
        )
        .setFooter({
          text: msg.author.username,
          iconURL: msg.author.displayAvatarURL({ dynamic: true }),
        });

      await msg.reply({ embeds: [errorEmbed] });
    }
    return;
  }

  // Now handle regular chat messages
  // Check if bot is mentioned OR if this is a reply to the bot's message OR if it's a DM
  const isMentioned = msg.mentions.has(client.user);
  const isReplyToBot =
    msg.reference &&
    (await msg.fetchReference().catch(() => null))?.author.id ===
      client.user.id;
  const isDM = msg.channel.isDMBased();

  if (!isMentioned && !isReplyToBot && !isDM) return;

  // Clean the message content
  const userMessage = msg.content.replace(/<@!?\d+>/g, "").trim();

  if (!userMessage) {
    await msg.reply("Please provide a message!");
    return;
  }

  // Show typing indicator
  await msg.channel.sendTyping();

  // Initialize or retrieve user conversation
  if (!userConversations.has(msg.author.id)) {
    userConversations.set(msg.author.id, {
      history: [],
      lastActivity: Date.now(),
    });
  }

  const userData = userConversations.get(msg.author.id);
  userData.lastActivity = Date.now();

  // Add user message to history
  userData.history.push({
    role: "user",
    content: userMessage,
  });

  // Trim history if too long
  if (userData.history.length > MAX_HISTORY * 2) {
    userData.history = userData.history.slice(-MAX_HISTORY * 2);
  }

  // Build messages for API
  const messages = [
    {
      role: "system",
      content:
        "You are a helpful, friendly AI assistant in a Discord server. Keep responses concise and engaging. When presenting lists or comparisons, use clear numbered points or bullet points instead of tables. Format code with proper syntax. Use markdown formatting (bold, italic, code blocks) to make responses easy to read.",
    },
    ...userData.history,
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: messages,
      temperature: 0.7,
    });

    let response = completion.choices[0].message.content;

    // Remove thinking tags
    response = response.replace(/<think>.*?<\/think>/gs, "").trim();

    // Convert HTML to Discord Markdown
    response = convertHtmlToMarkdown(response);

    // Add bot response to history
    userData.history.push({
      role: "assistant",
      content: response,
    });

    // Split response into chunks if too long (Discord embed limit is 4096)
    const chunks = splitResponse(response, 4090); // Leave small buffer for safety

    // Send first chunk as reply
    const firstEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setDescription(chunks[0])
      .setFooter({
        text: `💬 ${msg.author.username} • ${
          userData.history.length / 2
        } messages in conversation${
          chunks.length > 1 ? ` • Part 1/${chunks.length}` : ""
        }`,
        iconURL: msg.author.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    // Add DM indicator if in DM
    if (msg.channel.isDMBased()) {
      firstEmbed.setAuthor({
        name: "🔒 Private Conversation",
        iconURL: msg.author.displayAvatarURL({ dynamic: true }),
      });
    } else if (userData.history.length > 2) {
      firstEmbed.setAuthor({
        name: "Continuing conversation...",
        iconURL: "https://i.imgur.com/7SzLRyX.gif",
      });
    }

    const firstMessage = await msg.reply({ embeds: [firstEmbed] });

    // Send remaining chunks as follow-up messages
    for (let i = 1; i < chunks.length; i++) {
      const followUpEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setDescription(chunks[i])
        .setFooter({
          text: `💬 Continued • Part ${i + 1}/${chunks.length}`,
          iconURL: msg.author.displayAvatarURL({ dynamic: true }),
        });

      await msg.channel.send({ embeds: [followUpEmbed] });

      // Small delay to maintain message order
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error("Error in API call:", error);

    const errorEmbed = new EmbedBuilder()
      .setColor("#ED4245") // Discord red
      .setTitle("❌ Error")
      .setDescription(
        "I encountered an error processing your request. Please try again!"
      )
      .setFooter({
        text: `Requested by ${msg.author.username}`,
        iconURL: msg.author.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    await msg.reply({ embeds: [errorEmbed] });
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
