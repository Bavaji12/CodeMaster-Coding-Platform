import { Router, type IRouter } from "express";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import {
  CreateProblemBody,
  CreateProblemResponse,
  DeleteProblemParams,
  DeleteProblemResponse,
  GetAdminStatsResponse,
  GetDashboardResponse,
  GetLeaderboardQueryParams,
  GetLeaderboardResponse,
  GetMyProfileResponse,
  GetPublicProfileResponse,
  ListAdminProblemsQueryParams,
  ListAdminProblemsResponse,
  SetProblemActiveBody,
  SetProblemActiveParams,
  SetProblemActiveResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
  UpdateProblemBody,
  UpdateProblemParams,
  UpdateProblemResponse,
} from "@workspace/api-zod";
import {
  db,
  problemsTable,
  submissionsTable,
  usersTable,
} from "@workspace/db";
import {
  rateLimit,
  requireAdmin,
  requireUser,
  type SessionUser,
} from "../lib/codemaster-auth";
import {
  adminProblem,
  dashboardResponse,
  getProblemSubmissionStats,
  profileResponse,
} from "../lib/codemaster-services";

const router: IRouter = Router();
const profileRateLimit = rateLimit(60_000, 30);

router.get("/dashboard", requireUser, async (_request, response) => {
  const user = response.locals.user as SessionUser;
  response.json(
    GetDashboardResponse.parse(await dashboardResponse(user.id)),
  );
});

router.get("/users/me", requireUser, async (_request, response) => {
  const session = response.locals.user as SessionUser;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.id))
    .limit(1);
  if (!user) {
    response.status(404).json({ error: "Profile not found." });
    return;
  }
  response.json(GetMyProfileResponse.parse(await profileResponse(user)));
});

router.put(
  "/users/me",
  requireUser,
  profileRateLimit,
  async (request, response) => {
    const parsed = UpdateMyProfileBody.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Check the profile details and try again." });
      return;
    }
    const session = response.locals.user as SessionUser;
    const username = parsed.data.username.trim().toLowerCase();
    const [duplicate] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);
    if (duplicate && duplicate.id !== session.id) {
      response.status(409).json({ error: "That username is already in use." });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({
        username,
        name: parsed.data.name.trim(),
        avatar: parsed.data.avatar?.trim() || null,
      })
      .where(eq(usersTable.id, session.id))
      .returning();
    if (!updated) {
      response.status(404).json({ error: "Profile not found." });
      return;
    }
    response.json(UpdateMyProfileResponse.parse(await profileResponse(updated)));
  },
);

router.get("/users/:username", async (request, response) => {
  const username = String(request.params.username).trim().toLowerCase();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  if (!user) {
    response.status(404).json({ error: "Profile not found." });
    return;
  }
  response.json(GetPublicProfileResponse.parse(await profileResponse(user)));
});

