class ByteSize:
    def __init__(
        self,
        b: int = 0,
        kb: int = 0,
        mb: int = 0,
        gb: int = 0,
        tb: int = 0,
        pb: int = 0,
    ) -> None:
        self._b: int = b
        self._kb: int = kb
        self._mb: int = mb
        self._gb: int = gb
        self._tb: int = tb
        self._pb: int = pb

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

    def __repr__(self) -> str:
        """Smart display using largest unit >= 1"""
        bytes_val: int = self.total_bytes()
        units: list[str] = ["PB", "TB", "GB", "MB", "KB", "B"]
        factors: list[int] = [1024**5, 1024**4, 1024**3, 1024**2, 1024, 1]

        for unit, factor in zip(units, factors):
            val: float = bytes_val / factor
            if val >= 1:
                return f"{val:.2f} {unit}"
        return f"{bytes_val} B"

    # Arithmetic support
    def __add__(self, other: ByteSize) -> ByteSize:
        if isinstance(other, ByteSize):
            return ByteSize(b=self.total_bytes() + other.total_bytes())
        return NotImplemented  # type: ignore[return-value]

    def __sub__(self, other: ByteSize) -> ByteSize:
        if isinstance(other, ByteSize):
            return ByteSize(b=self.total_bytes() - other.total_bytes())
        return NotImplemented  # type: ignore[return-value]
