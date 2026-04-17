"""
Authentication router.

Endpoints:
  GET  /api/auth/login           → redirect to Google consent (requires GOOGLE_CLIENT_ID)
  GET  /api/auth/callback        → exchange code, return JWT pair
  POST /api/auth/refresh         → rotate refresh token
  POST /api/auth/logout          → invalidate refresh token
  POST /api/auth/dev-login       → instant login by email (no credentials needed)
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models.user import User
from backend.schemas.auth import DevLoginRequest, RefreshRequest, TokenResponse
from backend.utils.auth_utils import (
    cache,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _make_token_response(user: User) -> dict:
    access = create_access_token({"sub": user.id})
    refresh = create_refresh_token(user.id)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar_url": user.avatar_url,
            "learner_types": user.learner_types or [],
            "depth_pref": user.depth_pref,
            "language_pref": user.language_pref,
            "streak_count": user.streak_count,
        },
    }


# ── Dev login ─────────────────────────────────────────────────────────────────


@router.post(
    "/dev-login", response_model=TokenResponse, summary="Dev-only instant login"
)
def dev_login(body: DevLoginRequest, db: Session = Depends(get_db)):
    """
    Creates or retrieves a user by email and returns JWT tokens.
    No credentials required — for development use only.
    """
    if not settings.ENABLE_DEV_LOGIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev login is disabled. Set ENABLE_DEV_LOGIN=true to enable.",
        )
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email=body.email,
            name=body.name,
            google_id=None,
            avatar_url=None,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return _make_token_response(user)


# ── Google OAuth ──────────────────────────────────────────────────────────────


@router.get("/login", summary="Redirect to Google OAuth consent")
def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=501,
            detail="Google OAuth is not configured. Use /api/auth/dev-login instead.",
        )
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["openid", "email", "profile"],
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
    )
    auth_url, _ = flow.authorization_url(prompt="consent", access_type="offline")
    return RedirectResponse(auth_url)


@router.get("/callback", summary="Google OAuth callback")
def google_callback(code: str, db: Session = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth not configured.")
    from google_auth_oauthlib.flow import Flow
    import httpx

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["openid", "email", "profile"],
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
    )
    flow.fetch_token(code=code)
    credentials = flow.credentials

    # Get user info
    r = httpx.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {credentials.token}"},
        timeout=10,
    )
    r.raise_for_status()
    info = r.json()

    google_id = info["sub"]
    email = info["email"]
    name = info.get("name", email)
    avatar = info.get("picture")

    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            google_id=google_id,
            name=name,
            avatar_url=avatar,
        )
        db.add(user)
    else:
        user.google_id = google_id
        user.name = name
        if avatar:
            user.avatar_url = avatar
    db.commit()
    db.refresh(user)
    return _make_token_response(user)


# ── Token management ──────────────────────────────────────────────────────────


@router.post("/refresh", summary="Rotate refresh token")
def refresh_token(body: RefreshRequest):
    user_id = verify_refresh_token(body.refresh_token)
    # Invalidate old refresh token
    cache.delete(f"refresh:{user_id}")
    new_access = create_access_token({"sub": user_id})
    new_refresh = create_refresh_token(user_id)
    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


@router.post("/logout", summary="Invalidate session")
def logout(current_user: User = Depends(get_current_user)):
    cache.delete(f"refresh:{current_user.id}")
    return {"message": "Logged out"}
