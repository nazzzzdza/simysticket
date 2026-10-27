
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('post panel'),

  async execute(interaction, context) {
    if (!context.isStaff(interaction.member)) {
      return interaction.reply({
        content: 'only staff can use this command',
        ephemeral: true
      });
    }

    const channel = await context.client.channels.fetch(
      context.PANEL_CHANNEL_ID
    );

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        content: 'the configured panel channel could not be found.',
        ephemeral: true
      });
    }

    await channel.send(context.makePanel());

    return interaction.reply({
      content: `panel posted in <#${context.PANEL_CHANNEL_ID}>.`,
      ephemeral: true
    });
  }
};
