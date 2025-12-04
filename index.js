const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const fs = require("fs");
const chalk = require("chalk");
require('dotenv').config();

const config = {
  ...(require('./config.json') || {}),  
  token: process.env.token,            
  clientId: process.env.clientId 
};

// ================================[ Bot Initialization ]============================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.User,
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
  ],
});

client.commands = new Collection();
client.utils = new Collection();

// ================================[ COMMANDS Handlers ]============================
const loadCommands = () => {
  const commandsPath = "./commands";
  if (!fs.existsSync(commandsPath)) {
    console.log(chalk.yellow("[Commands Skipped] - No 'commands' folder found"));
    return;
  }

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
  for (const file of commandFiles) {
    try {
      const command = require(`./commands/${file}`);
      if (Array.isArray(command)) {
        command.forEach(cmd => {
          if ('data' in cmd && 'execute' in cmd) {
            client.commands.set(cmd.data.name, cmd);
            console.log(chalk.green(`[Command Loaded] - ${cmd.data.name}`));
          } else {
            console.log(chalk.red(`[Command Skipped] - ${file} (Missing 'data' or 'execute' property)`));
          }
        });
      } else if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(chalk.green(`[Command Loaded] - ${command.data.name}`));
      } else {
        console.log(chalk.red(`[Command Skipped] - ${file} (Missing 'data' or 'execute' property)`));
      }
    } catch (error) {
      console.error(chalk.red(`[Error Loading Command] - ${file}: ${error.message}`));
    }
  }
};

// ================================[ EVENT Handlers ]============================
const loadEvents = () => {
  const eventsPath = "./events";
  if (!fs.existsSync(eventsPath)) {
    console.log(chalk.yellow("[Events Skipped] - No 'events' folder found"));
    return;
  }

  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));
  for (const file of eventFiles) {
    try {
      const event = require(`./events/${file}`);
      if (event.name && typeof event.execute === 'function') {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client, config));
          console.log(chalk.blue(`[Event Loaded - Once] - ${event.name}`));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client, config));
          console.log(chalk.blue(`[Event Loaded - On] - ${event.name}`));
        }
      } else {
        console.log(chalk.yellow(`[Event Warned] - ${file} (Missing 'name' or 'execute' property)`));
      }
    } catch (error) {
      console.error(chalk.red(`[Error Loading Event] - ${file}: ${error.message}`));
    }
  }
};

// ================================[ UTILS Handlers ]============================
const loadUtils = () => {
  const utilsPath = "./utils";
  if (!fs.existsSync(utilsPath)) {
    console.log(chalk.yellow("[Utils Skipped] - No 'utils' folder found"));
    return;
  }

  const utilFiles = fs.readdirSync(utilsPath).filter(file => file.endsWith(".js"));
  for (const file of utilFiles) {
    try {
      const util = require(`./utils/${file}`);
      const utilName = file.replace(".js", "");
      client.utils.set(utilName, util);
      console.log(chalk.magenta(`[Util Loaded] - ${utilName}`));
    } catch (error) {
      console.error(chalk.red(`[Error Loading Util] - ${file}: ${error.message}`));
    }
  }
};

// ================================[ Interaction Handling ]============================
client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.log(chalk.yellow(`[Command Not Found] - ${interaction.commandName}`));
      return;
    }

    try {
      await command.execute(interaction, client, config);
    } catch (error) {
      console.error(chalk.red(`[Command Error] - ${interaction.commandName}: ${error.message}`));
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'An error occurred while executing this command!', ephemeral: true }).catch(console.error);
      } else {
        await interaction.reply({ content: 'An error occurred while executing this command!', ephemeral: true }).catch(console.error);
      }
    }
  }
});

// ================================[ Load Handlers & Login ]============================
loadCommands();
loadEvents();
loadUtils();
client.login(process.env.token).then(() => {
}).catch(error => {
  console.error(chalk.red(`[Bot Failed to Start] - ${error.message}`));
});