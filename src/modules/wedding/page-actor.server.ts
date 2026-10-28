import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { coupleCookie } from "@/lib/config.server";
import { resolveCoupleSession } from "@/modules/auth/service.server";
export async function pageCouple() {
  let actor;
  try {
    actor = await resolveCoupleSession(
      (await cookies()).get(coupleCookie().name)?.value,
    );
  } catch {
    return undefined;
  }
  if (!actor) redirect("/login");
  return actor;
}
