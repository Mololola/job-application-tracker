import crypto from "crypto";
import { requiredEnv } from "@/lib/env";

function getKey(): Buffer {
  const secret = requiredEnv("APP_SECRET");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptText(plainText?: string | null): string | null {
  if (!plainText) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptText(payload?: string | null): string | null {
  if (!payload) return null;

  const [ivBase64, tagBase64, encryptedBase64] = payload.split(":");
  if (!ivBase64 || !tagBase64 || !encryptedBase64) return null;

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}
