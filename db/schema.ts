import {sqliteTable, text, integer, index} from 'drizzle-orm/sqlite-core';
export const keepsakes = sqliteTable('nexus_keepsakes', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), gameId: text('game_id').notNull(),
  version: integer('version').notNull(), updatedAt: integer('updated_at').notNull(), payload: text('payload').notNull(),
}, table => [index('idx_nexus_owner_game_updated').on(table.owner, table.gameId, table.updatedAt)]);
