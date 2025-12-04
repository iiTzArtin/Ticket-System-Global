const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");

const ticketConfig = require("../data/ticket.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Commands for managing the ticket system.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription(
          "Sends a ticket embed with a select menu and buttons to a channel."
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to send the embed to.")
            .setRequired(false)
        )
        .addChannelOption((option) =>
          option
            .setName("category")
            .setDescription("Main ticket category.")
            .setRequired(false)
        )
        .addChannelOption((option) =>
          option
            .setName("closed_category")
            .setDescription("Closed tickets category.")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("ticket_responder_roles")
            .setDescription("Responder roles (comma separated IDs).")
            .setRequired(false)
        )
        .addRoleOption((option) =>
          option
            .setName("re_watcher_role")
            .setDescription("Ticket re-watcher role.")
            .setRequired(false)
        )
        .addChannelOption((option) =>
          option
            .setName("log_channel")
            .setDescription("Ticket logs channel.")
            .setRequired(false)
        )
        .addChannelOption((option) =>
          option
            .setName("save_channel")
            .setDescription("Ticket transcripts channel.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add-user")
        .setDescription("Add a user to the current ticket channel.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("User to add to the ticket.")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove-user")
        .setDescription("Remove a user from the current ticket channel.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("User to remove from the ticket.")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      ) {
        return interaction.reply({
          content: "You need Administrator permission to use this command.",
          ephemeral: true,
        });
      }

      const fs = require("fs");
      const path = require("path");
      const configPath = path.join(__dirname, "../data/ticket.json");

      const category = interaction.options.getChannel("category");
      const closedCategory = interaction.options.getChannel("closed_category");
      const responderRolesRaw =
        interaction.options.getString("ticket_responder_roles");
      const reWatcherRole = interaction.options.getRole("re_watcher_role");
      const logChannel = interaction.options.getChannel("log_channel");
      const saveChannel = interaction.options.getChannel("save_channel");

      if (category) ticketConfig.categoryId = category.id;
      if (closedCategory) ticketConfig.closedCategoryId = closedCategory.id;

      if (responderRolesRaw) {
        ticketConfig.ticketResponderRoles = responderRolesRaw
          .split(",")
          .map((r) => r.trim())
          .filter((r) => r.length > 0);
      }

      if (reWatcherRole) ticketConfig.ticketReWatcherRole = reWatcherRole.id;
      if (logChannel) ticketConfig.logChannelId = logChannel.id;
      if (saveChannel) ticketConfig.saveTicketChannelId = saveChannel.id;

      fs.writeFileSync(configPath, JSON.stringify(ticketConfig, null, 2));

      const targetChannel =
        interaction.options.getChannel("channel") || interaction.channel;

      const embed = new EmbedBuilder()
        .setColor(0xffffff)
        .setAuthor({ name: "Ticket System" })
        .setDescription(
          "To contact the support team, choose a category from the menu or use the buttons below.\n\nAll tickets are logged. Please avoid opening unnecessary tickets."
        )
        .setThumbnail(
          "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Information_icon.svg/1024px-Information_icon.svg.png"
        );

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Choose a ticket category")
        .addOptions(
          {
            label: "Player Report",
            value: "player_report",
            emoji: "⚠️",
          },
          {
            label: "Question & Request",
            value: "Q_R",
            emoji: "❓",
          },
          {
            label: "Technical Support",
            value: "t_report",
            emoji: "🛠️",
          },
          {
            label: "Purchase",
            value: "purchase",
            emoji: "💳",
          }
        );

      const selectRow = new ActionRowBuilder().addComponents(selectMenu);

      const button1 = new ButtonBuilder()
        .setCustomId("support")
        .setLabel("Support")
        .setEmoji("🎧")
        .setStyle(ButtonStyle.Secondary);

      const button2 = new ButtonBuilder()
        .setCustomId("shop")
        .setLabel("Shop")
        .setEmoji("🛒")
        .setStyle(ButtonStyle.Secondary);

      const button3 = new ButtonBuilder()
        .setCustomId("unban")
        .setLabel("Unban Request")
        .setEmoji("🔓")
        .setStyle(ButtonStyle.Secondary);

      const button4 = new ButtonBuilder()
        .setCustomId("bug")
        .setLabel("Bug Report")
        .setEmoji("🐞")
        .setStyle(ButtonStyle.Secondary);

      const buttonRow = new ActionRowBuilder().addComponents(
        button1,
        button2,
        button3,
        button4
      );

      await targetChannel.send({
        embeds: [embed],
        components: [selectRow, buttonRow],
      });

      return interaction.reply({
        content: "Ticket panel sent successfully.",
        ephemeral: true,
      });
    }

    else if (subcommand === "add-user") {
      await interaction.deferReply({ ephemeral: true });

      if (
        !interaction.channel.name.startsWith("ticket-") &&
        !interaction.channel.name.startsWith("closed-")
      ) {
        return interaction.editReply({
          content: "This command can only be used inside a ticket channel.",
        });
      }

      const hasPermission =
        ticketConfig.ticketResponderRoles?.some((roleId) =>
          interaction.member.roles.cache.has(roleId)
        ) ||
        interaction.member.roles.cache.has(ticketConfig.ticketReWatcherRole);

      if (!hasPermission) {
        return interaction.editReply({
          content: "You do not have permission to manage this ticket.",
        });
      }

      const targetUser = interaction.options.getUser("user");

      await interaction.channel.permissionOverwrites.edit(targetUser.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      await interaction.editReply({
        content: `${targetUser.tag} has been added to this ticket.`,
      });

      const addEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setDescription(
          `${targetUser} has been added to this ticket by ${interaction.user}.`
        )
        .setTimestamp();

      await interaction.channel.send({ embeds: [addEmbed] });
    }

    else if (subcommand === "remove-user") {
      await interaction.deferReply({ ephemeral: true });

      if (
        !interaction.channel.name.startsWith("ticket-") &&
        !interaction.channel.name.startsWith("closed-")
      ) {
        return interaction.editReply({
          content: "This command can only be used inside a ticket channel.",
        });
      }

      const hasPermission =
        ticketConfig.ticketResponderRoles?.some((roleId) =>
          interaction.member.roles.cache.has(roleId)
        ) ||
        interaction.member.roles.cache.has(ticketConfig.ticketReWatcherRole);

      if (!hasPermission) {
        return interaction.editReply({
          content: "You do not have permission to manage this ticket.",
        });
      }

      const targetUser = interaction.options.getUser("user");

      await interaction.channel.permissionOverwrites.edit(targetUser.id, {
        ViewChannel: false,
      });

      await interaction.editReply({
        content: `${targetUser.tag} has been removed from this ticket.`,
      });

      const removeEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setDescription(
          `${targetUser} has been removed from this ticket by ${interaction.user}.`
        )
        .setTimestamp();

      await interaction.channel.send({ embeds: [removeEmbed] });
    }
  },
};
