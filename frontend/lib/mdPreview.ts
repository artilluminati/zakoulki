/** Клиентское превью markdown: сначала escape, потом оформление. XSS-safe по построению. */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(src: string): string {
  let s = esc(src);
  // места +[id:name] -> чип (имена мест не уникальны, id нужен)
  s = s.replace(/\+\[(\d+):([^\]]+)\]/g, '<span class="pv-place">$2</span>');
  // пользователи @name — plain, ник уникальный
  s = s.replace(/(^|[\s(])@([а-яА-ЯёЁa-zA-Z0-9_]{2,50})/g, '$1<span class="pv-user">@$2</span>');
  // жирный, курсив, код — сначала жирный чтобы ** не съел *
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  // ссылки [текст](url) — только http(s)
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  // теги #слово (кириллица и латиница) — только после пробела/скобки, чтобы не ломать заголовки
  s = s.replace(/([\s(])#([а-яА-ЯёЁa-zA-Z0-9_]{2,50})/g, '$1<span class="pv-tag">#$2</span>');
  return s;
}

export function renderLine(line: string): string {
  const hm = line.match(/^(#{1,3})\s+(.*)$/);
  if (hm) {
    const level = hm[1].length;
    return `<div class="pv-h${level}">${inline(hm[2]) || "&nbsp;"}</div>`;
  }
  if (/^\s*-\s+/.test(line)) return `<div class="pv-li">${inline(line.replace(/^\s*-\s+/, ""))}</div>`;
  if (/^\s*>\s?/.test(line)) return `<blockquote class="pv-quote">${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`;
  if (line.trim() === "") return `<div class="pv-blank">&nbsp;</div>`;
  return `<div>${inline(line)}</div>`;
}

export function renderPreview(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const line of lines) {
    if (/^\s*-\s+/.test(line)) {
      if (!inList) { html += '<ul class="pv-list">'; inList = true; }
      html += `<li>${inline(line.replace(/^\s*-\s+/, ""))}</li>`;
    } else if (/^\s*>\s?/.test(line)) {
      closeList();
      html += `<blockquote class="pv-quote">${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`;
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html || '<span class="pv-empty">Пока пусто — начните писать</span>';
}
