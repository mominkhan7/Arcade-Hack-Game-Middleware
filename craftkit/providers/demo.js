import {createDemoSession, patternRequest, productRequest, checkoutRequest, demoProduct, demoUnitPrice, demoTotals, job, completeDemoPayment, advanceDemoOrder} from './demo-model.js';

export class DemoProvider {
  mode = 'simulated';
  initialize(type, input) { return createDemoSession(type, input); }
  start(record, now) {
    record.phase = 'pattern';
    record.generation = {startedAt: now, deadline: now + 60000, patternMs: 1100, productMs: 1200};
    record.error = null;
    record.job = job(record, 'pattern', 'running');
    this.trace(record, '/patterns/create', patternRequest(record), record.job);
  }
  reconcile(record, now) {
    if (!['pattern', 'product'].includes(record.phase)) return false;
    const elapsed = now - record.generation.startedAt;
    if (record.design.demoFailure === true) {
      record.phase = 'failed'; record.error = 'Demo provider failed. Your design is saved; retry generation.';
      record.job = {...record.job, status: 'failed', error: record.error};
      return true;
    }
    if (now > record.generation.deadline && record.design.demoTimeout === true) {
      record.phase = 'failed'; record.error = 'Generation timed out. Your design is saved; retry generation.';
      return true;
    }
    if (record.design.demoTimeout === true) return false;
    let changed = false;
    if (record.phase === 'pattern' && elapsed >= record.generation.patternMs) {
      this.trace(record, '/jobs/get', {jobId: record.job.jobId}, job(record, 'pattern', 'succeeded'));
      record.phase = 'product'; record.job = job(record, 'product', 'running');
      this.trace(record, '/products/create', productRequest(record), record.job); changed = true;
    }
    if (record.phase === 'product' && elapsed >= record.generation.patternMs + record.generation.productMs) {
      this.trace(record, '/jobs/get', {jobId: record.job.jobId}, job(record, 'product', 'succeeded'));
      record.job = job(record, 'product', 'succeeded');
      record.product = demoProduct(record); record.phase = 'quote';
      this.quote(record, now); changed = true;
    }
    return changed;
  }
  quote(record, now) {
    record.quote = {id: 'demo_quote_' + record.token + '_' + record.revision + '_' + record.quantity,
      designRevision: record.revision, expiresAt: now + 15 * 60 * 1000,
      ...demoTotals(demoUnitPrice(record), record.quantity), simulated: true};
    this.trace(record, '/products/get', {productId: record.productId, quantity: record.quantity}, record.product);
  }
  checkout(record) {
    record.checkout = {id: 'demo_checkout_' + record.token + '_' + record.revision + '_' + record.quantity,
      quoteId: record.quote.id, url: null, simulated: true};
    record.checkoutId = record.checkout.id; record.phase = 'checkout';
    this.trace(record, '/checkouts/create', checkoutRequest(record), record.checkout);
  }
  pay(record) { const order = completeDemoPayment(record); this.trace(record, '/orders/get', {checkoutId: record.checkoutId}, order); }
  advance(record) { const order = advanceDemoOrder(record); this.trace(record, '/orders/get', {orderId: order.orderId}, order); }
  trace(record, endpoint, request, response) {
    record.trace.push(structuredClone({endpoint, request, response, simulated: true}));
    record.trace = record.trace.slice(-40);
  }
}
