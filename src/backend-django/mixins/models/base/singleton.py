from typing import Self

from django.core.exceptions import ValidationError
from django.db import models


class SingletonModel(models.Model):
    class Meta:
        abstract = True

    def save(self, *args, **kwargs) -> None:
        if not self.pk and self.__class__.objects.exists():
            raise ValidationError(
                f"Only one instance of {self.__class__.__name__} is allowed."
            )
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> Self:
        """Return the single instance, create if doesn't exist."""
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
