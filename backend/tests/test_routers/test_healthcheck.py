import httpx


async def test_healthcheck(async_client: httpx.AsyncClient):
    response = await async_client.get("/healthcheck")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
