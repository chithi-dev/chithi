from pathlib import Path
from typing import Final


# Internal loader

_BASE_DIR: Final[Path] = Path(__file__).parent

# Public API types

class LuaModule:
    """Typed representation of a loaded Lua file."""

    __slots__ = ("__file__", "code")

    def __init__(self, file: Path, code: str) -> None:
        self.__file__: str = str(file)
        self.code: str = code

    def __repr__(self) -> str:
        return f"<LuaModule file={self.__file__!r}>"


def _load_lua_file(path: Path) -> LuaModule:
    content: str = path.read_text(encoding="utf-8")
    return LuaModule(path, content)


# Dynamic loading (runtime)

_modules: dict[str, LuaModule] = {}

for file in _BASE_DIR.glob("*.lua"):
    name: str = file.stem  # script_1.lua -> script_1
    module: LuaModule = _load_lua_file(file)

    _modules[name] = module
    globals()[name] = module  # dynamic export


# typed accessor

def get(name: str) -> LuaModule:
    """Type-safe access to Lua modules."""
    return _modules[name]


# Typed export list

__all__: list[str] = list(_modules.keys())