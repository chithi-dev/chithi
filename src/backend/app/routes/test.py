from fastapi import APIRouter


router = APIRouter()


@router.get("/")
async def list_usefrs():
    return {"users": ["alice", "bob"]}
