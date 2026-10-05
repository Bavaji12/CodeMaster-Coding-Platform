import { Router, type IRouter } from "express";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  GetProblemResponse,
  GetSubmissionResponse,
  ListProblemsQueryParams,
  ListProblemsResponse,
  ListSubmissionsQueryParams,
  ListSubmissionsResponse,
  RunCodeBody,
  RunCodeResponse,
  SubmitCodeBody,
  SubmitCodeResponse,
} from "@workspace/api-zod";
import {
  db,
  problemsTable,
  submissionsTable,
} from "@workspace/db";
import {
  optionalUser,
  rateLimit,
  requireUser,
  type SessionUser,
} from "../lib/codemaster-auth";
import {
  adminProblem,
  getProblemSubmissionStats,
  getSolvedProblemIds,
  problemDetails,
  problemSummary,
  submissionResponse,
  submissionResponseById,
} from "../lib/codemaster-services";
import {
  normalizedOutput,
  runInSandbox,
  statusFromJudge,
  type CodeLanguage,
} from "../lib/judge0";

const router: IRouter = Router();
const runRateLimit = rateLimit(60_000, 12);
const submitRateLimit = rateLimit(60 * 60 * 1000, 30);

router.get("/problems", optionalUser, async (request, response) => {
  const parsed = ListProblemsQueryParams.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "The problem filters are invalid." });
    return;
  }

  const { page, limit, q, difficulty, topic } = parsed.data;
  const filters = [eq(problemsTable.active, true)];
  if (q?.trim()) {
    const search = `%${q.trim().replace(/[%_]/g, "\\$&")}%`;
    filters.push(
      or(
        ilike(problemsTable.title, search),
        ilike(problemsTable.description, search),
      )!,
    );
  }
  if (difficulty) filters.push(eq(problemsTable.difficulty, difficulty));
  if (topic?.trim()) {
    filters.push(
      sql`${problemsTable.topics}::text ILIKE ${`%${topic.trim()}%`}`,
    );
  }
  const where = and(...filters);
  const [totalRow] = await db
    .select({ total: count() })
    .from(problemsTable)
    .where(where);
  const total = totalRow?.total ?? 0;
  const problems = await db
    .select()
    .from(problemsTable)
    .where(where)
    .orderBy(problemsTable.id)
    .limit(limit)
    .offset((page - 1) * limit);

  const stats = await getProblemSubmissionStats(problems.map((p) => p.id));
  const session = response.locals.user as SessionUser | undefined;
  const solved = session
    ? await getSolvedProblemIds(session.id)
    : new Set<number>();
  response.json(
    ListProblemsResponse.parse({
      items: problems.map((problem) =>
        problemSummary(problem, stats.get(problem.id), solved.has(problem.id)),
      ),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    }),
  );
});

router.get("/problems/:slug", optionalUser, async (request, response) => {
  const [problem] = await db
    .select()
    .from(problemsTable)
    .where(
      and(
        eq(problemsTable.slug, String(request.params.slug)),
        eq(problemsTable.active, true),
      ),
    )
    .limit(1);
  if (!problem) {
    response.status(404).json({ error: "Problem not found." });
    return;
  }

  const [stats, session] = await Promise.all([
    getProblemSubmissionStats([problem.id]),
    Promise.resolve(response.locals.user as SessionUser | undefined),
  ]);
  const solved = session
    ? (await getSolvedProblemIds(session.id)).has(problem.id)
    : false;
  response.json(
    GetProblemResponse.parse(
      problemDetails(problem, stats.get(problem.id), solved),
    ),
  );
});

router.post(
  "/submissions/run",
  runRateLimit,
  async (request, response) => {
    const parsed = RunCodeBody.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Check the code and input, then try again." });
      return;
    }
    const [problem] = await db
      .select({ id: problemsTable.id })
      .from(problemsTable)
      .where(
        and(
          eq(problemsTable.id, parsed.data.problemId),
          eq(problemsTable.active, true),
        ),
      )
      .limit(1);
    if (!problem) {
      response.status(404).json({ error: "Problem not found." });
      return;
    }

    try {
      const result = await runInSandbox(
        parsed.data.code,
        parsed.data.language as CodeLanguage,
        parsed.data.input,
      );
      const data = RunCodeResponse.parse({
        status: statusFromJudge(result),
        output: result.stdout,
        error: result.compileOutput || result.stderr,
        runtime:
          result.runtime === null ? null : Math.round(result.runtime * 1000),
        memory: result.memory,
      });
      response.json(data);
    } catch (error) {
      response.status(503).json({
        error:
          error instanceof Error
            ? error.message
            : "The code runner is unavailable right now.",
      });
    }
  },
);

