import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('workspaces', {
 id: text('id').primaryKey(), data: text('data').notNull(), version: integer('version').notNull().default(0)
});
export const sessions = sqliteTable('sessions', {
 token: text('token').primaryKey(), staffId: text('staff_id').notNull(), expires: integer('expires').notNull()
});
