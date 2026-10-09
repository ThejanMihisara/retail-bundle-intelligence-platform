from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from database import get_db
from models.user import User, UserRole, UserStatus
from schemas.auth import UserOut
from utils.dependencies import require_admin, get_current_user

router = APIRouter(prefix="/api/users", tags=["user-management"])


class RoleUpdate:
    def __init__(self, role: str):
        self.role = role


class StatusUpdate:
    def __init__(self, status: str):
        self.status = status


@router.get("", response_model=list[UserOut])
async def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Admin only — list all users."""
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/me", response_model=UserOut)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Return current authenticated user's profile."""
    return current_user


@router.patch("/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: int,
    role: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — change a user's role."""
    if user_id == admin.id:
        raise HTTPException(status_code=422, detail="You cannot change your own role.")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    try:
        user.role = UserRole(role)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid role: {role}. Valid: admin, manager, analyst, viewer")
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/status", response_model=UserOut)
async def update_user_status(
    user_id: int,
    status: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — activate or suspend a user."""
    if user_id == admin.id:
        raise HTTPException(status_code=422, detail="You cannot change your own status.")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    try:
        user.status = UserStatus(status)
        if status == "active":
            user.is_approved = True
        elif status == "suspended":
            user.is_approved = False
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid status: {status}. Valid: active, invited, suspended")
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/approve", response_model=UserOut)
async def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin only — approve a pending user."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_approved = True
    user.status = UserStatus.active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — permanently delete a user."""
    if user_id == admin.id:
        raise HTTPException(status_code=422, detail="You cannot delete yourself.")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    db.delete(user)
    db.commit()
