def test_signup_success(client):
    response = client.post(
        "/auth/signup",
        json={
            "name": "Pavan Test",
            "email": "pavan@example.com",
            "password": "TestPass123!",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == "pavan@example.com"
    assert data["token_type"] == "bearer"
    assert "access_token" in data
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]


def test_duplicate_signup_rejected(client):
    payload = {
        "name": "Test User",
        "email": "duplicate@example.com",
        "password": "TestPass123!",
    }

    first = client.post("/auth/signup", json=payload)
    second = client.post("/auth/signup", json=payload)

    assert first.status_code == 201
    assert second.status_code == 409


def test_login_success(client, create_user):
    create_user("login@example.com")

    response = client.post(
        "/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPass123!",
        },
    )

    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client, create_user):
    create_user("wrongpass@example.com")

    response = client.post(
        "/auth/login",
        json={
            "email": "wrongpass@example.com",
            "password": "WrongPassword123!",
        },
    )

    assert response.status_code == 401


def test_signup_rejects_invalid_email(client):
    response = client.post(
        "/auth/signup",
        json={
            "name": "Test User",
            "email": "not-an-email",
            "password": "TestPass123!",
        },
    )

    assert response.status_code == 422


def test_current_user_requires_authentication(client):
    response = client.get("/auth/me")

    assert response.status_code in (401, 403)


def test_current_user_returns_logged_in_user(client, create_user):
    result = create_user("me@example.com")
    headers = {
        "Authorization": f"Bearer {result['access_token']}"
    }

    response = client.get("/auth/me", headers=headers)

    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"
