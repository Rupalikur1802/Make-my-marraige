import "server-only";
import {
  Schema,
  type Connection,
  type InferSchemaType,
  type Model,
} from "mongoose";
import { AuthError } from "@/modules/auth/errors";
const options = {
  strict: "throw" as const,
  versionKey: false as const,
  autoCreate: false,
  autoIndex: false,
  timestamps: true,
};
const photoSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    requestKey: { type: String, required: true },
    payloadHash: { type: String, required: true },
    principalKey: { type: String, required: true },
    filename: { type: String, required: true },
    uploadedBy: { type: String, enum: ["Couple", "Guest"], required: true },
    state: {
      type: String,
      enum: ["pending", "ready", "deleting", "deleted"],
      required: true,
    },
    publicId: { type: String, required: true },
    storageScope: { type: String, required: true },
    signedAt: { type: Number, required: true },
    cleanupAfter: { type: Date, required: true },
    cleaned: { type: Boolean, default: false, required: true },
    leaseUntil: Date,
    leaseKey: String,
    width: Number,
    height: Number,
    format: String,
    providerVersion: Number,
  },
  options,
);
photoSchema.index({ weddingId: 1, requestKey: 1 }, { unique: true });
photoSchema.index({ weddingId: 1, state: 1, _id: -1 });
photoSchema.index({ storageScope: 1, state: 1, cleaned: 1, cleanupAfter: 1 });
const gallerySchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    guestAccess: { type: Boolean, default: true, required: true },
    settingsVersion: { type: Number, default: 0, required: true },
    revision: { type: Number, default: 0, required: true },
    reservedBytes: { type: Number, default: 0, required: true },
  },
  options,
);
const usageSchema = new Schema(
  {
    _id: { type: String, required: true },
    reservedBytes: { type: Number, default: 0, required: true },
  },
  options,
);
const rateSchema = new Schema(
  {
    _id: { type: String, required: true },
    count: { type: Number, default: 0, required: true },
    expiresAt: { type: Date, required: true },
  },
  options,
);
rateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
function model<T>(
  c: Connection,
  name: string,
  schema: Schema<T>,
  collection: string,
): Model<T> {
  return (
    (c.models[name] as Model<T> | undefined) ??
    c.model<T>(name, schema, collection)
  );
}
export type PhotoRecord = InferSchemaType<typeof photoSchema> & {
  createdAt: Date;
  updatedAt: Date;
};
export function photoModels(c: Connection) {
  return {
    Photo: model(c, "Photo", photoSchema, "photos"),
    Gallery: model(c, "PhotoGallery", gallerySchema, "photoGalleries"),
    Usage: model(c, "PhotoUsage", usageSchema, "photoUsage"),
    Rate: model(c, "PhotoRate", rateSchema, "photoRates"),
  };
}
export async function requirePhotoIndexes(c: Connection) {
  try {
    const { Photo, Gallery, Usage, Rate } = photoModels(c);
    for (const m of [Photo, Gallery, Usage, Rate]) await m.collection.indexes();
    const indexes = await Photo.collection.indexes();
    if (
      !indexes.some(
        (i) =>
          i.unique &&
          i.key.weddingId === 1 &&
          i.key.requestKey === 1 &&
          Object.keys(i.key).length === 2,
      )
    )
      throw Error();
  } catch {
    throw new AuthError(
      "PHOTO_SETUP_REQUIRED",
      503,
      "Photos need database setup. The administrator must install the application indexes.",
    );
  }
}
