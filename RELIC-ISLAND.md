# Relic Island

A mobile first 3D adventure built with Three.js. Move with the touch joystick or WASD / arrow keys. Walk into coins, solve the ancient echo, and return to the shrine to awaken a keepsake.

Demo: three coins, one memory encounter, no timer and no coin loss. Explorer and Adventurer add longer journeys with 12 and 20 coins. Every mode keeps retrying friendly.

The reward pendant photograph is an AI generated concept. Arcade generation, guaranteed pricing and checkout are not connected yet. No product or order is created by this prototype.

## Local use

Run `npm run preview` and open http://127.0.0.1:4174/. Run `npm run check` for JavaScript syntax validation. The game assets remain in dist. The Nexus API runs on a Worker with persistent D1 storage; npm run build creates the deployment bundle.

## Keepsakes and character design

The reward trail progresses through 3, 6, 9 and 12 coins. At each milestone, return to the shrine to reveal the concept and continue to the next tier. Higher tiers appear only after continuing. Gold and platinum-look pendants, an island trophy and a woven rug are previews, not quoted products. Material and trophy availability require confirmation.

Use the character button at any time during exploration to change the explorer name, coat, skin, headwear, scarf color and pattern. Changes appear on the character and its scarf / illustrated pillow concepts. Save an SVG reference and copy the design brief to take to Arcade.

An optional loom at the shore offers a tile rotation puzzle. Restore all mountain peaks and choose a palette to create a personalized rug reference. It does not add another required encounter to the three-coin demo.

Arcade's public catalog lists scarf, pillow cover, rug and jewelry categories. API access to specific categories has not been verified in this prototype. Plush toys, trophies and platinum materials remain exploratory concepts.

## Sigil worlds and shrine interaction

Sun, Moon, Mountain and Ocean each change the terrain palette, scenery and starting outfit. Ocean has palms, Mountain has snowy peaks, and Moon has night lighting and fireflies. Sigils use original engraved line art across menus, coins and reward previews.

The shrine has a world marker and beacon. Entering its 2.8-unit interaction radius with enough coins changes guidance to "Shrine reached" and reveals an explicit activation button. The explorer's height follows the four platform surfaces, so feet stay above the steps. Shrine columns have collision while leaving the approach paths clear.

"Watch again" only replays the current echo sequence. It retains the player's coins and position.

### Arcade simulation
Milestone rewards and the character studio open a local physical-product flow: reference upload, pattern job, product job, example quote, hosted-checkout simulation, demo payment, and order tracking. The optional integration trace follows the documented request structure at https://docs.arcade.ai/quickstart. All prices, makers, options, category IDs, shipping, tax, orders and tracking are fixtures. The games call the Nexus backend, which saves design snapshots and simulated orders. No payment credentials or real orders are used. Pendant, trophy and plush category availability is unverified. Live integration must retrieve catalog categories/options and replace fixtures with actual API responses and checkout URLs.

`npm run check` validates syntax, shrine footing and commerce contracts, totals and order transitions. Preview is served with `npm run preview`.

## Nexus integration

Relic Island now uses the reusable Nexus keepsake middleware. Saved designs, generated products, quotes, and demo orders survive closing the forge and reloading. Open Saved keepsakes from the start menu or the square collection button while playing. Game customization after saving cannot change a saved reference.

Signal Garden, available at `/signal-garden.html`, is a second playable circuit puzzle. Solve the nine-tile circuit and bring the exact pattern into a scarf using the same SDK, forge, and backend. Each game has its own collection.

See [Nexus implementation and integration guide](nexus/README.md) for architecture, API usage, simulation boundaries, and requirements before enabling live Arcade commerce.
