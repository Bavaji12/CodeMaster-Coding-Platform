import app from "./app";
import { logger } from "./lib/logger";
import { seedCodeMasterProblems } from "./lib/codemaster-seed";

const rawPort = process.env["PORT"] || "10000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  // Start listening FIRST so Render detects the service.
  app.listen(port, "0.0.0.0", async () => {
    logger.info({ port }, "Server listening");

    // Seed after the server is available.
    try {
      await seedCodeMasterProblems();
      logger.info("CodeMaster problems seeded successfully");
    } catch (error: unknown) {
      logger.error(
        { err: error },
        "Unable to seed CodeMaster problems",
      );

      // Keep the server alive so Render can reach the service.
      // The database issue can be fixed without causing a port timeout.
    }
  });
}

start().catch((error: unknown) => {
  logger.error({ err: error }, "Unable to initialize CodeMaster");
  process.exit(1);
});