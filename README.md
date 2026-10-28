# JobTrack — Job Application Tracker

JobTrack is a full-stack web application that helps users organize and track their job applications in one place. The project demonstrates full-stack development, automated testing, Docker containerization, and CI/CD deployment to AWS EC2.

## Project Overview

- **Frontend:** React, Vite, JavaScript
- **Backend:** Python, FastAPI
- **Database:** SQLite
- **Authentication:** JWT-based authentication
- **Testing:** Vitest, Pytest
- **Containerization:** Docker, Docker Compose
- **Web server / reverse proxy:** Nginx
- **CI/CD:** Jenkins
- **Cloud:** AWS EC2
- **Version control:** Git and GitHub

## Features

- User registration and login
- JWT-based authentication
- Create, view, update, and delete job applications
- User-specific job application data
- React-based user interface
- REST API built with FastAPI
- Persistent SQLite database using a Docker volume
- Automated frontend and backend tests
- Dockerized frontend and backend services
- Nginx reverse proxy for API requests
- Jenkins pipeline for validation, testing, building, and deployment
- Manual approval before production deployment
- Deployment health checks and rollback logic

## Technology Stack

| Area            | Technologies                          |
| --------------- | ------------------------------------- |
| Frontend        | React, Vite, JavaScript, Tailwind CSS |
| Backend         | Python, FastAPI, SQLAlchemy           |
| Database        | SQLite                                |
| Authentication  | JWT                                   |
| Testing         | Vitest, Pytest                        |
| DevOps          | Jenkins, Docker, Docker Compose       |
| Web server      | Nginx                                 |
| Cloud           | AWS EC2                               |
| Version control | Git, GitHub                           |

## Architecture

The application uses separate frontend and backend Docker containers.

1. The user accesses the React frontend through a web browser.
2. Nginx serves the frontend and proxies `/api/` requests to FastAPI.
3. FastAPI handles authentication and job application API requests.
4. SQLAlchemy interacts with the SQLite database.
5. Docker Compose manages the frontend and backend services.
6. A Docker volume stores the database so that rebuilding containers does not normally remove application data.

### Architecture flow

```text
User / Browser
      |
      v
AWS EC2 Instance
      |
      v
Nginx (Frontend Container)
      |
      |---- Serves React frontend
      |
      |---- /api/ requests
                 |
                 v
          FastAPI Backend
                 |
                 v
          SQLAlchemy ORM
                 |
                 v
            SQLite DB
        (Docker Volume)
```

## CI/CD Pipeline

The Jenkins pipeline automates the main validation and deployment steps.

1. **Checkout:** Retrieves the source code from GitHub.
2. **Environment validation:** Checks Git, Node.js, npm, and Python.
3. **Project validation:** Verifies required project files.
4. **Frontend tests:** Runs Vitest tests.
5. **Frontend lint:** Checks frontend code quality.
6. **Frontend build:** Creates the production frontend build.
7. **Backend tests:** Runs Pytest with coverage reporting.
8. **Manual approval:** Waits for approval before deployment.
9. **Deployment:** Connects to AWS EC2 over SSH and deploys the approved Git commit using Docker Compose.
10. **Health check and recovery:** Checks whether the frontend responds and attempts to restore the previous revision if deployment fails.

The production deployment uses a separate Docker Compose override file and a server-side environment file for the application secret.

## Testing Results

The following results were recorded in the successful Jenkins CI run:

- Frontend tests: **7 passed**
- Backend tests: **13 passed**
- Frontend lint: Passed
- Frontend production build: Passed
- Backend coverage: Approximately 91%
- Production Docker Compose configuration: Valid
- Deployment: Successful

These results describe the tested project revision and its recorded pipeline run.

## Run Locally with Docker

### Prerequisites

- Git
- Docker Desktop with Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/pavankumarbr411/JobTrack.git
cd JobTrack
```

### 2. Build and start the application

```bash
docker compose up -d --build
```

### 3. Open the application

Frontend:

```text
http://localhost:8081
```

FastAPI Swagger documentation:

```text
http://localhost:8000/docs
```

### 4. Stop the application

```bash
docker compose stop
```

### 5. Start it again

```bash
docker compose start
```

To stop and remove the containers without removing the named database volume:

```bash
docker compose down
```

**Important:** Avoid `docker compose down -v` if you want to preserve the local database volume.

## AWS Deployment

JobTrack has been deployed to an AWS EC2 Ubuntu instance using Docker Compose.

The production setup includes:

- Separate frontend and backend containers
- Nginx serving the frontend and proxying API requests
- Persistent SQLite storage using a Docker volume
- Server-side environment configuration for the secret key
- Jenkins-triggered deployment over SSH
- Manual deployment approval
- Frontend health checks and rollback logic

The current demo address is:

[http://54.153.219.122](http://54.153.219.122)

The application currently uses HTTP, not HTTPS. The public IP may change if the EC2 instance is stopped and restarted without an Elastic IP. The demo may therefore be unavailable when the instance is stopped.

## Repository Structure

```text
JobTrack/
├── backend/
│   ├── tests/
│   ├── requirements.txt
│   └── ...
├── frontend/
│   ├── src/
│   ├── package.json
│   └── ...
├── docker-compose.yml
├── docker-compose.prod.yml
├── Jenkinsfile
└── README.md
```

## Learning Outcomes

Through this project, I gained practical experience with:

- Building a full-stack web application
- Developing and integrating REST APIs
- Implementing authentication and user data isolation
- Using SQLAlchemy with SQLite
- Writing frontend and backend automated tests
- Building and managing Docker containers
- Configuring Nginx as a reverse proxy
- Creating a Jenkins CI/CD pipeline
- Deploying an application to AWS EC2
- Using deployment health checks and rollback logic

## Future Maintenance

The core application and CI/CD deployment are complete. Potential operational improvements include configuring HTTPS, automated database backups, and monitoring.

##

