import asyncio
import ssl
import uuid
from datetime import datetime
from typing import Optional
from pathlib import Path

import httpx

from app.config import get_settings
from app.schemas.proxy import ProxyStatus, ProxyState

settings = get_settings()


class ProxyManager:
    def __init__(self):
        self.server: Optional[asyncio.Server] = None
        self.intercept_enabled: bool = False
        self.intercepted_requests: dict = {}
        self.request_events: dict = {}
        self.requests_total: int = 0
        self.requests_intercepted: int = 0
        self._running: bool = False
        self._db_session_maker = None
        self._ws_manager = None

    def set_dependencies(self, db_session_maker, ws_manager):
        """Set database and websocket dependencies"""
        self._db_session_maker = db_session_maker
        self._ws_manager = ws_manager

    def get_status(self) -> ProxyStatus:
        state = ProxyState.RUNNING if self._running else ProxyState.STOPPED
        return ProxyStatus(
            state=state,
            host=settings.proxy_host,
            port=settings.proxy_port,
            intercept_enabled=self.intercept_enabled,
            requests_intercepted=self.requests_intercepted,
            requests_total=self.requests_total,
        )

    async def start(self):
        if self._running:
            return

        self.server = await asyncio.start_server(
            self._handle_client,
            settings.proxy_host,
            settings.proxy_port,
        )
        self._running = True

        # Run server in background
        asyncio.create_task(self._serve())

    async def _serve(self):
        async with self.server:
            await self.server.serve_forever()

    async def stop(self):
        if not self._running:
            return

        if self.server:
            self.server.close()
            await self.server.wait_closed()
            self.server = None

        self._running = False

    def toggle_intercept(self) -> bool:
        self.intercept_enabled = not self.intercept_enabled
        return self.intercept_enabled

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Handle incoming proxy connection"""
        try:
            # Read the request line
            request_line = await reader.readline()
            if not request_line:
                writer.close()
                return

            request_line = request_line.decode('utf-8', errors='ignore').strip()
            parts = request_line.split(' ')

            if len(parts) < 3:
                writer.close()
                return

            method, url, version = parts[0], parts[1], parts[2]

            # Read headers
            headers = {}
            while True:
                line = await reader.readline()
                line = line.decode('utf-8', errors='ignore').strip()
                if not line:
                    break
                if ':' in line:
                    key, value = line.split(':', 1)
                    headers[key.strip()] = value.strip()

            # Read body if present
            body = None
            content_length = headers.get('Content-Length') or headers.get('content-length')
            if content_length:
                body = await reader.read(int(content_length))

            # Handle CONNECT method (HTTPS tunneling)
            if method == 'CONNECT':
                await self._handle_connect(reader, writer, url, headers)
                return

            # Forward HTTP request
            await self._forward_request(reader, writer, method, url, headers, body)

        except Exception as e:
            print(f"Proxy error: {e}")
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except:
                pass

    async def _handle_connect(self, reader, writer, url, headers):
        """Handle HTTPS CONNECT tunneling"""
        try:
            # Parse host and port
            if ':' in url:
                host, port = url.split(':')
                port = int(port)
            else:
                host = url
                port = 443

            # Connect to target server
            target_reader, target_writer = await asyncio.open_connection(host, port)

            # Send success response
            writer.write(b'HTTP/1.1 200 Connection established\r\n\r\n')
            await writer.drain()

            # Record the connection
            self.requests_total += 1
            await self._store_connect_request(host, port)

            # Tunnel data bidirectionally
            await asyncio.gather(
                self._pipe(reader, target_writer),
                self._pipe(target_reader, writer),
                return_exceptions=True,
            )

        except Exception as e:
            print(f"CONNECT error: {e}")
        finally:
            try:
                target_writer.close()
            except:
                pass

    async def _pipe(self, reader, writer):
        """Pipe data from reader to writer"""
        try:
            while True:
                data = await reader.read(8192)
                if not data:
                    break
                writer.write(data)
                await writer.drain()
        except:
            pass

    async def _forward_request(self, reader, writer, method, url, headers, body):
        """Forward HTTP request and return response"""
        self.requests_total += 1
        start_time = datetime.utcnow()
        request_id = str(uuid.uuid4())

        # Parse URL
        from urllib.parse import urlparse
        parsed = urlparse(url)
        host = parsed.netloc or headers.get('Host', '')
        path = parsed.path or '/'
        if parsed.query:
            path += f'?{parsed.query}'

        # Check intercept
        if self.intercept_enabled:
            self.requests_intercepted += 1
            # Would pause here for user action
            # For now, just continue

        try:
            # Forward request
            async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers={k: v for k, v in headers.items() if k.lower() != 'host'},
                    content=body,
                )

            duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            # Send response back
            status_line = f'HTTP/1.1 {response.status_code} {response.reason_phrase}\r\n'
            writer.write(status_line.encode())

            for key, value in response.headers.items():
                if key.lower() not in ('transfer-encoding', 'connection'):
                    writer.write(f'{key}: {value}\r\n'.encode())

            writer.write(b'\r\n')
            writer.write(response.content)
            await writer.drain()

            # Store request
            await self._store_http_request(
                method=method,
                url=url,
                host=host,
                path=path,
                request_headers=headers,
                request_body=body,
                response_status=response.status_code,
                response_headers=dict(response.headers),
                response_body=response.content,
                duration_ms=duration_ms,
            )

        except Exception as e:
            print(f"Forward error: {e}")
            writer.write(b'HTTP/1.1 502 Bad Gateway\r\n\r\n')
            await writer.drain()

    async def _store_http_request(self, **kwargs):
        """Store request in database"""
        if not self._db_session_maker:
            return

        from app.models.request import Request

        try:
            async with self._db_session_maker() as session:
                req = Request(
                    timestamp=datetime.utcnow(),
                    scheme='https' if kwargs.get('url', '').startswith('https') else 'http',
                    **kwargs
                )
                session.add(req)
                await session.commit()
                await session.refresh(req)

                # Broadcast to websocket
                if self._ws_manager:
                    await self._ws_manager.broadcast_request({
                        'id': str(req.id),
                        'timestamp': req.timestamp.isoformat(),
                        'method': req.method,
                        'url': req.url,
                        'host': req.host,
                        'path': req.path,
                        'response_status': req.response_status,
                        'duration_ms': req.duration_ms,
                    })
        except Exception as e:
            print(f"Store error: {e}")

    async def _store_connect_request(self, host, port):
        """Store CONNECT request"""
        if not self._db_session_maker:
            return

        from app.models.request import Request

        try:
            async with self._db_session_maker() as session:
                req = Request(
                    timestamp=datetime.utcnow(),
                    method='CONNECT',
                    url=f'https://{host}:{port}',
                    host=host,
                    path='/',
                    scheme='https',
                    request_headers={},
                )
                session.add(req)
                await session.commit()
        except Exception as e:
            print(f"Store CONNECT error: {e}")

    async def forward_request(self, request_id: str):
        """Forward an intercepted request"""
        if request_id in self.request_events:
            event = self.request_events.pop(request_id)
            self.intercepted_requests.pop(request_id, None)
            event.set()

    async def drop_request(self, request_id: str):
        """Drop an intercepted request"""
        if request_id in self.intercepted_requests:
            self.intercepted_requests.pop(request_id)
            if request_id in self.request_events:
                event = self.request_events.pop(request_id)
                event.set()

    async def forward_modified(
        self,
        request_id: str,
        headers: Optional[dict] = None,
        body: Optional[bytes] = None,
        status: Optional[int] = None,
    ):
        """Forward with modifications"""
        await self.forward_request(request_id)

    def get_ca_cert_path(self) -> Optional[str]:
        """Get path to CA certificate (placeholder)"""
        return None


# Global proxy manager instance
proxy_manager = ProxyManager()
