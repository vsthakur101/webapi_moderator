import os
from pathlib import Path
from datetime import datetime, timedelta
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

from app.config import get_settings

settings = get_settings()


def get_cert_dir() -> Path:
    """Get or create certificate directory"""
    cert_dir = Path(settings.cert_dir)
    cert_dir.mkdir(parents=True, exist_ok=True)
    return cert_dir


def get_ca_cert_path() -> Path:
    return get_cert_dir() / "ca-cert.pem"


def get_ca_key_path() -> Path:
    return get_cert_dir() / "ca-key.pem"


def generate_ca_certificate() -> tuple[str, str]:
    """Generate a CA certificate for HTTPS interception"""
    cert_path = get_ca_cert_path()
    key_path = get_ca_key_path()

    # Check if already exists
    if cert_path.exists() and key_path.exists():
        return str(cert_path), str(key_path)

    # Generate private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )

    # Generate certificate
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "California"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "San Francisco"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "WebAPI Moderator"),
        x509.NameAttribute(NameOID.COMMON_NAME, "WebAPI Moderator CA"),
    ])

    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.utcnow())
        .not_valid_after(datetime.utcnow() + timedelta(days=3650))  # 10 years
        .add_extension(
            x509.BasicConstraints(ca=True, path_length=None),
            critical=True,
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_cert_sign=True,
                crl_sign=True,
                key_encipherment=False,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .sign(private_key, hashes.SHA256(), default_backend())
    )

    # Write certificate
    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    # Write private key
    with open(key_path, "wb") as f:
        f.write(
            private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )

    return str(cert_path), str(key_path)


def get_ca_certificate_content() -> str:
    """Get the CA certificate content as PEM string"""
    cert_path, _ = generate_ca_certificate()
    with open(cert_path, "r") as f:
        return f.read()
