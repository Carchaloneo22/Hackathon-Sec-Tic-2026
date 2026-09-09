import { Router } from "express";
import { checkCredentials } from "../services/auth.js";

const router = Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "username y password son requeridos" });
  }

  if (!checkCredentials(username, password)) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  return res.json({ ok: true });
});

export default router;
