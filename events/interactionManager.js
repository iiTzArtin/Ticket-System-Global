const { MessageFlags } = require('discord.js');
const ticketHandlerLogic = require('./ticketHandlerLogic');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      if (!interaction.customId) return;

      if (
        (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') ||
        (interaction.isButton() && [
          'support',
          'shop',
          'unban',
          'bug',
          'close_ticket',
          'confirm_close',
          'cancel_close',
          'save_ticket',
          'delete_ticket'
        ].includes(interaction.customId)) ||
        interaction.isModalSubmit()
      ) {
        await ticketHandlerLogic.execute(interaction);
        return;
      }

    } catch (error) {
      console.error('Error in interaction manager:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred while processing the interaction! Please contact the developer team.',
          flags: MessageFlags.Ephemeral,
        }).catch(console.error);
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          content: 'An error occurred while processing the interaction! Please contact the developer team.',
          flags: MessageFlags.Ephemeral,
        }).catch(console.error);
      }
    }
  },
};