function streakFromDays(days: Set<string>): number {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  let cursor = days.has(today) ? today : yesterday;
  let streak = 0;
  while (days.has(cursor) && streak < 366) {
    streak += 1;
    cursor = new Date(Date.parse(`${cursor}T00:00:00.000Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  return streak;
}

router.get("/leaderboard", async (request, response) => {
  const parsed = GetLeaderboardQueryParams.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "The leaderboard page is invalid." });
    return;
  }
  const page = parsed.data.page;
  const pageSize = 20;
  const [totalRow] = await db
    .select({ total: count() })
    .from(usersTable);
  const total = totalRow?.total ?? 0;
  const users = await db.select().from(usersTable).orderBy(usersTable.id);
  const userIds = users.map((user) => user.id);
  const aggregateRows = userIds.length
    ? await db
        .select({
          userId: submissionsTable.userId,
          totalSubmissions: count(),
          acceptedSubmissions: sql<number>`count(*) filter (where ${submissionsTable.status} = 'Accepted')`,
          solvedCount: sql<number>`count(distinct ${submissionsTable.problemId}) filter (where ${submissionsTable.status} = 'Accepted')`,
        })
        .from(submissionsTable)
        .where(inArray(submissionsTable.userId, userIds))
        .groupBy(submissionsTable.userId)
    : [];
  const dateExpression = sql<string>`to_char(${submissionsTable.submittedAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const activityRows = userIds.length
    ? await db
        .select({ userId: submissionsTable.userId, day: dateExpression })
        .from(submissionsTable)
        .where(inArray(submissionsTable.userId, userIds))
        .groupBy(submissionsTable.userId, dateExpression)
    : [];
  const totalsByUser = new Map(aggregateRows.map((row) => [row.userId, row]));
  const daysByUser = new Map<number, Set<string>>();
  for (const row of activityRows) {
    const days = daysByUser.get(row.userId) ?? new Set<string>();
    days.add(row.day);
    daysByUser.set(row.userId, days);
  }
  const entries = users
    .map((user) => {
      const metrics = totalsByUser.get(user.id);
      const accepted = Number(metrics?.acceptedSubmissions ?? 0);
      const totalSubmissions = Number(metrics?.totalSubmissions ?? 0);
      return {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        solvedCount: Number(metrics?.solvedCount ?? 0),
        currentStreak: streakFromDays(daysByUser.get(user.id) ?? new Set()),
        acceptanceRate: totalSubmissions
          ? Math.round((accepted / totalSubmissions) * 1000) / 10
          : 0,
      };
    })
    .sort(
      (a, b) =>
        b.solvedCount - a.solvedCount ||
        b.currentStreak - a.currentStreak ||
        b.acceptanceRate - a.acceptanceRate ||
        a.username.localeCompare(b.username),
    );
  const pages = Math.ceil(total / pageSize);
  response.json(
    GetLeaderboardResponse.parse({
      items: entries
        .slice((page - 1) * pageSize, page * pageSize)
        .map((entry, index) => ({
          ...entry,
          rank: (page - 1) * pageSize + index + 1,
        })),
      page,
      pages,
      total,
    }),
  );
});

router.get("/admin/stats", requireUser, requireAdmin, async (_request, response) => {
  const [userCount] = await db.select({ value: count() }).from(usersTable);
  const [problemCount] = await db
    .select({ value: count() })
    .from(problemsTable);
  const [submissionCounts] = await db
    .select({
      total: count(),
      accepted: sql<number>`count(*) filter (where ${submissionsTable.status} = 'Accepted')`,
    })
    .from(submissionsTable);
  const total = Number(submissionCounts?.total ?? 0);
  const accepted = Number(submissionCounts?.accepted ?? 0);
  response.json(
    GetAdminStatsResponse.parse({
      users: userCount?.value ?? 0,
      problems: problemCount?.value ?? 0,
      submissions: total,
      acceptedSubmissions: accepted,
      acceptanceRate: total
        ? Math.round((accepted / total) * 1000) / 10
        : 0,
    }),
  );
});

router.get(
  "/admin/problems",
  requireUser,
  requireAdmin,
  async (request, response) => {
    const parsed = ListAdminProblemsQueryParams.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ error: "The search filter is invalid." });
      return;
    }
    const query = parsed.data.q?.trim();
    const problems = await db
      .select()
      .from(problemsTable)
      .where(
        query
          ? or(
              ilike(problemsTable.title, `%${query}%`),
              ilike(problemsTable.slug, `%${query}%`),
            )
          : undefined,
      )
      .orderBy(problemsTable.id);
    const stats = await getProblemSubmissionStats(
      problems.map((problem) => problem.id),
    );
    response.json(
      ListAdminProblemsResponse.parse(
        problems.map((problem) =>
          adminProblem(problem, stats.get(problem.id)),
        ),
      ),
    );
  },
);

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180) || "problem";
}

