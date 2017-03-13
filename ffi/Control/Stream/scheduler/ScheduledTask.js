/* @flow */
export class ScheduledTask {
  constructor (delay, period, task, scheduler) {
    this.time = delay
    this.period = period
    this.task = task
    this.scheduler = scheduler
    this.active = true
  }

  run () {
    this.task.run(this.time)
  }

  dispose () {
    this.scheduler.cancel(this)
    this.task.dispose()
  }
}
