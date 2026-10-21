// The verifier copies its config outside the checkout, so the config stays
// self-contained. Runners read that same exported data through this adapter.
export { DREAMER_CAMPAIGN_CONTEXTS as dreamerCampaignContexts } from '../../verify-local.config.mjs';
