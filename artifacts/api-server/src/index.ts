import app from "./app";
import { logger } from "./lib/logger";
import { seedCodeMasterProblems } from "./lib/codemaster-seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  await seedCodeMasterProblems();
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

start().catch((error: unknown) => {
  logger.error({ err: error }, "Unable to initialize CodeMaster");
  process.exit(1);
});
