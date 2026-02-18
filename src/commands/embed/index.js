import { SlashCommandBuilder } from 'discord.js';
import embedModule from '../../modules/embed/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Manage server embed templates')
    .setDefaultMemberPermissions('0')
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Create an embed template')
      .addStringOption(opt => opt.setName('name').setDescription('Template name').setRequired(true))
      .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(false))
      .addStringOption(opt => opt.setName('description').setDescription('Embed description').setRequired(false))
      .addNumberOption(opt => opt.setName('color').setDescription('Color integer').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('edit')
      .setDescription('Edit an existing template')
      .addStringOption(opt => opt.setName('name').setDescription('Template name').setRequired(true))
      .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(false))
      .addStringOption(opt => opt.setName('description').setDescription('Embed description').setRequired(false))
      .addNumberOption(opt => opt.setName('color').setDescription('Color integer').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('Delete a template')
      .addStringOption(opt => opt.setName('name').setDescription('Template name').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List templates')
    )
    .addSubcommand(sub => sub
      .setName('preview')
      .setDescription('Preview a template')
      .addStringOption(opt => opt.setName('name').setDescription('Template name').setRequired(true))
    ),

  async execute(interaction) {
    await embedModule.handleSubcommand(interaction);
  }
};
