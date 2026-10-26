export default class Site {
  constructor(name, url) {
    this.name = name
    this.url = url
    this.status = 'unknown'
    this.code = null
    this.time = null
    this.fails = 0
    this.checks = 0
    this.errors = 0
    this.totalTime = 0
  }

  update(result, maxFails) {
    this.checks++
    this.code = result.code
    this.time = result.time

    if (result.ok) {
      this.fails = 0
      this.totalTime += result.time
      this.status = 'up'
    } else {
      this.fails++
      this.errors++
      this.status = this.fails >= maxFails ? 'down' : 'warning'
    }
  }

  getUptime() {
    if (this.checks === 0) return 0
    return Math.round((this.checks - this.errors) / this.checks * 100)
  }

  getAverageTime() {
    const success = this.checks - this.errors
    if (success === 0) return 0
    return Math.round(this.totalTime / success)
  }
}
