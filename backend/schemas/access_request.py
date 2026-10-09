from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class AccessRequestCreate(BaseModel):
    name: str
    email: EmailStr
    requested_role: str = "analyst"
    reason: Optional[str] = None


class AccessRequestOut(BaseModel):
    id: int
    name: str
    email: str
    requested_role: str
    reason: Optional[str] = None
    status: str
    assigned_role: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AccessRequestApprove(BaseModel):
    assigned_role: str = "analyst"
    password: str
