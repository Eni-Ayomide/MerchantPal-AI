from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.auth import get_current_user, user_id
from src.dependencies import get_db
from src.models.profile import Profile
from src.schemas.profile import ProfileRead, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])

def _auth_name(current_user: dict) -> str:
    metadata = current_user.get("user_metadata") or {}
    return str(metadata.get("full_name") or "").strip()

def _sync_default_name(profile: Profile, current_user: dict) -> bool:
    auth_name = _auth_name(current_user)
    if auth_name and (not profile.name or profile.name.strip() == "Merchant"):
        profile.name = auth_name
        return True
    return False

@router.get("", response_model=ProfileRead)
def get_profile(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)) -> Profile:
    profile = db.get(Profile, user_id(current_user))
    if profile is None:
        profile = Profile(id=user_id(current_user))
        auth_name = _auth_name(current_user)
        if auth_name:
            profile.name = auth_name
        db.add(profile)
        db.commit()
        db.refresh(profile)
    elif _sync_default_name(profile, current_user):
        db.commit()
        db.refresh(profile)
    return profile

@router.put("", response_model=ProfileRead)
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)) -> Profile:
    profile = db.get(Profile, user_id(current_user))
    if profile is None:
        profile = Profile(id=user_id(current_user), **payload.model_dump())
        db.add(profile)
    else:
        for field, value in payload.model_dump().items():
            setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile
