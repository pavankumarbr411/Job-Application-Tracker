
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import os

import jwt
from pwdlib import PasswordHash
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import (
    Date, Integer, String, ForeignKey, create_engine, select, inspect, text
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


# Database
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{(Path(__file__).resolve().parent / 'jobtrack.db').as_posix()}",
)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# Change this secret before deploying to the cloud.
SECRET_KEY = os.getenv(
    "JOBTRACK_SECRET_KEY",
    "dev-only-change-this-secret-before-deployment",
)
ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60

password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(500), nullable=False)


class JobApplication(Base):
    __tablename__ = "job_applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[str] = mapped_column(String(150), nullable=False)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Applied")
    date: Mapped[date] = mapped_column(Date, nullable=False)

    # Nullable for compatibility with existing database records.
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )


JobStatus = (
    "Applied", "Assessment", "Interview", "Selected", "Rejected"
)


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class JobCreate(BaseModel):
    company: str = Field(min_length=1, max_length=150)
    role: str = Field(min_length=1, max_length=150)
    link: str | None = Field(default=None, max_length=500)
    status: str = "Applied"
    date: date


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company: str
    role: str
    link: str | None
    status: str
    date: date
    user_id: int | None


def initialize_database():
    Base.metadata.create_all(bind=engine)

    # Add the new column to older SQLite databases without deleting data.
    columns = {
        column["name"]
        for column in inspect(engine).get_columns("job_applications")
    }
    if "user_id" not in columns:
        with engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE job_applications ADD COLUMN user_id "
                "INTEGER REFERENCES users(id)"
            ))
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_job_applications_user_id "
                "ON job_applications (user_id)"
            ))


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="JobTrack API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_access_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_MINUTES
    )
    return jwt.encode(
        {"sub": str(user_id), "exp": expires},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired login session",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise unauthorized

    with Session(engine) as session:
        user = session.get(User, user_id)
        if user is None:
            raise unauthorized

        # Return a detached object; its scalar attributes remain accessible.
        session.expunge(user)
        return user


@app.get("/")
def home():
    return {"message": "Welcome to JobTrack API"}


@app.post(
    "/auth/signup",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(data: SignupRequest):
    email = str(data.email).lower().strip()

    with Session(engine) as session:
        existing = session.scalar(
            select(User).where(User.email == email)
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            )

        user = User(
            name=data.name.strip(),
            email=email,
            password_hash=password_hash.hash(data.password),
        )
        session.add(user)

        try:
            session.commit()
            session.refresh(user)
        except IntegrityError:
            session.rollback()
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            )

        # Assign legacy applications without an owner to the first account
        # created, so existing records remain accessible.
        session.execute(
            text(
                "UPDATE job_applications SET user_id = :user_id "
                "WHERE user_id IS NULL"
            ),
            {"user_id": user.id},
        )
        session.commit()

        token = create_access_token(user.id)
        return AuthResponse(
            access_token=token,
            user=UserResponse(
                id=user.id, name=user.name, email=user.email
            ),
        )


@app.post("/auth/login", response_model=AuthResponse)
def login(data: LoginRequest):
    email = str(data.email).lower().strip()

    with Session(engine) as session:
        user = session.scalar(
            select(User).where(User.email == email)
        )

        if user is None or not password_hash.verify(
            data.password, user.password_hash
        ):
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password.",
            )

        return AuthResponse(
            access_token=create_access_token(user.id),
            user=UserResponse(
                id=user.id, name=user.name, email=user.email
            ),
        )


@app.get("/auth/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse(id=user.id, name=user.name, email=user.email)


# All job endpoints require authentication and only access the user's jobs.
@app.get("/jobs", response_model=list[JobResponse])
def get_jobs(user: User = Depends(get_current_user)):
    with Session(engine) as session:
        return session.scalars(
            select(JobApplication)
            .where(JobApplication.user_id == user.id)
            .order_by(JobApplication.id.desc())
        ).all()


@app.post(
    "/jobs",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_job(
    job_data: JobCreate,
    user: User = Depends(get_current_user),
):
    if job_data.status not in JobStatus:
        raise HTTPException(status_code=422, detail="Invalid job status")

    with Session(engine) as session:
        job = JobApplication(
            **job_data.model_dump(),
            user_id=user.id,
        )
        session.add(job)
        session.commit()
        session.refresh(job)
        return job


@app.put("/jobs/{job_id}", response_model=JobResponse)
def update_job(
    job_id: int,
    job_data: JobCreate,
    user: User = Depends(get_current_user),
):
    if job_data.status not in JobStatus:
        raise HTTPException(status_code=422, detail="Invalid job status")

    with Session(engine) as session:
        job = session.scalar(
            select(JobApplication).where(
                JobApplication.id == job_id,
                JobApplication.user_id == user.id,
            )
        )
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")

        for field, value in job_data.model_dump().items():
            setattr(job, field, value)

        session.commit()
        session.refresh(job)
        return job


@app.patch("/jobs/{job_id}", response_model=JobResponse)
def patch_job(
    job_id: int,
    updates: dict,
    user: User = Depends(get_current_user),
):
    allowed = {"company", "role", "link", "status", "date"}

    if not updates or set(updates) - allowed:
        raise HTTPException(
            status_code=422, detail="Invalid update fields"
        )

    with Session(engine) as session:
        job = session.scalar(
            select(JobApplication).where(
                JobApplication.id == job_id,
                JobApplication.user_id == user.id,
            )
        )
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")

        current = {
            "company": job.company,
            "role": job.role,
            "link": job.link,
            "status": job.status,
            "date": job.date,
        }
        current.update(updates)
        validated = JobCreate.model_validate(current)

        if validated.status not in JobStatus:
            raise HTTPException(status_code=422, detail="Invalid job status")

        for field, value in validated.model_dump().items():
            setattr(job, field, value)

        session.commit()
        session.refresh(job)
        return job


@app.delete(
    "/jobs/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_job(
    job_id: int,
    user: User = Depends(get_current_user),
):
    with Session(engine) as session:
        job = session.scalar(
            select(JobApplication).where(
                JobApplication.id == job_id,
                JobApplication.user_id == user.id,
            )
        )
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")

        session.delete(job)
        session.commit()
        return None
