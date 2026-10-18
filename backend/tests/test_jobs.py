JOB = {
    "company": "Example Technologies",
    "role": "Junior Python Developer",
    "link": "https://example.com/jobs/1",
    "status": "Applied",
    "date": "2026-10-18",
}


def test_jobs_require_authentication(client):
    response = client.get("/jobs")
    assert response.status_code in (401, 403)


def test_create_and_list_job(client, auth_headers):
    headers = auth_headers()

    created = client.post("/jobs", json=JOB, headers=headers)

    assert created.status_code == 201
    assert created.json()["company"] == JOB["company"]
    assert created.json()["status"] == "Applied"

    listed = client.get("/jobs", headers=headers)

    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["role"] == JOB["role"]


def test_invalid_job_status_rejected(client, auth_headers):
    headers = auth_headers()
    invalid_job = {**JOB, "status": "In Progress"}

    response = client.post(
        "/jobs",
        json=invalid_job,
        headers=headers,
    )

    assert response.status_code == 422


def test_update_job(client, auth_headers):
    headers = auth_headers()
    created = client.post("/jobs", json=JOB, headers=headers)
    job_id = created.json()["id"]

    updated_job = {
        **JOB,
        "status": "Interview",
    }

    response = client.put(
        f"/jobs/{job_id}",
        json=updated_job,
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "Interview"


def test_delete_job(client, auth_headers):
    headers = auth_headers()
    created = client.post("/jobs", json=JOB, headers=headers)
    job_id = created.json()["id"]

    deleted = client.delete(
        f"/jobs/{job_id}",
        headers=headers,
    )

    assert deleted.status_code == 204

    listed = client.get("/jobs", headers=headers)
    assert listed.status_code == 200
    assert listed.json() == []


def test_users_cannot_access_each_others_jobs(client, auth_headers):
    user_a = auth_headers("usera@example.com")
    user_b = auth_headers("userb@example.com")

    created = client.post("/jobs", json=JOB, headers=user_a)
    job_id = created.json()["id"]

    # User B must not see User A's job.
    response = client.get("/jobs", headers=user_b)
    assert response.status_code == 200
    assert response.json() == []

    # User B must not update or delete User A's job.
    update_response = client.put(
        f"/jobs/{job_id}",
        json={**JOB, "status": "Interview"},
        headers=user_b,
    )
    assert update_response.status_code == 404

    delete_response = client.delete(
        f"/jobs/{job_id}",
        headers=user_b,
    )
    assert delete_response.status_code == 404
