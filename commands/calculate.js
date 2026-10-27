
const { SlashCommandBuilder } = require('discord.js');

const FEE_PERCENT = 2;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calculate')
    .setDescription('calculate total price')
    .addNumberOption(option =>
      option
        .setName('amount')
        .setDescription('amount sending')
        .setRequired(true)
        .setMinValue(0.01)
    )
    .addStringOption(option =>
      option
        .setName('currency')
        .setDescription('currency you are using')
        .setRequired(false)
        .addChoices(
          { name: 'eur (€)', value: 'EUR' },
          { name: 'eur ($)', value: 'USD' }
        )
    ),

  async execute(interaction) {
    const amount = interaction.options.getNumber('amount', true);
    const currency = interaction.options.getString('currency') || 'EUR';

    if (!Number.isFinite(amount) || amount <= 0) {
      return interaction.reply({
        content: 'Please enter an amount greater than zero.',
        ephemeral: true
      });
    }

    const cents = Math.round(amount * 100);
    const feeCents = Math.round(cents * FEE_PERCENT / 100);
    const totalCents = cents + feeCents;
    const symbol = currency === 'USD' ? '$' : '€';

    const money = value =>
      (value / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

    return interaction.reply({
      content:
        '**calculated price**\n' +
        `amount: ${symbol}${money(cents)}\n` +
        `fee (${FEE_PERCENT}%): ${symbol}${money(feeCents)}\n` +
        `**total: ${symbol}${money(totalCents)}**`
    });
  }
};
