import "server-only";
import mongoose, { type Connection } from "mongoose";
import { databaseConfig } from "./config.server";

type ConnectionCache = { promise?: Promise<Connection> };
const globalDb = globalThis as typeof globalThis & {
  marriageDb?: ConnectionCache;
};
const cache = (globalDb.marriageDb ??= {});

export async function connectDatabase() {
  if (!cache.promise) {
    const { uri, name } = databaseConfig();
    const connection = mongoose.createConnection(uri, {
      dbName: name,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      autoIndex: false,
      autoCreate: false,
      bufferCommands: false,
    });
    cache.promise = connection.asPromise().catch(async () => {
      cache.promise = undefined;
      await connection.close().catch(() => undefined);
      throw new Error("Database unavailable");
    });
  }
  return cache.promise;
}
export async function disconnectDatabase() {
  const pending = cache.promise;
  cache.promise = undefined;
  if (pending) await (await pending).close();
}
