import inspect
from time import time_ns

from fastapi_limiter.depends import RateLimiter
from pyrate_limiter import BucketFactory, Limiter, Rate, RateItem
from pyrate_limiter.buckets.redis_bucket import RedisBucket

from app.states.app import GlobalState


class RedisBucketFactory(BucketFactory):
    def __init__(self, *rates: Rate):
        self.rates = list(rates)
        self._buckets = {}

    def wrap_item(self, name: str, weight: int = 1) -> RateItem:
        return RateItem(name, time_ns() // 1_000_000, weight=weight)

    async def get(self, item: RateItem) -> RedisBucket:
        bucket_key = f"rate_limit:{item.name}"
        if bucket_key not in self._buckets:
            redis = GlobalState._client()
            res = RedisBucket.init(self.rates, redis, bucket_key)
            if inspect.isawaitable(res):
                res = await res
            self._buckets[bucket_key] = res
        return self._buckets[bucket_key]


def get_rate_limiter(*rates: Rate) -> RateLimiter:
    return RateLimiter(limiter=Limiter(RedisBucketFactory(*rates)))
