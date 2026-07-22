'use strict';
/* global __dirname, describe, expect, it */

const fs = require('fs');
const path = require('path');

const chatRoute = fs.readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'functions', 'api', 'routes', 'chat.ts'),
  'utf8'
);

describe('guest chat entitlement route contract', () => {
  it('claims the per-dream safety allowance instead of exploration per message', () => {
    expect(chatRoute).toContain("adminClient.rpc('claim_guest_chat_message'");
    expect(chatRoute).not.toContain("p_quota_type: 'exploration'");
  });
});
