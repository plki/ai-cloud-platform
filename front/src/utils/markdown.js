import { marked } from 'marked'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

marked.setOptions({
  breaks: true,
  gfm: true,
})

function preprocess(src) {
  return String(src)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
}

function copyCodeImpl(btn) {
  const code = btn.nextElementSibling
  if (!code) return
  const text = code.innerText
  if (!navigator.clipboard) return
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent
    btn.textContent = '已复制'
    setTimeout(() => { btn.textContent = orig }, 1200)
  })
}

export function renderMarkdown(src) {
  if (!src) return ''
  const safe = preprocess(src)
  const raw = marked.parse(safe)
  const withHighlight = raw.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
    try {
      const decoded = code
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      const highlighted = hljs.highlight(decoded, { language: lang }).value
      return `<pre><button class="copy-btn" data-copy="1">复制</button><code class="hljs language-${lang}">${highlighted}</code></pre>`
    } catch {
      return match
    }
  })
  return DOMPurify.sanitize(withHighlight, {
    ADD_ATTR: ['data-copy', 'onclick'],
    ADD_TAGS: ['span'],
    FORBID_TAGS: ['style', 'iframe', 'form'],
    FORBID_ATTR: ['style', 'onerror', 'onload'],
  })
}

if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    const t = e.target
    if (t && t.classList && t.classList.contains('copy-btn') && t.dataset.copy) {
      copyCodeImpl(t)
    }
  })
}
