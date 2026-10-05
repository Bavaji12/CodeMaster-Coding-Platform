import { Router, type IRouter } from "express";
import { compare, hash } from "bcryptjs";
import { and, eq, or } from "drizzle-orm";
import {
  AuthResponse,
  GetCurrentUserResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  RegisterBody,
  RegisterResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import {
  clearSessionCookie,
  rateLimit,
  requireUser,
  setSessionCookie,
} from "../lib/codemaster-auth";
import { userResponse } from "../lib/codemaster-services";

const router: IRouter = Router();
const authRateLimit = rateLimit(15 * 60 * 1000, 15);

function adminEmail(): string | null {
  const value = process.env.CODEMASTER_ADMIN_EMAIL?.trim().toLowerCase();
  return value || null;
}

async function promoteBootstrapAdmin(userId: number, email: string, role: string) {
  if (role === "admin" || adminEmail() !== email) return role;
  await db
    .update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.id, userId));
  return "admin";
}

router.post("/auth/register", authRateLimit, async (request, response) => {
  const parsed = RegisterBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Check the account details and try again." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const username = parsed.data.username.trim().toLowerCase();
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.email, email), eq(usersTable.username, username)))
    .limit(1);
  if (existing) {
    response.status(409).json({ error: "That email or username is already in use." });
    return;
  }

  try {
    const passwordHash = await hash(parsed.data.password, 12);
    const [created] = await db
      .insert(usersTable)
      .values({
        username,
        name: parsed.data.name.trim(),
        email,
        passwordHash,
        role: adminEmail() === email ? "admin" : "user",
      })
      .returning();
    if (!created) throw new Error("User registration did not return a record.");

    setSessionCookie(response, created.id);
    const data = RegisterResponse.parse({
      user: await userResponse(created),
      message: "Your CodeMaster account is ready.",
    });
    response.status(201).json(data);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      response.status(409).json({ error: "That email or username is already in use." });
      return;
    }
    throw error;
  }
});

router.post("/auth/login", authRateLimit, async (request, response) => {
  const parsed = LoginBody.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Enter a valid email and password." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  const passwordMatches = user
    ? await compare(parsed.data.password, user.passwordHash)
    : false;
  if (!user || !passwordMatches) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  const role = await promoteBootstrapAdmin(user.id, user.email, user.role);
  const responseUser = role === user.role ? user : { ...user, role };
  setSessionCookie(response, user.id);
  response.json(
    LoginResponse.parse({
      user: await userResponse(responseUser),
      message: "Welcome back.",
    }),
  );
});

router.post("/auth/logout", (_request, response) => {
  clearSessionCookie(response);
  response.json(LogoutResponse.parse({ message: "You are signed out." }));
});

router.get("/auth/me", requireUser, async (_request, response) => {
  const session = response.locals.user as { id: number };
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.id))
    .limit(1);
  if (!user) {
    response.status(401).json({ error: "Sign in to continue." });
    return;
  }
  const role = await promoteBootstrapAdmin(user.id, user.email, user.role);
  const currentUser = role === user.role ? user : { ...user, role };
  response.json(
    GetCurrentUserResponse.parse(await userResponse(currentUser)),
  );
});

export default router;