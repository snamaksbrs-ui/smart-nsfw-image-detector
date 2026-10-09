from __future__ import annotations

from collections import OrderedDict


class ImageResultCache:
    def __init__(self, max_size: int = 1024):
        self.max_size = max_size
        self._items: OrderedDict[str, object] = OrderedDict()

    def get(self, key: str):
        value = self._items.get(key)
        if value is None:
            return None
        self._items.move_to_end(key)
        return value

    def set(self, key: str, value):
        if key in self._items:
            del self._items[key]
        self._items[key] = value
        while len(self._items) > self.max_size:
            self._items.popitem(last=False)

    def clear(self):
        self._items.clear()

    def __contains__(self, key: str) -> bool:
        return key in self._items

    def __len__(self) -> int:
        return len(self._items)
