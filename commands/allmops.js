
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allmops')
    .setDescription('check out all mops & info'),

  async execute(interaction, context) {
    if (!context.MOPS.length) {
      return interaction.reply({
        content:
          'the mop list has not been configured yet, payment methods will be added soon',
        ephemeral: true
      });
    }

    return interaction.reply(context.makeMopsPayload(0));
  }
};
