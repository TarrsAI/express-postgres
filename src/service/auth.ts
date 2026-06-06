import { UniqueConstraintError } from 'sequelize';
import { User } from '../model/index.js';
import { hashPassword, verifyPassword } from '../utility/password.js';
import { httpErr } from '../utility/httpErr.js';
import { HTTP_STATUS_CODE } from '../utility/httpStatusCode.js';
import { signSession } from '../utility/jwt.js';

/**
 * Auth business logic. Controllers are thin shells that parse input
 * and call into here; everything that touches the DB, hashes a
 * password, or mints a session lives in this file.
 *
 * Email-collision response is deliberately generic ("Sign-in failed")
 * to avoid an account-enumeration oracle. Trade off if you want a
 * friendlier UX.
 */

export interface PublicUser {
  id: string;
  email: string;
}

const toPublic = (u: User): PublicUser => ({ id: u.id, email: u.email });

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export const registerUser = async (
  email: string,
  password: string,
): Promise<AuthResult> => {
  const passwordHash = await hashPassword(password);
  let created: User;
  try {
    created = await User.create({ email, passwordHash });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      throw httpErr('Sign-in failed', HTTP_STATUS_CODE.BAD_REQUEST, {
        code: 'ERR_AUTH_FAILED',
      });
    }
    throw err;
  }
  const token = await signSession({ userId: created.id, email: created.email });
  return { user: toPublic(created), token };
};

// Indistinguishable-by-timing trick: bcrypt.compare runs against a
// fixed dummy hash even when the user doesn't exist so missing-user
// and wrong-password both take ~80ms. Keep this hash constant —
// regenerating it is fine, but don't randomize per request or the
// timing leak comes back.
const DUMMY_HASH =
  '$2a$10$abcdefghijklmnopqrstuvCqJYdv0fH.iWAY5g8mN4KX5yhEJ4hbxe';

export const loginUser = async (
  email: string,
  password: string,
): Promise<AuthResult> => {
  const user = await User.findOne({ where: { email } });
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, DUMMY_HASH);
  if (!user || !ok) {
    throw httpErr('Sign-in failed', HTTP_STATUS_CODE.UNAUTHORIZED, {
      code: 'ERR_AUTH_FAILED',
    });
  }
  const token = await signSession({ userId: user.id, email: user.email });
  return { user: toPublic(user), token };
};
