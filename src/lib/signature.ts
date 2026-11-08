import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { UserRole } from "@/lib/models";

function signatureSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getAuthorizerSignature(name: string, role?: UserRole): string | null {
  const directory = join(process.cwd(), "public", "signature");
  const namedFile = `${signatureSlug(name)}-signature.png`;
  if (name && existsSync(join(directory, namedFile))) return `/signature/${namedFile}`;

  // Keep the existing shared administrator signature working for old and new
  // Administrator accounts until named Administrator files are added.
  if (role === "Administrator" && existsSync(join(directory, "admin-signature.png"))) {
    return "/signature/admin-signature.png";
  }

  return null;
}
