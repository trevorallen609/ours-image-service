import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { imageRouter } from "./routes/image.js";

export function createApp() {
  const app = express();
  const allowedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

  app.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(cors({ origin: allowedOrigin }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 60,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/image", imageRouter);
  app.get("/", (_req, res) => {
    res.json({
      service: "ours-image-service",
      status: "scaffold",
      docs: "README.md",
    });
  });

  return app;
}
