from fastapi import APIRouter
from app.api.requests import router as requests_router
from app.api.rules import router as rules_router
from app.api.proxy import router as proxy_router

api_router = APIRouter()

api_router.include_router(requests_router, prefix="/requests", tags=["requests"])
api_router.include_router(rules_router, prefix="/rules", tags=["rules"])
api_router.include_router(proxy_router, prefix="/proxy", tags=["proxy"])
