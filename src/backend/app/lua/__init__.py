import weakref
from pathlib import Path
from typing import Final

BASE_DIR: Final = Path(__file__).parent


class LuaModule:
    """Typed representation of a loaded Lua file."""

    __slots__ = ("__file__", "code")

    def __init__(self, file: Path, code: str) -> None:
        self.__file__ = str(file)
        self.code = code

    def __repr__(self) -> str:
        return f"<LuaModule file={self.__file__!r}>"


def _load_lua_file(path: Path) -> LuaModule:
    return LuaModule(path, path.read_text("utf-8"))


# Weak cache allows GC when unused
_cache: "weakref.WeakValueDictionary[str, LuaModule]" = weakref.WeakValueDictionary()

_paths: dict[str, Path] = {file.stem: file for file in BASE_DIR.glob("*.lua")}


def __getattr__(name: str) -> LuaModule:
    """Lazy load Lua modules on attribute access."""

    if name not in _paths:
        raise AttributeError(name)

    module = _cache.get(name)
    if module is None:
        module = _load_lua_file(_paths[name])
        _cache[name] = module

    return module


# Typing hints for static analyzers
json_remove_file_by_key: LuaModule
json_remove_upload_by_key: LuaModule
json_update_uploaded_bytes_by_key: LuaModule


__all__ = [
    "json_remove_file_by_key",
    "json_remove_upload_by_key",
    "json_update_uploaded_bytes_by_key",
]
