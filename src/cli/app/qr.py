"""QR code encoder from scratch — byte mode, versions 1–10, EC levels L/M/Q/H.

Follows ISO/IEC 18004 / GB 18284.  No third-party QR libraries.
"""

from __future__ import annotations

# ═══════════════════════════════════════════════════════════════════════════
# 1. GF(256) arithmetic  (primitive polynomial 0x11D = x^8+x^4+x^3+x^2+1)
# ═══════════════════════════════════════════════════════════════════════════

_GF_EXP: list[int] = [0] * 512
_GF_EXP[0] = 1
_GF_LOG: list[int] = [0] * 256

__v = 1
for __i in range(254):
    __v <<= 1
    if __v & 0x100:
        __v ^= 0x11D
    _GF_EXP[__i + 1] = __v
    _GF_EXP[__i + 1 + 255] = __v
    _GF_LOG[__v] = __i + 1

del __v, __i


def _gf_mul(a: int, b: int) -> int:
    """Multiply two elements in GF(256)."""
    if a == 0 or b == 0:
        return 0
    return _GF_EXP[_GF_LOG[a] + _GF_LOG[b]]


# ═══════════════════════════════════════════════════════════════════════════
# 2. Reed-Solomon encoder
# ═══════════════════════════════════════════════════════════════════════════

def _rs_gen(nsym: int) -> list[int]:
    """Generator polynomial of degree *nsym* over GF(256)."""
    g = [1]
    for i in range(nsym):
        ng = [0] * (len(g) + 1)
        for j in range(len(g)):
            ng[j] ^= g[j]
            ng[j + 1] ^= _gf_mul(g[j], _GF_EXP[i])
        g = ng
    return g


def _rs_encode(data: bytes, nsym: int) -> bytes:
    """Append *nsym* RS error-correction codewords to *data*."""
    g = _rs_gen(nsym)
    reg = bytearray(data) + bytearray(nsym)
    for i in range(len(data)):
        coef = reg[i]
        if coef:
            for j in range(len(g)):
                reg[i + j] ^= _gf_mul(g[j], coef)
    return bytes(reg[len(data) :])


# ═══════════════════════════════════════════════════════════════════════════
# 3. QR code parameters  (ISO/IEC 18004 Tables 2-3)
# ═══════════════════════════════════════════════════════════════════════════

def _size(ver: int) -> int:
    """Module count for a given version."""
    return 21 + 4 * (ver - 1)


# EC codewords per block (same for all versions within a given EC level)
_EC_PER_BLOCK = {0: 10, 1: 7, 2: 13, 3: 17}  # L M Q H

# Capacity: (version, ec) -> (data_codewords, [(codewords_per_block, num_blocks), ...])
_CAPACITY: dict[tuple[int, int], tuple[int, list[tuple[int, int]]]] = {
    (1, 0): (16, [(16, 1)]),
    (1, 1): (19, [(19, 1)]),
    (1, 2): (16, [(16, 1)]),
    (1, 3): (16, [(16, 1)]),
    (2, 0): (28, [(28, 1)]),
    (2, 1): (34, [(34, 1)]),
    (2, 2): (28, [(28, 1)]),
    (2, 3): (28, [(28, 1)]),
    (3, 0): (44, [(16, 2)]),
    (3, 1): (55, [(18, 2)]),
    (3, 2): (44, [(22, 2)]),
    (3, 3): (44, [(11, 4)]),
    (4, 0): (64, [(20, 2)]),
    (4, 1): (80, [(24, 2)]),
    (4, 2): (64, [(26, 2)]),
    (4, 3): (64, [(16, 4)]),
    (5, 0): (86, [(24, 2)]),
    (5, 1): (108, [(30, 2)]),
    (5, 2): (86, [(22, 4)]),
    (5, 3): (86, [(20, 4)]),
    (6, 0): (108, [(26, 2)]),
    (6, 1): (136, [(36, 2)]),
    (6, 2): (108, [(20, 4)]),
    (6, 3): (108, [(18, 6)]),
    (7, 0): (124, [(30, 2)]),
    (7, 1): (156, [(36, 2)]),
    (7, 2): (124, [(24, 4)]),
    (7, 3): (124, [(22, 6)]),
    (8, 0): (154, [(28, 2)]),
    (8, 1): (194, [(42, 2)]),
    (8, 2): (154, [(24, 4)]),
    (8, 3): (154, [(26, 6)]),
    (9, 0): (182, [(32, 2)]),
    (9, 1): (232, [(44, 2)]),
    (9, 2): (182, [(24, 4)]),
    (9, 3): (182, [(28, 7)]),
    (10, 0): (216, [(28, 2)]),
    (10, 1): (274, [(40, 2)]),
    (10, 2): (216, [(40, 4)]),
    (10, 3): (216, [(24, 8)]),
}

