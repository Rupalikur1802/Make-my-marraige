import "server-only";
import { AuthError } from "./errors";
import { ConfigurationError } from "@/lib/config.server";

type LoginStage =
  | "database_connection"
  | "authentication_indexes"
  | "rate_limit"
  | "account_lookup"
  | "password_verification"
  | "wedding_lookup"
  | "session_creation";

export class LoginDependencyError extends Error {
  constructor(public readonly stage: LoginStage) {
    super("Sign-in dependency unavailable.");
  }
}

export async function loginDependency<T>(
  stage: LoginStage,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AuthError || error instanceof ConfigurationError)
      throw error;
    // Deliberately discard raw driver/native errors, which may contain secrets.
    throw new LoginDependencyError(stage);
  }
}
