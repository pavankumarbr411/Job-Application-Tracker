import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

import main


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Give every test its own temporary SQLite database.
    test_db = tmp_path / "test_jobtrack.db"
    test_engine = create_engine(
        f"sqlite:///{test_db.as_posix()}",
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
    )

    # Routes use main.engine directly, so replace it during testing.
    monkeypatch.setattr(main, "engine", test_engine)

    try:
        with TestClient(main.app) as test_client:
            yield test_client
    finally:
        test_engine.dispose()


@pytest.fixture
def create_user(client):
    def _create_user(email="tester@example.com"):
        response = client.post(
            "/auth/signup",
            json={
                "name": "Test User",
                "email": email,
                "password": "TestPass123!",
            },
        )
        assert response.status_code == 201
        return response.json()

    return _create_user


@pytest.fixture
def auth_headers(create_user):
    def _auth_headers(email="tester@example.com"):
        result = create_user(email)
        return {
            "Authorization": f"Bearer {result['access_token']}"
        }

    return _auth_headers
