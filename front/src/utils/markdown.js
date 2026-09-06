import { marked } from 'marked'
import hljs from 'highlight.js'

marked.setOptions({
  breaks: true,
  gfm: true,
})

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function renderMarkdown(src) {
  if (!src) return ''
  let html = marked.parse(src)
  html = html.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
    try {
      const decoded = code
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      const highlighted = hljs.highlight(decoded, { language: lang }).value
      return `<pre><button class="copy-btn" onclick="copyCode(this)">复制</button><code class="hljs language-${lang}">${highlighted}</code></pre>`
    } catch {
      return match
    }
  })
  return html
}

window.copyCode = function(btn) {
  const code = btn.nextElementSibling.innerText
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = '已复制'
    setTimeout(() => (btn.textContent = '复制'), 1200)
  })
}
