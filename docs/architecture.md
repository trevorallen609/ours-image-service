# Architecture — Ours Privacy Image Processing Service

## Overview

Ours Privacy is a TypeScript-based image processing service with an HTTP API and a browser-based playground. The API fetches remote images securely, transforms them using Sharp, and returns the processed image directly to the client.

The repository uses npm workspaces to keep the API and frontend together while allowing them to be developed, tested, built, and deployed independently.

## Repository Structure

- `apps/api` — Express API, request validation, remote image fetching, image transformation, security controls, and API tests.
- `apps/web` — Next.js frontend for submitting image URLs and configuring transformations.
- `docs` — Architecture notes and technical decisions.
- `.github/workflows` — Continuous integration workflows.

## System Components

### API

The API owns the complete image-processing workflow:

1. Validate query parameters using Zod.
2. Validate the remote image URL and require HTTPS.
3. Resolve the hostname and reject unsafe IP addresses.
4. Pin the outbound connection to a validated IP address to reduce DNS-rebinding and SSRF risks.
5. Follow redirects only after revalidating the destination.
6. Enforce request timeouts and a maximum source image size.
7. Decode, normalize orientation, resize, and convert the image using Sharp.
8. Return the processed bytes with the appropriate content type and response headers.

The API also applies HTTP security headers, CORS restrictions, and rate limiting.

### Frontend

The frontend is a normal consumer of the public API. It sends image URLs and transformation options to the API and displays the returned image.

Image fetching and processing remain server-side. The frontend must not bypass the API by fetching and transforming remote images directly.

### Image Processing

Sharp handles image decoding and transformation.

Supported output formats are JPEG, PNG, WebP, and AVIF. The API supports configurable dimensions, quality, and resize-fit behavior, with validation limits to prevent unreasonable requests.

The service limits source downloads to 10 MiB and configures Sharp with a 40-million-pixel input limit. Resizing does not enlarge smaller images.

## Request and Error Handling

The primary endpoint is `GET /api/image`. The `/health` endpoint provides a basic health check.

Invalid query parameters return a client error. Unsafe URLs are rejected, oversized sources return a payload-too-large response, upstream fetch failures return a gateway error, and upstream timeouts return a gateway-timeout response.

Image decoding or transformation failures return a safe error response without exposing internal exception details or filesystem paths.

## Security Considerations

Fetching user-provided URLs creates server-side request forgery (SSRF) and resource-exhaustion risks.

The API mitigates these risks through:

- HTTPS-only URLs, with credentials and nonstandard ports rejected.
- DNS resolution and rejection of non-public IP addresses.
- Connection pinning to the validated address.
- Redirect destination validation and a redirect-count limit.
- DNS and request timeouts.
- Maximum download size and image pixel limits.
- Input schema validation, rate limiting, and safe error responses.

These protections reduce risk but do not guarantee complete security. The implementation should be reviewed and tested against private and reserved IP ranges, IPv4-mapped IPv6 addresses, mixed DNS answers, redirect-based SSRF, timeouts, aborted responses, and oversized downloads before public deployment.

## Caching

Successful image responses include:

`Cache-Control: private, max-age=300`

This allows private client-side caching for five minutes without explicitly permitting shared-cache reuse. Cache policy should be revisited if the service introduces authentication, sensitive images, or a shared caching layer.

## Data Storage

No database is required for the initial feature set. Requests are processed in memory, and transformed image bytes are returned directly to the client.

The service does not require persistent storage for source or transformed images.

## Deployment

The API and frontend are designed to deploy independently from the same repository.

The current deployment plan is:

- API: Railway or another Node.js-compatible hosting provider.
- Frontend: Vercel or another Next.js-compatible hosting provider.

Production configuration must provide the correct frontend origin, API URL, and runtime environment variables. Deployment should follow successful type checking, tests, builds, and security-focused regression checks.

## Engineering Trade-offs

- **Direct byte responses:** Avoids the need for persistent image storage but requires each transformation request to perform processing.
- **No database:** Keeps the initial architecture simple and reduces operational overhead.
- **DNS pinning:** Helps prevent hostname resolution from changing between validation and connection.
- **Independent deployments:** Allows the frontend and API to scale and release separately.
- **Bounded processing:** Limits download size, pixel count, timeouts, and request rates to reduce resource-exhaustion risk.

## Future Improvements

Potential improvements include structured metrics, request tracing, configurable concurrency limits, load testing, and a controlled caching layer for frequently requested transformations.
