import "server-only";
import { createInterface, emitKeypressEvents } from "node:readline";
import { stdin, stdout } from "node:process";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { disconnectDatabase } from "../src/lib/db.server";
import { databaseConfig } from "../src/lib/config.server";
import {
  ensureAuthIndexes,
  provisionCouple,
} from "../src/modules/auth/provision.server";

function question(prompt: string) {
  return new Promise<string>((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
function secretQuestion(prompt: string) {
  return new Promise<string>((resolve, reject) => {
    stdout.write(prompt);
    emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    const chars: string[] = [];
    function finish(error?: Error) {
      stdin.off("keypress", onKey);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(chars.join(""));
    }
    function onKey(
      text: string | undefined,
      key: { name?: string; ctrl?: boolean },
    ) {
      if (key.ctrl && key.name === "c") return finish(new Error("Cancelled"));
      if (key.name === "return") return finish();
      if (key.name === "backspace") {
        chars.pop();
        return;
      }
      if (
        text &&
        !key.ctrl &&
        !text.includes("\u001b") &&
        !/[\r\n\u0000-\u001f]/.test(text)
      )
        chars.push(text);
    }
    stdin.on("keypress", onKey);
  });
}
async function main() {
  // Operators explicitly invoke these commands. They never run on app startup.
  if (existsSync(".env.local")) loadEnvFile(".env.local");
  const operation = process.argv[2];
  if (!["indexes", "provision"].includes(operation ?? ""))
    throw new Error("Unknown operator command");
  const { name } = databaseConfig();
  if (!/^mmm_(dev|test)(_|$)/.test(name))
    throw new Error(
      "Operator commands are limited to mmm_dev/mmm_test databases.",
    );
  if (operation === "indexes") {
    await ensureAuthIndexes();
    console.log(
      "Application indexes ensured without dropping indexes or data.",
    );
    return;
  }
  if (!stdin.isTTY || !stdout.isTTY)
    throw new Error(
      "Provisioning requires an interactive terminal; do not pass passwords as arguments.",
    );
  console.log(
    `Provisioning one shared couple account in development database: ${name}`,
  );
  const email = await question("Shared account email: ");
  const password = await secretQuestion(
    "Password (12–128 characters, input hidden): ",
  );
  const confirmation = await secretQuestion(
    "Confirm password (input hidden): ",
  );
  if (password !== confirmation) throw new Error("Passwords do not match.");
  // Run index setup first, explicitly, to enforce reciprocal ownership uniqueness.
  const result = await provisionCouple(email, password);
  console.log(
    `Created account ${result.accountId} and wedding shell ${result.weddingId}.`,
  );
}
main()
  .catch(() => {
    console.error(
      "Operator command failed. Check development configuration, applied indexes, unique email, and password requirements. No credentials are printed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase().catch(() => undefined);
  });
