from datetime import datetime

from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.user import User, UserRole, UserStatus
from schemas.auth import Token, UserOut, PasswordChange
from services.auth_service import create_access_token, hash_password, verify_password
from utils.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
async def register(
    full_name: str,
    email: str,
    password: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Admin-only: create a new user directly.
    Public registration is handled via /api/access-requests (request-access flow).
    """
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=422, detail="Email is already registered.")
    user = User(
        full_name=full_name,
        email=email,
        hashed_password=hash_password(password),
        role=UserRole.manager,
        is_approved=True,
        status=UserStatus.active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    """Authenticate and return a JWT. Accepts email as username."""
    user = db.query(User).filter(User.email == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Your account is pending admin approval.")
    if user.status.value == "suspended":
        raise HTTPException(status_code=403, detail="Your account has been suspended.")

    # Update last login timestamp
    user.last_login_at = datetime.utcnow()
    if user.status.value == "invited":
        user.status = UserStatus.active
    db.commit()

    return Token(access_token=create_access_token(user))


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.post("/change-password")
async def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow any authenticated user to change their password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"message": "Password changed successfully."}


@router.post("/admin/approve/{user_id}", response_model=UserOut)
async def approve_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_approved = True
    user.status = UserStatus.active
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserOut])
async def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.created_at.desc()).all()
