import importlib
import logging
from pathlib import Path
from fastapi import APIRouter
from fastapi.routing import APIRoute
from typing import List, Tuple

# Configure logging
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


def _normalize_prefix(prefix: str) -> str:
    """Ensure prefix starts with '/' and has no trailing '/'"""
    if not prefix or prefix.strip("/") == "":
        return ""

    # Clean up multiple slashes and whitespace
    clean_prefix = "/".join(part for part in prefix.strip().split("/") if part)

    # Ensure single leading slash, no trailing slash
    return f"/{clean_prefix}"


def register_routes(folder_name: str) -> APIRouter:
    """
    Auto-registers routes from app/<folder_name> directory with FLAT routing:

    - app/routes/__init__.py → /
    - app/routes/test.py → /test/
    - app/routes/nested/demo.py → /demo/

    Directory structure is ignored - only filenames determine routes
    """
    app_dir = Path(__file__).parent.resolve()
    target_dir = app_dir / folder_name

    if not target_dir.is_dir():
        raise FileNotFoundError(
            f"Route directory 'app/{folder_name}' does not exist. "
            f"Searched at: {target_dir}"
        )

    logger.info(f"\n{'#' * 80}")
    logger.info(f"REGISTERING FLAT ROUTES FROM: app/{folder_name}")
    logger.info(f"Source directory: {target_dir}")
    logger.info(f"{'#' * 80}\n")

    root_router = APIRouter()

    # Collect all route files first (flat structure)
    route_files = []
    for py_file in target_dir.rglob("*.py"):
        if py_file.name in {"router.py", "__init__.py"} or py_file.name.startswith("_"):
            continue

        # Skip __pycache__ and other non-route directories
        if "__pycache__" in py_file.parts:
            continue

        route_files.append(py_file)

    # Special handling for root __init__.py
    root_init = target_dir / "__init__.py"
    if root_init.exists():
        logger.info("Registering ROOT routes from __init__.py")
        _register_module(root_init, root_router, app_dir, "")

    # Process all other route files
    for py_file in sorted(route_files):
        rel_path = py_file.relative_to(target_dir)

        # Use filename as the route prefix (without .py)
        prefix = _normalize_prefix(py_file.stem)
        logger.info(f"Registering: {rel_path} → {prefix}")

        _register_module(py_file, root_router, app_dir, prefix)

    # Log all registered routes
    _log_registered_routes(root_router)

    return root_router


def _register_module(
    file_path: Path, router: APIRouter, base_path: Path, prefix: str
) -> None:
    """Register module with flat prefix handling"""
    try:
        rel_path = file_path.relative_to(base_path)
        module_parts = list(rel_path.with_suffix("").parts)
        module_name = "app." + ".".join(module_parts)

        logger.debug(f"Importing: {module_name} → {prefix}")

        module = importlib.import_module(module_name)

        if not hasattr(module, "router"):
            raise AttributeError(f"Missing 'router' in {module_name}")

        if not isinstance(module.router, APIRouter):
            raise TypeError(f"'router' in {module_name} must be APIRouter instance")

        # Special case: root __init__.py
        if file_path.name == "__init__.py" and file_path.parent == base_path / "routes":
            logger.debug(f"Registering root routes from {file_path.name}")
            # For root __init__.py, include directly without prefix
            for route in module.router.routes:
                # Add the route as-is (it should already be defined for root)
                router.routes.append(route)
        else:
            logger.debug(f"Including router: {module_name} → {prefix}")
            # Ensure prefix is properly formatted
            normalized_prefix = _normalize_prefix(prefix)
            router.include_router(module.router, prefix=normalized_prefix)

    except Exception as e:
        logger.error(
            f"✗ FAILED to register {file_path.relative_to(base_path)}: {str(e)}"
        )
        raise RuntimeError(
            f"Failed to register {file_path.relative_to(base_path)}: {str(e)}"
        ) from e


def _log_registered_routes(router: APIRouter) -> List[Tuple[str, str, str]]:
    """Log all routes with their actual paths"""
    routes: List[Tuple[str, str, str]] = []

    for route in router.routes:
        if isinstance(route, APIRoute):
            for method in route.methods:
                # Format path to show clean representation
                path = route.path
                routes.append((method, path, route.name))

    if not routes:
        return routes

    routes.sort(key=lambda x: (x[1], x[0]))

    logger.info("\n" + "=" * 80)
    logger.info("REGISTERED FLAT ROUTES")
    logger.info("-" * 80)

    for method, path, name in routes:
        logger.info(f"{method:6} {path:40} → {name}")

    logger.info("-" * 80)
    logger.info(f"TOTAL ROUTES: {len(routes)}")
    logger.info("=" * 80 + "\n")

    return routes
