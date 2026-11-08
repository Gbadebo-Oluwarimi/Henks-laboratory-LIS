import { randomBytes, scrypt, scryptSync, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scryptAsync = (
  password: string,
  salt: string,
  length: number,
  options: ScryptOptions,
) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
const keyLength = 64;
const cost = 16384;
const blockSize = 8;
const parallelization = 1;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scryptAsync(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
  })) as Buffer;
  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt}$${derivedKey.toString("base64url")}`;
}

export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = scryptSync(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
  });
  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, costText, blockSizeText, parallelizationText, salt, expectedText] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedText) return false;
  const parameters = [Number(costText), Number(blockSizeText), Number(parallelizationText)];
  if (parameters.some((value) => !Number.isInteger(value) || value <= 0)) return false;

  const expected = Buffer.from(expectedText, "base64url");
  if (expected.length !== keyLength) return false;
  const actual = (await scryptAsync(password, salt, keyLength, {
    N: parameters[0],
    r: parameters[1],
    p: parameters[2],
  })) as Buffer;
  return timingSafeEqual(actual, expected);
}