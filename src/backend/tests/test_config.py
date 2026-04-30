from httpx import AsyncClient
import pytest

@pytest.mark.asyncio
async def test_get_config_not_found(client: AsyncClient):
    response = await client.get("/config")
    assert response.status_code == 404
