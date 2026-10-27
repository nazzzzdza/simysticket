
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('close this ticket'),

  async execute(interaction, context) {
    await context.showCloseConfirmation(interaction);
  }
};
