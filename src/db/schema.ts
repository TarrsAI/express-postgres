import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Users table. id is a server-generated uuid; email is the human
 * identifier and gets a unique index. password_hash holds the bcrypt
 * digest — never the plaintext, never anything else.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

/**
 * Sample posts table — replace with whatever your domain actually is.
 * Foreign key to users so deleting a user cleans up their posts.
 */
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    authorId: uuid('author_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    // List queries order by createdAt; index supports both the order
    // and the per-author filter that's common in dashboards.
    authorCreatedIdx: index('posts_author_created_idx').on(
      t.authorId,
      t.createdAt,
    ),
  }),
);

export type User = typeof users.$inferSelect;
export type Post = typeof posts.$inferSelect;
