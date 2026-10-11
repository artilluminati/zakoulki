"""Markdown v5: user-friendly парсинг + санитизация + извлечение сущностей.

Фронт шлет raw_md где упоминания уже с id: @[123:username] +[456:ТЦ Галерея] #тег
Бэк: рендерит html_safe, собирает списки user_ids/place_ids/tags.
"""
import re

try:
    import markdown as md_lib
    import bleach
    HAS_LIBS = True
except ImportError:
    HAS_LIBS = False

ALLOWED_TAGS = ["p", "br", "strong", "em", "code", "pre", "blockquote", "ul", "ol", "li", "a", "h1", "h2", "h3"]
ALLOWED_ATTRS = {"a": ["href", "class", "data-place-id", "data-user-id", "data-tag", "data-thread-id", "data-kind"]}

# Свои хосты: ссылки вида HOST/thread/123 и HOST/hub/45 превращаем в чипы
# постов/разделов. При переезде на другой домен — дописать сюда.
INTERNAL_HOSTS = {"zakoulki.serveousercontent.com"}
INTERNAL_LINK_RE = re.compile(
    r'<a href="(?:https?://([^/"\s]+))?/(thread|hub)/(\d+)[^"]*">([^<]*)</a>'
)
_hosts_alt = "|".join(sorted(h.replace(".", r"\.") for h in INTERNAL_HOSTS))
# голые ссылки на своё (markdown без extensions их не автолин кует):
# заворачиваем в [Вопрос #N](url) до рендера, дальше сработает INTERNAL_LINK_RE
BARE_INTERNAL_RE = re.compile(
    rf"(?<![\(\]\"'=])https?://(?:{_hosts_alt})/((?:thread|hub))/(\d+)(?![\w/-])",
    re.IGNORECASE,
)
USER_RE = re.compile(r"@\[(\d+):([^\]]+)\]")  # legacy, для старых записей
PLAIN_USER_RE = re.compile(r"(?<![\wа-яА-ЯёЁ@\[])@([а-яА-ЯёЁa-zA-Z0-9_]{2,50})")
PLACE_RE = re.compile(r"\+\[(\d+):([^\]]+)\]")
TAG_RE = re.compile(r"(?<![\wа-яА-ЯёЁ])#([а-яА-ЯёЁa-zA-Z0-9_]{2,50})")
# та же маска тега, но только после пробела/скобки (не ломаем заголовки);
# применяется к тексту ВНЕ ссылок через _outside_anchors
TAG_SUB = re.compile(r"(?<=[\s(])#([а-яА-ЯёЁa-zA-Z0-9_]{2,50})")

# словарь авто-тегов: слово -> тег
AUTO_TAGS = {
    "отопление": "ЖКХ", "батарея": "ЖКХ", "подъезд": "ЖКХ", "лифт": "ЖКХ",
    "яма": "Дороги", "дорога": "Дороги", "асфальт": "Дороги", "разметка": "Дороги",
    "автобус": "Транспорт", "маршрутка": "Транспорт", "остановка": "Транспорт",
    "парк": "Благоустройство", "лавочка": "Благоустройство", "детская": "Благоустройство",
    "стройка": "Стройка", "кран": "Стройка", "мусор": "Экология", "свалка": "Экология",
}


def render_markdown(raw_md: str, comments_mode: bool = False) -> tuple[str, dict]:
    """Возвращает (html_safe, entities={user_ids, usernames, place_ids, tags})."""
    user_ids = [int(m.group(1)) for m in USER_RE.finditer(raw_md)]
    # сначала вырезаем legacy-упоминания, чтобы не цеплять ники внутри них
    without_legacy = USER_RE.sub("@\\2", raw_md)
    usernames = [m.group(1) for m in PLAIN_USER_RE.finditer(without_legacy)]
    place_ids = [int(m.group(1)) for m in PLACE_RE.finditer(raw_md)]
    tags = [m.group(1).lower() for m in TAG_RE.finditer(raw_md)]

    # авто-теги по словарю
    low = raw_md.lower()
    for word, tag in AUTO_TAGS.items():
        if word in low and tag.lower() not in tags:
            tags.append(tag.lower())

    # заменяем скрытые id на читаемые чипы до рендера
    text = USER_RE.sub(r"@\2", raw_md)
    # место -> ссылка-чип с data-атрибутом (обработаем после md)
    text = PLACE_RE.sub(r"[\2](place:\1)", text)
    # голые ссылки на свои посты/разделы -> markdown-ссылки (иначе чипа не будет)
    def _barelink(m: "re.Match") -> str:
        kind, tid = m.group(1).lower(), m.group(2)
        label = "Раздел" if kind == "hub" else "Вопрос"
        return f"[{label} #{tid}]({m.group(0)})"

    text = BARE_INTERNAL_RE.sub(_barelink, text)

    if not HAS_LIBS:
        # без либ — escape + параграфы, чтобы не падать
        import html as _h
        return f"<p>{_h.escape(text)}</p>", {"user_ids": user_ids, "usernames": usernames, "place_ids": place_ids, "tags": tags}

    html = md_lib.markdown(text, extensions=[])

    def _outside_anchors(h: str, fn) -> str:
        """Применить fn только к тексту вне <a>…</a> (чипы не рвём)."""
        parts = re.split(r"(<a\b[^>]*>.*?</a>)", h, flags=re.DOTALL)
        for i in range(0, len(parts), 2):
            parts[i] = fn(parts[i])
        return "".join(parts)

    def _tagify(s: str) -> str:
        return TAG_SUB.sub(r'<a class="tag" href="/tag/\1">#\1</a>', s)

    # place:123 ссылки -> чипы мест
    html = re.sub(
        r'<a href="place:(\d+)">([^<]+)</a>',
        r'<a class="place" data-place-id="\1" href="/map?place=\1">📍\2</a>',
        html,
    )
    # @username без id -> @ссылка (пользователь есть у нас или нет)
    html = re.sub(
        r'(?<![\wа-яА-ЯёЁ])@([а-яА-ЯёЁa-zA-Z0-9_]{2,50})',
        r'<a class="user-mention" href="/user/\1">@\1</a>',
        html,
    )
    # теги #слово (кириллица и латиница) — только внутри текста, не в начале строки (там заголовок)
    # и никогда внутри ссылок (иначе рвём чипы вида «Вопрос #52»)
    html = _outside_anchors(html, _tagify)

    def _postlink(m: "re.Match") -> str:
        host, kind, tid, text = m.group(1), m.group(2), m.group(3), m.group(4)
        if host and host.lower() not in INTERNAL_HOSTS:
            return m.group(0)  # чужой домен — обычная ссылка
        label = text.strip() or f"#{tid}"
        return (f'<a class="postlink" data-thread-id="{tid}" data-kind="{kind}" '
                f'href="/{kind}/{tid}">{label}</a>')

    # свои посты/разделы -> чипы (полные URL своего хоста и относительные)
    html = INTERNAL_LINK_RE.sub(_postlink, html)
    if comments_mode:
        # в комментах режем заголовки
        html = re.sub(r"</?h[1-3]>", "", html)
    safe = bleach.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)
    return safe, {"user_ids": user_ids, "usernames": usernames, "place_ids": place_ids, "tags": tags}
