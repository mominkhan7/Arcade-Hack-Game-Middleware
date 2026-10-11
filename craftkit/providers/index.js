import {DemoProvider} from './demo.js';
import {ArcadeProvider} from './arcade.js';
export function configuredProvider(env = {}) {
  const mode = env.CRAFTKIT_PROVIDER ?? env.NEXUS_PROVIDER;
  if (mode === 'live') return new ArcadeProvider({apiKey: env.ARCADE_API_KEY});
  if (mode && mode !== 'simulated') throw new Error('Unknown provider mode.');
  return new DemoProvider();
}
