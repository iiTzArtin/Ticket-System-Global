const { ActivityType, PresenceUpdateStatus, ChannelType } = require("discord.js");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ticketConfig = require('../data/ticket.json');

module.exports = {
  name: "ready",
  async execute(client) {
    console.log(chalk.red("=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+="));
    console.log(chalk.green("Developer:") + chalk.cyan(" @artinlp"));
    console.log(chalk.green("Application Name:") + chalk.cyan(` ${client.user.tag}`));
    console.log(chalk.green("Bot Status:") + chalk.cyan(" Online"));
    console.log(chalk.red("=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+="));

    
    const countOpenTickets = () => {
      const categoryId = ticketConfig.categoryId;
      if (!categoryId) return 0;

      const guild = client.guilds.cache.first(); 
      if (!guild) return 0;

      const openTickets = guild.channels.cache.filter(channel =>
        channel.type === ChannelType.GuildText &&
        channel.parentId === categoryId &&
        channel.name.toLowerCase().startsWith('ticket-')
      ).size;

      return openTickets;
    };

    
    const presences = [
      { name: "Ticket system global", type: ActivityType.Playing },
      { name: `Open ${countOpenTickets()} tickets`, type: ActivityType.Watching, categoryId: ticketConfig.categoryId },
    ];

    let i = 0;
    const applyPresence = () => {
      try {
        const activity = presences[i % presences.length];
        if (activity.categoryId) {
          const ticketCount = countOpenTickets();
          activity.name = `Open ${ticketCount} tickets`;
        }
        client.user.setPresence({
          activities: [activity],
          status: PresenceUpdateStatus.DoNotDisturb,
        });
        i++;
      } catch (error) {
        console.error("Error in Presence:", error);
      }
    };

    applyPresence();
    setInterval(applyPresence, 30_000); 
  },
};