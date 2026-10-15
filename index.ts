// Background tasks must be defined before the router mounts: Android evaluates
// this entry in a headless JS instance to deliver a reminder reply.
import './services/notificationDreamTask';
import 'expo-router/entry';
