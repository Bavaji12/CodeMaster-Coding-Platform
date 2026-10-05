import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

const COOKIE_NAME = "codemaster_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;
const SESSION_SECRET = process.env.SESSION_SECRET;

export type SessionUser = Pick<User, "id" | "username" | "role">;
type SessionClaims = { sub: string; exp: number };

function requiredSecret(): string {
  if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be configured before serving CodeMaster.");
  }
  return SESSION_SECRET;
}

function sign(value: string): string {
  return createHmac("sha256", requiredSecret()).update(value).digest("base64url");
}

function makeToken(userId: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({
      sub: String(userId),
      exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
    }),
  ).toString("base64url");
  const content = `${header}.${payload}`;
  return `${content}.${sign(content)}`;
}

function verifyToken(token: unknown): number | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const content = `${parts[0]}.${parts[1]}`;
    const expected = Buffer.from(sign(content));
    const actual = Buffer.from(parts[2]);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }

    const claims = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as SessionClaims;
    const userId = Number(claims.sub);
    if (!Number.isSafeInteger(userId) || userId < 1) return null;
    if (!Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) {
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: Response, userId: number): void {
  response.cookie(COOKIE_NAME, makeToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS * 1000,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

async function findSessionUser(token: unknown): Promise<SessionUser | null> {
  const id = verifyToken(token);
  if (!id) return null;
  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  return user ?? null;
}

export const optionalUser: RequestHandler = async (request, response, next) => {
  try {
    const user = await findSessionUser(request.cookies?.[COOKIE_NAME]);
    if (user) response.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireUser: RequestHandler = async (request, response, next) => {
  try {
    const user = await findSessionUser(request.cookies?.[COOKIE_NAME]);
    if (!user) {
      response.status(401).json({ error: "Sign in to continue." });
      return;
    }
    response.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = (request, response, next) => {
  const user = response.locals.user as SessionUser | undefined;
  if (!user) {
    response.status(401).json({ error: "Sign in to continue." });
    return;
  }
  if (user.role !== "admin") {
    response.status(403).json({ error: "Administrator access is required." });
    return;
  }
  next();
};

export function rateLimit(windowMs: number, maxRequests: number): RequestHandler {
  const requests = new Map<string, { count: number; resetAt: number }>();
  return (request, response, next) => {
    const now = Date.now();
    const key = request.ip || "unknown";
    let current = requests.get(key);
    if (!current || current.resetAt <= now) {
      current = { count: 0, resetAt: now + windowMs };
      requests.set(key, current);
    }

    current.count += 1;
    if (requests.size > 5000) {
      for (const [storedKey, value] of requests) {
        if (value.resetAt <= now) requests.delete(storedKey);
      }
    }

    if (current.count > maxRequests) {
      response.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))),
      );
      response.status(429).json({ error: "Too many requests. Try again shortly." });
      return;
    }
    next();
  };
}