import fs from 'node:fs'
import path from 'node:path'

export default class Logger {
  constructor(file, quiet = false) {
    this.file = file
    this.quiet = quiet
    fs.mkdirSync(path.dirname(file), { recursive: true })
  }

  write(text) {
    const date = new Date().toLocaleString('ru-RU')
    const line = `[${date}] ${text}`
    if (!this.quiet) console.log(line)
    fs.appendFileSync(this.file, line + '\n')
  }
}
