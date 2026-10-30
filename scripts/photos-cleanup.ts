import "server-only";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { databaseConfig } from "../src/lib/config.server";
import { disconnectDatabase } from "../src/lib/db.server";
import { cleanupPhotoUploads } from "../src/modules/photos/service.server";
async function main() {
  const production = process.argv.includes("--production");
  if (!production && existsSync(".env.local")) loadEnvFile(".env.local");
  const development = /^mmm_(dev|test)(_|$)/.test(databaseConfig().name);
  if (
    production
      ? development ||
        process.env.NODE_ENV !== "production" ||
        process.env.VERCEL_ENV !== "production"
      : !development
  )
    throw Error(
      "Cleanup environment does not match the explicit operator target",
    );
  const result = await cleanupPhotoUploads();
  console.log(JSON.stringify(result));
}
main()
  .catch(() => {
    console.error(
      "Photo cleanup failed. Check the selected environment configuration; no private details are printed.",
    );
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
