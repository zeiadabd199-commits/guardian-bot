export const moduleSchema = {
    enabled: {
        type: 'boolean',
        default: false,
        description: 'Enable/disable the introduce module',
    },
    channelId: {
        type: 'string',
        default: null,
        description: 'Channel ID where introduction message is sent',
    },
    message: {
        type: 'string',
        default: '',
        description: 'Custom introduction message template',
    },
    embedEnabled: {
        type: 'boolean',
        default: true,
        description: 'Use embed for introduction message',
    },
};
