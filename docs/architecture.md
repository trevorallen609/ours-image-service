# Architecture — Ours Privacy Image Processing Service

## Overview

Ours Privacy is a TypeScript-based image processing service consisting of an HTTP API and a browser-based playground. The API fetches remote images, validates requests, transforms images using Sharp, and returns the processed image bytes directly to the client.

The repository uses npm workspaces to organize the API and frontend while allowing them to be developed, tested, built, and deployed independently.

## Repository Structure

- `apps/api` — Express API, request validation, remote image fetching, image transformation, security controls, and API tests.
- `apps/web` — Next.js frontend for submitting image URLs and configuring transformations.
- `docs` — Architecture documentation and technical decisions.
- `.github/workflows` — Continuous integration workflows.

## System Components

### API

The API owns the image-processing workflow:

1. Validate query parameters using Zod.
2. Validate the remote image URL and enforce HTTPS.
3. Resolve the hostname and reject non-public IP addresses.
4. Pin outbound connections to validated IP addresses, where supported by the implementation, to reduce DNS-rebinding and SSRF risks.
5. Revalidate redirect destinations and enforce a redirect limit.
6. Enforce request timeouts and source-image size limits.
7. Decode, normalize image orientation, resize, and convert images using Sharp.
8. Return the processed bytes with the appropriate content type and response headers.

The API also applies HTTP security headers, CORS restrictions, and rate limiting, as configured.

### Frontend

The frontend consumes the image-processing API. Users provide an image URL and transformation options, and the frontend displays the processed result.

Remote image fetching and transformation are performed server-side. The frontend should use the API rather than independently fetching user-provided image URLs, which would bypass the API's validation and security controls.

### Image Processing

Sharp handles image decoding and transformation.

The supported output formats are JPEG, PNG, WebP, and AVIF. The API accepts configurable dimensions, quality, and resize-fit behavior, subject to input validation and configured limits.

The configured source-download limit is 10 MiB, and the configured Sharp input-pixel limit is 40 million pixels. Resizing is configured not to enlarge smaller images.

These limits help constrain memory consumption and processing costs. They should be validated against the current implementation and covered by regression tests.

## Request and Error Handling

The primary endpoint is `GET /api/image`. The `/health` endpoint provides a basic health check.

Expected error categories include:

- Invalid or missing parameters: client error.
- Unsafe or unsupported URLs: rejected before fetching.
- Oversized source images: payload-too-large response.
- Upstream fetch failures: gateway error.
- Upstream timeouts: gateway-timeout response.
- Invalid image data or transformation failures: safe error response.

Error responses should avoid exposing internal exception details, filesystem paths, or other sensitive implementation information.

## Security Considerations

Fetching user-provided URLs introduces server-side request forgery (SSRF), denial-of-service, and resource-exhaustion risks.

The API is designed to mitigate these risks through:

- HTTPS-only URLs, with credentials and nonstandard ports rejected.
- DNS resolution and rejection of non-public IP addresses.
- Outbound connection pinning to reduce DNS-rebinding risks.
- Redirect destination validation and a redirect-count limit.
- DNS-resolution and request timeouts.
- Maximum source-download size and image pixel limits.
- Input schema validation, rate limiting, and safe error responses.

These protections reduce risk but do not guarantee complete security. Basic rejection tests for localhost, loopback IP addresses, and unsupported protocols are useful regression checks, but they do not establish comprehensive SSRF protection.

Before public deployment, security testing should also cover:

- Private, loopback, link-local, and reserved IPv4 and IPv6 addresses.
- IPv4-mapped IPv6 addresses and mixed public/private DNS answers.
- DNS rebinding and redirects to unsafe destinations.
- Redirect loops and excessive redirect chains.
- DNS-resolution failures, upstream timeouts, and aborted responses.
- Oversized downloads, malformed image data, and decompression-related resource exhaustion.

Connection pinning, redirect validation, and IP-address classification should be verified against the actual networking implementation and tested automatically.

## Caching

Successful image responses are intended to use the following cache policy:

`Cache-Control: private, max-age=300`

This permits private caching for up to five minutes while discouraging shared-cache reuse. The actual response headers should be verified during API testing.

The cache policy should be revisited if authentication, sensitive images, or a shared caching layer is introduced.

## Data Storage

The initial architecture does not require a database. Requests are processed in memory, and transformed image bytes are returned directly to the client.

Persistent storage for source or transformed images is not required for the current feature set. Operational logging and monitoring should avoid unnecessarily recording sensitive image URLs or other user data.

## Deployment

The API and frontend are designed to deploy independently from the same repository.

Proposed deployment targets:

- **API:** Railway or another Node.js-compatible hosting provider.
- **Frontend:** Vercel or another Next.js-compatible hosting provider.

These are deployment options, not claims of an existing production deployment.

Production configuration should provide the correct frontend origin, API URL, and required environment variables. Deployment should follow successful type checking, tests, production builds, and security-focused regression checks.

## Engineering Trade-offs

- **Direct byte responses:** Avoid persistent image storage but require processing for each transformation request.
- **No database:** Simplifies the initial architecture and reduces operational overhead.
- **DNS pinning:** Helps prevent the destination address from changing between validation and connection, provided the connection uses the validated address.
- **Independent deployments:** Allow the frontend and API to scale and release separately.
- **Bounded processing:** Limits download size, image pixel count, request duration, and request rates to reduce resource-exhaustion risks.

## Future Improvements

Potential improvements include:

- Structured metrics, request tracing, and operational dashboards.
- Configurable concurrency limits and backpressure.
- Automated SSRF regression tests covering DNS resolution and redirects.
- Load testing and resource-exhaustion testing.
- A controlled caching layer for frequently requested transformations.
- Deployment automation and production health monitoring.
