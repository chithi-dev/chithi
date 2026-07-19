from celery import shared_task
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)


@shared_task()
def remove_expired_blacklisted_tokens() -> str:
    now = timezone.now()
    expired_tokens = BlacklistedToken.objects.filter(token__expires_at__lt=now)
    count = expired_tokens.count()
    expired_tokens.delete()
    return f"Deleted {count} expired blacklisted tokens."


@shared_task()
def remove_expired_outstanding_tokens() -> str:
    now = timezone.now()
    expired = OutstandingToken.objects.filter(expires_at__lt=now)
    count = expired.count()
    expired.delete()
    return f"Deleted {count} expired outstanding tokens."
