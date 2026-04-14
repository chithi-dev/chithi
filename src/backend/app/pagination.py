from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field
from sqlalchemy.sql import func
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.expression import SelectOfScalar

from app.settings import settings

T = TypeVar("T", bound=SQLModel)


class PaginationInput(BaseModel):
    """Model passed in the request to validate pagination input."""

    page: int = Field(default=1, ge=1, description="Requested page number")
    page_size: int = Field(
        default=10,
        ge=1,
        le=settings.MAX_RESULTS_PER_PAGE,
        description="Requested number of items per page",
    )


class Page(BaseModel, Generic[T]):
    """Model to represent a page of results along with pagination metadata."""

    items: list[T] = Field(description="List of items on this Page")
    total_items: int = Field(ge=0, description="Number of total items")
    start_index: int = Field(ge=0, description="Starting item index")
    end_index: int = Field(ge=0, description="Ending item index")
    total_pages: int = Field(ge=0, description="Total number of pages")
    current_page: int = Field(
        ge=0, description="Page number (could differ from request)"
    )
    current_page_size: int = Field(
        ge=0, description="Number of items per page (could differ from request)"
    )
    meta: dict[str, Any] = Field(
        default_factory=dict, description="Extra metadata for the response"
    )


async def paginate(
    query: SelectOfScalar[T],  # SQLModel select query
    session: AsyncSession,
    pagination_input: PaginationInput,
    meta: dict[str, Any] | None = None,
) -> Page[T]:
    """Paginate the given query based on the pagination input."""

    # Get the total number of items
    total_items = await session.scalar(
        select(func.count()).select_from(query.subquery())
    )
    assert isinstance(total_items, int), (
        "A database error occurred when getting `total_items`"
    )

    # Handle out-of-bounds page requests by going to the last page instead of displaying
    # empty data.
    total_pages = (
        total_items + pagination_input.page_size - 1
    ) // pagination_input.page_size
    # we don't want to have 0 page even if there is no item.
    total_pages = max(total_pages, 1)
    current_page = min(pagination_input.page, total_pages)

    # Calculate the offset for pagination
    offset = (current_page - 1) * pagination_input.page_size

    # Apply limit and offset to the query
    result = await session.exec(query.offset(offset).limit(pagination_input.page_size))

    # Fetch the paginated items
    items = list(result.all())

    # Calculate the rest of pagination metadata
    start_index = offset + 1 if total_items > 0 else 0
    end_index = min(offset + pagination_input.page_size, total_items)

    # Return the paginated response using the Page model
    return Page[T](
        items=items,
        total_items=total_items,
        start_index=start_index,
        end_index=end_index,
        total_pages=total_pages,
        current_page_size=len(items),  # can differ from the requested page_size
        current_page=current_page,  # can differ from the requested page
        meta=meta or {},
    )
