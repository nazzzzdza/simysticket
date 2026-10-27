
require('dotenv').config();

const express = require('express');
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');

const { createClient } = require('@supabase/supabase-js');

const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

// ==================== CONFIGURATION ====================

const PANEL_CHANNEL_ID = '1557032953362784397';
const ORDER_CATEGORY_ID = '1558459685634445332';
const SUPPORT_CATEGORY_ID = '1557035026489680002';
const TRANSCRIPT_CHANNEL_ID = '1529196050450087966';
const STAFF_ROLE_ID = '1055309415806406766';

const CONFIRM_COLOR = 0x8b5cf6;

// /allmops stays here until its updated version is ready.
const MOPS = [
  // Add the MOP details here later.
];

// ==================== ENVIRONMENT ====================

if (
  !DISCORD_TOKEN ||
  !CLIENT_ID ||
  !GUILD_ID ||
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    'Missing environment variables. Check DISCORD_TOKEN, CLIENT_ID, GUILD_ID, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render.'
  );
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ==================== RENDER KEEPALIVE ====================

const app = express();

app.get('/', (_req, res) => {
  res.status(200).send('simys ticket bot is online.');
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

const port = process.env.PORT || 3000;

app.listen(port, '0.0.0.0', () => {
  console.log('Web server listening on port ' + port);
});

// ==================== TICKETS ====================

const activeTickets = new Map();

function isStaff(member) {
  return Boolean(
    member &&
    member.roles &&
    member.roles.cache &&
    member.roles.cache.has(STAFF_ROLE_ID)
  );
}

function cleanChannelPart(value) {
  const cleaned = String(value || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);

  return cleaned || 'user';
}

function formatTicketNumber(type, number) {
  return type + '-' + String(number).padStart(4, '0');
}

function ticketChannelName(type, username, ticketId) {
  const prefix = type === 'ORD' ? 'order-' : 'support-';

  return cleanChannelPart(
    prefix + username + '-' + ticketId.toLowerCase()
  );
}

function confirmationEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(CONFIRM_COLOR)
    .setTitle(title)
    .setDescription(description);
}

function makePanel() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket_create')
    .setPlaceholder('⠀ .   .   .⠀select⠀one⠀below')
    .addOptions(
      {
        label: '⠀ .   .   .⠀buy',
        description: 'buy⠀from⠀us',
        value: 'ORD',
        emoji: '✿'
      },
      {
        label: '⠀ .   .   .⠀support',
        description: 'get⠀support',
        value: 'SUP',
        emoji: '✿'
      }
    );

  return {
    content:
      '✿ **simys tickets**\n' +
      'choose the type of ticket you want to open below ! ',
    components: [
      new ActionRowBuilder().addComponents(menu)
    ]
  };
}

async function getTicketForChannel(channelId) {
  if (activeTickets.has(channelId)) {
    return activeTickets.get(channelId);
  }

  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('channel_id', channelId)
    .eq('open', true)
    .maybeSingle();

  if (error) {
    console.error('could not load ticket:', error.message);
    return null;
  }

  if (data) {
    activeTickets.set(channelId, data);
  }

  return data || null;
}

async function updateTicketRow(channelId, updates) {
  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('channel_id', channelId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    activeTickets.set(channelId, data);
  }

  return data;
}

// ==================== SLASH COMMAND REGISTRATION ====================

