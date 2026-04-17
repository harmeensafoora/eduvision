from pydantic import BaseModel, EmailStr


class DevLoginRequest(BaseModel):
    email: str
    name: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict
