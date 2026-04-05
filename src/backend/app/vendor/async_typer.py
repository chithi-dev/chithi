import asyncio
from collections import defaultdict
from functools import wraps
from inspect import iscoroutine
from typing import (
    Any,
    Callable,
    Coroutine,
    DefaultDict,
    Literal,
    ParamSpec,
    TypeVar,
)

import typer

P = ParamSpec("P")
R = TypeVar("R")

EventType = Literal["startup", "shutdown"]

SyncHandler = Callable[[], None]
AsyncHandler = Callable[[], Coroutine[Any, Any, None]]
EventHandler = SyncHandler | AsyncHandler


class AsyncTyper(typer.Typer):
    event_handlers: DefaultDict[EventType, list[EventHandler]]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.event_handlers = defaultdict(list)

    def async_command(
        self, *args: Any, **kwargs: Any
    ) -> Callable[
        [Callable[P, Coroutine[Any, Any, R]]],
        Callable[P, Coroutine[Any, Any, R]],
    ]:
        def decorator(
            async_func: Callable[P, Coroutine[Any, Any, R]],
        ) -> Callable[P, Coroutine[Any, Any, R]]:
            @wraps(async_func)
            def sync_func(*_args: P.args, **_kwargs: P.kwargs) -> R:
                async def runner() -> R:
                    await self._run_handlers("startup")
                    try:
                        return await async_func(*_args, **_kwargs)
                    finally:
                        await self._run_handlers("shutdown")

                return asyncio.run(runner())

            self.command(*args, **kwargs)(sync_func)
            return async_func

        return decorator

    def add_event_handler(
        self, event_type: EventType, func: EventHandler
    ) -> None:
        self.event_handlers[event_type].append(func)

    async def _run_handlers(self, event_type: EventType) -> None:
        for handler in self.event_handlers[event_type]:
            result = handler()
            if iscoroutine(result):
                await result