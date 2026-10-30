import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { AuthError } from "@/modules/auth/errors";
import { MAX_PHOTO_BYTES, PHOTO_RESERVATION } from "./validation";
export const THUMB = "c_fill,h_600,w_600,q_auto,f_jpg";
export const LARGE = "c_limit,h_2000,w_2000,q_auto,f_jpg";
export const INCOMING = "c_limit,h_4096,w_4096/fl_strip_profile";
export function photoConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME,
    apiKey = process.env.CLOUDINARY_API_KEY,
    apiSecret = process.env.CLOUDINARY_API_SECRET;
  const prefix = process.env.CLOUDINARY_PHOTO_PREFIX;
  if (
    !cloudName ||
    !/^[a-zA-Z0-9_-]+$/.test(cloudName) ||
    !apiKey ||
    !apiSecret ||
    !prefix ||
    !/^mmm_(dev|test|prod)_[a-z0-9_-]{3,60}$/.test(prefix)
  )
    throw new AuthError(
      "PHOTO_CONFIGURATION_REQUIRED",
      503,
      "Photos are temporarily unavailable. Please try again later.",
    );
  const production = process.env.VERCEL_ENV === "production";
  if (
    (production && !prefix.startsWith("mmm_prod_")) ||
    (!production && prefix.startsWith("mmm_prod_"))
  )
    throw new AuthError(
      "PHOTO_CONFIGURATION_REQUIRED",
      503,
      "Photos are temporarily unavailable. Please try again later.",
    );
  return {
    cloudName,
    apiKey,
    apiSecret,
    prefix,
    scope: cloudName + ":" + prefix,
  };
}
function options() {
  const c = photoConfig();
  return {
    cloud_name: c.cloudName,
    api_key: c.apiKey,
    api_secret: c.apiSecret,
    secure: true,
    timeout: 25000,
  };
}
export function signPhotoUpload(publicId: string, timestamp: number) {
  const c = photoConfig();
  const params = {
    public_id: publicId,
    timestamp,
    type: "authenticated",
    overwrite: false,
    allowed_formats: "jpg,jpeg,png,webp",
    transformation: INCOMING,
    eager: THUMB + "|" + LARGE,
    eager_async: false,
  };
  return {
    endpoint: `https://api.cloudinary.com/v1_1/${c.cloudName}/image/upload`,
    fields: {
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ),
      api_key: c.apiKey,
      signature: cloudinary.utils.api_sign_request(params, c.apiSecret),
    } as Record<string, string>,
  };
}
const resourceSchema = z.object({
  public_id: z.string(),
  type: z.literal("authenticated"),
  resource_type: z.literal("image"),
  format: z.enum(["jpg", "png", "webp"]),
  bytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
  width: z.number().int().positive().max(4096),
  height: z.number().int().positive().max(4096),
  version: z.number().int().positive(),
  pages: z.literal(1).optional(),
  derived: z
    .array(
      z.object({
        transformation: z.string(),
        bytes: z.number().int().positive(),
        format: z.literal("jpg"),
      }),
    )
    .max(10),
});
export function validateProviderPhoto(input: unknown, publicId: string) {
  const parsed = resourceSchema.safeParse(input);
  if (!parsed.success)
    throw new AuthError(
      "INVALID_PHOTO",
      422,
      "This file could not be added. Choose a still JPEG, PNG or WebP photo up to 10 MB.",
    );
  const value = parsed.data,
    derivatives = value.derived;
  const valid =
    value.public_id === publicId &&
    value.type === "authenticated" &&
    value.resource_type === "image" &&
    ["jpg", "png", "webp"].includes(value.format) &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes > 0 &&
    value.bytes <= MAX_PHOTO_BYTES &&
    Number.isSafeInteger(value.width) &&
    value.width > 0 &&
    value.width <= 4096 &&
    Number.isSafeInteger(value.height) &&
    value.height > 0 &&
    value.height <= 4096 &&
    (!value.pages || value.pages === 1) &&
    derivatives &&
    [THUMB, LARGE].every((t) =>
      derivatives.some(
        (d) =>
          d.transformation === t &&
          d.format === "jpg" &&
          Number.isSafeInteger(d.bytes) &&
          d.bytes > 0,
      ),
    ) &&
    value.bytes + derivatives.reduce((s, d) => s + d.bytes, 0) <=
      PHOTO_RESERVATION;
  if (!valid)
    throw new AuthError(
      "INVALID_PHOTO",
      422,
      "This file could not be added. Choose a still JPEG, PNG or WebP photo up to 10 MB.",
    );
  return {
    width: value.width,
    height: value.height,
    format: value.format,
    providerVersion: value.version,
  };
}
export const photoProvider = {
  async inspect(publicId: string) {
    const value = await cloudinary.api.resource(publicId, {
      ...options(),
      resource_type: "image",
      type: "authenticated",
      max_results: 10,
    });
    return validateProviderPhoto(value, publicId);
  },
  async remove(publicId: string) {
    const result = await cloudinary.uploader.destroy(publicId, {
      ...options(),
      resource_type: "image",
      type: "authenticated",
      invalidate: true,
    });
    if (!["ok", "not found"].includes(result.result))
      throw Error("Provider deletion incomplete");
  },
  async image(publicId: string, version: number, large: boolean) {
    // Never return permanent signed CDN URLs to browsers or image optimizers.
    const url = cloudinary.url(publicId + ".jpg", {
      ...options(),
      type: "authenticated",
      resource_type: "image",
      version,
      sign_url: true,
      raw_transformation: large ? LARGE : THUMB,
    });
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(25000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/jpeg")
    )
      throw Error("Photo unavailable");
    return response;
  },
};