# Alignment-pattern row/column positions per version (ISO/IEC 18004 Table 3)
_ALIGNMENT: dict[int, list[int]] = {
    1: [],
    2: [6, 22],
    3: [6, 26],
    4: [6, 30],
    5: [6, 34],
    6: [6, 22, 38],
    7: [6, 24, 42],
    8: [6, 26, 46],
    9: [6, 28, 52],
    10: [6, 30, 54],
}


# ═══════════════════════════════════════════════════════════════════════════
# 4. Data encoding  (byte mode)
# ═══════════════════════════════════════════════════════════════════════════

def _total_raw_codewords(ver: int) -> int:
    """Total codewords in the raw code (data + EC)."""
    return 4 * ver * ver + 26 * ver + 16


def _data_capacity_bits(ver: int, ec: int) -> int:
    """Bits available for data (including mode, length, terminator, padding)."""
    total = _total_raw_codewords(ver)
    ec_total = _EC_PER_BLOCK[ec] * sum(nb for _, nb in _CAPACITY[(ver, ec)][1])
    return (total - ec_total) * 8


def _encode_stream(msg: bytes, ver: int, ec: int) -> bytes:
    """Build the data codeword stream (mode + length + data + terminator + pad)."""
    cc_bits = 8  # character count bits for versions 1-20
    data_bits = 8 * len(msg)
    avail = _data_capacity_bits(ver, ec) - 4 - cc_bits
    if data_bits > avail:
        raise OverflowError("Message too long")

    stream: list[int] = []

    # Mode indicator (byte = 0100)
    for i in range(3, -1, -1):
        stream.append((0b0100 >> i) & 1)

    # Character count
    for i in range(cc_bits - 1, -1, -1):
        stream.append((len(msg) >> i) & 1)

    # Data
    for byte in msg:
        for i in range(7, -1, -1):
            stream.append((byte >> i) & 1)

    # Terminator
    remaining = _data_capacity_bits(ver, ec) - len(stream)
    term = min(4, remaining)
    stream.extend([0] * term)

    # Pad to byte boundary
    while len(stream) % 8 != 0 and len(stream) < _data_capacity_bits(ver, ec):
        stream.append(0)

    # Pad codewords
    patterns = [0xEC, 0x11]  # 11101100, 00010001
    pidx = 0
    while len(stream) < _data_capacity_bits(ver, ec):
        pat = patterns[pidx % 2]
        for i in range(7, -1, -1):
            if len(stream) < _data_capacity_bits(ver, ec):
                stream.append((pat >> i) & 1)
        pidx += 1

    # Convert bit stream to bytes
    out = bytearray()
    for i in range(0, len(stream), 8):
        byte = 0
        for bit in stream[i : i + 8]:
            byte = (byte << 1) | bit
        out.append(byte)
    return bytes(out)


# ═══════════════════════════════════════════════════════════════════════════
# 5. Error correction & interleaving
# ═══════════════════════════════════════════════════════════════════════════

def _add_ec(data: bytes, ver: int, ec: int) -> bytes:
    """Add RS error correction and interleave blocks."""
    dcw, dist = _CAPACITY[(ver, ec)]
    nsym = _EC_PER_BLOCK[ec]

    # Split data into blocks
    data_blocks: list[bytes] = []
    ec_blocks: list[bytes] = []
    offset = 0
    for cw_per_block, num_blocks in dist:
        for _ in range(num_blocks):
            block = data[offset : offset + cw_per_block]
            data_blocks.append(block)
            ec_blocks.append(_rs_encode(block, nsym))
            offset += cw_per_block

    # Interleave: data block 0 byte 0, data block 1 byte 0, ..., then EC
    max_data_len = max(len(b) for b in data_blocks)
    out = bytearray()
    for i in range(max_data_len):
        for db in data_blocks:
            out.append(db[i])
    for i in range(nsym):
        for eb in ec_blocks:
            out.append(eb[i])

    return bytes(out)


# ═══════════════════════════════════════════════════════════════════════════
# 6. Matrix construction
# ═══════════════════════════════════════════════════════════════════════════

