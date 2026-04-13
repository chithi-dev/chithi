from pathlib import Path
from typing import Final

BASE_DIR: Final[Path] = Path(__file__).parent


class LuaModule:
    """Typed representation of a loaded Lua file."""

    __slots__ = ("__file__", "code")

    def __init__(self, file: Path, code: str) -> None:
        self.__file__ = str(file)
        self.code = code

    def __repr__(self) -> str:
        return f"<LuaModule file={self.__file__!r}>"


def _load_lua_file(path: Path) -> LuaModule:
    return LuaModule(path, path.read_text(encoding="utf-8"))


# Load modules and export to globals
_modules: dict[str, LuaModule] = {
    file.stem: _load_lua_file(file) for file in BASE_DIR.glob("*.lua")
}

globals().update(_modules)


# Definitions

json_remove_file_by_key: LuaModule
json_remove_upload_by_key: LuaModule
json_update_uploaded_bytes_by_key: LuaModule

__all__ = ['json_remove_file_by_key','json_remove_upload_by_key','json_update_uploaded_bytes_by_key','rate_limit']
