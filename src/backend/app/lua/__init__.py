from pathlib import Path
from typing import Final

BASE_DIR: Final[Path] = Path(__file__).parent


class LuaModule:
    """Typed representation of a loaded Lua file."""

    __slots__ = ("__file__", "code")

    def __init__(self, file: Path, code: str) -> None:
        self.__file__: str = str(file)
        self.code: str = code

    def __repr__(self) -> str:
        return f"<LuaModule file={self.__file__!r}>"


def _load_lua_file(path: Path) -> LuaModule:
    return LuaModule(path, path.read_text(encoding="utf-8"))


# Load modules and export to globals
_modules: dict[str, LuaModule] = {
    file.stem: _load_lua_file(file) for file in BASE_DIR.glob("*.lua")
}

globals().update(_modules)


def get(name: str) -> LuaModule:
    """Type-safe access to Lua modules."""
    return _modules[name]
