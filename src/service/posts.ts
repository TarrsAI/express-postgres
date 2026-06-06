import { Post } from '../model/index.js';
import { httpErr } from '../utility/httpErr.js';
import { HTTP_STATUS_CODE } from '../utility/httpStatusCode.js';

/**
 * Posts business logic. Authorization lives here, not in the
 * controller — the rule "only authors can delete their own posts"
 * is a property of the resource, not of the HTTP transport.
 */

export interface PostView {
  id: string;
  title: string;
  body: string;
  authorId: string;
  createdAt: Date;
}

const toView = (p: Post): PostView => ({
  id: p.id,
  title: p.title,
  body: p.body,
  authorId: p.authorId,
  createdAt: p.createdAt,
});

const LIST_LIMIT = 100;

export const listPosts = async (): Promise<PostView[]> => {
  const rows = await Post.findAll({
    order: [['createdAt', 'DESC']],
    limit: LIST_LIMIT,
  });
  return rows.map(toView);
};

export interface CreatePostInput {
  title: string;
  body: string;
  authorId: string;
}

export const createPost = async (input: CreatePostInput): Promise<PostView> => {
  const created = await Post.create(input);
  return toView(created);
};

/**
 * Delete a post. Returns 404 for both "doesn't exist" and "exists but
 * belongs to someone else" so non-owners can't probe for row existence.
 */
export const removePost = async (
  postId: string,
  actingUserId: string,
): Promise<void> => {
  const post = await Post.findByPk(postId);
  if (!post || post.authorId !== actingUserId) {
    throw httpErr('Not found', HTTP_STATUS_CODE.NOT_FOUND);
  }
  await post.destroy();
};
