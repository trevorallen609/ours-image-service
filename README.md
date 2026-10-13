# Ours Privacy — Image Processing Service

A TypeScript-based image transformation API and browser-based playground built for the Ours Privacy Senior Platform Engineer take-home challenge.

The service fetches remote images over HTTPS, validates and transforms them using Sharp, and returns the resulting image bytes directly to the client.

## Features

- **Image transformations:** resize, rotate based on image orientation, and convert between JPEG, PNG, WebP, and AVIF.
- **Configurable output:** width, height, fit mode, format, and quality.
- **Input validation:** validates URL and transformation parameters before processing.
- **SSRF defenses:** validates remote destinations, rejects unsafe IP addresses, pins HTTPS connections to validated IPs, and revalidates redirect destinations.
- **Resource limits:** limits source downloads to 10 MiB, decoded image dimensions to 40 million pixels, and remote DNS/HTTP request durations.
- **API hardening:** Helmet security headers, CORS configuration, rate limiting, and safe error responses.
- **Automated tests:** API tests using Vitest and Supertest.

## Repository structure

```text
apps/
  api/       Express + TypeScript API
  web/       Next.js + TypeScript playground
.github/
  workflows/ CI workflows
docs/        Design notes and operational decisions
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer

## Local development

1. Clone the repository and navigate to the project root.

2. Create your local environment file from the provided example, if required:

   ```bash
   cp .env.example .env
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the API and web application:

   ```bash
   npm run dev
   ```

5. Open the web application at `http://localhost:3000`. Check the API startup output or local configuration for its actual port.

If you want to run either application independently:

```bash
npm run dev:api
npm run dev:web
```

## Available scripts

Run these commands from the repository root.

| Command             | Description                        |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Start the API and web applications |
| `npm run dev:api`   | Start the API only                 |
| `npm run dev:web`   | Start the web application only     |
| `npm run build`     | Build both applications            |
| `npm test`          | Run API tests                      |
| `npm run typecheck` | Type-check both applications       |

## API reference

### `GET /health`

Health-check endpoint.

```bash
curl -i http://localhost:4000/health
```

Replace port `4000` with the configured API port if different.

### `GET /api/image`

Fetches a remote image, applies the requested transformations, and returns the resulting image bytes.

**Required parameter**

| Parameter | Description                            |
| --------- | -------------------------------------- |
| `url`     | Absolute HTTPS URL of the source image |

**Optional parameters**

| Parameter | Accepted values                                 | Default       |
| --------- | ----------------------------------------------- | ------------- |
| `width`   | Integer from 1 to 2048                          | Not specified |
| `height`  | Integer from 1 to 2048                          | Not specified |
| `format`  | `jpeg`, `png`, `webp`, `avif`                   | `webp`        |
| `quality` | Integer from 1 to 100                           | `80`          |
| `fit`     | `cover`, `contain`, `fill`, `inside`, `outside` | `cover`       |

Resizing is configured not to enlarge images beyond their original dimensions. Actual output dimensions depend on the requested size, fit mode, and source aspect ratio.

**Example: convert and resize to WebP**

```bash
curl -G "http://localhost:4000/api/image" \
  --data-urlencode "url=https://example.com/image.jpg" \
  --data-urlencode "width=800" \
  --data-urlencode "height=600" \
  --data-urlencode "format=webp" \
  --data-urlencode "quality=80" \
  -o output.webp
```

Replace the example source URL with an accessible HTTPS image URL. The output file is written to the current directory.

### Response behavior

Successful requests return the transformed image bytes with the corresponding image content type and security headers.

| Status | Error code                | Meaning                                           |
| ------ | ------------------------- | ------------------------------------------------- |
| `200`  | —                         | Image transformed successfully                    |
| `400`  | `INVALID_QUERY`           | Invalid query parameters                          |
| `400`  | `INVALID_IMAGE_URL`       | Invalid or unsupported source URL                 |
| `400`  | `UNSAFE_IMAGE_HOST`       | Destination rejected by host/IP validation        |
| `413`  | `IMAGE_TOO_LARGE`         | Source exceeds the download-size limit            |
| `413`  | `SOURCE_IMAGE_TOO_LARGE`  | Decoded source exceeds the image-processing limit |
| `422`  | `IMAGE_PROCESSING_FAILED` | Source could not be processed as an image         |
| `502`  | `IMAGE_FETCH_FAILED`      | Remote image could not be retrieved               |
| `504`  | `IMAGE_FETCH_TIMEOUT`     | Remote image request timed out                    |

Error responses use a JSON object containing an error code and a safe message.

## Security considerations

Fetching user-supplied URLs introduces server-side request forgery (SSRF), resource-exhaustion, and malformed-input risks.

The implementation includes the following safeguards:

- Requires HTTPS and rejects URL credentials and nonstandard ports.
- Resolves hostnames and rejects destinations that fail public-IP validation.
- Pins the HTTPS connection to the validated address to reduce DNS-rebinding risk.
- Validates each redirect destination and limits redirect hops.
- Enforces a 10 MiB response limit and remote request timeouts.
- Uses Sharp pixel limits to constrain decoded image processing.
- Validates transformation parameters before processing.
- Applies rate limiting and security headers.
- Returns sanitized errors rather than exposing raw internal exception messages.

These controls reduce risk but do not, by themselves, establish that the service is safe for unrestricted public exposure. Security tests, deployment configuration, and runtime behavior should be reviewed before production use.

## Caching

Successful image responses use a private cache policy with a five-minute maximum age. This allows client-side caching without explicitly authorizing shared-cache storage.

## Testing and verification

Run the complete local checks:

```bash
npm run typecheck
npm test
npm run build
```

Security regression tests should cover unsafe IPv4 and IPv6 addresses, mixed DNS answers, redirect validation, connection pinning, timeouts, oversized responses, aborted downloads, and malformed image data.

Passing the automated suite is useful evidence, but it does not replace deployment-level security review.

## Architecture and trade-offs

The API and UI live in a single npm-workspaces repository but can be deployed independently.

The API returns transformed image bytes directly, keeping the interface simple for both the browser playground and other HTTP clients. Sharp handles image processing, while explicit validation and resource limits constrain untrusted inputs.

The service currently processes images synchronously during the request. A production deployment should account for concurrency, rate limits, memory usage, caching behavior, and upstream availability.

## Deployment

The intended deployment is:

- **API:** Railway
- **Web application:** Vercel

Deployment URLs and instructions should be added once deployment is configured and verified.
