"""Stateless relay helpers for reverse-share rooms.

The backend is a thin pass-through: it stores no room data and no file
bytes. It only knows how to (a) name the Channels group for a room and
(b) stream a file's bytes to a requesting client on demand.

File storage itself is the host's responsibility -- the ``file_key`` is an
opaque identifier the host chose, and ``stream_file`` reads it through the
existing ``open_chunk_stream`` path (CDN / local / S3).
"""

from apps.files import services as file_services

GROUP_PREFIX = "room"


def group_name(room_id: str) -> str:
    """Return the Channels group name for a room.

    Channels group names must be ASCII alphanumerics plus ``-_.`` only, so
    a hyphen separates the prefix from the (dashed) room id.
    """
    return f"{GROUP_PREFIX}-{room_id}"


def stream_file(file_key: str, chunk_index: int, read_size: int):
    """Return an async iterator of byte blocks for one chunk of a file.

    The reverse-share consumer drives this and sends each block as a raw
    binary WebSocket frame. The caller is responsible for closing the
    underlying storage handle (the generator handles this via its
    ``finally`` clause).
    """
    return file_services.open_chunk_stream(file_key, chunk_index, read_size)
