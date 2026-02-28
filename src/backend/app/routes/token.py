from fastapi import APIRouter

from app.deps import CurrentUser

router = APIRouter()


@router.get("/token/validate", response_model=dict)
async def validate_token(_: CurrentUser):
    """
    Validates the JWT and returns the corresponding user info.
    """
    return {
        "valid": True,
    }
