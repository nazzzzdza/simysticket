
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const MOPS = [
  {
    name: 'paypal usd (+10%)',
    instructions: `-# _ _ _ _ _ _ _ _ _ _ _ _ _ _  _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ mαke  reαding  α  hαbit 


                      pleαse   **never**  send  αny  notes 
                      sending  with  α  note  =  **voided** 

                      fnf  αnd  bαlαnce  only  
                      send  uncropped  ss  when  sent 

                      holder does not refund any  **incorrect**  αmount 
                      https://www.paypal.me/DaniloPack 

_ _`
  },
  {
    name: 'paypal eur (+3%)',
    instructions: `-# _ _ _ _ _ _ _ _ _ _ _ _ _ _  _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ mαke  reαding  α  hαbit 


                      pleαse   **never**  send  αny  notes 
                      sending  with  α  note  =  **voided** 

                      fnf  αnd  bαlαnce  only  
                      send  uncropped  ss  when  sent 

                      i do not  refund  any  **incorrect**  αmount 
                      https://www.paypal.me/NazSimypl

_ _`
  },
  {
    name: 'cashapp (+10%)',
    instructions: `-# _ _ _ _ _ _ _ _ _ _ _ _ _ _  _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ mαke  reαding  α hαbit

                      pleαse   αlwαys  send  with  note  \`food\`
                      no  refund  for  incorrect  notes  /  card

                      send  with  bαlαnce  only  
                      send  uncropped  ss  when  sent

                      holder does not  refund  any  **incorrect**  αmount
                      https://cash.app/$bubblkid
_ _`
  },
  {
    name: 'apple pay (+7%)',
    instructions: `-# _ _ _ _ _ _ _ _ _ _ _ _ _ _  _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ mαke  reαding  α hαbit

                      i  do  not  refund  any  **incorrect**  αmount
                     \`ssiimypl@gmail.com\`
_ _`
  },
  {
    name: 'robux ($1 = 250 Robux)',
    instructions: `-# _ _ _ _ _ _ _ _ _ _ _ _ _ _  _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ mαke  reαding  α hαbit

                      i  do  not  refund  any  **incorrect**  αmount
                     \`always ask for correct link to gp\`
_ _`
  }
];

function makePage(page) {
  const mop = MOPS[page];

  const embed = new EmbedBuilder()
    .setTitle(mop.name)
    .setDescription(mop.instructions)
    .setFooter({
      text: `page ${page + 1} / ${MOPS.length}`
    });

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('allmops_previous')
      .setLabel('previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),

    new ButtonBuilder()
      .setCustomId('allmops_next')
      .setLabel('next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === MOPS.length - 1)
  );

  return {
    embeds: [embed],
    components: [buttons]
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allmops')
    .setDescription('view all available mops'),

  async execute(interaction) {
    await interaction.reply(makePage(0));

    const message = await interaction.fetchReply();

    let currentPage = 0;

    const collector = message.createMessageComponentCollector({
      time: 15 * 60 * 1000
    });

    collector.on('collect', async buttonInteraction => {
      if (
        buttonInteraction.customId !== 'allmops_previous' &&
        buttonInteraction.customId !== 'allmops_next'
      ) {
        return;
      }

      if (buttonInteraction.customId === 'allmops_previous') {
        currentPage = Math.max(0, currentPage - 1);
      }

      if (buttonInteraction.customId === 'allmops_next') {
        currentPage = Math.min(
          MOPS.length - 1,
          currentPage + 1
        );
      }

      await buttonInteraction.update(makePage(currentPage));
    });

    collector.on('end', async () => {
      try {
        await message.edit({
          components: []
        });
      } catch (_) {}
    });
  }
};
