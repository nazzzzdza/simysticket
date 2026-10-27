
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const MOPS = {
  paypal_usd: {
    name: 'pp usd',
    currency: 'usd',
    symbol: '$',
    feePercent: 10
  },
  paypal_eur: {
    name: 'pp eur',
    currency: 'eur',
    symbol: '€',
    feePercent: 3
  },
  apple_pay: {
    name: 'apple pay',
    currency: 'eur',
    symbol: '€',
    feePercent: 7
  },
  robux: {
    name: 'robux',
    currency: 'usd',
    symbol: '$',
    feePercent: 0
  }
};

const FEE_COLOR = 0x8b5cf6;

function formatMoney(cents, symbol) {
  return symbol + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calculate')
    .setDescription('calculate total price')
    .addStringOption(option =>
      option
        .setName('mop')
        .setDescription('choose your mop')
        .setRequired(true)
        .addChoices(
          { name: 'pp usd', value: 'paypal_usd' },
          { name: 'pp eur', value: 'paypal_eur' },
          { name: 'apple pay', value: 'apple_pay' },
          { name: 'robux', value: 'robux' }
        )
    )
    .addNumberOption(option =>
      option
        .setName('amount')
        .setDescription('amount you are spending')
        .setRequired(true)
        .setMinValue(0.01)
    ),

  async execute(interaction) {
    const mopKey = interaction.options.getString('mop', true);
    const amount = interaction.options.getNumber('amount', true);
    const mop = MOPS[mopKey];

    if (!mop || !Number.isFinite(amount) || amount <= 0) {
      return interaction.reply({
        content: 'select valid mop & amount above 0',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(FEE_COLOR)
      .setTitle('calculated price')
      .addFields(
        { name: 'mop you choose', value: mop.name, inline: true }
      );

    if (mopKey === 'robux') {
      const robux = Math.round(amount * 250);

      embed.addFields(
        { name: 'amount', value: formatMoney(Math.round(amount * 100), '$'), inline: true },
        { name: 'conversion rate', value: '$1 = 250 Robux', inline: true },
        { name: 'total', value: `**${robux.toLocaleString('en-US')} Robux**` }
      );
    } else {
      const amountCents = Math.round(amount * 100);
      const feeCents = Math.round(amountCents * mop.feePercent / 100);
      const totalCents = amountCents + feeCents;

      embed.addFields(
        { name: 'currency', value: mop.currency, inline: true },
        { name: 'amount', value: formatMoney(amountCents, mop.symbol), inline: true },
        { name: `fee (${mop.feePercent}%)`, value: formatMoney(feeCents, mop.symbol), inline: true },
        { name: 'total price', value: `**${formatMoney(totalCents, mop.symbol)}**` }
      );
    }

    return interaction.reply({ embeds: [embed] });
  }
};
