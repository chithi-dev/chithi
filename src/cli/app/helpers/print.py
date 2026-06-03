from io import BytesIO

from PIL.Image import open as open_image
from rich.console import Console
from rich.segment import Segment

from app.qr import matrix


def _qr_svg(url: str, border: int = 2) -> bytes:
    """Render a QR code as compact SVG bytes.

    Uses a single <path> with horizontal run-length encoding instead of
    one <rect> per dark module — typically 10-20x smaller SVG.
    """
    m = matrix(url, ec=3)
    n = len(m)
    size = n + 2 * border

    # Build path data: horizontal runs of dark modules per row
    path_parts: list[str] = []
    for r, row in enumerate(m):
        y = r + border
        i = 0
        while i < n:
            if row[i]:
                start = i + border
                while i < n and row[i]:
                    i += 1
                path_parts.append(f"M{start} {y}h{i + border - start}")
            else:
                i += 1

    path_d = "".join(path_parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
        f'<rect width="{size}" height="{size}" fill="white"/>'
        f'<path d="{path_d}"/>'
        f"</svg>"
    ).encode()


def _qr_png(url: str, scale: int = 4) -> bytes:
    """Convert QR code SVG to PNG via resvg_py."""
    from resvg_py import svg_to_bytes

    svg_data = _qr_svg(url)
    qr_size = len(matrix(url, ec=3)) + 4
    return svg_to_bytes(
        svg_string=svg_data.decode(), width=qr_size * scale, height=qr_size * scale
    )


class _SegmentRenderable:
    """Wrap a list of Segments so Console.print can render them."""

    def __init__(self, segments: list[Segment]) -> None:
        self.segments = segments

    def __rich_console__(self, console: Console, options):
        return iter(self.segments)


def print_branded_qr(url: str, console: Console = Console()) -> None:
    """Render QR code to terminal using rich-pixels."""
    from rich_pixels import FullcellRenderer

    png_data = _qr_png(url)
    img = open_image(BytesIO(png_data))
    renderer = FullcellRenderer()
    segments = renderer.render(img, resize=None)
    console.print(_SegmentRenderable(segments))


def export_qr_svg(url: str, path: str, size: int = 256) -> None:
    """Export QR code as SVG file."""
    svg_data = _qr_svg(url)
    with open(path, "wb") as f:
        f.write(svg_data)
