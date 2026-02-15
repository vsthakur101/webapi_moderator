import base64
import gzip
import hashlib
import html
import re
from typing import Optional
from urllib.parse import quote, unquote

from fastapi import APIRouter

from app.schemas.decoder import (
    DecodeRequest,
    DecodeResponse,
    DecodingStep,
    EncodeRequest,
    EncodeResponse,
    EncodingType,
    HashAlgorithm,
    HashRequest,
    HashResponse,
    SmartDecodeRequest,
    SmartDecodeResponse,
)

router = APIRouter()


def encode_url(data: str) -> str:
    return quote(data, safe="")


def decode_url(data: str) -> str:
    return unquote(data)


def encode_base64(data: str) -> str:
    return base64.b64encode(data.encode("utf-8")).decode("utf-8")


def decode_base64(data: str) -> str:
    return base64.b64decode(data).decode("utf-8")


def encode_html(data: str) -> str:
    return html.escape(data)


def decode_html(data: str) -> str:
    return html.unescape(data)


def encode_hex(data: str) -> str:
    return data.encode("utf-8").hex()


def decode_hex(data: str) -> str:
    return bytes.fromhex(data).decode("utf-8")


def encode_unicode(data: str) -> str:
    return "".join(f"\\u{ord(c):04x}" for c in data)


def decode_unicode(data: str) -> str:
    return data.encode("utf-8").decode("unicode_escape")


def encode_gzip(data: str) -> str:
    compressed = gzip.compress(data.encode("utf-8"))
    return base64.b64encode(compressed).decode("utf-8")


def decode_gzip(data: str) -> str:
    compressed = base64.b64decode(data)
    return gzip.decompress(compressed).decode("utf-8")


ENCODERS = {
    EncodingType.URL: encode_url,
    EncodingType.BASE64: encode_base64,
    EncodingType.HTML: encode_html,
    EncodingType.HEX: encode_hex,
    EncodingType.UNICODE: encode_unicode,
    EncodingType.GZIP: encode_gzip,
}

DECODERS = {
    EncodingType.URL: decode_url,
    EncodingType.BASE64: decode_base64,
    EncodingType.HTML: decode_html,
    EncodingType.HEX: decode_hex,
    EncodingType.UNICODE: decode_unicode,
    EncodingType.GZIP: decode_gzip,
}

HASH_FUNCTIONS = {
    HashAlgorithm.MD5: hashlib.md5,
    HashAlgorithm.SHA1: hashlib.sha1,
    HashAlgorithm.SHA256: hashlib.sha256,
    HashAlgorithm.SHA512: hashlib.sha512,
}


@router.post("/encode", response_model=EncodeResponse)
async def encode_data(request: EncodeRequest) -> EncodeResponse:
    """Encode data using the specified encoding type."""
    try:
        encoder = ENCODERS.get(request.encoding)
        if not encoder:
            return EncodeResponse(
                output="",
                encoding=request.encoding,
                success=False,
                error=f"Unsupported encoding: {request.encoding}",
            )

        output = encoder(request.input)
        return EncodeResponse(
            output=output,
            encoding=request.encoding,
            success=True,
        )
    except Exception as e:
        return EncodeResponse(
            output="",
            encoding=request.encoding,
            success=False,
            error=str(e),
        )


@router.post("/decode", response_model=DecodeResponse)
async def decode_data(request: DecodeRequest) -> DecodeResponse:
    """Decode data using the specified encoding type."""
    try:
        decoder = DECODERS.get(request.encoding)
        if not decoder:
            return DecodeResponse(
                output="",
                encoding=request.encoding,
                success=False,
                error=f"Unsupported encoding: {request.encoding}",
            )

        output = decoder(request.input)
        return DecodeResponse(
            output=output,
            encoding=request.encoding,
            success=True,
        )
    except Exception as e:
        return DecodeResponse(
            output="",
            encoding=request.encoding,
            success=False,
            error=str(e),
        )


@router.post("/hash", response_model=HashResponse)
async def hash_data(request: HashRequest) -> HashResponse:
    """Generate a hash of the input data."""
    try:
        hash_func = HASH_FUNCTIONS.get(request.algorithm)
        if not hash_func:
            return HashResponse(
                output="",
                algorithm=request.algorithm,
                success=False,
                error=f"Unsupported algorithm: {request.algorithm}",
            )

        output = hash_func(request.input.encode("utf-8")).hexdigest()
        return HashResponse(
            output=output,
            algorithm=request.algorithm,
            success=True,
        )
    except Exception as e:
        return HashResponse(
            output="",
            algorithm=request.algorithm,
            success=False,
            error=str(e),
        )


def detect_encoding(data: str) -> Optional[str]:
    """Try to detect the encoding of a string."""
    # Check for URL encoding (contains %XX patterns)
    if re.search(r"%[0-9A-Fa-f]{2}", data):
        return "url"

    # Check for HTML entities
    if re.search(r"&[a-zA-Z]+;|&#\d+;|&#x[0-9A-Fa-f]+;", data):
        return "html"

    # Check for Unicode escape sequences
    if re.search(r"\\u[0-9A-Fa-f]{4}", data):
        return "unicode"

    # Check for hex encoding (only hex chars, even length)
    if re.match(r"^[0-9A-Fa-f]+$", data) and len(data) % 2 == 0 and len(data) >= 2:
        return "hex"

    # Check for Base64 (basic pattern)
    if re.match(r"^[A-Za-z0-9+/]+=*$", data) and len(data) % 4 == 0 and len(data) >= 4:
        return "base64"

    return None


@router.post("/smart-decode", response_model=SmartDecodeResponse)
async def smart_decode(request: SmartDecodeRequest) -> SmartDecodeResponse:
    """Auto-detect encoding and recursively decode."""
    steps: list[DecodingStep] = []
    current = request.input
    iterations = 0

    try:
        while iterations < request.max_iterations:
            encoding = detect_encoding(current)
            if not encoding:
                break

            try:
                encoding_type = EncodingType(encoding)
                decoder = DECODERS.get(encoding_type)
                if not decoder:
                    break

                decoded = decoder(current)

                # If decoding didn't change anything, stop
                if decoded == current:
                    break

                steps.append(
                    DecodingStep(
                        encoding=encoding,
                        input=current,
                        output=decoded,
                    )
                )
                current = decoded
                iterations += 1

            except Exception:
                # If decoding fails, stop trying
                break

        return SmartDecodeResponse(
            output=current,
            steps=steps,
            success=True,
        )
    except Exception as e:
        return SmartDecodeResponse(
            output=request.input,
            steps=steps,
            success=False,
            error=str(e),
        )
