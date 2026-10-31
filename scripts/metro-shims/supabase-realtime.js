// Native-only stand-in for @supabase/realtime-js inside supabase-js (see
// scripts/metro-native-stubs.js). supabase-js always constructs a
// RealtimeClient and keeps its token in sync; the app opens no channel.
// Remove the stub before adopting Realtime.
export class RealtimeClient {
  constructor() {
    this.channels = [];
  }

  setAuth() {
    return Promise.resolve();
  }

  channel() {
    throw new Error('Supabase Realtime is not bundled in the native app.');
  }

  getChannels() {
    return this.channels;
  }

  removeChannel() {
    return Promise.resolve('ok');
  }

  removeAllChannels() {
    return Promise.resolve([]);
  }
}
