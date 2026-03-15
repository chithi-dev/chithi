from fastapi import APIRouter

from app.deps import CurrentUser
from app.schemas.token import TokenValidOut

router = APIRouter(prefix="/token")


@router.get("/validate", response_model=TokenValidOut)
async def validate_token(_: CurrentUser):
    """
    Validates the JWT and returns the corresponding user info.
    """
    return {
        "valid": True,
    }
