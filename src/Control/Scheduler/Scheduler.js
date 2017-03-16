exports.scheduleTasks = function (f) {
  return function (tasks) {
    var scheduledTasks = tasks.map(f.bind(scheduler))

    function dispose () {
      scheduledTasks.forEach(function (task) {
        task.dispose()
      })
    }

    return { dispose: dispose }
  }
}

exports.eventTask = function (sink) {
  return function (value) {
    return new PropagateTask(runEvent, value, sink)
  }
}

exports.endTask = function (sink) {
  return new PropagateTask(runEnd, void 0, sink)
}

function PropagateTask (run, value, sink) {
  this.active = true
  this._run = run
  this.value = value
  this.sink = sink
}

PropagateTask.prototype.dispose = function () {
  this.active = false
}

PropagateTask.prototype.run = function (time) {
  if (!this.active) return

  this._run(time, this.value, this.sink)
}

function runEvent (time, value, sink) {
  sink.event(time)(value)
}

function runEnd (time, value, sink) {
  sink.end(time)
}

function defer (task) {
  return Promise.resolve(task).then(runTask)
}

function runTask (task) {
  return task.run()
}

var ClockTimer = function ClockTimer () {
  this.now = Date.now
}

ClockTimer.prototype.setTimer = function setTimer (f, dt) {
  return dt <= 0 ? runAsap(f) : setTimeout(f, dt)
}

ClockTimer.prototype.clearTimer = function clearTimer (t) {
  return t instanceof Asap ? t.cancel() : clearTimeout(t)
}

var Asap = function Asap (f) {
  this.f = f
  this.active = true
}

Asap.prototype.run = function run () {
  return this.active && this.f()
}

Asap.prototype.cancel = function cancel () {
  this.active = false
}

function runAsap (f) {
  var task = new Asap(f)
  defer(task)
  return task
}

var ScheduledTask = function ScheduledTask (delay, period, task, scheduler) {
  this.time = delay
  this.period = period
  this.task = task
  this.scheduler = scheduler
  this.active = true
}

ScheduledTask.prototype.run = function run () {
  this.task.run(this.time)
}

ScheduledTask.prototype.dispose = function dispose () {
  this.scheduler.cancel(this)
  this.task.dispose()
}

function runTask$1 (task) {
  try {
    return task.run()
  } catch (e) {
    console.error(e)
  }
}

var Scheduler = function Scheduler (timer, timeline) {
  var this$1 = this

  this.timer = timer
  this.timeline = timeline

  this._timer = null
  this._nextArrival = Infinity

  this._runReadyTasksBound = function () { return this$1._runReadyTasks(this$1.now()) }
}

Scheduler.prototype.now = function now () {
  return this.timer.now()
}

Scheduler.prototype.asap = function asap (task) {
  return this.schedule(0)(-1)(task)
}

Scheduler.prototype.delay = function delay (delay$1) {
  var this$1 = this

  return function (task) { return this$1.schedule(delay$1)(-1)(task) }
}

Scheduler.prototype.periodic = function periodic (period) {
  var this$1 = this

  return function (task) { return this$1.schedule(0)(period)(task) }
}

Scheduler.prototype.schedule = function schedule (delay) {
  var this$1 = this

  return function (period) {
    return function (task) {
      var now = this$1.now()
      var st = new ScheduledTask(now + Math.max(0, delay), period, task, this$1)

      st.run = st.run.bind(st)
      st.dispose = st.dispose.bind(st)

      this$1.timeline.add(st)
      this$1._scheduleNextRun(now)
      return st
    }
  }
}

Scheduler.prototype.cancel = function cancel (task) {
  task.active = false
  if (this.timeline.remove(task)) {
    this._reschedule()
  }
}

Scheduler.prototype.cancelAll = function cancelAll (f) {
  this.timeline.removeAll(f)
  this._reschedule()
}

Scheduler.prototype._reschedule = function _reschedule () {
  if (this.timeline.isEmpty()) {
    this._unschedule()
  } else {
    this._scheduleNextRun(this.now())
  }
}

Scheduler.prototype._unschedule = function _unschedule () {
  this.timer.clearTimer(this._timer)
  this._timer = null
}

