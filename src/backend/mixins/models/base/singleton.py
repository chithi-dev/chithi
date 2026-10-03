from django.core.exceptions import ValidationError
from django.db import models


class SingletonModel[T: SingletonModel](models.Model):
    """Abstract model that enforces a single instance in the database."""

    class Meta:
        abstract = True

    def save(self, *args, **kwargs) -> None:
        # Reject insertion if any row already exists. Equality on the new
        # row's PK is fine (e.g. ``Config.load()`` re-uses pk=1) — what
        # we forbid is a *second* row from being inserted.
        existing = self.__class__.objects.all()
        if self.pk is not None:
            existing = existing.exclude(pk=self.pk)
        if existing.exists():
            raise ValidationError(
                f"Only one instance of {self.__class__.__name__} is allowed."
            )
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> T:
        """Return the single instance, creating it if it doesn't exist."""
        instance = cls.objects.first()
        if instance is None:
            instance = cls.objects.create(pk=1)
        return instance
