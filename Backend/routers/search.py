from fastapi import APIRouter

router = APIRouter()

@router.get("/search")
def search_items():
    return {"mensaje":"search funcionando"}