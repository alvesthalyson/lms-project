"""Open Library cover lookup (https://openlibrary.org). Only a cover URL is ever stored."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request

from apps.books.isbn import normalize_isbn, to_isbn13

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


# --------------------------------------------------------------------------
# Catalogue search (librarian import): find a book by ISBN, title or author
# --------------------------------------------------------------------------

SEARCH_FIELDS = "key,title,author_name,first_publish_year,isbn,publisher,number_of_pages_median,cover_i,subject"
MAX_SUBJECTS = 12


def _pick_isbn(isbns: list[str], wanted: str | None) -> str | None:
    """One ISBN-13 for the edition: the one asked for, else the first valid one the record lists."""
    if wanted:
        return wanted
    for raw in isbns or []:
        converted = to_isbn13(raw)
        if converted:
            return converted
    return None


def _candidate(doc: dict, wanted_isbn: str | None) -> dict | None:
    isbn = _pick_isbn(doc.get("isbn") or [], wanted_isbn)
    title = (doc.get("title") or "").strip()
    if not isbn or not title:
        return None  # a Book needs both; without them the librarian could not import it anyway
    cover_id = doc.get("cover_i")
    return {
        "isbn": isbn,
        "title": title[:255],
        "authors": [name.strip() for name in (doc.get("author_name") or [])[:4] if name and name.strip()],
        "publisher": ((doc.get("publisher") or [""])[0] or "")[:255],
        "publication_year": doc.get("first_publish_year"),
        "pages": doc.get("number_of_pages_median"),
        "cover_url": COVER_URL.format(cover_id=cover_id) if cover_id else "",
        "subjects": [s for s in (doc.get("subject") or [])[:MAX_SUBJECTS] if isinstance(s, str)],
    }


def search_books(*, isbn: str = "", title: str = "", author: str = "", limit: int = 10) -> list[dict]:
    """
    Candidates from Open Library for an ISBN, a title and/or an author, most relevant first.
    Every candidate has a valid ISBN-13 (ISBN-10s are converted). Raises NetworkProblem when Open Library
    does not answer. Nothing is stored: the caller shows the list and imports the chosen one.
    """
    wanted = to_isbn13(normalize_isbn(isbn)) if isbn else None
    params: dict[str, object] = {"fields": SEARCH_FIELDS, "limit": limit}
    if isbn:
        if not wanted:
            return []
        params["q"] = "isbn:" + wanted
    else:
        if title.strip():
            params["title"] = title.strip()
        if author.strip():
            params["author"] = author.strip()
        if "title" not in params and "author" not in params:
            return []
    data = _get_json(SEARCH_URL + "?" + urllib.parse.urlencode(params))
    found, seen = [], set()
    for doc in data.get("docs", []):
        item = _candidate(doc, wanted)
        if item and item["isbn"] not in seen:
            seen.add(item["isbn"])
            found.append(item)
    return found
