// Gate simple de usuario/contraseña para toda la API — credenciales fijas en
// TRAZO_USERNAME/TRAZO_PASSWORD (env), sin base de datos de usuarios ni sesiones.
// El frontend reenvía las mismas credenciales como Basic Auth en cada request, así
// que la verificación es puramente stateless en el backend.

import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.TRAZO_USERNAME ?? "";
  const expectedPass = process.env.TRAZO_PASSWORD ?? "";
  if (!expectedUser || !expectedPass) return false;
  return safeEqual(username, expectedUser) && safeEqual(password, expectedPass);
}

function parseBasicAuth(header: string | undefined): { username: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf-8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) return null;
    return { username: decoded.slice(0, separatorIndex), password: decoded.slice(separatorIndex + 1) };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const credentials = parseBasicAuth(req.header("authorization"));
  if (!credentials || !checkCredentials(credentials.username, credentials.password)) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  next();
}
