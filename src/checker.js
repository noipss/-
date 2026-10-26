export async function checkUrl(url, timeout = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const start = Date.now()

  try {
    const res = await fetch(url, { signal: controller.signal })
    const time = Date.now() - start
    await res.body?.cancel()

    return {
      ok: res.ok,
      code: res.status,
      time,
      error: res.ok ? null : `код ответа ${res.status}`
    }
  } catch (e) {
    const time = Date.now() - start
    const error = e.name === 'AbortError' ? 'превышено время ожидания' : 'нет соединения'
    return { ok: false, code: null, time, error }
  } finally {
    clearTimeout(timer)
  }
}
