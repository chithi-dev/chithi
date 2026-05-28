"""﻿ All type definitions live here; resolvers are in queries/mutations.."""
from __future__ import annotations
from typing import Optional
import strawberry
@strawberry.type
class UserOut:
    id: strawberry.ID
    username: str
    email: Optional[str] = None
@strawberry.type
class LoginResult:
    access_token: str
    token_type: str = "bearer"
@strawberry.type
class OnboardingStatus:
    onboarded: bool
@strawberry.type
class PaginationInfo:
    total: int
    page: int
    page_size: int
    pages: int
@strawberry.input
class UserCreateInput:
    username: str
    email: Optional[str] = None
    password: str
@strawberry.input
class UserUpdateInput:
    username: Optional[str] = None
    email: Optional[str] = None