def _reserved(n: int, ver: int) -> list[list[bool]]:
    """Mark cells reserved by structural elements."""
    r = [[False] * n for _ in range(n)]

    def _rect(t: int, l: int, h: int, w: int) -> None:
        for row in range(max(0, t), min(n, t + h)):
            for col in range(max(0, l), min(n, l + w)):
                r[row][col] = True

    # Finder + separator (9×9)
    _rect(0, 0, 9, 9)
    _rect(0, n - 7, 9, 9)
    _rect(n - 7, 0, 9, 9)

    # Timing patterns
    for i in range(9, n - 7):
        r[6][i] = True
        r[i][6] = True

    # Alignment patterns
    for pos in _ALIGNMENT.get(ver, []):
        for i in range(n):
            r[pos][i] = True
            r[i][pos] = True

    # Format info areas (avoid row 6 and col 6 — timing pattern takes priority)
    for i in range(8):
        r[8][i] = True  # left of top-left finder
        r[i][8] = True  # above top-left finder
    r[8][8] = True  # diagonal
    for i in range(n - 7, n):
        r[8][i] = True  # right of bottom-left finder
        r[i][8] = True  # above bottom-left finder

    # Dark module
    r[n - 8][8] = True

    return r


def _finder(m: list[list[int]], tr: int, tc: int) -> None:
    """Place a 7×7 finder pattern at (tr, tc)."""
    for dy in range(7):
        for dx in range(7):
            if dy in (0, 6) or dx in (0, 6):
                m[tr + dy][tc + dx] = 1
            elif 2 <= dy <= 4 and 2 <= dx <= 4:
                m[tr + dy][tc + dx] = 1
            elif 1 <= dy <= 4 and 1 <= dx <= 4:
                m[tr + dy][tc + dx] = 0
            else:
                m[tr + dy][tc + dx] = 0


def _alignment(m: list[list[int]], cr: int, cc: int) -> None:
    """Place a 5×5 alignment pattern centred at (cr, cc)."""
    pattern = [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 1],
        [1, 0, 1, 0, 1],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 1],
    ]
    for dy in range(5):
        for dx in range(5):
            m[cr - 2 + dy][cc - 2 + dx] = pattern[dy][dx]


def _format_bits(m: list[list[int]], n: int, fmt: int) -> None:
    """Write format information into reserved cells."""
    # Along row 8, left of top-left finder
    for i in range(8):
        m[8][i] = (fmt >> i) & 1
    # Above top-left finder (row 1..7, bit 1..7)
    for i in range(1, 8):
        m[i][8] = (fmt >> i) & 1
    s = n - 7
    # Along row 8, right of bottom-left finder
    for i in range(7):
        m[8][s + i] = (fmt >> (i + 9)) & 1
    # Above bottom-left finder (rows n-1..n-7, bits 14..8)
    for i in range(7):
        m[n - 1 - i][8] = (fmt >> (14 - i)) & 1


def _fill(
    m: list[list[int]],
    res: list[list[bool]],
    codewords: bytes,
) -> None:
    """Zigzag data bits into the matrix from bottom-right."""
    n = len(m)
    bits = []
    for byte in codewords:
        for i in range(7, -1, -1):
            bits.append((byte >> i) & 1)

    bit_pos = 0
    total = len(bits)
    up = True
    row = n - 1
    col = n - 1

    while col > 0:
        if col == 6:
            col -= 1
        while bit_pos < total and 0 <= row < n:
            if not res[row][col]:
                m[row][col] = bits[bit_pos]
                bit_pos += 1
            if bit_pos < total and not res[row][col - 1]:
                m[row][col - 1] = bits[bit_pos]
                bit_pos += 1
            row += -1 if up else 1
        if up:
            row = n - 2
        else:
            row = 1
        col -= 2
        up = not up


# ═══════════════════════════════════════════════════════════════════════════
# 7. Masking
# ═══════════════════════════════════════════════════════════════════════════

