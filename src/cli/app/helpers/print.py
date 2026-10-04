from io import BytesIO

from PIL import Image
from qrcode import QRCode
from qrcode.image.svg import SvgPathFillImage
from rich.console import Console
from rich.segment import Segment
from rich.style import Style


def _qr_svg(url: str) -> bytes:
    """Generate a QR code SVG using the qrcode library."""
    qr = QRCode(error_correction=2)  # H
    qr.add_data(url)
    img = qr.make_image(image_factory=SvgPathFillImage)
    return img.to_string()


def _qr_png(url: str) -> bytes:
    """Render QR code SVG to PNG via resvg at module-level resolution."""
    from resvg_py import svg_to_bytes

    qr = QRCode(error_correction=2)
    qr.add_data(url)
    qr.make()
    size = qr.modules_count + 8

    svg_data = _qr_svg(url).decode()
    svg_data = svg_data.replace("mm", "")  # resvg rejects mm with explicit px
    return svg_to_bytes(svg_string=svg_data, width=size, height=size)


class _SegmentRenderable:
    """Wrap a list of Segments so Console.print can render them."""

    def __init__(self, segments: list[Segment]) -> None:
        self.segments = segments

    def __rich_console__(self, console: Console, options):
        return iter(self.segments)


def print_branded_qr(url: str, console: Console = Console()) -> None:
    """Render QR code to terminal.

    Rasterises the QR SVG then downsamples 2× before printing, so each
    terminal cell covers a 2×2 pixel block — roughly half the terminal size.
    """
    png_data = _qr_png(url)
    img = Image.open(BytesIO(png_data)).convert("RGBA")
    w, h = img.size

    # Downsample 2× to keep the terminal QR compact.
    img = img.resize((w // 2, h // 2), Image.LANCZOS)
    w, h = img.size

    DARK_BG = Style(bgcolor="#000000")
    LIGHT_BG = Style(bgcolor="#ffffff")

    for y in range(h):
        row: list[Segment] = []
        for x in range(w):
            r, g, b, _a = img.getpixel((x, y))  # type: ignore[assignment]
            brightness = (r + g + b) / 3
            style = LIGHT_BG if brightness > 128 else DARK_BG
            row.append(Segment(" ", style))
        row.append(Segment("\n"))
        console.print(_SegmentRenderable(row))


def export_qr_svg(url: str, path: str) -> None:
    """Export QR code as SVG file."""
    svg_data = _qr_svg(url)
    with open(path, "wb") as f:
        f.write(svg_data)
