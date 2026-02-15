from typing import Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel


class ExtractionType(str, Enum):
    HEADER = "header"
    COOKIE = "cookie"
    BODY_REGEX = "body_regex"
    BODY_JSON = "body_json"


class AnalysisStatus(str, Enum):
    CONFIGURED = "configured"
    COLLECTING = "collecting"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    ERROR = "error"


class AnalysisCreate(BaseModel):
    name: str
    source_request_id: Optional[str] = None
    extraction_type: ExtractionType
    extraction_pattern: str
    sample_count: int = 100


class AnalysisUpdate(BaseModel):
    name: Optional[str] = None
    extraction_type: Optional[ExtractionType] = None
    extraction_pattern: Optional[str] = None
    sample_count: Optional[int] = None


class AnalysisResponse(BaseModel):
    id: str
    name: str
    status: str
    source_request_id: Optional[str]
    extraction_type: str
    extraction_pattern: str
    sample_count: int
    collected_count: int
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class AnalysisDetailResponse(AnalysisResponse):
    samples: list[str]
    analysis_results: Optional[dict]


class CharacterFrequency(BaseModel):
    character: str
    count: int
    percentage: float


class EntropyResult(BaseModel):
    entropy_bits: float
    max_entropy: float
    efficiency: float  # entropy / max_entropy
    rating: str  # Excellent, Good, Fair, Poor


class PatternResult(BaseModel):
    has_sequential: bool
    has_repeated: bool
    common_prefixes: list[str]
    common_suffixes: list[str]


class AnalysisResults(BaseModel):
    total_samples: int
    unique_samples: int
    min_length: int
    max_length: int
    avg_length: float
    character_set: list[str]
    character_frequencies: list[CharacterFrequency]
    entropy: EntropyResult
    patterns: PatternResult
    recommendation: str


class ManualAnalyzeRequest(BaseModel):
    tokens: list[str]
