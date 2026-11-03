"""
backend/app/api/routes/privacy.py

Endpoints for inspecting and updating privacy settings.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.database.models import PrivacySettings

router = APIRouter(prefix="/privacy", tags=["Privacy"])


class PrivacySettingsSchema(BaseModel):
    privacy_mode: str  # local_only | hybrid
    allow_online_llm: bool
    allow_cloud_documents: bool
    require_consent_before_external: bool


class PrivacySettingsUpdate(BaseModel):
    privacy_mode: str


@router.get("/settings", response_model=PrivacySettingsSchema)
def get_privacy_settings(db: Session = Depends(get_db)):
    """Retrieve active privacy settings."""
    settings_record = db.query(PrivacySettings).first()
    if not settings_record:
        settings_record = PrivacySettings(
            user_id="default_user",
            privacy_mode="local_only",
            allow_online_llm=False,
            allow_cloud_documents=False,
            require_consent_before_external=True,
        )
        db.add(settings_record)
        db.commit()
        db.refresh(settings_record)

    return PrivacySettingsSchema(
        privacy_mode=settings_record.privacy_mode,
        allow_online_llm=settings_record.allow_online_llm,
        allow_cloud_documents=settings_record.allow_cloud_documents,
        require_consent_before_external=settings_record.require_consent_before_external,
    )


@router.put("/settings", response_model=PrivacySettingsSchema)
def update_privacy_settings(
    update: PrivacySettingsUpdate,
    db: Session = Depends(get_db),
):
    """Update privacy mode (local_only vs hybrid)."""
    settings_record = db.query(PrivacySettings).first()
    if not settings_record:
        settings_record = PrivacySettings(
            user_id="default_user",
            privacy_mode=update.privacy_mode,
            allow_online_llm=(update.privacy_mode == "hybrid"),
            allow_cloud_documents=False,
            require_consent_before_external=True,
        )
        db.add(settings_record)
    else:
        settings_record.privacy_mode = update.privacy_mode
        settings_record.allow_online_llm = (update.privacy_mode == "hybrid")
        settings_record.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(settings_record)

    return PrivacySettingsSchema(
        privacy_mode=settings_record.privacy_mode,
        allow_online_llm=settings_record.allow_online_llm,
        allow_cloud_documents=settings_record.allow_cloud_documents,
        require_consent_before_external=settings_record.require_consent_before_external,
    )

