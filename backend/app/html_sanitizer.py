import re

SCRIPT_STYLE_RE = re.compile(r"<\s*(script|style|iframe|object|embed|link|meta)[^>]*>.*?<\s*/\s*\1\s*>", re.IGNORECASE | re.DOTALL)
DANGEROUS_TAG_RE = re.compile(r"<\s*/?\s*(script|style|iframe|object|embed|link|meta)[^>]*>", re.IGNORECASE)
EVENT_ATTR_RE = re.compile(r"\s+on[a-zA-Z]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", re.IGNORECASE)
JS_URL_RE = re.compile(r"\s+(href|src)\s*=\s*(\"|')\s*javascript:[^\"']*\2", re.IGNORECASE)
BASE64_IMAGE_RE = re.compile(r"<img\b[^>]*\bsrc\s*=\s*(\"|')\s*data:image/[^\"']*\1[^>]*>", re.IGNORECASE)


def sanitize_rich_html(value: str | None) -> str | None:
    if not value:
        return value

    cleaned = SCRIPT_STYLE_RE.sub("", value)
    cleaned = DANGEROUS_TAG_RE.sub("", cleaned)
    cleaned = EVENT_ATTR_RE.sub("", cleaned)
    cleaned = JS_URL_RE.sub("", cleaned)
    cleaned = BASE64_IMAGE_RE.sub("", cleaned)
    return cleaned
