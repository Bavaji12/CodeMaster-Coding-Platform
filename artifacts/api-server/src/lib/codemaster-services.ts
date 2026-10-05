import {
  and,
  count,
  desc,
  eq,
  inArray,
  sql,
} from "drizzle-orm";
import {
  db,
  problemsTable,
  submissionsTable,
  usersTable,
  type Problem,
  type Submission,
  type User,
} from "@workspace/db";
import type { SessionUser } from "./codemaster-auth";

export type ProblemSubmissionStats = {
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
};

export type UserMetrics = {
  totalSubmissions: number;
  acceptedSubmissions: number;
  solvedCount: number;
  currentStreak: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  acceptanceRate: number;
};

function iso(value: Date): string {
  return value.toISOString();
}

function percent(accepted: number, total: number): number {
  return total ? Math.round((accepted / total) * 1000) / 10 : 0;
}

export async function getProblemSubmissionStats(
  problemIds: number[],
): Promise<Map<number, ProblemSubmissionStats>> {
  if (!problemIds.length) return new Map();
  const rows = await db
    .select({
      problemId: submissionsTable.problemId,
      status: submissionsTable.status,
      count: count(),
    })
    .from(submissionsTable)
    .where(inArray(submissionsTable.problemId, problemIds))
    .groupBy(submissionsTable.problemId, submissionsTable.status);

  const result = new Map<number, ProblemSubmissionStats>();
  for (const row of rows) {
    const current = result.get(row.problemId) ?? {
      totalSubmissions: 0,
      acceptedSubmissions: 0,
      acceptanceRate: 0,
    };
    current.totalSubmissions += row.count;
    if (row.status === "Accepted") current.acceptedSubmissions += row.count;
    result.set(row.problemId, current);
  }
  for (const stats of result.values()) {
    stats.acceptanceRate = percent(
      stats.acceptedSubmissions,
      stats.totalSubmissions,
    );
  }
  return result;
}

export async function getSolvedProblemIds(userId: number): Promise<Set<number>> {
  const rows = await db
    .selectDistinct({ problemId: submissionsTable.problemId })
    .from(submissionsTable)
    .where(
      and(
        eq(submissionsTable.userId, userId),
        eq(submissionsTable.status, "Accepted"),
      ),
    );
  return new Set(rows.map((row) => row.problemId));
}

export function problemSummary(
  problem: Problem,
  stats?: ProblemSubmissionStats,
  solved = false,
) {
  const counts = stats ?? {
    totalSubmissions: 0,
    acceptedSubmissions: 0,
    acceptanceRate: 0,
  };
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    topics: problem.topics,
    ...counts,
    solved,
  };
}

export function problemDetails(
  problem: Problem,
  stats?: ProblemSubmissionStats,
  solved = false,
) {
  return {
    ...problemSummary(problem, stats, solved),
    description: problem.description,
    constraints: problem.constraints,
    examples: problem.examples,
    starterCode: problem.starterCode,
    supportedLanguages: problem.supportedLanguages,
  };
}

export function adminProblem(
  problem: Problem,
  stats?: ProblemSubmissionStats,
) {
  return {
    ...problemDetails(problem, stats),
    testCases: problem.testCases,
    hiddenTestCases: problem.hiddenTestCases,
    active: problem.active,
  };
}

export async function getUserMetrics(userId: number): Promise<UserMetrics> {
  const [totals] = await db
    .select({
      totalSubmissions: count(),
      acceptedSubmissions: sql<number>`count(*) filter (where ${submissionsTable.status} = 'Accepted')`,
    })
    .from(submissionsTable)
    .where(eq(submissionsTable.userId, userId));

  const solved = await db
    .selectDistinct({
      problemId: submissionsTable.problemId,
      difficulty: problemsTable.difficulty,
    })
    .from(submissionsTable)
    .innerJoin(
      problemsTable,
      eq(submissionsTable.problemId, problemsTable.id),
    )
    .where(
      and(
        eq(submissionsTable.userId, userId),
        eq(submissionsTable.status, "Accepted"),
      ),
    );

  const solvedProblemIds = new Set<number>();
  const difficultyByProblem = new Map<number, string>();
  for (const row of solved) {
    solvedProblemIds.add(row.problemId);
    difficultyByProblem.set(row.problemId, row.difficulty);
  }
  const difficultyCount = { Easy: 0, Medium: 0, Hard: 0 };
  for (const difficulty of difficultyByProblem.values()) {
    if (difficulty in difficultyCount) {
      difficultyCount[difficulty as keyof typeof difficultyCount] += 1;
    }
  }

  const dateExpression = sql<string>`to_char(${submissionsTable.submittedAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const activeDays = await db
    .select({ day: dateExpression })
    .from(submissionsTable)
    .where(eq(submissionsTable.userId, userId))
    .groupBy(dateExpression);
  const daySet = new Set(activeDays.map((row) => row.day));
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  let cursor = daySet.has(today) ? today : yesterday;
  let currentStreak = 0;
  while (daySet.has(cursor) && currentStreak < 366) {
    currentStreak += 1;
    cursor = new Date(Date.parse(`${cursor}T00:00:00.000Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10);
  }

  return {
    totalSubmissions: Number(totals?.totalSubmissions ?? 0),
    acceptedSubmissions: Number(totals?.acceptedSubmissions ?? 0),
    solvedCount: solvedProblemIds.size,
    currentStreak,
    easySolved: difficultyCount.Easy,
    mediumSolved: difficultyCount.Medium,
    hardSolved: difficultyCount.Hard,
    acceptanceRate: percent(
      Number(totals?.acceptedSubmissions ?? 0),
      Number(totals?.totalSubmissions ?? 0),
    ),
  };
}

