# JobTrack – Job Application Tracker

JobTrack is a full-stack web application developed to help users organize and track their job applications. This project was built to practice full-stack development, REST API integration, automated testing, and Docker containerization.

## Features

- User registration and login
- JWT-based authentication
- Job application management
- React-based user interface
- REST API built with FastAPI
- SQLite database integration
- Backend and frontend automated tests
- Docker containers for the frontend and backend
- Docker Compose for running the application locally
- Nginx configuration for frontend hosting and API proxying

## Tech Stack

**Frontend**
- React
- Vite
- JavaScript
- Tailwind CSS
- React Router

**Backend**
- Python
- FastAPI
- SQLAlchemy
- SQLite
- JWT authentication

**Testing and DevOps**
- Pytest
- Vitest
- Docker
- Docker Compose
- Nginx
- Git and GitHub

## Project Architecture

The application uses a containerized frontend and backend.

1. The user accesses the React frontend through a web browser.
2. Nginx serves the frontend and forwards API requests to the backend.
3. FastAPI processes requests and interacts with the SQLite database.
4. Docker Compose manages the frontend and backend containers.

## Run Locally with Docker

### Prerequisites
- Docker Desktop
- Git

### Steps

1. Clone the repository:

   ```bash
   git clone https://github.com/pavankumarbr411/JobTrack.git
   cd JobTrack
   ```

2. Start the application:

   ```bash
   docker compose up -d --build
   ```

3. Open the frontend:

   http://localhost:8081

4. Open the FastAPI Swagger documentation:

   http://localhost:8000/docs

### Stop the application

```bash
docker compose stop
```

To start it again:

```bash
docker compose start
```

## Testing

The following tests were passing during development:

- Backend: 13 tests passed
- Frontend: 7 tests passed
- Frontend production build: successful

These results reflect the development environment at the time of testing. Run the tests again if you change the code.

## Learning Outcomes

Through this project, I gained practical experience with:

- Developing a React frontend and FastAPI backend
- Integrating frontend and backend APIs
- Implementing authentication
- Working with relational databases and SQLAlchemy
- Writing automated tests
- Building Docker images
- Running multiple services with Docker Compose
- Configuring Nginx as a reverse proxy
- Managing source code using Git and GitHub

## Current Status

The core application and local Docker setup have been developed and tested. Further improvements, including Jenkins-based CI/CD automation and AWS deployment, remain planned.

## Future Improvements

- Configure a Jenkins CI/CD pipeline
- Deploy the application to AWS EC2
- Improve production configuration and secrets management
- Add further automated integration tests
- Improve database backup and persistence practices

## Author

Pavan Kumar B. R.

GitHub: https://github.com/pavankumarbr411
