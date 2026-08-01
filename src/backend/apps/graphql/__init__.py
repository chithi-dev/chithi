from strawberry.schema.schema import Schema

__all__ = ["schema"]


# Lazy import — schema references models, so it can't be imported at
# module load time (Django apps aren't ready during app_config creation).
def __getattr__(name) -> Schema:
    if name == "schema":
        from .schema import schema as _schema

        return _schema
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
