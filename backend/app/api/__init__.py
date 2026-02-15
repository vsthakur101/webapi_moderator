from fastapi import APIRouter
from app.api.requests import router as requests_router
from app.api.rules import router as rules_router
from app.api.proxy import router as proxy_router
from app.api.decoder import router as decoder_router
from app.api.comparer import router as comparer_router
from app.api.collections import router as collections_router
from app.api.targets import router as targets_router
from app.api.intruder import router as intruder_router
from app.api.sequencer import router as sequencer_router
from app.api.spider import router as spider_router
from app.api.scanner import router as scanner_router

api_router = APIRouter()

api_router.include_router(requests_router, prefix="/requests", tags=["requests"])
api_router.include_router(rules_router, prefix="/rules", tags=["rules"])
api_router.include_router(proxy_router, prefix="/proxy", tags=["proxy"])
api_router.include_router(decoder_router, prefix="/decoder", tags=["decoder"])
api_router.include_router(comparer_router, prefix="/comparer", tags=["comparer"])
api_router.include_router(collections_router, prefix="/collections", tags=["collections"])
api_router.include_router(targets_router, prefix="/targets", tags=["targets"])
api_router.include_router(intruder_router, prefix="/intruder", tags=["intruder"])
api_router.include_router(sequencer_router, prefix="/sequencer", tags=["sequencer"])
api_router.include_router(spider_router, prefix="/spider", tags=["spider"])
api_router.include_router(scanner_router, prefix="/scanner", tags=["scanner"])