Scheduler.prototype._scheduleNextRun = function _scheduleNextRun (now) { // eslint-disable-line complexity
  if (this.timeline.isEmpty()) {
    return
  }

  var nextArrival = this.timeline.nextArrival()

  if (this._timer === null) {
    this._scheduleNextArrival(nextArrival, now)
  } else if (nextArrival < this._nextArrival) {
    this._unschedule()
    this._scheduleNextArrival(nextArrival, now)
  }
}

Scheduler.prototype._scheduleNextArrival = function _scheduleNextArrival (nextArrival, now) {
  this._nextArrival = nextArrival
  var delay = Math.max(0, nextArrival - now)
  this._timer = this.timer.setTimer(this._runReadyTasksBound, delay)
}

Scheduler.prototype._runReadyTasks = function _runReadyTasks (now) {
  this._timer = null
  this.timeline.runTasks(now, runTask$1)
  this._scheduleNextRun(this.now())
}

/** @license MIT License (c) copyright 2010-2016 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

var Timeline = function Timeline () {
  this.tasks = []
}

Timeline.prototype.nextArrival = function nextArrival () {
  return this.isEmpty() ? Infinity : this.tasks[0].time
}

Timeline.prototype.isEmpty = function isEmpty () {
  return this.tasks.length === 0
}

Timeline.prototype.add = function add (st) {
  insertByTime(st, this.tasks)
}

Timeline.prototype.remove = function remove$$1 (st) {
  var i = binarySearch(st.time, this.tasks)

  if (i >= 0 && i < this.tasks.length) {
    var at = findIndex(st, this.tasks[i].events)
    if (at >= 0) {
      this.tasks[i].events.splice(at, 1)
      return true
    }
  }

  return false
}

Timeline.prototype.removeAll = function removeAll$$1 (f) {
  var this$1 = this

  for (var i = 0; i < this.tasks.length; ++i) {
    removeAllFrom(f, this$1.tasks[i])
  }
}

Timeline.prototype.runTasks = function runTasks (t, runTask) {
  var this$1 = this

  var tasks = this.tasks
  var l = tasks.length
  var i = 0

  while (i < l && tasks[i].time <= t) {
    ++i
  }

  this.tasks = tasks.slice(i)

  // Run all ready tasks
  for (var j = 0; j < i; ++j) {
    this$1.tasks = runReadyTasks(runTask, tasks[j].events, this$1.tasks)
  }
}

function runReadyTasks (runTask, events, tasks) { // eslint-disable-line complexity
  for (var i = 0; i < events.length; ++i) {
    var task = events[i]

    if (task.active) {
      runTask(task)

      // Reschedule periodic repeating tasks
      // Check active again, since a task may have canceled itself
      if (task.period >= 0 && task.active) {
        task.time = task.time + task.period
        insertByTime(task, tasks)
      }
    }
  }

  return tasks
}

function insertByTime (task, timeslots) { // eslint-disable-line complexity
  var l = timeslots.length

  if (l === 0) {
    timeslots.push(newTimeslot(task.time, [task]))
    return
  }

  var i = binarySearch(task.time, timeslots)

  if (i >= l) {
    timeslots.push(newTimeslot(task.time, [task]))
  } else if (task.time === timeslots[i].time) {
    timeslots[i].events.push(task)
  } else {
    timeslots.splice(i, 0, newTimeslot(task.time, [task]))
  }
}

function removeAllFrom (f, timeslot) {
  timeslot.events = removeAll(f, timeslot.events)
}

function binarySearch (t, sortedArray) { // eslint-disable-line complexity
  var lo = 0
  var hi = sortedArray.length
  var mid, y

  while (lo < hi) {
    mid = Math.floor((lo + hi) / 2)
    y = sortedArray[mid]

    if (t === y.time) {
      return mid
    } else if (t < y.time) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  return hi
}

var newTimeslot = function (t, events) { return ({ time: t, events: events }) }

function removeAll (f, a) {
  var l = a.length
  var b = new Array(l)
  var j = 0
  for (var x = (void 0), i = 0; i < l; ++i) {
    x = a[i]
    if (!f(x)) {
      b[j] = x
      ++j
    }
  }

  b.length = j
  return b
}

// findIndex :: a -> [a] -> Int
// find index of x in a, from the left
function findIndex (x, a) {
  for (var i = 0, l = a.length; i < l; ++i) {
    if (x === a[i]) {
      return i
    }
  }
  return -1
}

var scheduler = new Scheduler(new ClockTimer(), new Timeline())

exports.scheduler = scheduler