async function registerCommands() {
  const ticketpanelCommand = require('./commands/ticketpanel');
  const closeCommand = require('./commands/close');
  const calculateCommand = require('./commands/calculate');

  const commands = [
    ticketpanelCommand.data,
    closeCommand.data,
    new SlashCommandBuilder()
      .setName('allmops')
      .setDescription('Vview available mops'),
    calculateCommand.data
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' })
    .setToken(DISCORD_TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log('registered slash commands');
}

// ==================== CREATE TICKETS ====================

async function createTicket(interaction, type) {
  const guild = interaction.guild;
  const user = interaction.user;

  const categoryId =
    type === 'ORD'
      ? ORDER_CATEGORY_ID
      : SUPPORT_CATEGORY_ID;

  const displayName =
    interaction.member && interaction.member.displayName
      ? interaction.member.displayName
      : user.username;

  await interaction.deferReply({ ephemeral: true });

  const { data: number, error: numberError } =
    await supabase.rpc('next_ticket_number', {
      p_ticket_type: type
    });

  if (
    numberError ||
    number === null ||
    number === undefined
  ) {
    console.error(
      'ticket number allocation failed:',
      numberError && numberError.message
    );

    await interaction.editReply(
      'could not allocate a ticket number, please tell staff.'
    );

    return;
  }

  const ticketId = formatTicketNumber(type, number);
  let channel;

  try {
    channel = await guild.channels.create({
      name: ticketChannelName(type, displayName, ticketId),
      type: ChannelType.GuildText,
      parent: categoryId,

      topic:
        ticketId +
        ' | opened by ' +
        user.tag +
        ' (' +
        user.id +
        ')',

      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: STAFF_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        }
      ],

      reason: 'Ticket ' + ticketId + ' opened by ' + user.tag
    });

    const ticketRow = {
      ticket_id: ticketId,
      ticket_type: type,
      guild_id: guild.id,
      channel_id: channel.id,
      user_id: user.id,
      channel_name: channel.name,
      open: true
    };

    const { data: savedTicket, error: saveError } =
      await supabase
        .from('tickets')
        .insert(ticketRow)
        .select('*')
        .single();

    if (saveError) {
      throw saveError;
    }

    activeTickets.set(channel.id, savedTicket);

    if (type === 'ORD') {
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('order_continue')
          .setLabel('continue')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId('ticket_cancel')
          .setLabel('cancel')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        content:
          '<@' + user.id + '>\n\n' +
          '⠀⠀⠀⠀✿⠀ ―⠀ __n__e**w**⠀⠀–⠀⠀**or**d__er__！\n' +
          '⠀⠀⠀⠀⠀ ୭⠀⠀__p__le**as**e⠀⠀ch**oos**e⠀◞',

        components: [buttons],
        allowedMentions: { users: [user.id] }
      });
    } else {
      await channel.send({
        content:
          '<@' + user.id + '>\n\n' +
          '⠀⠀⠀⠀✿⠀  ―⠀ **ge**t **s**upport⠀–⠀he**re**！\n' +
          '⠀⠀⠀⠀⠀ ୭⠀⠀ple**as**e⠀⠀**be** patient⠀◞',

        allowedMentions: { users: [user.id] }
      });
    }

    await interaction.editReply(
      'Your ticket **' +
      ticketId +
      '** has been created: ' +
      channel.toString()
    );
  } catch (error) {
    console.error('ticket creation failed:', error);

    if (channel) {
      try {
        await channel.delete('ticket setup failed');
      } catch (_) {}
    }

    await interaction.editReply(
      'something went wrong creating your ticket, please tell staff Error: ' +
      String(error.message || error).slice(0, 200)
    );
  }
}

// ==================== ORDER & WARRANTY FORMS ====================

function makeFormModal(kind) {
  if (kind === 'order') {
    const modal = new ModalBuilder()
      .setCustomId('form_order')
      .setTitle('order form');

    const fields = [
      ['item', 'item', 'item you are buying', true],
      ['amount', 'amount', 'how many', true],
      ['mop', 'mop', 'mop you are paying with', true],
      ['tip', 'tip', 'tip amount, if any', false],
      ['info', 'info', 'any extra information', false]
    ];

    for (const field of fields) {
      const input = new TextInputBuilder()
        .setCustomId(field[0])
        .setLabel(field[1])
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(field[2])
        .setRequired(field[3])
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(input)
      );
    }

    return modal;
  }

  const modal = new ModalBuilder()
    .setCustomId('form_warranty')
    .setTitle('warranty form');

  const fields = [
    ['ticket_id', 'ticket id', 'enter ticket id sent in dms', true],
    ['item', 'Item', 'item you are wanting a warranty for', true],
    ['issue', 'Issue', 'explain the issue', true]
  ];

  for (const field of fields) {
    const input = new TextInputBuilder()
      .setCustomId(field[0])
      .setLabel(field[1])
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(field[2])
      .setRequired(field[3])
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(input)
    );
  }

  return modal;
}

// ==================== HTML TRANSCRIPTS ====================

