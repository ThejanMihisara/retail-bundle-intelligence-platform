from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.access_request import AccessRequest, RequestStatus
from models.user import User, UserRole, UserStatus
from schemas.access_request import AccessRequestCreate, AccessRequestOut, AccessRequestApprove
from services.auth_service import hash_password
from utils.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/api/access-requests", tags=["access-requests"])


@router.post("", response_model=AccessRequestOut, status_code=201)
async def submit_access_request(payload: AccessRequestCreate, db: Session = Depends(get_db)):
    """Public endpoint — anyone can submit a request for access."""
    # Check for duplicate pending requests from same email
    existing = db.query(AccessRequest).filter(
        AccessRequest.email == payload.email,
        AccessRequest.status == RequestStatus.pending,
    ).first()
    if existing:
        raise HTTPException(
            status_code=422,
            detail="A pending access request already exists for this email address."
        )

    req = AccessRequest(
        name=payload.name,
        email=payload.email,
        organization=payload.organization,
        department=payload.department,
        requested_role=payload.requested_role or "analyst",
        reason=payload.reason,
        status=RequestStatus.pending,
    )
    db.add(req)
    try:
        db.commit()
        db.refresh(req)
        return req
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not submit access request: {exc}") from exc


@router.get("", response_model=list[AccessRequestOut])
async def list_access_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin only — list all access requests."""
    query = db.query(AccessRequest)
    if status:
        query = query.filter(AccessRequest.status == status)
    return query.order_by(AccessRequest.created_at.desc()).all()


@router.patch("/{request_id}/approve", response_model=AccessRequestOut)
async def approve_access_request(
    request_id: int,
    payload: AccessRequestApprove,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Admin only — approve access request and create user account.
    Returns the updated request after saving the admin-provided password.
    In production, connect an email service here instead of sharing credentials manually.
    """
    req = db.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Access request not found.")
    if req.status != RequestStatus.pending:
        raise HTTPException(status_code=422, detail=f"Request is already '{req.status}'.")

    if len(payload.password.strip()) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    # Determine role
    assigned_role = payload.assigned_role or req.requested_role or "analyst"
    try:
        role_enum = UserRole(assigned_role)
    except ValueError:
        role_enum = UserRole.analyst

    existing_user = db.query(User).filter(User.email == req.email).first()
    if existing_user:
        existing_user.full_name = req.name
        existing_user.hashed_password = hash_password(payload.password)
        existing_user.role = role_enum
        existing_user.is_approved = True
        existing_user.status = UserStatus.invited
        existing_user.must_change_password = True
        existing_user.invited_at = datetime.utcnow()
    else:
        new_user = User(
            full_name=req.name,
            email=req.email,
            hashed_password=hash_password(payload.password),
            role=role_enum,
            is_approved=True,
            status=UserStatus.invited,
            must_change_password=True,
            invited_at=datetime.utcnow(),
        )
        db.add(new_user)

    # Update request status
    req.status = RequestStatus.approved
    req.assigned_role = assigned_role
    req.reviewed_by = admin.email
    req.reviewed_at = datetime.utcnow()
    # Password is hashed on the user account; do not store plaintext credentials.
    req.invite_token = None

    try:
        db.commit()
        db.refresh(req)
        return req
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not approve access request: {exc}") from exc


@router.patch("/{request_id}/reject", response_model=AccessRequestOut)
async def reject_access_request(
    request_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — reject an access request."""
    req = db.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Access request not found.")
    if req.status != RequestStatus.pending:
        raise HTTPException(status_code=422, detail=f"Request is already '{req.status}'.")

    req.status = RequestStatus.rejected
    req.reviewed_by = admin.email
    req.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(req)
    return req


@router.delete("/{request_id}", status_code=204)
async def delete_access_request(
    request_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin only — delete a request."""
    req = db.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Access request not found.")
    db.delete(req)
    db.commit()
