import qrcode
from qrcode.constants import ERROR_CORRECT_H
from rich.console import Console
from rich.style import Style
from rich.text import Text

# ── Chithi logo (5x5) ──────────────────────────────────────────────────────────
# "C" envelope mark with red→purple gradient, mimics the frontend logo SVG.
# 0 = transparent (let QR show through)
LOGO = (
    (1, 0, 0, 0, 2),
    (0, 3, 3, 3, 0),
    (0, 3, 3, 3, 0),
    (0, 3, 3, 3, 0),
    (4, 0, 0, 0, 5),
)

# Legend: 1=dark-red, 2=red, 3=white, 4=crimson, 5=purple
LOGO_COLORS = {
    1: (180, 10, 10),
    2: (225, 15, 15),
    3: (255, 255, 255),
    4: (247, 6, 6),
    5: (212, 16, 179),
}

# ── QR palette ─────────────────────────────────────────────────────────────────
QR_DARK = (20, 20, 20)
QR_WHITE = (255, 255, 255)


def _generate_qr_image(url: str, size: int = 256) -> "Image":
    """Generate a QR code PIL image with the Chithi logo embedded at centre."""
    from PIL import Image, ImageDraw

    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=1,
        border=0,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = Image.new("RGB", (size, size), QR_WHITE)
    draw = ImageDraw.Draw(img)

    matrix = qr.get_matrix()
    matrix_size = len(matrix)
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
    logo_size = len(LOGO)
    logo_px = module_px * logo_size
    offset = (size - logo_px) / 2

    # White background behind logo
    draw.rectangle([offset, offset, offset + logo_px, offset + logo_px], fill=QR_WHITE)

    for ly in range(logo_size):
        for lx in range(logo_size):
            color_id = LOGO[ly][lx]
            if color_id:
                px = offset + lx * module_px
                py = offset + ly * module_px
                draw.rectangle(
                    [px, py, px + module_px, py + module_px],
                    fill=LOGO_COLORS[color_id],
                )

    return img


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

    # Fallback: pick the dominant channel
    mx = max(r, g, b)
    if mx == r:
        return "red"
    if mx == g:
        return "green"
    return "blue"


def print_branded_qr(url: str, console: Console = Console(), qr_size: int = 128) -> None:
    """Render a QR code with the Chithi logo watermark via coloured half-blocks."""
    img = _generate_qr_image(url, qr_size)
    img = _add_padding(img)
    w, h = img.size

    for y in range(0, h, 2):
        lower_row = min(y + 1, h - 1)
        line = Text()

        for x in range(w):
            upper_rgb = img.getpixel((x, y))
            lower_rgb = img.getpixel((x, lower_row))

            upper_dark = upper_rgb != QR_WHITE
            lower_dark = lower_rgb != QR_WHITE

            if upper_dark and lower_dark:
                char = " "
                color = _nearest_rich_color(upper_rgb)
                style = Style(color=color, bgcolor="black")
            elif upper_dark and not lower_dark:
                char = "▄"
                color = _nearest_rich_color(upper_rgb)
                style = Style(color=color, bgcolor="black")
            elif not upper_dark and lower_dark:
                char = "▀"
                color = _nearest_rich_color(lower_rgb)
                style = Style(color=color, bgcolor="black")
            else:
                char = "█"
                style = Style(color="black", bgcolor="black")

            line.append(char, style=style)

        console.print(line)


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
