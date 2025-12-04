const { ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const ticketConfig = require('../data/ticket.json');
const fs = require('fs');
const path = require('path');

module.exports = {
  async execute(interaction) {
    try {
      if (
        (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') ||
        (interaction.isButton() && ['support', 'shop', 'unban', 'bug'].includes(interaction.customId))
      ) {
        let ticketType = '';
        if (interaction.isStringSelectMenu()) {
          ticketType = interaction.values[0];
        } else if (interaction.isButton()) {
          ticketType = interaction.customId;
        }

        const ticketTypeNames = {
          player_report: 'Player-Report',
          Q_R: 'Question-Request',
          t_report: 'Technical-Support',
          purchase: 'Purchase',
          support: 'Support',
          shop: 'Shop',
          unban: 'Unban',
          bug: 'Bug-Report',
        };

        const modal = new ModalBuilder()
          .setCustomId(`ticket_form_${ticketType}`)
          .setTitle(`Ticket Form - ${ticketTypeNames[ticketType] || ticketType}`);

        const question = new TextInputBuilder()
          .setCustomId('question')
          .setLabel('Describe your issue or request')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Example: I cannot join the server')
          .setRequired(true);

        const id_email = new TextInputBuilder()
          .setCustomId('id_email')
          .setLabel('Account ID & Email (if needed)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Example: ID: 12345')
          .setRequired(false);

        const firstActionRow = new ActionRowBuilder().addComponents(question);
        const secondActionRow = new ActionRowBuilder().addComponents(id_email);

        modal.addComponents(firstActionRow, secondActionRow);

        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction.showModal(modal);
          } catch (err) {
            console.error('Failed to show modal:', err);
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: 'An error occurred while opening the form! Please try again.', ephemeral: true });
            }
          }
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(err => {
            console.error('Failed to defer reply on modal submit:', err);
          });
        }

        const { categoryId, ticketResponderRoles, ticketReWatcherRole, logChannelId } = ticketConfig;
        const user = interaction.user;
        const guild = interaction.guild;

        if (!categoryId) {
          return interaction.editReply({ content: 'Error: Ticket category not found in settings!', flags: MessageFlags.Ephemeral });
        }

        const existingTicket = guild.channels.cache.find(
          channel =>
            channel.type === ChannelType.GuildText &&
            channel.parentId === categoryId &&
            channel.name.startsWith(`ticket-${user.username.toLowerCase()}`)
        );

        if (existingTicket) {
          return interaction.editReply({
            content: `You already have an open ticket! Please check it: ${existingTicket}.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const ticketType = interaction.customId.replace('ticket_form_', '');
        const ticketTypeNames = {
          player_report: 'Player-Report',
          Q_R: 'Question-Request',
          t_report: 'Technical-Support',
          purchase: 'Purchase',
          support: 'Support',
          shop: 'Shop',
          unban: 'Unban',
          bug: 'Bug-Report',
        };

        const ticketName = `open-${user.username.toLowerCase()}`;
        const question = interaction.fields.getTextInputValue('question');
        const id_email = interaction.fields.getTextInputValue('id_email') || 'None';

        const responderRoles = ['purchase', 'shop'].includes(ticketType) ? ticketResponderRoles : ticketResponderRoles;

        if (!responderRoles || !Array.isArray(responderRoles) || responderRoles.length === 0) {
          return interaction.editReply({
            content: `Error: No responder roles defined for ${ticketType} tickets!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        try {
          const ticketChannel = await guild.channels.create({
            name: ticketName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
              {
                id: guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
              {
                id: user.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory,
                ],
              },
              ...responderRoles.map(roleId => ({
                id: roleId,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory,
                ],
              })),
              {
                id: interaction.client.user.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory,
                ],
              },
            ],
          });

          const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger);

          const buttonRow = new ActionRowBuilder().addComponents(closeButton);

          const ticketEmbed = new EmbedBuilder()
            .setColor(0xffffff)
            .setAuthor({ name: interaction.member.displayName, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setDescription(`Your ticket has been created! Please wait patiently for staff to respond.\nAvoid spamming or tagging staff.\nIf your issue requires a recording, upload it to a site like streamable.com or imgur.com and send the link here.`)
            .setTimestamp();

          const formEmbed = new EmbedBuilder()
            .setColor(0xffffff)
            .addFields(
              { name: 'Describe your issue or request', value: `\`\`\`${question}\`\`\``, inline: false },
              { name: 'Account ID & Email (if needed)', value: `\`\`\`${id_email}\`\`\``, inline: false }
            )
            .setFooter({ text: 'HIGH Ticket System', iconURL: guild.iconURL({ dynamic: true }) });

          await ticketChannel.send({
            content: `Owner: ${user.toString()}\nSubject: "**${ticketTypeNames[ticketType] || ticketType}**"`,
            embeds: [ticketEmbed, formEmbed],
            components: [buttonRow],
          });

          if (logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
              const logEmbed = new EmbedBuilder()
                .setColor(0x8cf06b)
                .setTitle('Ticket Created')
                .setDescription(`${user} created a new ticket: ${ticketChannel} (Subject: ${ticketTypeNames[ticketType] || ticketType}).`)
                .setTimestamp();
              await logChannel.send({ embeds: [logEmbed] });
            }
          }

          await interaction.editReply({
            content: `Your ticket has been created! Check it here: ${ticketChannel}`,
            flags: MessageFlags.Ephemeral,
          });
        } catch (error) {
          console.error('Error creating ticket:', error);
          await interaction.editReply({
            content: `An error occurred while creating the ticket: ${error.message}. Please contact support.`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      if (interaction.isButton() && interaction.customId === 'close_ticket') {
        if (interaction.replied || interaction.deferred) {
          return interaction.followUp({
            content: 'This interaction has already been processed! Please try again.',
            flags: MessageFlags.Ephemeral,
          });
        }

        const hasPermission =
          interaction.member.id === interaction.channel.permissionOverwrites.cache.find(perm => perm.type === 'member')?.id ||
          ticketConfig.ticketResponderRoles.some(roleId => interaction.member.roles.cache.has(roleId));

        if (!hasPermission) {
          return interaction.reply({
            content: 'You do not have permission to close this ticket!',
            flags: MessageFlags.Ephemeral,
          });
        }

        const confirmEmbed = new EmbedBuilder()
          .setColor(0xf06b6b)
          .setTitle('Confirm Ticket Closure')
          .setDescription('Are you sure you want to close this ticket?')
          .setTimestamp();

        const confirmButton = new ButtonBuilder()
          .setCustomId('confirm_close')
          .setLabel('Close')
          .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
          .setCustomId('cancel_close')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary);

        const confirmRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await interaction.reply({
          embeds: [confirmEmbed],
          components: [confirmRow],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.isButton() && interaction.customId === 'confirm_close') {
        await interaction.deferUpdate();

        const { closedCategoryId, ticketReWatcherRole, logChannelId } = ticketConfig;

        if (!closedCategoryId || !ticketReWatcherRole) {
          return interaction.editReply({
            content: 'Error: Closed tickets category or re-watcher role not configured!',
            flags: MessageFlags.Ephemeral,
          });
        }

        const ticketType = interaction.channel.name.split('-').slice(2).join('-');
        const ticketOwnerName = interaction.channel.name.split('-')[1];
        const newChannelName = `closed-${ticketOwnerName}`;

        await interaction.channel.edit({
          name: newChannelName,
          parent: closedCategoryId,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: ticketReWatcherRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory] },
            { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
            ...[...ticketConfig.ticketResponderRoles].map(roleId => ({
              id: roleId,
              deny: [PermissionsBitField.Flags.ViewChannel],
            })),
          ],
        });

        const closureEmbed = new EmbedBuilder()
          .setColor(0xf06b6b)
          .setTitle('Ticket Closed')
          .setDescription(`This ticket has been closed by ${interaction.user}.`)
          .setTimestamp();

        const saveButton = new ButtonBuilder()
          .setCustomId('save_ticket')
          .setLabel('Save Transcript')
          .setStyle(ButtonStyle.Primary);

        const deleteButton = new ButtonBuilder()
          .setCustomId('delete_ticket')
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger);

        const closureRow = new ActionRowBuilder().addComponents(saveButton, deleteButton);

        await interaction.channel.send({
          embeds: [closureEmbed],
          components: [closureRow],
        });

        if (logChannelId) {
          const logChannel = interaction.guild.channels.cache.get(logChannelId);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setColor(0xf06b6b)
              .setTitle('Ticket Closed')
              .setDescription(`${interaction.user} closed ticket: ${interaction.channel}.`)
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        }

        await interaction.deleteReply();
      }

      if (interaction.isButton() && interaction.customId === 'cancel_close') {
        await interaction.deferUpdate();
        await interaction.deleteReply();
      }

      if (interaction.isButton() && interaction.customId === 'save_ticket') {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const hasPermission =
          interaction.member.id === interaction.channel.permissionOverwrites.cache.find(perm => perm.type === 'member')?.id ||
          interaction.member.roles.cache.has(ticketConfig.ticketReWatcherRole);

        if (!hasPermission) {
          return interaction.editReply({
            content: 'You do not have permission to save this ticket!',
            flags: MessageFlags.Ephemeral,
          });
        }

        const { saveTicketChannelId, logChannelId } = ticketConfig;
        const ticketChannel = interaction.channel;
        const ticketType = ticketChannel.name.split('-').slice(2).join('-');
        const ticketOwnerName = ticketChannel.name.split('-')[1];
        let ticketOwnerUser = null;
        try {
          ticketOwnerUser = await interaction.guild.members.fetch({ query: ticketOwnerName, limit: 1 })
            .then(members => members.first()?.user)
            .catch(() => null);
        } catch (error) { }

        if (saveTicketChannelId) {
          const saveChannel = interaction.guild.channels.cache.get(saveTicketChannelId);
          if (saveChannel) {
            const ticketInfoEmbed = new EmbedBuilder()
              .setColor(0x0000ff)
              .setTitle('Ticket Saved')
              .setDescription(`Saved by ${interaction.user}\n\n**Details:**\n- Channel: ${ticketChannel}\n- Owner: ${ticketOwnerUser ? ticketOwnerUser.tag : ticketOwnerName || 'Unknown'}\n- Subject: ${ticketType}\n- Created: ${ticketChannel.createdAt.toISOString()}`)
              .setTimestamp();
            await saveChannel.send({ embeds: [ticketInfoEmbed] });

            const messages = [];
            let lastId;
            while (true) {
              const fetchedMessages = await ticketChannel.messages.fetch({ limit: 100, before: lastId });
              messages.push(...fetchedMessages.values());
              if (fetchedMessages.size < 100) break;
              lastId = fetchedMessages.last()?.id;
            }

            let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Transcript - ${ticketChannel.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {font-family: 'Segoe UI', sans-serif;background:#2f3136;color:#dcddde;}
    .container {max-width:800px;margin:5% auto;padding:20px; border: 3px dashed #5865f2; border-radius: 10px;}
    .header {background:#202225;padding:15px;border-radius:8px;margin-bottom:20px;}
    .messages {margin-top: 20px;}
    .message {display:flex;margin-bottom:15px;padding:10px;border: 1px solid #61646b;border-radius:5px;transition:background 0.2s;}
    .message:hover {background:#32353b;}
    .author {font-weight:600;color:#fff;}
    .timestamp {color:#72767d;font-size:0.75rem;margin-left:10px;}
    .info-title{ font-weight: bold; margin: 5px 0 15px 0; border-bottom: 2px solid white; letter-spacing: 5px;}
    .line {height: 2px; border: 2px dashed #5865f2;}
  </style>
</head>
<body>
  <div class="container">
   

    <div class="header">
      <h1 class="info-title">Ticket information</h1>
      <p><strong>- Ticket Transcript:</strong> ${ticketChannel.name}</p>
      <p><strong>- Owner:</strong> ${ticketOwnerUser ? ticketOwnerUser.tag : ticketOwnerName || 'Unknown'}</p>
      <p><strong>- Subject:</strong> ${ticketType}</p>
      <p><strong>- Created:</strong> ${ticketChannel.createdAt.toISOString()}</p>
    </div>
    <div class="line"></div>
    <div class="messages">
`;

            messages.reverse().forEach(message => {
              const author = message.author ? message.author.tag : 'Unknown';
              const timestamp = message.createdAt.toISOString();
              if (message.content) {
                htmlContent += `
      <div class="message">
        <div>
          <p style="margin-bottom: 5px;"><span class="author">${author}</span> <span class="timestamp">[${timestamp}]</span></p>
          <p>${message.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
      </div>
`;
              }
              if (message.embeds.length > 0) {
                message.embeds.forEach(embed => {
                  let embedContent = '';
                  if (embed.title) embedContent += `<p><strong>${embed.title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong></p>`;
                  if (embed.description) embedContent += `<p>${embed.description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
                  htmlContent += `
      <div class="message" style="border-left:4px solid #5865f2;">
        <div>
          <p style="margin-bottom: 5px;"><span class="author">Embed by ${author}</span> <span class="timestamp">[${timestamp}]</span></p>
          <p>${embedContent}</p>
        </div>
      </div>
`;
                });
              }
            });

            htmlContent += `</div></div></body></html>`;

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `ticket-${ticketOwnerName || 'unknown'}-${ticketType}-${timestamp}.html`;
            const filePath = path.join(__dirname, fileName);

            fs.writeFileSync(filePath, htmlContent);

            await saveChannel.send({
              content: `Transcript for ${ticketChannel.name}`,
              files: [{ attachment: filePath, name: fileName }],
            });

            fs.unlinkSync(filePath);

            if (logChannelId) {
              const logChannel = interaction.guild.channels.cache.get(logChannelId);
              if (logChannel) {
                await logChannel.send({
                  embeds: [new EmbedBuilder()
                    .setColor(0x786bf0)
                    .setTitle('Transcript Saved')
                    .setDescription(`${interaction.user} saved transcript of ${ticketChannel}`)
                    .setTimestamp()]
                });
              }
            }
          }
        }

        await interaction.editReply({
          content: 'Ticket transcript saved successfully!',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.isButton() && interaction.customId === 'delete_ticket') {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const hasPermission =
          interaction.member.id === interaction.channel.permissionOverwrites.cache.find(perm => perm.type === 'member')?.id ||
          interaction.member.roles.cache.has(ticketConfig.ticketReWatcherRole);

        if (!hasPermission) {
          return interaction.editReply({
            content: 'You do not have permission to delete this ticket!',
            flags: MessageFlags.Ephemeral,
          });
        }

        if (ticketConfig.logChannelId) {
          const logChannel = interaction.guild.channels.cache.get(ticketConfig.logChannelId);
          if (logChannel) {
            await logChannel.send({
              embeds: [new EmbedBuilder()
                .setColor(0xf06b6d)
                .setTitle('Ticket Deleted')
                .setDescription(`${interaction.user} deleted ${interaction.channel}`)
                .setTimestamp()]
            });
          }
        }

        await interaction.channel.delete();
      }
    } catch (error) {
      console.error('Error in ticket system:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An unexpected error occurred! Please try again.',
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    }
  },
};