async function uniqueProblemSlug(title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let suffix = 2;
  while (
    await db
      .select({ id: problemsTable.id })
      .from(problemsTable)
      .where(eq(problemsTable.slug, slug))
      .limit(1)
      .then((rows) => rows.length > 0)
  ) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

router.post(
  "/admin/problems",
  requireUser,
  requireAdmin,
  async (request, response) => {
    const parsed = CreateProblemBody.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Check the problem details and test cases." });
      return;
    }
    const admin = response.locals.user as SessionUser;
    const input = parsed.data;
    const slug = await uniqueProblemSlug(input.title);
    const [created] = await db
      .insert(problemsTable)
      .values({
        slug,
        title: input.title.trim(),
        description: input.description.trim(),
        difficulty: input.difficulty,
        topics: input.topics.map((topic) => topic.trim()).filter(Boolean),
        constraints: input.constraints.map((item) => item.trim()).filter(Boolean),
        examples: input.examples,
        starterCode: input.starterCode,
        supportedLanguages: input.supportedLanguages,
        testCases: input.testCases,
        hiddenTestCases: input.hiddenTestCases,
        active: input.active,
        createdBy: admin.id,
      })
      .returning();
    if (!created) throw new Error("Problem could not be created.");
    response.status(201).json(
      CreateProblemResponse.parse(adminProblem(created)),
    );
  },
);

router.put(
  "/admin/problems/:id",
  requireUser,
  requireAdmin,
  async (request, response) => {
    const params = UpdateProblemParams.safeParse(request.params);
    const body = UpdateProblemBody.safeParse(request.body);
    if (!params.success || !body.success) {
      response.status(400).json({ error: "Check the problem details and test cases." });
      return;
    }
    const input = body.data;
    const [updated] = await db
      .update(problemsTable)
      .set({
        title: input.title.trim(),
        description: input.description.trim(),
        difficulty: input.difficulty,
        topics: input.topics.map((topic) => topic.trim()).filter(Boolean),
        constraints: input.constraints.map((item) => item.trim()).filter(Boolean),
        examples: input.examples,
        starterCode: input.starterCode,
        supportedLanguages: input.supportedLanguages,
        testCases: input.testCases,
        hiddenTestCases: input.hiddenTestCases,
        active: input.active,
      })
      .where(eq(problemsTable.id, params.data.id))
      .returning();
    if (!updated) {
      response.status(404).json({ error: "Problem not found." });
      return;
    }
    const stats = await getProblemSubmissionStats([updated.id]);
    response.json(
      UpdateProblemResponse.parse(adminProblem(updated, stats.get(updated.id))),
    );
  },
);

router.delete(
  "/admin/problems/:id",
  requireUser,
  requireAdmin,
  async (request, response) => {
    const params = DeleteProblemParams.safeParse(request.params);
    if (!params.success) {
      response.status(400).json({ error: "Problem id is invalid." });
      return;
    }
    const [deleted] = await db
      .delete(problemsTable)
      .where(eq(problemsTable.id, params.data.id))
      .returning({ id: problemsTable.id });
    if (!deleted) {
      response.status(404).json({ error: "Problem not found." });
      return;
    }
    response.json(
      DeleteProblemResponse.parse({ message: "Problem deleted." }),
    );
  },
);

router.patch(
  "/admin/problems/:id/active",
  requireUser,
  requireAdmin,
  async (request, response) => {
    const params = SetProblemActiveParams.safeParse(request.params);
    const body = SetProblemActiveBody.safeParse(request.body);
    if (!params.success || !body.success) {
      response.status(400).json({ error: "Problem visibility is invalid." });
      return;
    }
    const [updated] = await db
      .update(problemsTable)
      .set({ active: body.data.active })
      .where(eq(problemsTable.id, params.data.id))
      .returning();
    if (!updated) {
      response.status(404).json({ error: "Problem not found." });
      return;
    }
    const stats = await getProblemSubmissionStats([updated.id]);
    response.json(
      SetProblemActiveResponse.parse(adminProblem(updated, stats.get(updated.id))),
    );
  },
);

export default router;