import jwt from 'jsonwebtoken';

const JWT_SECRET  = process.env.JWT_SECRET ?? 'dev_secret_change_me';
const JWT_EXPIRES = '8h';

export interface AdminJwtPayload {
  adminId:  string;
  username: string;
}

export function signAdminToken(payload: AdminJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyAdminToken(token: string): AdminJwtPayload {
  return jwt.verify(token, JWT_SECRET) as AdminJwtPayload;
}