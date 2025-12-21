import importlib
import logging
from pathlib import Path
from fastapi import APIRouter
from fastapi.routing import APIRoute
from typing import Set

# Configure logging ONCE
logger = logging.getLogger("auto_router")
logger.setLevel(logging.INFO)

if not logger.handlers:
    console_handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    # Prevent logs from bubbling up to root if already handled
    logger.propagate = False

# Global state to prevent duplicate registration across reloads
_ALREADY_REGISTERED: Set[str] = set()
_REGISTERED_ROUTES: Set[str] = set()


def _normalize_prefix(prefix: str) -> str:
    """Ensure prefix starts with '/' and has NO trailing slash"""
    if not prefix or prefix.strip("/") == "":
        return ""

    # Clean and normalize path
    clean_parts = [part for part in prefix.strip().split("/") if part]
    clean_prefix = "/".join(clean_parts)

    return f"/{clean_prefix}" if clean_prefix else ""


def _is_route_unique(method: str, path: str) -> bool:
    """Check if route is already registered"""
    clean_path = path.rstrip("/")
    if clean_path == "" or clean_path == "/":
        clean_path = "/"
    else:
        clean_path = "/" + clean_path.lstrip("/")

    route_id = f"{method}:{clean_path}"
    if route_id in _REGISTERED_ROUTES:
        return False
    _REGISTERED_ROUTES.add(route_id)
    return True


def register_routes(folder_name: str) -> APIRouter:
    """
    Auto-registers routes from app/<folder_name> using GLOB PATTERNS

    Prevents duplicate registration when imported multiple times (FastAPI reload)
    """
    app_dir = Path(__file__).parent.resolve()
    target_dir = (app_dir / folder_name).resolve()

    # Use resolved path string as key to ensure absolute uniqueness
    registration_key = str(target_dir)

    # Prevent duplicate registration across reloads
    if registration_key in _ALREADY_REGISTERED:
        return APIRouter()

    if not target_dir.is_dir():
        raise FileNotFoundError(
            f"Route directory 'app/{folder_name}' does not exist. "
            f"Searched at: {target_dir}"
        )

    logger.info(f"\n{'=' * 80}")
    logger.info(f"REGISTERING ROUTES FROM: app/{folder_name}")
    logger.info(f"Source directory: {target_dir}")
    logger.info(f"{'=' * 80}\n")

    root_router = APIRouter()

    # Get ALL Python files using glob
    all_py_files = list(target_dir.rglob("*.py"))

    # Process root __init__.py first if exists
    root_init = target_dir / "__init__.py"
    if root_init in all_py_files:
        _register_module(root_init, root_router, app_dir, "")
        all_py_files.remove(root_init)

    # Process all other .py files
    for py_file in sorted(all_py_files):
        if py_file.name.startswith("_") or py_file.name == "router.py":
            continue

        prefix = _normalize_prefix(py_file.stem)
        logger.info(f"Registering: {py_file.relative_to(target_dir)} → {prefix or '/'}")
        _register_module(py_file, root_router, app_dir, prefix)

    # Log unique routes summary
    _log_registered_routes(root_router)

    # Mark as registered
    _ALREADY_REGISTERED.add(registration_key)

    return root_router


def _register_module(
    file_path: Path, router: APIRouter, base_path: Path, prefix: str
) -> None:
    """Register module with proper prefix handling"""
    try:
        rel_path = file_path.relative_to(base_path)
        module_parts = list(rel_path.with_suffix("").parts)
        module_name = "app." + ".".join(module_parts)

        module = importlib.import_module(module_name)

        if not hasattr(module, "router"):
            raise AttributeError(f"Missing 'router' in {module_name}")

        if not isinstance(module.router, APIRouter):
            raise TypeError(f"'router' in {module_name} must be APIRouter instance")

        # Check uniqueness for routes being added directly (like in __init__.py)
        if file_path.name == "__init__.py":
            for route in module.router.routes:
                if isinstance(route, APIRoute):
                    for method in route.methods:
                        if _is_route_unique(method, route.path):
                            router.routes.append(route)
        else:
            # For included routers, we check the routes within them before including
            # to ensure the summary and the registration stay in sync
            normalized_prefix = _normalize_prefix(prefix)
            router.include_router(module.router, prefix=normalized_prefix)

            # Populate global registry for included routes to prevent log duplication later
            for route in module.router.routes:
                if isinstance(route, APIRoute):
                    full_path = f"{normalized_prefix}{route.path}".replace("//", "/")
                    for method in route.methods:
                        _is_route_unique(method, full_path)

    except Exception as e:
        logger.error(
            f"✗ FAILED to register {file_path.relative_to(base_path)}: {str(e)}"
        )
        raise RuntimeError(f"Failed to register: {str(e)}") from e


def _log_registered_routes(router: APIRouter) -> None:
    """Log all unique routes from the current registration cycle"""
    routes_to_print = []

    for route in router.routes:
        if isinstance(route, APIRoute):
            for method in route.methods:
                clean_path = route.path.rstrip("/") or "/"
                routes_to_print.append((method, clean_path, route.name))

    if not routes_to_print:
        return

    routes_to_print.sort(key=lambda x: (x[1], x[0]))

    logger.info("\n" + "=" * 80)
    logger.info("REGISTERED ROUTES SUMMARY")
    logger.info("-" * 80)

    for method, path, name in routes_to_print:
        logger.info(f"{method:6} {path:40} → {name}")

    logger.info("-" * 80)
    logger.info(f"TOTAL UNIQUE ROUTES: {len(routes_to_print)}")
    logger.info("=" * 80 + "\n")
