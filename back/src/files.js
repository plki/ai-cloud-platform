// File upload: accept multipart, store in R2, return public URL
import { json } from './lib/http.js'

const ALLOWED_TYPES = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'text/plain': 'txt', 'text/markdown': 'md',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

const MAX_SIZE = 25 * 1024 * 1024 // 25MB

export async function handleUpload(request, env) {
  if (request.method !== 'POST') return json(405, { error: '仅支持 POST' })

  let contentType = request.headers.get('Content-Type') || ''
  if (!contentType.includes('multipart/form-data')) {
    return json(400, { error: '需要 multipart/form-data' })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return json(400, { error: '未找到文件' })
    }

    const mime = file.type
    const ext = ALLOWED_TYPES[mime]
    if (!ext) {
      return json(400, { error: `不支持的文件类型: ${mime}` })
    }
    if (file.size > MAX_SIZE) {
      return json(400, { error: `文件超过 25MB 限制` })
    }

    const uuid = crypto.randomUUID()
    const filename = `${uuid}.${ext}`
    const arrayBuffer = await file.arrayBuffer()

    await env.R2.put(filename, arrayBuffer, {
      httpMetadata: { contentType: mime, cacheControl: 'public, max-age=86400' },
      customMetadata: { originalName: file.name, size: file.size },
    })

    const base = env.PUBLIC_BASE_URL || 'https://ai-cloud-platform.pages.dev'
    const url = `${base}/_r2/${filename}`

    return json(200, {
      ok: true,
      url,
      filename: file.name,
      size: file.size,
      mimeType: mime,
    })
  } catch (e) {
    console.error('Upload error:', e)
    return json(500, { error: '上传失败: ' + e.message })
  }
}