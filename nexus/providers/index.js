import {DemoProvider} from './demo.js';
import {ArcadeProvider} from './arcade.js';
export function configuredProvider(env = {}) {
  if (env.NEXUS_PROVIDER === 'live') return new ArcadeProvider({apiKey: env.ARCADE_API_KEY});
  if (env.NEXUS_PROVIDER && env.NEXUS_PROVIDER !== 'simulated') throw new Error('Unknown provider mode.');
  return new DemoProvider();
}
