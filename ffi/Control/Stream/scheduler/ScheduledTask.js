/* @flow */
export function ScheduledTask (delay, period, task, scheduler) {
  this.time = delay
  this.period = period
  this.task = task
  this.scheduler = scheduler
  this.active = true

  this.run = () => task.run(this.time)
  this.dispose = () => {
    scheduler.cancel(this)
    task.dispose()
  }
}