async function fetchAllMessages(channel) {
  const allMessages = [];
  let before;

  while (true) {
    const options = { limit: 100 };

    if (before) {
      options.before = before;
    }

    const batch = await channel.messages.fetch(options);

    if (!batch.size) {
      break;
    }

    allMessages.push(...batch.values());
    before = batch.last().id;

    if (batch.size < 100) {
      break;
    }
  }

  return allMessages.sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function createTranscript(channel, ticket) {
  const messages = await fetchAllMessages(channel);

  const messageHtml = messages.map(message => {
    const timestamp = new Date(message.createdTimestamp)
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d{3}Z$/, ' UTC');

    const author = escapeHtml(
      message.author ? message.author.tag : 'Unknown user'
    );

    const body = escapeHtml(message.content || '')
      .replace(/\n/g, '<br>');

    const attachments = [...message.attachments.values()]
      .map(file =>
        '<div class="attachment">Attachment: ' +
        '<a href="' + escapeHtml(file.url) + '">' +
        escapeHtml(file.name || file.url) +
        '</a></div>'
      )
      .join('');

    return (
      '<article>' +
      '<div class="meta">' +
      author + ' · ' + escapeHtml(timestamp) +
      '</div>' +
      '<div class="body">' +
      (body || '<span class="muted">(no text)</span>') +
      '</div>' +
      attachments +
      '</article>'
    );
  }).join('\n');

  const html =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHtml(ticket.ticket_id) + ' transcript</title>' +
    '<style>' +
    'body{font-family:Arial,sans-serif;background:#1e1f22;color:#dbdee1;margin:0;padding:24px}' +
    'header{border-bottom:1px solid #444;padding-bottom:16px;margin-bottom:20px}' +
    'h1{font-size:22px;margin:0 0 8px}' +
    '.muted{color:#949ba4}' +
    'article{padding:12px 0;border-bottom:1px solid #35363c;overflow-wrap:anywhere}' +
    '.meta{font-size:13px;color:#b5bac1;margin-bottom:7px}' +
    '.body{line-height:1.5}' +
    '.attachment{margin-top:7px}' +
    '.attachment a{color:#00a8fc}' +
    '</style></head><body>' +
    '<header><h1>Ticket ' + escapeHtml(ticket.ticket_id) + '</h1>' +
    '<div class="muted">' +
    'Type: ' +
    escapeHtml(ticket.ticket_type === 'ORD' ? 'Ordering' : 'Support') +
    ' · channel: ' + escapeHtml(channel.name) +
    ' · opener id: ' + escapeHtml(ticket.user_id) +
    ' · messages: ' + messages.length +
    '</div></header>' +
    messageHtml +
    '</body></html>';

  return new AttachmentBuilder(
    Buffer.from(html, 'utf8'),
    { name: ticket.ticket_id.toLowerCase() + '-transcript.html' }
  );
}

async function sendTranscript(channel, ticket) {
  const transcriptChannel =
    await client.channels.fetch(TRANSCRIPT_CHANNEL_ID);

  if (!transcriptChannel || !transcriptChannel.isTextBased()) {
    throw new Error('Transcript channel is not available.');
  }

  const file = await createTranscript(channel, ticket);

  await transcriptChannel.send({
    content:
      'Transcript for **' + ticket.ticket_id + '** · ' +
      (ticket.ticket_type === 'ORD' ? 'Ordering' : 'Support') +
      '\nOpener: <@' + ticket.user_id + '>' +
      '\nChannel: #' + channel.name,

    files: [file],
    allowedMentions: { parse: [] }
  });
}

async function finishTicket(channel, ticket, sendDM) {
  await sendTranscript(channel, ticket);

  if (sendDM) {
    try {
      const opener = await client.users.fetch(ticket.user_id);

      await opener.send(
        'your ticket **' +
        ticket.ticket_id +
        '** has been closed by staff, thank you!'
      );
    } catch (error) {
      console.warn(
        'could not dm opener for ' + ticket.ticket_id + ':',
        error.message
      );
    }
  }

  await updateTicketRow(channel.id, {
    open: false,
    channel_name: channel.name
  });

  activeTickets.delete(channel.id);

  await channel.delete('Ticket ' + ticket.ticket_id + ' closed');
}

// ==================== CONFIRMATION PROMPTS ====================

async function showCancelConfirmation(interaction) {
  const ticket = await getTicketForChannel(interaction.channelId);

  if (!ticket) {
    await interaction.reply({
      content: 'this channel is not an open ticket',
      ephemeral: true
    });
    return;
  }

  const openerOrStaff =
    interaction.user.id === ticket.user_id ||
    isStaff(interaction.member);

  if (!openerOrStaff) {
    await interaction.reply({
      content: 'only the ticket opener or staff can cancel this ticket',
      ephemeral: true
    });
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('cancel_confirm:' + interaction.channelId)
      .setLabel('cancel ticket')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('cancel_abort:' + interaction.channelId)
      .setLabel('keep ticket')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    embeds: [
      confirmationEmbed(
        'cancel this ticket?',
        'this will save a transcript and permanently delete this ticket channel'
      )
    ],
    components: [row]
  });
}

