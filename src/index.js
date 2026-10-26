import fs from 'node:fs'
import Monitor from './Monitor.js'
import Logger from './Logger.js'

const args = process.argv.slice(2)
const once = args.includes('--once')
const configPath = args.find(arg => !arg.startsWith('--')) || 'data/sites.json'

let config
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
} catch (e) {
  console.log(`Не удалось прочитать файл настроек: ${configPath}`)
  process.exit(1)
}

const logger = new Logger(config.logFile || 'logs/checks.log')
const monitor = new Monitor(config, logger)

for (const item of config.sites || []) {
  try {
    monitor.addSite(item.name, item.url)
  } catch (e) {
    console.log(e.message)
  }
}

if (monitor.sites.length === 0) {
  console.log('Список сайтов пуст, проверять нечего')
  process.exit(1)
}

if (once) {
  await monitor.checkAll()
  console.table(monitor.report())
} else {
  monitor.start()
  console.log('Для остановки нажмите Ctrl+C\n')

  process.on('SIGINT', () => {
    monitor.stop()
    console.table(monitor.report())
    process.exit(0)
  })
}
