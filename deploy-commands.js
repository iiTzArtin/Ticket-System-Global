const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
require ('dotenv').config();
const chalk = require("chalk");

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if (Array.isArray(command)) {
    command.forEach(cmd => {
      if ('data' in cmd && 'execute' in cmd) {
        commands.push(cmd.data.toJSON());
        console.log(chalk.green(`[Command Loaded] - ${cmd.data.name}`));
      } else {
        console.warn(`⚠️ The command at "${filePath}" is missing a required "data" or "execute" property.`);
      }
    });
  } else if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    console.log(chalk.green(`[Command Loaded] - ${command.data.name}`));
  } else {
    console.warn(`⚠️ The command at "${filePath}" is missing a required "data" or "execute" property.`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.token);

(async () => {
  try {
    console.log('⌛ Refreshing application (/) commands...');

    console.log('🌐 Deploying global commands...');
    await rest.put(
      Routes.applicationCommands(process.env.clientId),
      { body: commands }
    );

    console.log('✅ Successfully reloaded global application (/) commands.');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();