export async function userResponse(user: User) {
  const metrics = await getUserMetrics(user.id);
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    solvedCount: metrics.solvedCount,
    currentStreak: metrics.currentStreak,
    totalSubmissions: metrics.totalSubmissions,
    acceptedSubmissions: metrics.acceptedSubmissions,
    joinedAt: iso(user.createdAt),
  };
}

export async function submissionSummaryResponse(
  submission: Submission,
  problem: Pick<Problem, "title" | "slug">,
) {
  return {
    id: submission.id,
    problemId: submission.problemId,
    problemTitle: problem.title,
    problemSlug: problem.slug,
    language: submission.language,
    status: submission.status,
    runtime: submission.runtime,
    memory: submission.memory,
    testCasesPassed: submission.testCasesPassed,
    totalTestCases: submission.totalTestCases,
    submittedAt: iso(submission.submittedAt),
  };
}

export async function submissionResponse(
  submission: Submission,
  problem: Pick<Problem, "title" | "slug">,
) {
  return {
    ...await submissionSummaryResponse(submission, problem),
    userId: submission.userId,
    code: submission.code,
    errorMessage: submission.errorMessage,
  };
}

export async function getUserRecentSubmissions(
  userId: number,
  limit = 10,
) {
  const rows = await db
    .select({ submission: submissionsTable, problem: problemsTable })
    .from(submissionsTable)
    .innerJoin(
      problemsTable,
      eq(submissionsTable.problemId, problemsTable.id),
    )
    .where(eq(submissionsTable.userId, userId))
    .orderBy(desc(submissionsTable.submittedAt))
    .limit(limit);
  return Promise.all(
    rows.map((row) =>
      submissionSummaryResponse(row.submission, row.problem),
    ),
  );
}

export async function profileResponse(user: User) {
  const [metrics, recentSubmissions] = await Promise.all([
    getUserMetrics(user.id),
    getUserRecentSubmissions(user.id, 10),
  ]);
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
    solvedCount: metrics.solvedCount,
    totalSubmissions: metrics.totalSubmissions,
    acceptedSubmissions: metrics.acceptedSubmissions,
    acceptanceRate: metrics.acceptanceRate,
    currentStreak: metrics.currentStreak,
    joinedAt: iso(user.createdAt),
    recentSubmissions,
  };
}

export async function dashboardResponse(userId: number) {
  const [metrics, recentSubmissions, allProblems, solvedIds, activityRows] =
    await Promise.all([
      getUserMetrics(userId),
      getUserRecentSubmissions(userId, 8),
      db.select().from(problemsTable).where(eq(problemsTable.active, true)),
      getSolvedProblemIds(userId),
      db
        .select({
          date: sql<string>`to_char(${submissionsTable.submittedAt} at time zone 'UTC', 'YYYY-MM-DD')`,
          count: count(),
        })
        .from(submissionsTable)
        .where(
          and(
            eq(submissionsTable.userId, userId),
            sql`${submissionsTable.submittedAt} >= now() - interval '29 days'`,
          ),
        )
        .groupBy(
          sql`to_char(${submissionsTable.submittedAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        ),
    ]);

  const topics = new Map<string, { solved: number; total: number }>();
  for (const problem of allProblems) {
    for (const topic of problem.topics) {
      const current = topics.get(topic) ?? { solved: 0, total: 0 };
      current.total += 1;
      if (solvedIds.has(problem.id)) current.solved += 1;
      topics.set(topic, current);
    }
  }

  const activityCount = new Map(
    activityRows.map((row) => [row.date, row.count]),
  );
  const today = new Date();
  const activity = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (29 - index));
    const formatted = date.toISOString().slice(0, 10);
    return { date: formatted, count: activityCount.get(formatted) ?? 0 };
  });

  return {
    totalSolved: metrics.solvedCount,
    totalSubmissions: metrics.totalSubmissions,
    acceptedSubmissions: metrics.acceptedSubmissions,
    acceptanceRate: metrics.acceptanceRate,
    currentStreak: metrics.currentStreak,
    easySolved: metrics.easySolved,
    mediumSolved: metrics.mediumSolved,
    hardSolved: metrics.hardSolved,
    activity,
    topicProgress: Array.from(topics, ([topic, progress]) => ({
      topic,
      ...progress,
    })).sort((a, b) => b.total - a.total || a.topic.localeCompare(b.topic)),
    recentSubmissions,
  };
}

export async function submissionResponseById(
  submissionId: number,
  user: SessionUser,
) {
  const [row] = await db
    .select({ submission: submissionsTable, problem: problemsTable })
    .from(submissionsTable)
    .innerJoin(
      problemsTable,
      eq(submissionsTable.problemId, problemsTable.id),
    )
    .where(
      and(
        eq(submissionsTable.id, submissionId),
        eq(submissionsTable.userId, user.id),
      ),
    )
    .limit(1);
  if (!row) return null;
  return submissionResponse(row.submission, row.problem);
}