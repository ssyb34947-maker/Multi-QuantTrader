from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.common import ApiResponse


def ok(data, message: str = "success"):
    return ApiResponse(code=200, message=message, data=data)


def paginated(items, total: int, page: int, page_size: int, message: str = "success"):
    total_pages = max(1, (total + page_size - 1) // page_size)
    return ApiResponse(
        code=200,
        message=message,
        data={
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        },
    )
