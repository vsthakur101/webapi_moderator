from enum import Enum
from typing import Optional
from pydantic import BaseModel


class EncodingType(str, Enum):
    URL = "url"
    BASE64 = "base64"
    HTML = "html"
    HEX = "hex"
    UNICODE = "unicode"
    GZIP = "gzip"


class HashAlgorithm(str, Enum):
    MD5 = "md5"
    SHA1 = "sha1"
    SHA256 = "sha256"
    SHA512 = "sha512"


class EncodeRequest(BaseModel):
    input: str
    encoding: EncodingType


class EncodeResponse(BaseModel):
    output: str
    encoding: EncodingType
    success: bool
    error: Optional[str] = None


class DecodeRequest(BaseModel):
    input: str
    encoding: EncodingType


class DecodeResponse(BaseModel):
    output: str
    encoding: EncodingType
    success: bool
    error: Optional[str] = None


class HashRequest(BaseModel):
    input: str
    algorithm: HashAlgorithm


class HashResponse(BaseModel):
    output: str
    algorithm: HashAlgorithm
    success: bool
    error: Optional[str] = None


class SmartDecodeRequest(BaseModel):
    input: str
    max_iterations: int = 10


class DecodingStep(BaseModel):
    encoding: str
    input: str
    output: str


class SmartDecodeResponse(BaseModel):
    output: str
    steps: list[DecodingStep]
    success: bool
    error: Optional[str] = None
