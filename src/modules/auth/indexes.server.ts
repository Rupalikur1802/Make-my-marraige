import "server-only";
import type { Connection } from "mongoose";
import { authModels } from "./models.server";
import { weddingModel } from "@/modules/wedding/model.server";

const checked = new WeakMap<Connection, Promise<void>>();
export async function requireAuthIndexes(connection: Connection) {
  let promise = checked.get(connection);
  if (!promise) {
    promise = (async () => {
      const { Account, Session, RateLimit } = authModels(connection);
      const Wedding = weddingModel(connection);
      const requirements = [
        { model: Account, key: { emailNormalized: 1 }, unique: true },
        { model: Account, key: { weddingId: 1 }, unique: true },
        { model: Wedding, key: { ownerAccountId: 1 }, unique: true },
        { model: Session, key: { tokenHash: 1 }, unique: true },
        { model: Session, key: { expiresAt: 1 }, ttl: 0 },
        { model: RateLimit, key: { keyHash: 1 }, unique: true },
        { model: RateLimit, key: { windowEndsAt: 1 }, ttl: 0 },
      ];
      for (const requirement of requirements) {
        const indexes = await requirement.model.collection
          .listIndexes()
          .toArray();
        const exists = indexes.some(
          (index) =>
            JSON.stringify(index.key) === JSON.stringify(requirement.key) &&
            (!requirement.unique || index.unique === true) &&
            (requirement.ttl === undefined ||
              index.expireAfterSeconds === requirement.ttl),
        );
        if (!exists)
          throw new Error("Authentication indexes are not installed.");
      }
    })().catch((error) => {
      checked.delete(connection);
      throw error;
    });
    checked.set(connection, promise);
  }
  await promise;
}
