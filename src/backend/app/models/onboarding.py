from sqlmodel import SQLModel


class OnboardingOut(SQLModel):
    onboarded: bool


class OnboardingPOSTOut(SQLModel):
    message: str
