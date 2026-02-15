import asyncio
import base64
import itertools
import re
import time
from datetime import datetime
from typing import Optional, Callable

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intruder import IntruderAttack, IntruderResult


class IntruderManager:
    """Manages intruder attack execution."""

    def __init__(self):
        self._db_session_maker = None
        self._ws_manager = None
        self._running_attacks: dict[str, asyncio.Task] = {}
        self._paused_attacks: set[str] = set()

    def set_dependencies(self, db_session_maker, ws_manager):
        """Set database session maker and WebSocket manager."""
        self._db_session_maker = db_session_maker
        self._ws_manager = ws_manager

    def calculate_total_requests(
        self, attack_type: str, num_positions: int, payload_counts: list[int]
    ) -> int:
        """Calculate total number of requests for an attack."""
        if not payload_counts:
            return 0

        if attack_type == "sniper":
            # Each position tested with each payload
            return num_positions * max(payload_counts) if payload_counts else 0

        elif attack_type == "battering_ram":
            # All positions get same payload
            return max(payload_counts) if payload_counts else 0

        elif attack_type == "pitchfork":
            # Parallel iteration - limited by shortest list
            return min(payload_counts) if payload_counts else 0

        elif attack_type == "cluster_bomb":
            # Cartesian product of all payloads
            total = 1
            for count in payload_counts:
                total *= count
            return total

        return 0

    def generate_payload_combinations(
        self, attack_type: str, positions: list[dict], payload_sets: list[list[str]]
    ) -> list[list[str]]:
        """Generate payload combinations based on attack type."""
        if not payload_sets or not positions:
            return []

        num_positions = len(positions)

        if attack_type == "sniper":
            # Each position tested with each payload, one at a time
            combinations = []
            for pos_idx in range(num_positions):
                payloads = payload_sets[min(pos_idx, len(payload_sets) - 1)]
                for payload in payloads:
                    combo = [""] * num_positions
                    combo[pos_idx] = payload
                    combinations.append(combo)
            return combinations

        elif attack_type == "battering_ram":
            # All positions get same payload
            payloads = payload_sets[0] if payload_sets else []
            return [[p] * num_positions for p in payloads]

        elif attack_type == "pitchfork":
            # Parallel iteration
            return list(zip(*payload_sets))[:min(len(ps) for ps in payload_sets)]

        elif attack_type == "cluster_bomb":
            # Cartesian product
            return list(itertools.product(*payload_sets))

        return []

    def apply_payloads(
        self, template: str, positions: list[dict], payloads: list[str]
    ) -> str:
        """Apply payloads to template at specified positions."""
        if not positions or not payloads:
            return template

        # Sort positions by start index in reverse order
        # to avoid offset issues when replacing
        sorted_positions = sorted(
            enumerate(positions), key=lambda x: x[1]["start"], reverse=True
        )

        result = template
        for original_idx, pos in sorted_positions:
            if original_idx < len(payloads):
                start = pos["start"]
                end = pos["end"]
                payload = payloads[original_idx]
                result = result[:start] + payload + result[end:]

        return result

    async def start_attack(self, attack_id: str) -> None:
        """Start an intruder attack."""
        if attack_id in self._running_attacks:
            return  # Already running

        task = asyncio.create_task(self._run_attack(attack_id))
        self._running_attacks[attack_id] = task

    async def pause_attack(self, attack_id: str) -> None:
        """Pause an intruder attack."""
        self._paused_attacks.add(attack_id)

    async def resume_attack(self, attack_id: str) -> None:
        """Resume a paused attack."""
        self._paused_attacks.discard(attack_id)

    async def stop_attack(self, attack_id: str) -> None:
        """Stop an intruder attack."""
        if attack_id in self._running_attacks:
            self._running_attacks[attack_id].cancel()
            del self._running_attacks[attack_id]
        self._paused_attacks.discard(attack_id)

    async def _run_attack(self, attack_id: str) -> None:
        """Execute an intruder attack."""
        async with self._db_session_maker() as db:
            # Get attack
            result = await db.execute(
                select(IntruderAttack).where(IntruderAttack.id == attack_id)
            )
            attack = result.scalar_one_or_none()

            if not attack:
                return

            # Update status
            attack.status = "running"
            attack.started_at = datetime.utcnow()
            attack.error_message = None
            await db.commit()

            try:
                # Generate payload combinations
                combinations = self.generate_payload_combinations(
                    attack.attack_type, attack.positions, attack.payload_sets
                )

                attack.total_requests = len(combinations)
                await db.commit()

                # Broadcast status update
                if self._ws_manager:
                    await self._ws_manager.broadcast({
                        "type": "intruder_progress",
                        "data": {
                            "attack_id": attack_id,
                            "status": "running",
                            "total": attack.total_requests,
                            "completed": 0,
                        },
                    })

                # Execute requests
                async with httpx.AsyncClient(
                    timeout=attack.timeout_seconds,
                    follow_redirects=attack.follow_redirects,
                    verify=False,
                ) as client:
                    for idx, payloads in enumerate(combinations):
                        # Check for pause
                        while attack_id in self._paused_attacks:
                            await asyncio.sleep(0.5)

                        # Check for cancellation
                        if attack_id not in self._running_attacks:
                            break

                        # Execute single request
                        await self._execute_request(
                            db, client, attack, list(payloads), idx
                        )

                        # Delay between requests
                        if attack.delay_ms > 0:
                            await asyncio.sleep(attack.delay_ms / 1000)

                # Mark completed
                attack.status = "completed"
                attack.completed_at = datetime.utcnow()
                await db.commit()

                if self._ws_manager:
                    await self._ws_manager.broadcast({
                        "type": "intruder_progress",
                        "data": {
                            "attack_id": attack_id,
                            "status": "completed",
                            "total": attack.total_requests,
                            "completed": attack.completed_requests,
                        },
                    })

            except asyncio.CancelledError:
                attack.status = "paused"
                await db.commit()

            except Exception as e:
                attack.status = "error"
                attack.error_message = str(e)
                await db.commit()

            finally:
                if attack_id in self._running_attacks:
                    del self._running_attacks[attack_id]

    async def _execute_request(
        self,
        db: AsyncSession,
        client: httpx.AsyncClient,
        attack: IntruderAttack,
        payloads: list[str],
        position_index: int,
    ) -> IntruderResult:
        """Execute a single intruder request."""
        # Apply payloads to URL
        url = self.apply_payloads(attack.url_template, attack.positions, payloads)

        # Apply payloads to headers
        headers = {}
        for key, value in (attack.headers_template or {}).items():
            headers[key] = self.apply_payloads(value, attack.positions, payloads)

        # Apply payloads to body
        body = None
        if attack.body_template:
            body = self.apply_payloads(attack.body_template, attack.positions, payloads)

        # Create result record
        result = IntruderResult(
            attack_id=attack.id,
            position_index=position_index,
            payloads=payloads,
            request_url=url,
            request_body=body.encode() if body else None,
        )

        start_time = time.time()

        try:
            # Make request
            response = await client.request(
                method=attack.method,
                url=url,
                headers=headers,
                content=body,
            )

            result.response_status = response.status_code
            result.response_length = len(response.content)
            result.response_time_ms = int((time.time() - start_time) * 1000)
            result.response_body = response.content[:10000]  # Limit size
            result.response_headers = dict(response.headers)

        except Exception as e:
            result.error = str(e)
            result.response_time_ms = int((time.time() - start_time) * 1000)

        # Save result
        db.add(result)
        attack.completed_requests += 1
        await db.commit()

        # Broadcast result
        if self._ws_manager:
            await self._ws_manager.broadcast({
                "type": "intruder_result",
                "data": {
                    "attack_id": attack.id,
                    "result": {
                        "id": result.id,
                        "payloads": payloads,
                        "request_url": url,
                        "response_status": result.response_status,
                        "response_length": result.response_length,
                        "response_time_ms": result.response_time_ms,
                        "error": result.error,
                    },
                    "completed": attack.completed_requests,
                    "total": attack.total_requests,
                },
            })

        return result


# Singleton instance
intruder_manager = IntruderManager()
