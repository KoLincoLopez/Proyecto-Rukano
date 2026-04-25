from fastapi import APIRouter

router = APIRouter()

@router.get("/reviews")
def get_reviews():
    return {"mensaje":"reviews funcionando"}