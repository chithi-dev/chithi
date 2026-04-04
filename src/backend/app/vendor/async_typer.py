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
    Union,
)

import typer

P = ParamSpec("P")
R = TypeVar("R")

EventType = Literal["startup", "shutdown"]

SyncHandler = Callable[[], None]
AsyncHandler = Callable[[], Coroutine[Any, Any, None]]
EventHandler = Union[SyncHandler, AsyncHandler]


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
                self._run_handlers_sync("startup")
                try:
                    return self._run_async(async_func(*_args, **_kwargs))
                finally:
                    self._run_handlers_sync("shutdown")

            self.command(*args, **kwargs)(sync_func)
            return async_func

        return decorator

    def add_event_handler(
        self, event_type: EventType, func: EventHandler
    ) -> None:
        self.event_handlers[event_type].append(func)

    def _run_async(self, coro: Coroutine[Any, Any, R]) -> R:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(coro)
        else:
            # Already inside an event loop → create task and wait
            return loop.run_until_complete(coro)  # type: ignore

    def _run_handlers_sync(self, event_type: EventType) -> None:
        for handler in self.event_handlers[event_type]:
            result = handler()
            if iscoroutine(result):
                self._run_async(result)