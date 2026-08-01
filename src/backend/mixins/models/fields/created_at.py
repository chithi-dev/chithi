from django.db import models


class CreatedAtMixin(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")

    class Meta:
        abstract = True
