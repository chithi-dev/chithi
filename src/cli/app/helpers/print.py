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


def _supports_half_block() -> bool:
    """Check whether the terminal can render the ▀ half-block glyph."""
    import sys
    try:
        sys.stdout.encoding
        "▀".encode(sys.stdout.encoding or "utf-8")
        return True
    except (UnicodeEncodeError, AttributeError, LookupError):
        return False


def print_branded_qr(url: str, console: Console = Console()) -> None:
    """Render QR code to terminal, as compact as the terminal allows.

    On terminals that support the ▀ half-block glyph, each row encodes 2 pixel
    rows, halving the height. On legacy Windows consoles (cp1252), falls back
    to full-block spaces with a 2× downsample.
    """
    png_data = _qr_png(url)
    img = Image.open(BytesIO(png_data)).convert("L")
    w, h = img.size

    use_half_block = _supports_half_block()

    if use_half_block:
        # Half-block mode: 2 pixel rows per terminal row, 3× horizontal downsample.
        if h % 2:
            img = img.resize((w, h + 1), Image.LANCZOS)
            w, h = img.size
        target_w = max(1, w // 3)
        img = img.resize((target_w, h), Image.LANCZOS)
        w, h = img.size
        pixels = img.load()
        dark = Style(bgcolor="#000000")
        light = Style(bgcolor="#ffffff")
        for y in range(0, h, 2):
            row: list[Segment] = []
            for x in range(w):
                top_dark = pixels[x, y] < 128
                bot_dark = pixels[x, y + 1] < 128 if y + 1 < h else top_dark
                if top_dark and bot_dark:
                    row.append(Segment(" ", dark))
                elif top_dark:
                    row.append(Segment("▀", light))
                else:
                    row.append(Segment(" ", light))
            row.append(Segment("\n"))
            console.print(_SegmentRenderable(row))
    else:
        # Fallback: full-block, 2× downsample.
        img = img.resize((w // 2, h // 2), Image.LANCZOS)
        w, h = img.size
        pixels = img.load()
        dark = Style(bgcolor="#000000")
        light = Style(bgcolor="#ffffff")
        for y in range(h):
            row: list[Segment] = []
            for x in range(w):
                row.append(Segment(" ", dark if pixels[x, y] < 128 else light))
            row.append(Segment("\n"))
            console.print(_SegmentRenderable(row))


def export_qr_svg(url: str, path: str) -> None:
    """Export QR code as SVG file."""
    svg_data = _qr_svg(url)
    with open(path, "wb") as f:
        f.write(svg_data)
