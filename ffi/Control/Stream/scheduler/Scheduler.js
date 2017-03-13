/* @flow */
import { ScheduledTask } from './ScheduledTask'

function runTask (task) {
  try {
    return task.run()
  } catch (e) {
    console.error(e)
  }
}

export class Scheduler {
  constructor (timer, timeline) {
    this.timer = timer
    this.timeline = timeline

    this._timer = null
    this._nextArrival = Infinity

    this._runReadyTasksBound = () => this._runReadyTasks(this.now())
  }

  now () {
    return this.timer.now()
  }

  asap (task) {
    return this.schedule(0)(-1)(task)
  }

  delay (delay) {
    return task => this.schedule(delay)(-1)(task)
  }

  periodic (period) {
    return task => this.schedule(0)(period)(task)
  }

  schedule (delay) {
    return period => task => {
      const now = this.now()
      const st = new ScheduledTask(now + Math.max(0, delay), period, task, this)

      this.timeline.add(st)
      this._scheduleNextRun(now)
      return st
    }
  }

  cancel (task) {
    task.active = false
    if (this.timeline.remove(task)) {
      this._reschedule()
    }
  }

  cancelAll (f) {
    this.timeline.removeAll(f)
    this._reschedule()
  }

  _reschedule () {
    if (this.timeline.isEmpty()) {
      this._unschedule()
    } else {
      this._scheduleNextRun(this.now())
    }
  }

  _unschedule () {
    this.timer.clearTimer(this._timer)
    this._timer = null
  }

  _scheduleNextRun (now) { // eslint-disable-line complexity
    if (this.timeline.isEmpty()) {
      return
    }

    const nextArrival = this.timeline.nextArrival()

    if (this._timer === null) {
      this._scheduleNextArrival(nextArrival, now)
    } else if (nextArrival < this._nextArrival) {
      this._unschedule()
      this._scheduleNextArrival(nextArrival, now)
    }
  }

  _scheduleNextArrival (nextArrival, now) {
    this._nextArrival = nextArrival
    const delay = Math.max(0, nextArrival - now)
    this._timer = this.timer.setTimer(this._runReadyTasksBound, delay)
  }

  _runReadyTasks (now) {
    this._timer = null
    this.timeline.runTasks(now, runTask)
    this._scheduleNextRun(this.now())
  }
}
