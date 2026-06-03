import qrcode
from qrcode.constants import ERROR_CORRECT_H
from rich.console import Console
from rich.style import Style
from rich.text import Text

# ── QR palette ─────────────────────────────────────────────────────────────────
QR_DARK = (20, 20, 20)
QR_WHITE = (255, 255, 255)


def _load_logo_grid(grid_size: int) -> list[tuple[int, int, int] | None]:
    """Render the Chithi SVG logo to a flat grid of RGB pixels (or None for transparent).

    Each row is 2 terminal characters tall so we can use half-blocks for crisp edges.
    Returns a flat list keyed as grid[y*grid_size + x].
    """
    import io
    from PIL import Image
    from resvg_py import svg_to_bytes

    svg_path = (__import__("pathlib").Path(__file__).parent.parent.parent / "assets" / "logo.svg").resolve()
    png_bytes = svg_to_bytes(svg_path=str(svg_path))
    img = Image.open(io.BytesIO(png_bytes))

    # 2px per terminal character so half-blocks render cleanly
    render_size = grid_size * 2
    img = img.resize((render_size, render_size), Image.LANCZOS)
    bg = Image.new("RGBA", (render_size, render_size), (255, 255, 255, 0))
    bg.paste(img, mask=img.split()[3])

    grid: list[tuple[int, int, int] | None] = [None] * (grid_size * grid_size)
    for gy in range(grid_size):
        for gx in range(grid_size):
            pixels = [
                bg.getpixel((gx * 2, gy * 2)),
                bg.getpixel(((gx * 2) + 1, gy * 2)),
                bg.getpixel((gx * 2, (gy * 2) + 1)),
                bg.getpixel(((gx * 2) + 1, (gy * 2) + 1)),
            ]
            visible = [p for p in pixels if p[3] > 0]
            if visible:
                avg_r = sum(p[0] for p in visible) // len(visible)
                avg_g = sum(p[1] for p in visible) // len(visible)
                avg_b = sum(p[2] for p in visible) // len(visible)
                grid[gy * grid_size + gx] = (avg_r, avg_g, avg_b)
    return grid


def _build_qr_matrix(url: str) -> tuple[list[list[int]], int]:
    """Generate a QR code and return the boolean matrix plus its size."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=1,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    size = len(matrix)
    return matrix, size


def _generate_qr_image(url: str, size: int = 256) -> "Image":
    """Generate a QR code PIL image with the Chithi logo embedded at centre."""
    from PIL import Image, ImageDraw

    matrix, matrix_size = _build_qr_matrix(url)

    img = Image.new("RGB", (size, size), QR_WHITE)
    draw = ImageDraw.Draw(img)

    module_px = size / matrix_size

    # Draw QR modules
    for y in range(matrix_size):
        for x in range(matrix_size):
            if matrix[y][x]:
                draw.rectangle(
                    [x * module_px, y * module_px,
                     (x + 1) * module_px, (y + 1) * module_px],
                    fill=QR_DARK,
                )

    # Overlay logo at centre
    logo_modules = 5
    logo_px = module_px * logo_modules
    offset = (size - logo_px) / 2

    logo_img = _load_logo_image(int(logo_px))
    draw.rectangle([offset, offset, offset + logo_px, offset + logo_px], fill=QR_WHITE)
    img.paste(logo_img, (int(offset), int(offset)))

    return img


def _load_logo_image(size: int = 64) -> "Image":
    """Render the Chithi SVG logo to a PIL Image at the given size."""
    import io
    from PIL import Image
    from resvg_py import svg_to_bytes

    svg_path = (__import__("pathlib").Path(__file__).parent.parent.parent / "assets" / "logo.svg").resolve()
    png_bytes = svg_to_bytes(svg_path=str(svg_path))
    img = Image.open(io.BytesIO(png_bytes)).resize((size, size), Image.LANCZOS)
    bg = Image.new("RGB", (size, size), QR_WHITE)
    bg.paste(img, mask=img.split()[3])
    return bg


def _nearest_rich_color(rgb: tuple[int, int, int]) -> str:
    """Map an RGB tuple to a Rich-compatible colour name."""
    r, g, b = rgb

    if r > 240 and g > 240 and b > 240:
        return "white"
    if r < 40 and g < 40 and b < 40:
        return "black"
    if r > 200 and g < 80 and b < 80:
        return "red"
    if r > 180 and g < 40 and b > 140:
        return "magenta"
    if r > 150 and g > 150 and b < 60:
        return "yellow"
    if r < 60 and g > 150 and b < 60:
        return "green"
    if r < 60 and g < 60 and b > 180:
        return "blue"
    if r > 150 and g > 100 and b < 60:
        return "dark_yellow"
    if r > 128 and g < 128 and b > 128:
        return "dark_magenta"

    mx = max(r, g, b)
    if mx == r:
        return "red"
    if mx == g:
        return "green"
    return "blue"


def print_branded_qr(url: str, console: Console = Console()) -> None:
    """Render a compact QR code with the Chithi logo overlaid at centre."""
    import sys
    from io import StringIO

    from rich.console import Console as RichConsole

    matrix, size = _build_qr_matrix(url)

    # Load logo at module resolution (5x5 overlay area)
    logo_grid_size = 5
    logo_grid = _load_logo_grid(logo_grid_size)
    logo_start = (size - logo_grid_size) // 2

    # Render to UTF-8 string buffer to avoid Windows cp1252 encoding errors,
    # then write raw bytes to stdout so the original console isn't broken.
    buf = StringIO()
    render_console = RichConsole(file=buf, force_terminal=True, width=100)

    for y in range(size):
        line = Text()
        for x in range(size):
            in_logo = (logo_start <= x < logo_start + logo_grid_size and
                       logo_start <= y < logo_start + logo_grid_size)

            if in_logo:
                lx = x - logo_start
                ly = y - logo_start
                logo_rgb = logo_grid[ly * logo_grid_size + lx]
                if logo_rgb:
                    color = _nearest_rich_color(logo_rgb)
                    line.append("█", style=Style(color=color, bgcolor="black"))
                else:
                    line.append(" ", style=Style(color="black", bgcolor="black"))
            elif matrix[y][x]:
                line.append("█", style=Style(color="black", bgcolor="black"))
            else:
                line.append(" ", style=Style(color="black", bgcolor="black"))
        render_console.print(line)

    # Write raw ANSI bytes to stdout, bypassing the text encoder
    text = buf.getvalue()
    sys.stdout.buffer.write(text.encode("utf-8"))
    sys.stdout.buffer.flush()


def export_qr_svg(url: str, path: str, size: int = 256) -> None:
    """Export the branded QR code as an SVG file."""
    img = _generate_qr_image(url, size)
    img = _add_padding(img)
    w, h = img.size

    elements = []
    for y in range(h):
        for x in range(w):
            rgb = img.getpixel((x, y))
            if rgb != QR_WHITE:
                r, g, b = rgb
                elements.append(
                    f'    <rect x="{x}" y="{y}" width="1" height="1" '
                    f'fill="rgb({r},{g},{b})"/>\n'
                )

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n'
        f'  <rect width="{w}" height="{h}" fill="white"/>\n'
        + "".join(elements)
        + f'</svg>'
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _add_padding(img: "Image", border: int = 4) -> "Image":
    """Add a white border around the QR image for cleaner terminal rendering."""
    from PIL import Image

    w, h = img.size
    padded = Image.new("RGB", (w + border * 2, h + border * 2), QR_WHITE)
    padded.paste(img, (border, border))
    return padded
