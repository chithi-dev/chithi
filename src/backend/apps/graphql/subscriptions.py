import strawberry

from apps.graphql.consumers import AppStateType, _compute_state_standalone


@strawberry.type
class Subscription:
    @strawberry.subscription
    async def remaining_storage(self) -> AppStateType:
        """Stream app-state snapshots (storage usage + active uploads).

        Polls the DB periodically to emit fresh state.
        The WebSocket StateConsumer on ws:/ws/state provides the same data
        via channels groups — both paths share _compute_state_standalone()
        so the system works identically in single-process and cluster modes.
        """
        # Emit an initial snapshot immediately
        state = await _compute_state_standalone()
        yield AppStateType(**state)

        # Keep the subscription alive and push updates periodically.
        # Strawberry's subscription transport handles the WebSocket lifecycle.
        while True:
            await asyncio.sleep(5)
            state = await _compute_state_standalone()
            yield AppStateType(**state)
