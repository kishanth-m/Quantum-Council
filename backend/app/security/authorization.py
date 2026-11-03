"""
backend/app/security/authorization.py

FastAPI dependency functions for authentication and authorization.
Import get_current_user in route handlers to enforce login.
"""

from typing import Optional, Union
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database.db import get_db
from app.database.models import User
from app.security.authentication import decode_access_token

# OAuth2 scheme — clients send the token as "Authorization: Bearer <token>"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


class LocalUser:
    """Synthetic user object representing the single local desktop user in local deployment mode."""
    id: str = "default_user"
    username: str = "local_desktop_user"
    email: str = "local@desktop"
    is_active: bool = True


LOCAL_USER = LocalUser()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that verifies the JWT token and returns the User object.

    Raises HTTP 401 if the token is missing, invalid, or expired.
    Raises HTTP 401 if the user no longer exists or is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception

    return user


def get_session_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> Union[User, LocalUser]:
    """
    Mode-aware authentication dependency:
    - In ONLINE MODE:
      - Valid token is strictly required. Missing token -> HTTP 401. Invalid/expired token -> HTTP 401.
      - Returns verified authenticated User instance.
    - In LOCAL DESKTOP MODE:
      - If token is provided: validates token. If invalid/expired -> HTTP 401. If valid -> returns User.
      - If token is omitted: returns local single-user context (LOCAL_USER with id="default_user").
    """
    if token:
        user_id = decode_access_token(token)
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found or inactive",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user

    # No token provided
    if settings.is_online_mode:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for online deployment mode",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Local Desktop Mode fallback
    return LOCAL_USER


def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Like get_current_user but returns None if no token was provided.
    Raises HTTP 401 if a token was supplied but is invalid or expired.
    """
    if not token:
        return None
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


