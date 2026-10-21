// Background tasks must be defined before the router mounts: Android evaluates
// this entry in a headless JS instance to deliver a reminder reply.
import './services/notificationDreamTask';
// Scrub web auth URL credentials before Expo Router captures the initial link.
import './lib/supabase';
import 'expo-router/entry';
