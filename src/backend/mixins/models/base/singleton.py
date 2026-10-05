from django.core.exceptions import ValidationError
from django.db import models


class SingletonModel[T: SingletonModel](models.Model):
    """Abstract model that enforces a single instance in the database.

    Two entry points, matching Django 6's async ORM:

    - ``load()``  – synchronous, for contexts Django calls synchronously
      (validators, admin, the ``save()`` guard below).
    - ``aload()`` – native async, using the ``a``-prefixed ORM methods,
      for async views and mutations. Atomic via ``aget_or_create``.
    """

    class Meta:
        abstract = True

    def save(self, *args, **kwargs) -> None:
        # Django invokes save() synchronously (from asave(), create(), admin,
        # save chaining), so this guard must stay sync. It rejects a second
        # row: updating the existing row (e.g. Config.load() re-using pk=1)
        # is fine; inserting another one is not.
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
        """Synchronous: return the single instance, creating it if absent."""
        instance = cls.objects.first()
        if instance is None:
            instance = cls.objects.create(pk=1)
        return instance

    @classmethod
    async def aload(cls) -> T:
        """Async: return the single instance, creating it if absent.

        ``aget_or_create`` is a single atomic statement, so concurrent first
        loads cannot both insert. Django 6 has no async transaction support,
        but this is a single upsert with no multi-statement transaction.
        """
        instance, _created = await cls.objects.aget_or_create(pk=1)
        return instance
