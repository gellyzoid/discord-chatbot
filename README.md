# 🚀 Discord ChatBot powered by DeepSeek-R1 & Groq API

A powerful Discord chatbot leveraging **DeepSeek-R1** and **Groq API** for intelligent interactions. This bot provides a wide range of functionalities, including answering questions, generating text, and much more.

---

## 🔧 Getting Started

### 📌 Creating the Discord Bot

1. **Go to the [Discord Developer Portal](https://discord.com/developers/applications).**
2. Click **New Application** and enter a name for your bot.
3. Navigate to the **"Bot"** section and click **Add Bot**.
4. Under the **"TOKEN"** section, click **Copy** (Keep this secure!).
5. In the **"OAuth2"** section, generate the invite link:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
   ```
   Replace `YOUR_CLIENT_ID` with your bot's client ID.

### 📥 Inviting the Bot

1. In the **Bot** section, enable **Administrator** permissions.
2. Use the modified OAuth2 link above to invite the bot to your server.
3. Open the link in your browser, select a server, and authorize the bot.

---

## 🛠 Installation

1. **Create a project folder** (e.g., `ai-bot`).
2. Open the folder in **Visual Studio Code (VSCode)**.
3. Open the terminal and install dependencies:
   ```sh
   npm install discord.js openai
   ```
4. Install `nodemon` globally (if not installed):
   ```sh
   npm install -g nodemon
   ```

---

## ⚙️ Configuration

1. Open `index.js` and replace the placeholders with your API keys:
   - **Groq API Key**: Get it from [Groq](https://groq.com/).
   - **Discord Token**: Obtain from the **Discord Developer Portal**.

---

## ▶️ Running the Bot

Start the bot using:

```sh
nodemon .
```

The chatbot will now be active and ready to interact in your Discord server!

---
## 🚀 Usage

Mention the bot's name or username in Discord to start a conversation. Example:
```sh
@ai-chatbot Who are you?
```
Sample Response:
```sh
I'm an AI assistant created to help with a wide range of topics, from answering questions to providing guidance and solutions. My goal is to assist you in the most helpful and clear way possible. Whether you're troubleshooting tech issues, need explanations, or want advice on a problem, I'm here to help! Let me know what you need, and I'll do my best to provide a useful response.
```
---

## ✨ Features

✅ **DeepSeek-R1** for intelligent responses

✅ **Groq API** for ultra-fast language model inference

✅ Answers questions, generates text, and more

---

## ⚠️ Important Notes

🔒 **Keep your API keys & tokens secure** – Reset them if leaked.  
📜 Ensure you have permissions to use the Groq API & DeepSeek-R1.

---

## 🤝 Contributing

Contributions are welcome! Feel free to **open an issue** or **submit a pull request** if you have suggestions or improvements.

---

🚀 **Happy Coding & Enjoy Your Discord ChatBot!** 🎉