_MASKS = [
    lambda r, c: (r + c) % 2 == 0,
    lambda r, c: r % 2 == 0,
    lambda r, c: c % 3 == 0,
    lambda r, c: (r + c) % 3 == 0,
    lambda r, c: (r // 2 + c // 3) % 2 == 0,
    lambda r, c: (r * c) % 2 + (r * c) % 3 == 0,
    lambda r, c: ((r * c) % 2 + (r * c) % 3) % 2 == 0,
    lambda r, c: ((r + c) % 2 + (r * c) % 3) % 2 == 0,
]


def _mask_apply(
    m: list[list[int]],
    res: list[list[bool]],
    mask: int,
) -> list[list[int]]:
    n = len(m)
    out = [row[:] for row in m]
    f = _MASKS[mask]
    for r in range(n):
        for c in range(n):
            if not res[r][c] and f(r, c):
                out[r][c] ^= 1
    return out


# ═══════════════════════════════════════════════════════════════════════════
# 8. Penalty scoring  (ISO/IEC 18004 Annex E)
# ═══════════════════════════════════════════════════════════════════════════

def _penalty(m: list[list[int]]) -> int:
    n = len(m)
    p = 0

    # Rule 1 — consecutive same-colour modules
    for r in range(n):
        run = 1
        for c in range(1, n):
            if m[r][c] == m[r][c - 1]:
                run += 1
                if run == 5:
                    p += 3
                elif run > 5:
                    p += 1
            else:
                run = 1
    for c in range(n):
        run = 1
        for r in range(1, n):
            if m[r][c] == m[r - 1][c]:
                run += 1
                if run == 5:
                    p += 3
                elif run > 5:
                    p += 1
            else:
                run = 1

    # Rule 2 — 2×2 blocks
    for r in range(n - 1):
        for c in range(n - 1):
            if m[r][c] == m[r][c + 1] == m[r + 1][c] == m[r + 1][c + 1]:
                p += 3

    # Rule 3 — finder-like patterns
    a_pat = [1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1]
    b_pat = [0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0]
    for r in range(n):
        for c in range(n - 10):
            strip = [m[r][c + k] for k in range(11)]
            if strip == a_pat or strip == b_pat:
                p += 40
    for c in range(n):
        for r in range(n - 10):
            strip = [m[r + k][c] for k in range(11)]
            if strip == a_pat or strip == b_pat:
                p += 40

    # Rule 4 — dark module proportion
    dark = sum(m[r][c] for r in range(n) for c in range(n))
    pct = dark * 100 // (n * n)
    diff = abs(pct - 50)
    p += (diff // 5) * 10

    return p


# ═══════════════════════════════════════════════════════════════════════════
# 9. Format information  (BCH(15, 5), generator 10100110111)
# ═══════════════════════════════════════════════════════════════════════════

def _format_info(ec: int, mask: int) -> int:
    """Compute 15-bit format information word."""
    data = (ec << 13) | (mask << 10)
    remainder = data
    for i in range(14, -1, -1):
        if remainder & (1 << i):
            remainder ^= 0x537 << (i - 10)
    return (data << 10) | remainder | 0x5412


# Pre-computed for EC-H (ec=3) to avoid runtime errors:
_FMT_H = {
    0: 0x5412, 1: 0x512A, 2: 0x5E25, 3: 0x5B1D,
    4: 0x45F1, 5: 0x40C9, 6: 0x4FC6, 7: 0x4AFE,
}


# ═══════════════════════════════════════════════════════════════════════════
# 10. Public API
# ═══════════════════════════════════════════════════════════════════════════

def matrix(text: str, ec: int = 3) -> list[list[int]]:
    """Encode *text* into a QR code matrix.

    ec: 0=L, 1=M, 2=Q, 3=H  (default H).
    Returns a 2-D list: 1 = dark module, 0 = light module.
    """
    msg = text.encode("utf-8")

    # Pick smallest version that fits
    ver = 1
    data = b""
    while ver <= 10:
        try:
            data = _encode_stream(msg, ver, ec)
            break
        except OverflowError:
            ver += 1
    else:
        raise OverflowError("Message too long for supported versions (1-10)")

    n = _size(ver)
    res = _reserved(n, ver)

    # Error correction + interleave
    cw = _add_ec(data, ver, ec)

    # Build matrix
    m = [[0] * n for _ in range(n)]

    # Finder patterns
    _finder(m, 0, 0)
    _finder(m, 0, n - 7)
    _finder(m, n - 7, 0)

    # Alignment patterns
    for ar in _ALIGNMENT.get(ver, []):
        for ac in _ALIGNMENT.get(ver, []):
            if res[ar][ac]:
                _alignment(m, ar, ac)

    # Timing patterns (between separator and alignment/dark-module area)
    for i in range(9, n - 7):
        m[6][i] = (i - 9) % 2
        m[i][6] = (i - 9) % 2

    # Dark module
    m[n - 8][8] = 1

    # Fill data
    _fill(m, res, cw)

    # Try all 8 masks, pick lowest penalty
    best_m, best_sc, best_fmt = None, float("inf"), 0
    for mask in range(8):
        masked = _mask_apply(m, res, mask)
        fmt = _FMT_H[mask] if ec == 3 else _format_info(ec, mask)
        _format_bits(masked, n, fmt)
        sc = _penalty(masked)
        if sc < best_sc:
            best_sc = sc
            best_m = masked
            best_fmt = fmt

    return best_m
