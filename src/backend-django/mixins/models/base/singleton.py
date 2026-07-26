from django.core.exceptions import ValidationError
from django.db import models


class SingletonModel[T: SingletonModel](models.Model):
    """Abstract model that enforces a single instance in the database."""

    class Meta:
        abstract = True

    def save(self, *args, **kwargs) -> None:
        if not self.pk and self.__class__.objects.exists():
            raise ValidationError(
                f"Only one instance of {self.__class__.__name__} is allowed."
            )
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> T:
        """Return the single instance, creating it if it doesn't exist."""
        return cls.objects.get_or_create(pk=1)[0]
