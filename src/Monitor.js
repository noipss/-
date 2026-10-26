import Site from './Site.js'
import { checkUrl } from './checker.js'

export default class Monitor {
  constructor(options, logger) {
    this.interval = options.interval || 30
    this.timeout = options.timeout || 5000
    this.slow = options.slow || 2000
    this.maxFails = options.maxFails || 3
    this.logger = logger
    this.sites = []
    this.timer = null
    this.busy = false
  }

  addSite(name, url) {
    if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) {
      throw new Error(`Неверный адрес у сайта "${name}": ${url}`)
    }
    if (this.sites.some(site => site.url === url)) {
      throw new Error(`Адрес ${url} уже есть в списке`)
    }

    const site = new Site(name, url)
    this.sites.push(site)
    return site
  }

  async checkSite(site) {
    const oldStatus = site.status
    const result = await checkUrl(site.url, this.timeout)
    site.update(result, this.maxFails)

    if (result.ok) {
      let text = `${site.name} — ${result.code}, ${result.time} мс`
      if (result.time > this.slow) text += ' (медленный ответ)'
      this.logger.write(text)

      if (oldStatus === 'down') {
        this.logger.write(`${site.name} снова доступен`)
      }
    } else {
      this.logger.write(`${site.name} — ошибка: ${result.error}`)

      if (site.fails === this.maxFails) {
        this.logger.write(`ВНИМАНИЕ! ${site.name} недоступен уже ${site.fails} проверки подряд`)
      }
    }
  }

  async checkAll() {
    if (this.busy) return
    this.busy = true
    await Promise.all(this.sites.map(site => this.checkSite(site)))
    this.busy = false
  }

  start() {
    this.logger.write(`Мониторинг запущен. Сайтов: ${this.sites.length}, интервал: ${this.interval} с`)
    this.checkAll()
    this.timer = setInterval(() => this.checkAll(), this.interval * 1000)
  }

  stop() {
    clearInterval(this.timer)
    this.timer = null
    this.logger.write('Мониторинг остановлен')
  }

  report() {
    const names = {
      up: 'доступен',
      warning: 'есть ошибки',
      down: 'недоступен',
      unknown: 'не проверялся'
    }

    return this.sites.map(site => ({
      'Сайт': site.name,
      'Статус': names[site.status],
      'Проверок': site.checks,
      'Ошибок': site.errors,
      'Доступность, %': site.getUptime(),
      'Среднее время, мс': site.getAverageTime()
    }))
  }
}
