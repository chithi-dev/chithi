from fastapi import APIRouter

from app.deps import CurrentUser

router = APIRouter(prefix="/token")


@router.get("/validate", response_model=dict)
async def validate_token(_: CurrentUser):
    """
    Validates the JWT and returns the corresponding user info.
    """
    return {
        "valid": True,
    }
