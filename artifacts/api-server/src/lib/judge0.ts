export type CodeLanguage = "javascript" | "python" | "java" | "cpp";

export type JudgeResult = {
  statusId: number;
  status: string;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  runtime: number | null;
  memory: number | null;
};

const LANGUAGE_IDS: Record<CodeLanguage, number> = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54,
};

const DEFAULT_JUDGE_URL = "https://ce.judge0.com";

export async function runInSandbox(
  code: string,
  language: CodeLanguage,
  input: string,
): Promise<JudgeResult> {
  const baseUrl = (process.env.JUDGE0_API_URL || DEFAULT_JUDGE_URL).replace(
    /\/+$/,
    "",
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const apiKey = process.env.JUDGE0_API_KEY;
    if (apiKey) {
      headers[process.env.JUDGE0_AUTH_HEADER || "X-Auth-Token"] = apiKey;
    }

    const response = await fetch(
      `${baseUrl}/submissions?base64_encoded=false&wait=true`,
      {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          source_code: code,
          language_id: LANGUAGE_IDS[language],
          stdin: input,
          cpu_time_limit: 2,
          cpu_extra_time: 1,
          wall_time_limit: 5,
          memory_limit: 131072,
          max_processes_and_or_threads: 20,
          enable_network: false,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("The code runner is busy. Try again in a moment.");
      }
      throw new Error(`The code runner returned status ${response.status}.`);
    }

    const result = (await response.json()) as {
      status?: { id?: number; description?: string };
      stdout?: string | null;
      stderr?: string | null;
      compile_output?: string | null;
      time?: string | null;
      memory?: number | null;
    };
    if (!result.status?.id || !result.status.description) {
      throw new Error("The code runner returned an incomplete response.");
    }

    return {
      statusId: result.status.id,
      status: result.status.description,
      stdout: result.stdout ?? null,
      stderr: result.stderr ?? null,
      compileOutput: result.compile_output ?? null,
      runtime: result.time === null || result.time === undefined
        ? null
        : Number(result.time),
      memory: result.memory ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The code runner took too long to respond.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizedOutput(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

export function statusFromJudge(result: JudgeResult): string {
  if (result.statusId === 3) return "Accepted";
  if (result.statusId === 5 || result.status.toLowerCase().includes("time limit")) {
    return "Time Limit Exceeded";
  }
  if (result.statusId === 6 || result.status.toLowerCase().includes("compilation")) {
    return "Compilation Error";
  }
  if (result.statusId === 13) return "Internal Error";
  return "Runtime Error";
}