async function showCloseConfirmation(interaction) {
  const ticket = await getTicketForChannel(interaction.channelId);

  if (!ticket) {
    await interaction.reply({
      content: 'use /close inside an open ticket channel',
      ephemeral: true
    });
    return;
  }

  if (!isStaff(interaction.member)) {
    await interaction.reply({
      content: 'only staff can close tickets with /close',
      ephemeral: true
    });
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('close_confirm:' + interaction.channelId)
      .setLabel('confirm close')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('close_abort:' + interaction.channelId)
      .setLabel('keep open')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    embeds: [
      confirmationEmbed(
        'Close ' + ticket.ticket_id + '?',
        'confirming will create an HTML transcript, dm the ticket id to the opener, and then delete this channel.'
      )
    ],
    components: [row]
  });
}

// ==================== ALL MOPS ====================

function makeMopsPayload(page) {
  const pageSize = 5;
  const pageCount = Math.ceil(MOPS.length / pageSize);
  const safePage = Math.max(0, Math.min(page, pageCount - 1));
  const start = safePage * pageSize;
  const current = MOPS.slice(start, start + pageSize);

  const buttons = current.map((mop, index) =>
    new ButtonBuilder()
      .setCustomId('mop_info:' + (start + index))
      .setLabel(mop.name.slice(0, 80))
      .setStyle(ButtonStyle.Secondary)
  );

  const rows = [];

  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(
      new ActionRowBuilder().addComponents(
        buttons.slice(i, i + 5)
      )
    );
  }

  if (pageCount > 1) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('mop_page:' + (safePage - 1))
          .setLabel('previous')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage === 0),

        new ButtonBuilder()
          .setCustomId('mop_page:' + (safePage + 1))
          .setLabel('next')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage === pageCount - 1)
      )
    );
  }

  return {
    content:
      '✿ **available mops**\n' +
      'choose a method below to see its instructions.\n' +
      'Page ' + (safePage + 1) + ' of ' + pageCount + '.',
    components: rows
  };
}

// ==================== BOT STARTUP ====================

client.once('ready', async () => {
  console.log('Logged in as ' + client.user.tag);

  client.user.setPresence({
    activities: [
      {
        name: '.gg/simys for goodies',
        type: ActivityType.Streaming,
        url: 'https://www.twitch.tv/discord'
      }
    ],
    status: 'online'
  });

  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('open', true);

    if (error) {
      throw error;
    }

    for (const ticket of data || []) {
      try {
        const channel = await client.channels.fetch(ticket.channel_id);

        if (channel) {
          activeTickets.set(ticket.channel_id, ticket);
        } else {
          console.warn(
            'Open ticket channel missing: ' + ticket.ticket_id
          );
        }
      } catch (error) {
        console.warn(
          'Could not restore ' + ticket.ticket_id + ': ' + error.message
        );
      }
    }

    console.log(
      'Restored ' + activeTickets.size + ' open tickets from Supabase.'
    );

    await registerCommands();
  } catch (error) {
    console.error('Startup setup failed:', error);
  }
});

// ==================== INTERACTIONS ====================

