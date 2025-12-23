import importlib
import logging
import gc
from pathlib import Path
from fastapi import APIRouter
from fastapi.routing import APIRoute
from typing import Set

# Configure logging
logger = logging.getLogger("auto_router")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(ch)
    logger.propagate = False

# Ephemeral state for validation
_ALREADY_REGISTERED: Set[str] = set()
_REGISTERED_ROUTES: Set[str] = set()


def _normalize_prefix(prefix: str) -> str:
    if not prefix or prefix.strip("/") == "":
        return ""
    clean = "/".join([p for p in prefix.strip().split("/") if p])
    return f"/{clean}" if clean else ""


def _is_route_unique(method: str, path: str) -> bool:
    clean_path = f"/{path.strip('/')}" if path.strip("/") else "/"
    route_id = f"{method}:{clean_path}"
    if route_id in _REGISTERED_ROUTES:
        return False
    _REGISTERED_ROUTES.add(route_id)
    return True


def register_routes(folder_name: str, cleanup: bool = True) -> APIRouter:
    """
    Registers routes and performs a memory cleanup of discovery metadata.
    """
    app_dir = Path(__file__).parent.resolve()
    target_dir = (app_dir / folder_name).resolve()
    reg_key = str(target_dir)

    if reg_key in _ALREADY_REGISTERED:
        return APIRouter()

    if not target_dir.is_dir():
        raise FileNotFoundError(f"Directory not found: {target_dir}")

    logger.info(f"STARTING REGISTRATION: {folder_name}")
    root_router = APIRouter()

    # Use a generator to find files to keep memory low during iteration
    py_files = sorted(list(target_dir.rglob("*.py")))

    # 1. Handle __init__.py
    root_init = target_dir / "__init__.py"
    if root_init in py_files:
        _register_module(root_init, root_router, app_dir, "")
        py_files.remove(root_init)

    # 2. Handle standard route files
    for py_file in py_files:
        if py_file.name.startswith("_") or py_file.name == "router.py":
            continue

        prefix = _normalize_prefix(py_file.stem)
        _register_module(py_file, root_router, app_dir, prefix)

    # 3. Log results
    _log_registered_routes(root_router)

    # 4. Cleanup Step
    _ALREADY_REGISTERED.add(reg_key)

    if cleanup:
        # Clear the validation set - we don't need it after the app is built
        _REGISTERED_ROUTES.clear()
        # Remove reference to the file list
        del py_files
        # Force garbage collection to reclaim path objects and strings immediately
        gc.collect()
        logger.info("CLEANUP: Metadata sets cleared and GC triggered.")

    return root_router


def _register_module(
    file_path: Path, router: APIRouter, base_path: Path, prefix: str
) -> None:
    try:
        # 1. Improved Module Discovery
        # Get the relative path from the project root (not just app_dir)
        # Assuming your project root is the parent of 'app'
        parts = file_path.with_suffix("").parts

        # Find where 'app' starts to build a correct absolute import
        if "app" in parts:
            app_index = parts.index("app")
            module_name = ".".join(parts[app_index:])
        else:
            # Fallback for localized structures
            rel_path = file_path.relative_to(base_path)
            module_name = ".".join(rel_path.with_suffix("").parts)

        module = importlib.import_module(module_name)

        mod_router = getattr(module, "router", None)
        if not isinstance(mod_router, APIRouter):
            logger.debug(f"No APIRouter found in {module_name}")
            return

        if file_path.name == "__init__.py":
            # Direct injection for __init__ routes
            for r in mod_router.routes:
                if isinstance(r, APIRoute):
                    for m in r.methods:
                        if _is_route_unique(m, r.path):
                            router.routes.append(r)
        else:
            # Standard inclusion
            norm_prefix = _normalize_prefix(prefix)
            # Ensure we don't double-slash or miss a slash
            router.include_router(mod_router, prefix=norm_prefix)

            # Log for uniqueness tracking
            for r in mod_router.routes:
                if isinstance(r, APIRoute):
                    full_p = f"{norm_prefix}{r.path}".replace("//", "/")
                    for m in r.methods:
                        _is_route_unique(m, full_p)

    except Exception as e:
        logger.error(f"Error registering {file_path}: {e}", exc_info=True)


def _log_registered_routes(router: APIRouter) -> None:
    # Logic remains same as previous but localizes variables for GC
    routes = []
    for r in router.routes:
        if isinstance(r, APIRoute):
            for m in r.methods:
                routes.append((m, r.path.rstrip("/") or "/", r.name))

    if not routes:
        return
    routes.sort(key=lambda x: (x[1], x[0]))

    logger.info("\n" + "=" * 50 + "\nREGISTERED ROUTES\n" + "-" * 50)
    for m, p, n in routes:
        logger.info(f"{m:6} {p:30} -> {n}")
    logger.info(f"TOTAL: {len(routes)}\n" + "=" * 50)
