"""API katmani icin ortak FastAPI dependency'leri (auth, DB session vb.)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@dataclass(frozen=True)
class CurrentUser:
    user_id: uuid.UUID
    family_id: uuid.UUID
    role: str


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """JWT'yi dogrular ve CurrentUser dondurur.

    NOT: Bu ilk-surum iskelette sadece token imzasi/claim'leri kontrol
    edilir. Production oncesi eklenmesi gereken kontroller:
    - users tablosunda is_active=true dogrulamasi (user_repository ile)
    - token blacklist kontrolu (Redis, logout/refresh senaryolari icin)
    """
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Kimlik dogrulanamadi",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        family_id = payload.get("family_id")
        role = payload.get("role", "member")
        if user_id is None or family_id is None:
            raise credentials_exception
    except jwt.PyJWTError as exc:
        raise credentials_exception from exc

    return CurrentUser(user_id=uuid.UUID(user_id), family_id=uuid.UUID(family_id), role=role)
