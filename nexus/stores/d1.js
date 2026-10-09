export class D1Store {
  constructor(db) { this.db = db; }
  async get(id) {
    const row = await this.db.prepare('SELECT payload FROM nexus_keepsakes WHERE id = ?').bind(id).first();
    return row ? JSON.parse(row.payload) : null;
  }
  async insert(record) {
    await this.db.prepare('INSERT INTO nexus_keepsakes (id, owner, game_id, version, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
      .bind(record.id, record.owner, record.gameId, record.version, record.updatedAt, JSON.stringify(record)).run();
    return this.get(record.id);
  }
  async update(record, version) {
    const result = await this.db.prepare('UPDATE nexus_keepsakes SET version = ?, updated_at = ?, payload = ? WHERE id = ? AND version = ?')
      .bind(record.version, record.updatedAt, JSON.stringify(record), record.id, version).run();
    return result.meta.changes === 1;
  }
  async list(owner, gameId) {
    const result = await this.db.prepare('SELECT payload FROM nexus_keepsakes WHERE owner = ? AND game_id = ? ORDER BY updated_at DESC LIMIT 50').bind(owner, gameId).all();
    return result.results.map(row => JSON.parse(row.payload));
  }
}
