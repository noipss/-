import { test, before, after } from 'node:test'
import assert from 'node:assert'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkUrl } from '../src/checker.js'
import Monitor from '../src/Monitor.js'
import Logger from '../src/Logger.js'

let server
let base
let alive = true

const logFile = path.join(os.tmpdir(), `monitor-test-${Date.now()}.log`)

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/ok') {
      res.end('ok')
    } else if (req.url === '/slow') {
      setTimeout(() => res.end('slow'), 300)
    } else if (req.url === '/flaky') {
      res.statusCode = alive ? 200 : 500
      res.end()
    } else {
      res.statusCode = 404
      res.end('not found')
    }
  })

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => {
  server.closeAllConnections()
  server.close()
  fs.rmSync(logFile, { force: true })
})

test('доступный адрес возвращает код 200', async () => {
  const result = await checkUrl(`${base}/ok`)
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.code, 200)
  assert.ok(result.time >= 0)
})

test('ошибка 404 считается неудачной проверкой', async () => {
  const result = await checkUrl(`${base}/nothing`)
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.code, 404)
})

test('долгий ответ прерывается по тайм-ауту', async () => {
  const result = await checkUrl(`${base}/slow`, 100)
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.error, 'превышено время ожидания')
})

test('недоступный сервер даёт ошибку соединения', async () => {
  const result = await checkUrl('http://127.0.0.1:1', 1000)
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.code, null)
  assert.strictEqual(result.error, 'нет соединения')
})

test('неверный адрес и повтор не добавляются', () => {
  const monitor = new Monitor({}, new Logger(logFile, true))
  monitor.addSite('Тест', `${base}/ok`)
  assert.throws(() => monitor.addSite('Плохой', 'example.com'))
  assert.throws(() => monitor.addSite('Повтор', `${base}/ok`))
  assert.strictEqual(monitor.sites.length, 1)
})

test('сайт становится недоступным после нескольких ошибок и восстанавливается', async () => {
  const monitor = new Monitor({ maxFails: 2 }, new Logger(logFile, true))
  const site = monitor.addSite('Нестабильный', `${base}/flaky`)

  alive = false
  await monitor.checkAll()
  assert.strictEqual(site.status, 'warning')
  await monitor.checkAll()
  assert.strictEqual(site.status, 'down')

  alive = true
  await monitor.checkAll()
  assert.strictEqual(site.status, 'up')
  assert.strictEqual(site.fails, 0)

  const log = fs.readFileSync(logFile, 'utf-8')
  assert.ok(log.includes('ВНИМАНИЕ! Нестабильный недоступен'))
  assert.ok(log.includes('Нестабильный снова доступен'))
})

test('отчёт считает процент доступности', async () => {
  const monitor = new Monitor({}, new Logger(logFile, true))
  monitor.addSite('Рабочий', `${base}/ok`)
  monitor.addSite('Сломанный', `${base}/broken`)

  await monitor.checkAll()
  await monitor.checkAll()

  const report = monitor.report()
  assert.strictEqual(report[0]['Доступность, %'], 100)
  assert.strictEqual(report[1]['Доступность, %'], 0)
  assert.strictEqual(report[1]['Ошибок'], 2)
})
