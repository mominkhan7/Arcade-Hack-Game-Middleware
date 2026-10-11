import {buildOffering} from './craftkit-offerings.js';
// Engine-neutral SDK. No Arcade endpoints, catalog fixtures, prices, or payment credentials.
export class CraftKitClient {
  constructor({gameId, baseUrl = '/api/craftkit', fetcher = (...args) => fetch(...args)}) {
    this.gameId = gameId; this.baseUrl = baseUrl; this.fetcher = fetcher;
  }
  async request(path = '', input) {
    let response;
    try {
      response = await this.fetcher(this.baseUrl + path, {
        method: input === undefined ? 'GET' : 'POST', credentials: 'same-origin',
        headers: {'X-CraftKit-Game': this.gameId, ...(input === undefined ? {} : {'Content-Type': 'application/json'})},
        body: input === undefined ? undefined : JSON.stringify(input), signal: AbortSignal.timeout(120000),
      });
    } catch { throw new Error('Keepsake service is unavailable. Your design is still in the game; try again.'); }
    const body = await response.json();
    if (!response.ok) { const error = new Error(body.error || 'Keepsake request failed.'); error.status = response.status; throw error; }
    return body;
  }
  createKeepsake(input) { return this.request('/keepsakes', input); }
  createFromOffering(offeringId, input) { const config=buildOffering(offeringId,input); return this.createKeepsake({recipe:config.type,sourceEventId:config.sourceEventId,title:config.title,prompt:config.prompt,design:config.design,story:config.story}); }
  getKeepsake(id) { return this.request('/keepsakes/' + encodeURIComponent(id)); }
  listKeepsakes() { return this.request('/keepsakes'); }
  catalog() { return this.request('/catalog'); }
  action(id, action, input = {}) { return this.request('/keepsakes/' + encodeURIComponent(id) + '/' + action, input); }
  generateProduct(id) { return this.action(id, 'generate'); }
  setOptions(id, selections, quantity) { return this.action(id, 'options', {selections, quantity}); }
  openCheckout(id) { return this.action(id, 'checkout'); }
  refreshQuote(id) { return this.action(id, 'refresh-quote'); }
  completeDemoPayment(id) { return this.action(id, 'pay-demo'); }
  advanceDemoOrder(id, expectedStatus) { return this.action(id, 'advance-demo', {expectedStatus}); }
  async waitForProduct(id, {onUpdate = () => {}, signal, timeoutMs = 15 * 60000} = {}) {
    const startedAt = Date.now(); let delay = 300;
    while (Date.now() - startedAt < timeoutMs) {
      if (signal?.aborted) throw new DOMException('Stopped observing', 'AbortError');
      let record;
      try { record = await this.getKeepsake(id); }
      catch (error) { if (![409, 503].includes(error.status)) throw error; }
      if (record) {
        if (signal?.aborted) throw new DOMException('Stopped observing', 'AbortError');
        onUpdate(record);
        if (record.phase === 'failed') throw new Error(record.error);
        if (!['pattern', 'product'].includes(record.phase)) return record;
      }
      await new Promise(resolve => setTimeout(resolve, delay)); delay = Math.min(record?.simulated ? 2000 : 5000, delay * 1.5);
    }
    throw new Error('Generation is taking longer than expected. Close and reopen to resume.');
  }
}