router.get("/submissions", requireUser, async (request, response) => {
  const parsed = ListSubmissionsQueryParams.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "The submission filters are invalid." });
    return;
  }
  const user = response.locals.user as SessionUser;
  const { page, status } = parsed.data;
  const filters = [eq(submissionsTable.userId, user.id)];
  if (status) filters.push(eq(submissionsTable.status, status));
  const where = and(...filters);
  const [totalRow] = await db
    .select({ total: count() })
    .from(submissionsTable)
    .where(where);
  const total = totalRow?.total ?? 0;
  const rows = await db
    .select({ submission: submissionsTable, problem: problemsTable })
    .from(submissionsTable)
    .innerJoin(
      problemsTable,
      eq(submissionsTable.problemId, problemsTable.id),
    )
    .where(where)
    .orderBy(desc(submissionsTable.submittedAt))
    .limit(20)
    .offset((page - 1) * 20);

  response.json(
    ListSubmissionsResponse.parse({
      items: await Promise.all(
        rows.map((row) =>
          submissionResponse(row.submission, row.problem),
        ),
      ),
      page,
      total,
      pages: Math.ceil(total / 20),
    }),
  );
});

router.post(
  "/submissions",
  requireUser,
  submitRateLimit,
  async (request, response) => {
    const parsed = SubmitCodeBody.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Check your solution and try again." });
      return;
    }
    const user = response.locals.user as SessionUser;
    const [problem] = await db
      .select()
      .from(problemsTable)
      .where(
        and(
          eq(problemsTable.id, parsed.data.problemId),
          eq(problemsTable.active, true),
        ),
      )
      .limit(1);
    if (!problem) {
      response.status(404).json({ error: "Problem not found." });
      return;
    }

    const testCases = [...problem.testCases, ...problem.hiddenTestCases];
    if (!testCases.length) {
      response.status(422).json({ error: "This problem has no test cases yet." });
      return;
    }

    let status = "Accepted";
    let errorMessage: string | null = null;
    let runtimeMs = 0;
    let memory = 0;
    let passed = 0;

    try {
      for (const testCase of testCases) {
        const result = await runInSandbox(
          parsed.data.code,
          parsed.data.language as CodeLanguage,
          testCase.input,
        );
        runtimeMs += Math.round((result.runtime ?? 0) * 1000);
        memory = Math.max(memory, result.memory ?? 0);
        const judgeStatus = statusFromJudge(result);
        if (judgeStatus !== "Accepted") {
          status = judgeStatus;
          errorMessage = result.compileOutput || result.stderr || result.status;
          break;
        }
        if (normalizedOutput(result.stdout) !== normalizedOutput(testCase.output)) {
          status = "Wrong Answer";
          errorMessage = "The output did not match the expected result.";
          break;
        }
        passed += 1;
      }
    } catch (error) {
      response.status(503).json({
        error:
          error instanceof Error
            ? error.message
            : "The code runner is unavailable right now.",
      });
      return;
    }

    const [submission] = await db
      .insert(submissionsTable)
      .values({
        userId: user.id,
        problemId: problem.id,
        language: parsed.data.language,
        code: parsed.data.code,
        status,
        runtime: runtimeMs,
        memory,
        testCasesPassed: passed,
        totalTestCases: testCases.length,
        errorMessage,
      })
      .returning();
    if (!submission) throw new Error("Submission could not be saved.");

    response.status(201).json(
      SubmitCodeResponse.parse({
        ...await submissionResponse(submission, problem),
        totalTestCases: testCases.length,
      }),
    );
  },
);

router.get("/submissions/:id", requireUser, async (request, response) => {
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    response.status(404).json({ error: "Submission not found." });
    return;
  }
  const result = await submissionResponseById(
    id,
    response.locals.user as SessionUser,
  );
  if (!result) {
    response.status(404).json({ error: "Submission not found." });
    return;
  }
  response.json(GetSubmissionResponse.parse(result));
});

export default router;