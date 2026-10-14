import { Router } from "express";
import { imageQuerySchema } from "../services/image-schema.js";
import {
  fetchRemoteImage,
  RemoteImageError,
} from "../services/remote-image.js";
import { transformImage } from "../services/image-service.js";

export const imageRouter = Router();

const knownErrors: Record<string, { status: number; message: string }> = {
  INVALID_IMAGE_URL: {
    status: 400,
    message: "Provide a valid HTTPS image URL.",
  },
  UNSAFE_IMAGE_HOST: {
    status: 400,
    message: "The requested image host is not allowed.",
  },
  IMAGE_TOO_LARGE: {
    status: 413,
    message: "The source image exceeds the allowed size.",
  },
  SOURCE_IMAGE_TOO_LARGE: {
    status: 413,
    message: "The source image exceeds the allowed size.",
  },
  IMAGE_FETCH_TIMEOUT: {
    status: 504,
    message: "The source image request timed out.",
  },
  IMAGE_FETCH_FAILED: {
    status: 502,
    message: "The source image could not be retrieved.",
  },
};

imageRouter.get("/", async (req, res) => {
  const parsed = imageQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "INVALID_QUERY",
        message: "The image URL or transformation options are invalid.",
      },
    });
    return;
  }

  try {
    const source = await fetchRemoteImage(parsed.data.url);
    const result = await transformImage(source, parsed.data);

    res
      .status(200)
      .set("Content-Type", result.contentType)
      .set("Cache-Control", "private, max-age=300")
      .set("X-Content-Type-Options", "nosniff")
      .send(result.data);
  } catch (error) {
    if (error instanceof RemoteImageError) {
      const known = knownErrors[error.code];

      if (known) {
        res.status(known.status).json({
          error: {
            code: error.code,
            message: known.message,
          },
        });
        return;
      }
    }

    // Log stable metadata only; never log the URL or raw exception message.
    console.error(
      JSON.stringify({
        level: "error",
        message: "image_processing_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );

    res.status(422).json({
      error: {
        code: "IMAGE_PROCESSING_FAILED",
        message: "The source could not be processed as an image.",
      },
    });
  }
});
