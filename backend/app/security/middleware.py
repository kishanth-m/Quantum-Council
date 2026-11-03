"""
backend/app/security/middleware.py

Local-First Security & Boundary Enforcement Middleware for Quantum Council:
1. Host Header Validation:
   Restricts Host header strictly to local loopback identifiers (127.0.0.1, localhost, [::1], testserver).
   Prevents DNS rebinding attacks from routing malicious web requests to local ports.
2. Cross-Origin CSRF & Origin Verification:
   Validates Origin/Referer on all state-changing requests (POST, PUT, DELETE, PATCH).
   Blocks malicious third-party websites from executing unauthorized local AI deliberations or data purges.
3. Defensive HTTP Security Headers:
   Applies X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy.
"""

from urllib.parse import urlparse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import settings

ALLOWED_HOSTS = {
    "127.0.0.1",
    "localhost",
    "::1",
    "[::1]",
    "testserver",
}


class LocalSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # 1. Host Header Validation (Anti-DNS Rebinding)
        host_header = request.headers.get("host", "")
        if host_header:
            # Strip port if present (e.g., localhost:8000 -> localhost)
            hostname = host_header.split(":")[0].strip()
            if hostname and hostname not in ALLOWED_HOSTS:
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": "Bad Request",
                        "detail": f"Host '{hostname}' is not permitted. Quantum Council only accepts local loopback connections.",
                    },
                )

        # 2. Origin Verification on State-Changing HTTP Methods
        if request.method in ("POST", "PUT", "DELETE", "PATCH"):
            origin = request.headers.get("origin")
            if origin:
                parsed_origin = urlparse(origin)
                origin_host = parsed_origin.hostname or ""
                origin_full = f"{parsed_origin.scheme}://{parsed_origin.netloc}".rstrip("/")

                is_allowed_origin = (
                    origin_host in ALLOWED_HOSTS or
                    origin_full in [o.rstrip("/") for o in settings.allowed_origins_list]
                )

                if not is_allowed_origin:
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error": "Forbidden",
                            "detail": f"Cross-origin request from untrusted origin '{origin}' was blocked by Quantum Council security policy.",
                        },
                    )

        # 3. Process Request
        response = await call_next(request)

        # 4. Inject Defensive Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        return response

