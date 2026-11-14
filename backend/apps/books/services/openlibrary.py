"""Open Library cover lookup (https://openlibrary.org). Only a cover URL is ever stored."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request

SEARCH_URL = "https://openlibrary.org/search.json"
COVER_URL = "https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"
USER_AGENT = "LMS/1.0 (https://github.com/alvesthalyson/lms-project)"
TIMEOUT = 10


class NetworkProblem(Exception):
    """Open Library did not answer."""


def _get_json(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310 (fixed https host)
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        raise NetworkProblem(str(exc)) from exc


def _normalize(text: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()


def base_title(title: str | None) -> str:
    """'Kokoro: A Novel' and 'Kokoro (Penguin Classics)' both become 'Kokoro'."""
    return re.split(r"\s*[:(–—]\s*|\s+-\s+", title or "")[0]


def _search(**params) -> list[dict]:
    params.setdefault("limit", 5)
    params["fields"] = "title,author_name,cover_i"
    data = _get_json(SEARCH_URL + "?" + urllib.parse.urlencode(params))
    return [doc for doc in data.get("docs", []) if doc.get("cover_i")]


def find_cover_url(*, isbn: str, title: str, author: str) -> str | None:
    """ISBN first, then an exact base-title match. A looser match could attach the wrong book's cover."""
    if isbn:
        docs = _search(q="isbn:" + isbn, limit=1)
        if docs:
            return COVER_URL.format(cover_id=docs[0]["cover_i"])
    wanted = _normalize(title)
    for doc in _search(title=title, author=author):
        if _normalize(base_title(doc.get("title"))) == wanted:
            return COVER_URL.format(cover_id=doc["cover_i"])
    return None
