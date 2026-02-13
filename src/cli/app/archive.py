"""ZIP compress/extract helpers (supports WinZip AES-256)."""

import os
import tempfile
from pathlib import Path

import pyzipper
from tqdm import tqdm


def compress(source: Path, dest: Path, password: str | None = None) -> Path:
    """
    Compress a file or directory to a ZIP archive using pyzipper.
    Enables AES-256 encryption if password is set.
    """
    total_size = _get_source_size(source)

    encryption_kwargs = {}
    if password:
        encryption_kwargs["encryption"] = pyzipper.WZ_AES

    with tqdm(
        total=total_size,
        unit="B",
        unit_scale=True,
        desc="Compressing",
        leave=False,
    ) as pbar:
        with pyzipper.AESZipFile(
            str(dest),
            mode="w",
            compression=pyzipper.ZIP_DEFLATED,
            compresslevel=9,
            **encryption_kwargs,
        ) as zf:
            if password:
                zf.setpassword(password.encode("utf-8"))
                zf.setencryption(pyzipper.WZ_AES, nbits=256)

            if source.is_dir():
                files = [f for f in source.rglob("*") if f.is_file()]
                for f in files:
                    arcname = str(f.relative_to(source.parent))
                    zf.write(f, arcname=arcname)
                    pbar.update(f.stat().st_size)
            else:
                zf.write(source, arcname=source.name)
                pbar.update(total_size)

    return dest


def decompress(archive: Path, dest: Path, password: str | None = None) -> Path:
    """Extract a ZIP archive to *dest*."""
    dest.mkdir(parents=True, exist_ok=True)

    with pyzipper.AESZipFile(str(archive), "r") as zf:
        if password:
            zf.setpassword(password.encode("utf-8"))

        infos = zf.infolist()
        total_size = sum(i.file_size for i in infos if not i.is_dir())

        with tqdm(
            total=total_size,
            unit="B",
            unit_scale=True,
            desc="Extracting",
            leave=False,
        ) as pbar:
            for info in infos:
                zf.extract(info, path=str(dest))
                if not info.is_dir():
                    pbar.update(info.file_size)

    return dest


def create_temp_archive() -> Path:
    """Create a temporary path for a ZIP archive."""
    fd, path = tempfile.mkstemp(suffix=".zip", prefix="chithi_")
    os.close(fd)
    return Path(path)


def _get_source_size(source: Path) -> int:
    if source.is_file():
        return source.stat().st_size
    return sum(f.stat().st_size for f in source.rglob("*") if f.is_file())
