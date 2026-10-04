"""HTTP boundary, lifespan and dependency-aware readiness."""

from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from .campus import load_campus
from .config import Settings
from .errors import RoutingError
from .graphhopper import GraphHopperClient
from .models import RouteRequest, RouteResponse
from .transform import transform_route


def create_app(settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None):
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(application):
        application.state.campus = load_campus(settings.data_dir)
        timeout = httpx.Timeout(connect=2, read=10, write=5, pool=2)
        async with httpx.AsyncClient(
            timeout=timeout,
            transport=transport,
            follow_redirects=False,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        ) as client:
            application.state.engine = GraphHopperClient(settings.graphhopper_url, client)
            yield

    app = FastAPI(title="CampusCompass routing", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.origins),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        allow_credentials=False,
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, _error: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": "Use valid campus coordinates and the walking profile; unknown fields are not accepted.",
                }
            },
        )

    @app.exception_handler(RoutingError)
    async def routing_error(_request: Request, error: RoutingError):
        return JSONResponse(
            status_code=error.status,
            content={"error": {"code": error.code, "message": error.message}},
        )

    @app.exception_handler(HTTPException)
    async def http_error(_request: Request, error: HTTPException):
        return JSONResponse(
            status_code=error.status_code,
            content={
                "error": {
                    "code": "NOT_FOUND" if error.status_code == 404 else "HTTP_ERROR",
                    "message": "The requested endpoint is unavailable.",
                }
            },
        )

    @app.get("/live")
    async def live():
        return {"status": "ok", "service": "routing-api"}

    @app.get("/health")
    async def health():
        ready = await app.state.engine.ready()
        return JSONResponse(
            status_code=200 if ready else 503,
            content={
                "status": "ok" if ready else "unavailable",
                "service": "routing-api",
                "dependencies": {
                    "campusData": "ok",
                    "graphhopper": "ok" if ready else "unavailable",
                },
            },
        )

    @app.get("/api/campus")
    async def campus():
        return app.state.campus.map_response()

    @app.get("/api/pois")
    async def pois(
        q: str = Query(default="", max_length=120), limit: int = Query(default=200, ge=1, le=200)
    ):
        return app.state.campus.search(q, limit)

    @app.post("/api/routes", response_model=RouteResponse, response_model_exclude_none=True)
    async def routes(request: RouteRequest):
        payload = await app.state.engine.route(request)
        return transform_route(payload, app.state.campus)

    return app


app = create_app()
