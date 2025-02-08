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
  ],
});

const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: "<Groq API Key>", // Store this securely
});

// To keep track of conversations for each user
const userConversations = new Map();

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot || !msg.mentions.has(client.user)) return;

  msg.content = msg.content.replace(/<@\d+>/g, "").trim();

  // Initialize the user's conversation history if it's their first time interacting
  if (!userConversations.has(msg.author.id)) {
    userConversations.set(msg.author.id, []);
  }

  // Add the new message to the user's conversation history
  userConversations.get(msg.author.id).push({
    role: "user",
    content: msg.content,
  });

  // Create the messages for the chat completion
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    ...userConversations.get(msg.author.id),
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "deepseek-r1-distill-llama-70b",
      messages: messages,
    });

    let response = completion.choices[0].message.content;

    // Remove the <think> and </think> tags from the response
    response = response.replace(/<think>.*?<\/think>/gs, "").trim();

    // Add the bot's response to the conversation history
    userConversations.get(msg.author.id).push({
      role: "assistant",
      content: response,
    });

    // Create an embed to make the response stylish
    const embed = new EmbedBuilder()
      .setColor("#3498db") // Blue color
      .setTitle("Bot Response")
      .setDescription(response) // Add the cleaned response as description
      .setImage("https://your-image-url.com/image.png") // Add an image to the embed
      .setFooter({
        text: `Requested by ${msg.author.tag}`,
        iconURL: msg.author.displayAvatarURL(),
      }) // Footer with user info
      .setTimestamp(); // Timestamp for when the message was created

    await msg.reply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in OpenAI API call:", error);
    await msg.reply(
      "Sorry, I encountered an error while processing your request."
    );
  }
});

client.login("<Discord bot token>");