client.on('interactionCreate', async interaction => {
  try {
    // Commands that have their own files.
    if (interaction.isChatInputCommand()) {
      const commandFiles = {
        ticketpanel: require('./commands/ticketpanel'),
        close: require('./commands/close'),
        calculate: require('./commands/calculate')
      };

      const command = commandFiles[interaction.commandName];

      if (command) {
        await command.execute(interaction, {
          client,
          PANEL_CHANNEL_ID,
          isStaff,
          makePanel,
          showCloseConfirmation,
          MOPS,
          makeMopsPayload
        });
        return;
      }

      // /allmops remains in index.js for now.
      if (interaction.commandName === 'allmops') {
        if (!MOPS.length) {
          await interaction.reply({
            content:
              'the mop list has not been configured yet, we will add the methods and instructions soon',
            ephemeral: true
          });
          return;
        }

        await interaction.reply(makeMopsPayload(0));
        return;
      }
    }

    // Ticket dropdown
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === 'ticket_create'
    ) {
      const type = interaction.values[0];

      if (type === 'ORD' || type === 'SUP') {
        await createTicket(interaction, type);
      }

      return;
    }

    // Buttons
    if (interaction.isButton()) {
      if (interaction.customId === 'order_continue') {
        const ticket = await getTicketForChannel(interaction.channelId);

        if (!ticket || ticket.ticket_type !== 'ORD') {
          await interaction.reply({
            content: 'this is not an open ordering ticket',
            ephemeral: true
          });
          return;
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('order_form')
            .setLabel('order')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId('warranty_form')
            .setLabel('warranty')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          content: 'choose which form you want to fill out please',
          components: [row],
          ephemeral: true
        });
        return;
      }

      if (
        interaction.customId === 'order_form' ||
        interaction.customId === 'warranty_form'
      ) {
        const ticket = await getTicketForChannel(interaction.channelId);

        if (!ticket || ticket.ticket_type !== 'ORD') {
          await interaction.reply({
            content: 'these forms are only available inside a ticket',
            ephemeral: true
          });
          return;
        }

        await interaction.showModal(
          makeFormModal(
            interaction.customId === 'order_form'
              ? 'order'
              : 'warranty'
          )
        );
        return;
      }

      if (interaction.customId === 'ticket_cancel') {
        await showCancelConfirmation(interaction);
        return;
      }

      if (
        interaction.customId.startsWith('cancel_abort:') ||
        interaction.customId.startsWith('close_abort:')
      ) {
        const channelId = interaction.customId.split(':')[1];

        if (channelId !== interaction.channelId) {
          await interaction.reply({
            content: 'this confirmation belongs to a different channel',
            ephemeral: true
          });
          return;
        }

        await interaction.update({
          embeds: [
            confirmationEmbed(
              'cancelled',
              'the ticket will remain open'
            )
          ],
          components: []
        });
        return;
      }

      // Confirm ticket cancellation: transcript, then delete; no DM.
      if (interaction.customId.startsWith('cancel_confirm:')) {
        const channelId = interaction.customId.split(':')[1];

        if (channelId !== interaction.channelId) {
          await interaction.reply({
            content: 'this confirmation belongs to a different channel',
            ephemeral: true
          });
          return;
        }

        const ticket = await getTicketForChannel(channelId);

        if (!ticket) {
          await interaction.update({
            content: 'this ticket is already closed.',
            embeds: [],
            components: []
          });
          return;
        }

        if (
          interaction.user.id !== ticket.user_id &&
          !isStaff(interaction.member)
        ) {
          await interaction.reply({
            content: 'only the opener or staff can confirm cancellation',
            ephemeral: true
          });
          return;
        }

        await interaction.update({
          embeds: [
            confirmationEmbed(
              'saving transcript…',
              'please wait while the transcript is being sent'
            )
          ],
          components: []
        });

        try {
          await sendTranscript(interaction.channel, ticket);

          await updateTicketRow(channelId, {
            open: false,
            channel_name: interaction.channel.name
          });

          activeTickets.delete(channelId);

          await interaction.channel.delete(
            'Ticket ' + ticket.ticket_id + ' cancelled'
          );
        } catch (error) {
          console.error('Cancellation failed:', error);

          try {
            await interaction.followUp({
              content:
                'could not finish cancelling this ticket because the transcript failed, the ticket should remain open Error: ' +
                String(error.message || error).slice(0, 200),
              ephemeral: true
            });
          } catch (_) {}
        }

        return;
      }

      // Confirm staff closure: transcript, DM, then delete.
      if (interaction.customId.startsWith('close_confirm:')) {
        const channelId = interaction.customId.split(':')[1];

        if (channelId !== interaction.channelId) {
          await interaction.reply({
            content: 'this confirmation belongs to a different channel',
            ephemeral: true
          });
          return;
        }

        if (!isStaff(interaction.member)) {
          await interaction.reply({
            content: 'only staff can confirm closing tickets',
            ephemeral: true
          });
          return;
        }

        const ticket = await getTicketForChannel(channelId);

        if (!ticket) {
          await interaction.update({
            content: 'this ticket is already closed',
            embeds: [],
            components: []
          });
          return;
        }

        await interaction.update({
          embeds: [
            confirmationEmbed(
              'saving transcript…',
              'please wait while the transcript is being sent'
            )
          ],
          components: []
        });

        try {
          await finishTicket(interaction.channel, ticket, true);
        } catch (error) {
          console.error('ticket close failed:', error);

          try {
            await interaction.followUp({
              content:
                'could not finish closing this ticket because the transcript failed Error: ' +
                String(error.message || error).slice(0, 200),
              ephemeral: true
            });
          } catch (_) {}
        }

        return;
      }

      // MOP instructions are visible only to the person who clicks.
      if (interaction.customId.startsWith('mop_info:')) {
        const index = Number(interaction.customId.split(':')[1]);
        const mop = MOPS[index];

        if (!mop) {
          await interaction.reply({
            content: 'invalid mop',
            ephemeral: true
          });
          return;
        }

        await interaction.reply({
          content: '**' + mop.name + '**\n' + mop.instructions,
          ephemeral: true
        });
        return;
      }

      // Update the existing public MOP panel when changing pages.
      if (interaction.customId.startsWith('mop_page:')) {
        if (!MOPS.length) {
          await interaction.reply({
            content: 'no mops are configured yet',
            ephemeral: true
          });
          return;
        }

        const page = Number(interaction.customId.split(':')[1]);

        await interaction.update(makeMopsPayload(page));
        return;
      }
    }

    // Modal submissions
    if (interaction.isModalSubmit()) {
      const ticket = await getTicketForChannel(interaction.channelId);

      if (!ticket || ticket.ticket_type !== 'ORD') {
        await interaction.reply({
          content: 'this form can only be submitted inside a ticket',
          ephemeral: true
        });
        return;
      }

      if (interaction.customId === 'form_order') {
        const answers = [
          ['item', interaction.fields.getTextInputValue('item')],
          ['amount', interaction.fields.getTextInputValue('amount')],
          ['mop', interaction.fields.getTextInputValue('mop')],
          ['tip', interaction.fields.getTextInputValue('tip') || 'Not provided'],
          ['info', interaction.fields.getTextInputValue('info') || 'Not provided']
        ];

        await interaction.channel.send({
          content:
            '**order form**\n' +
            'submitted by <@' + interaction.user.id + '>\n' +
            answers
              .map(answer => '**' + answer[0] + ':** ' + answer[1])
              .join('\n'),
          allowedMentions: { users: [interaction.user.id] }
        });

        await interaction.reply({
          content: 'your order form is sent, please be patient',
          ephemeral: true
        });
        return;
      }

      if (interaction.customId === 'form_warranty') {
        const answers = [
          ['ticket id', interaction.fields.getTextInputValue('ticket_id')],
          ['item', interaction.fields.getTextInputValue('item')],
          ['issue', interaction.fields.getTextInputValue('issue')]
        ];

        await interaction.channel.send({
          content:
            '**warranty form**\n' +
            'submitted by <@' + interaction.user.id + '>\n' +
            answers
              .map(answer => '**' + answer[0] + ':** ' + answer[1])
              .join('\n'),
          allowedMentions: { users: [interaction.user.id] }
        });

        await interaction.reply({
          content: 'your warranty form has been sent, please be patient',
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error('Interaction error:', error);

    if (
      interaction.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      try {
        await interaction.reply({
          content: 'something went wrong, contact staff',
          ephemeral: true
        });
      } catch (_) {}
    }
  }
});

// Keep the ticket ID in channel names when staff rename a ticket.
client.on('channelUpdate', async (oldChannel, newChannel) => {
  try {
    if (
      !newChannel.guild ||
      newChannel.type !== ChannelType.GuildText ||
      oldChannel.name === newChannel.name
    ) {
      return;
    }

    const ticket = await getTicketForChannel(newChannel.id);

    if (
      !ticket ||
      newChannel.name.toLowerCase().includes(ticket.ticket_id.toLowerCase())
    ) {
      return;
    }

    const suffix = '-' + ticket.ticket_id.toLowerCase();

    const base = cleanChannelPart(
      newChannel.name.replace(
        new RegExp('-?' + ticket.ticket_id.toLowerCase() + '$', 'i'),
        ''
      )
    );

    const newName =
      base.slice(0, 90 - suffix.length) + suffix;

    if (newName !== newChannel.name) {
      await newChannel.setName(
        newName,
        'keep ticket id in the channel name'
      );
    }

    await updateTicketRow(newChannel.id, {
      channel_name: newName
    });
  } catch (error) {
    console.warn(
      'could not preserve ticket id after rename:',
      error.message
    );
  }
});

client.login(DISCORD_TOKEN);
