"""Reverse-share: a thin stateless WebSocket relay between hosts and guests.

The backend does not store room data or file bytes. It only:

* joins connected sockets into a Channels group keyed by ``room_id``
* forwards JSON messages (``file_added``, ``connection_counts``, …) between
  all members of that group
* streams a file's encrypted bytes to the requesting client on demand
  (via ``open_chunk_stream``)

Room lifecycle (create, destroy, upload) and file storage are the host's
responsibility. The backend is a pass-through relay.
"""
