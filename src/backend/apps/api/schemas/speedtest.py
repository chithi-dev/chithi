"""Pydantic schemas for the speedtest endpoints."""

from ninja import Schema


class SpeedtestQuery(Schema):
    bytes: int = 100_000_000


class SpeedtestResponse(Schema):
    bytes_received: int
    timestamp: float
