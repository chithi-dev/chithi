from rich.console import Console

import qrcode
from qrcode.constants import ERROR_CORRECT_L
from qrcode.exceptions import DataOverflowError


def print_compact_qr(url: str, console: Console = Console()) -> None:
    """
    Renders a URL as the smallest possible QR code (Version 1, 21x21)
    using Unicode half-blocks (▄/▀/█) to minimize terminal height.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=ERROR_CORRECT_L,
        box_size=1,
        border=0,
    )
    qr.add_data(url)

    try:
        # Force Version 1 (21x21)
        qr.make(fit=False)
    except DataOverflowError:
        # Fallback if the URL is too long for Version 1
        qr.version = None
        qr.make(fit=True)

    matrix = qr.get_matrix()

    # We iterate 2 rows at a time because one terminal line = 2 vertical pixels
    for y in range(0, len(matrix), 2):
        line = ""
        for x in range(len(matrix[0])):
            upper = matrix[y][x]
            lower = matrix[y + 1][x] if (y + 1) < len(matrix) else False

            # Map combinations to half-block characters
            if upper and lower:
                line += " "  # Both black
            elif upper and not lower:
                line += "▄"  # Top black, bottom white
            elif not upper and lower:
                line += "▀"  # Top white, bottom black
            else:
                line += "█"  # Both white

        # Use white on black to ensure contrast in most terminals
        console.print(line, style="white on black", highlight=False)
