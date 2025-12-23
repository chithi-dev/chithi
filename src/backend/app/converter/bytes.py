class ByteSize:
    def __init__(self, b=0, kb=0, mb=0, gb=0, tb=0, pb=0):
        self._b = b
        self._kb = kb
        self._mb = mb
        self._gb = gb
        self._tb = tb
        self._pb = pb

    def total_bytes(self) -> int:
        """Return total bytes as an integer"""
        return (
            self._b
            + self._kb * 1024
            + self._mb * 1024**2
            + self._gb * 1024**3
            + self._tb * 1024**4
            + self._pb * 1024**5
        )

    def __repr__(self):
        """Smart display using largest unit >= 1"""
        bytes_val = self.total_bytes()
        for unit, factor in zip(
            ["PB", "TB", "GB", "MB", "KB", "B"],
            [1024**5, 1024**4, 1024**3, 1024**2, 1024, 1],
        ):
            val = bytes_val / factor
            if val >= 1:
                return f"{val:.2f} {unit}"
        return f"{bytes_val} B"

    # Arithmetic support
    def __add__(self, other):
        if isinstance(other, ByteSize):
            return ByteSize(b=self.total_bytes() + other.total_bytes())
        raise TypeError("Can only add ByteSize objects")

    def __sub__(self, other):
        if isinstance(other, ByteSize):
            return ByteSize(b=self.total_bytes() - other.total_bytes())
        raise TypeError("Can only subtract ByteSize objects")
