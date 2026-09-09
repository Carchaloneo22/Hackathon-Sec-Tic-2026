import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import searchRouter from "./routes/search.js";
import expandRouter from "./routes/expand.js";
import detailRouter from "./routes/detail.js";
import casesRouter from "./routes/cases.js";
import { USE_MOCK_DATA } from "./services/data-source.js";
import { requireAuth } from "./services/auth.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", mode: USE_MOCK_DATA ? "mock" : "live" })
);
app.use("/api/auth", authRouter);
app.use("/api/search", requireAuth, searchRouter);
app.use("/api/expand", requireAuth, expandRouter);
app.use("/api/detail", requireAuth, detailRouter);
app.use("/api/cases", requireAuth, casesRouter);

app.listen(PORT, () => {
  console.log(`[trazo-backend] escuchando en http://localhost:${PORT}`);
  if (USE_MOCK_DATA) {
    console.log(
      "[trazo-backend] modo MOCK activo (sin CROMA_API_KEY real) — sirviendo datos de prueba. Buscá 'BIDFOR', 'Constructora Horizonte' o 'Tecno Insumos' como proveedor, o 'Medellín', 'Bogotá' o 'Antioquia' como entidad."
    );
  } else {
    console.log("[trazo-backend] modo LIVE activo — consultando Croma en tiempo real.");
  }
});
