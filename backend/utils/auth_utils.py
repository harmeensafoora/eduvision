from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.utils.cache import cache

bearer_scheme = HTTPBearer(auto_error=False)

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    data = {"sub": user_id, "exp": expire, "type": "refresh"}
    token = jwt.encode(
        data, settings.JWT_REFRESH_SECRET, algorithm=settings.JWT_ALGORITHM
    )
    # Store in cache so we can invalidate on logout
    cache.set(
        f"refresh:{user_id}", token, ex=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )
    return token


def verify_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != "access":
            raise CREDENTIALS_EXCEPTION
        return payload
    except jwt.InvalidTokenError:
        raise CREDENTIALS_EXCEPTION


def verify_refresh_token(token: str) -> str:
    """Returns user_id if valid, raises 401 otherwise."""
    try:
        payload = jwt.decode(
            token, settings.JWT_REFRESH_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != "refresh":
            raise CREDENTIALS_EXCEPTION
        user_id: str = payload.get("sub")
        if not user_id:
            raise CREDENTIALS_EXCEPTION
        stored = cache.get(f"refresh:{user_id}")
        if stored != token:
            raise CREDENTIALS_EXCEPTION
        return user_id
    except jwt.InvalidTokenError:
        raise CREDENTIALS_EXCEPTION


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    from backend.models.user import User

    if not credentials:
        raise CREDENTIALS_EXCEPTION
    payload = verify_access_token(credentials.credentials)
    user_id: str = payload.get("sub")
    if not user_id:
        raise CREDENTIALS_EXCEPTION
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise CREDENTIALS_EXCEPTION
    return user
