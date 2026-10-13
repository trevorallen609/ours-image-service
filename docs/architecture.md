# Initial architecture notes

- `apps/api` owns validation, safe remote fetching, transformation, HTTP caching, and operational controls.
- `apps/web` is a normal public API consumer. It must not bypass the API for processing.
- API and UI deploy independently from one repository.
- No database is required for the initial feature set.
- Public deployment must wait until SSRF protections and resource limits are implemented and tested.
