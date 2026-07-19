import uuid_utils.compat as uuid
from django.db import models


class UUIDPrimaryKeyMixin(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid7,
        editable=False,
    )

    class Meta:
        abstract = True
