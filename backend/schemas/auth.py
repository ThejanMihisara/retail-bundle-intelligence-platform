import enum
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class TokenPayload(BaseModel):
    sub: str
    email: str
    role: str
    exp: int


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_approved: bool
    status: str
    must_change_password: bool
    invited_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
