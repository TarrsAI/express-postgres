import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { posts } from '../db/schema.js';

/**
 * Sample CRUD endpoints. Replace with your domain. The auth assumption
 * is enforced upstream by requireAuth — every handler can read
 * req.user without a null check.
 */

export const list = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rows = await db
      .select({
        id: posts.id,
        title: posts.title,
        body: posts.body,
        authorId: posts.authorId,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .orderBy(desc(posts.createdAt))
      .limit(100);
    res.json({ posts: rows });
  } catch (err) {
    next(err);
  }
};

const CreateBody = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
});

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }
    const [created] = await db
      .insert(posts)
      .values({
        title: parsed.data.title,
        body: parsed.data.body,
        authorId: req.user!.id,
      })
      .returning();
    res.status(201).json({ post: created });
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/posts/:id — author-only. 404s when the row exists but
 *  belongs to someone else, same as not-found, to avoid leaking row
 *  existence to non-owners. */
export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const result = await db
      .delete(posts)
      .where(eq(posts.id, id))
      .returning({ id: posts.id, authorId: posts.authorId });
    if (result.length === 0 || result[0]!.authorId !== req.user!.id) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
