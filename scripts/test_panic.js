import { config } from 'dotenv';
config();
import { enablePanic, disablePanic } from '../src/security/panicMode.js';
import panicGuard from '../src/core/panicGuard.js';

(async () => {
  try {
    const guildId = process.env.TEST_GUILD_ID || 'test-guild';
    console.log('Enabling full panic for', guildId);
    await enablePanic(guildId, 'full');

    const actions = ['ROLE_MODIFY','CHANNEL_DELETE','WEBHOOK_CREATE','PERMISSION_UPDATE','GATEWAY_ROLE_ASSIGN'];
    for (const a of actions) {
      const ok = await panicGuard.assertNotInPanic(guildId, a).catch(() => true);
      console.log(a, 'allowed=', ok);
    }

    console.log('Disabling panic');
    await disablePanic(guildId);
    process.exit(0);
  } catch (err) {
    console.error('test_panic failed:', err);
    process.exit(2);
  }
})();
