
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

function makeMopsPanel() {
  const embed = new EmbedBuilder()
    .setDescription(
      '✿ **available mops**\n' +
      'choose a method below to see its instructions'
    );

  const buttons = MOPS.map((mop, index) =>
    new ButtonBuilder()
      .setCustomId('mop_info:' + index)
      .setLabel(mop.name)
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(buttons)
    ]
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('allmops')
    .setDescription('view all available mops'),

  async execute(interaction) {
    await interaction.reply(makeMopsPanel());
  },

  async handleButton(interaction) {
    if (!interaction.customId.startsWith('mop_info:')) {
      return false;
    }

    const index = Number(interaction.customId.split(':')[1]);
    const mop = MOPS[index];

    if (!mop) {
      await interaction.reply({
        content: 'invalid payment method.',
        ephemeral: true
      });

      return true;
    }

    await interaction.reply({
      content: '**' + mop.name + '**\n' + mop.instructions,
      ephemeral: true
    });

    return true;
  }
};
