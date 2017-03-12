'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/** @license MIT License (c) copyright 2010-2016 original author or authors */

// Non-mutating array operations

// cons :: a -> [a] -> [a]
// a with x prepended


// append :: a -> [a] -> [a]
// a with x appended


// drop :: Int -> [a] -> [a]
// drop first n elements


// tail :: [a] -> [a]
// drop head element


// copy :: [a] -> [a]
// duplicate a (shallow duplication)


// map :: (a -> b) -> [a] -> [b]
// transform each element with f
function map (f, a) {
  var l = a.length;
  var b = new Array(l);
  for (var i = 0; i < l; ++i) {
    b[i] = f(a[i]);
  }
  return b
}

// reduce :: (a -> b -> a) -> a -> [b] -> a
// accumulate via left-fold


// replace :: a -> Int -> [a]
// replace element at index


// remove :: Int -> [a] -> [a]
// remove element at index


// removeAll :: (a -> boolean) -> [a] -> [a]
// remove all elements matching a predicate
function removeAll (f, a) {
  var l = a.length;
  var b = new Array(l);
  var j = 0;
  for (var x = (void 0), i = 0; i < l; ++i) {
    x = a[i];
    if (!f(x)) {
      b[j] = x;
      ++j;
    }
  }

  b.length = j;
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

// isArrayLike :: * -> boolean
// Return true iff x is array-like

/** @license MIT License (c) copyright 2010-2016 original author or authors */

// id :: a -> a
var id = function (x) { return x; };

// compose :: (b -> c) -> (a -> b) -> (a -> c)


// apply :: (a -> b) -> a -> b


// curry2 :: ((a, b) -> c) -> (a -> b -> c)
function curry2 (f) {
  function curried (a, b) {
    switch (arguments.length) {
      case 0: return curried
      case 1: return function (b) { return f(a, b); }
      default: return f(a, b)
    }
  }
  return curried
}

// curry3 :: ((a, b, c) -> d) -> (a -> b -> c -> d)
function curry3 (f) {
  function curried (a, b, c) { // eslint-disable-line complexity
    switch (arguments.length) {
      case 0: return curried
      case 1: return curry2(function (b, c) { return f(a, b, c); })
      case 2: return function (c) { return f(a, b, c); }
      default:return f(a, b, c)
    }
  }
  return curried
}

// curry4 :: ((a, b, c, d) -> e) -> (a -> b -> c -> d -> e)

/** @license MIT License (c) copyright 2016 original author or authors */

var Disposable = function Disposable (dispose, data) {
  this._dispose = dispose;
  this._data = data;
};

Disposable.prototype.dispose = function dispose () {
  return this._dispose(this._data)
};

var MemoizedDisposable = function MemoizedDisposable (disposable) {
  this.disposed = false;
  this.value = undefined;
  this.disposable = disposable;
};

MemoizedDisposable.prototype.dispose = function dispose () {
  if (!this.disposed) {
    this.disposed = true;
    this.value = disposeSafely(this.disposable);
    this.disposable = undefined;
  }

  return this.value
};

function disposeSafely$1 (disposable) {
  disposable.dispose();
}

var createDisposable = curry2(function (dispose, data) { return new MemoizedDisposable(new Disposable(dispose, data)); });

var emptyDisposable = new Disposable(id, undefined);

var disposeAll = function (disposables) { return createDisposable(map(disposeSafely$1, disposables), disposables); };

/** @license MIT License (c) copyright 2010-2016 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

/*global setTimeout, clearTimeout*/

function defer (task) {
  return Promise.resolve(task).then(runTask)
}

function runTask (task) {
  return task.run()
}

var ClockTimer = function ClockTimer () {
  this.now = Date.now;
};

ClockTimer.prototype.setTimer = function setTimer (f, dt) {
  return dt <= 0 ? runAsap(f) : setTimeout(f, dt)
};

ClockTimer.prototype.clearTimer = function clearTimer (t) {
  return t instanceof Asap ? t.cancel() : clearTimeout(t)
};

var Asap = function Asap (f) {
  this.f = f;
  this.active = true;
};

Asap.prototype.run = function run () {
  return this.active && this.f()
};

Asap.prototype.cancel = function cancel () {
  this.active = false;
};

function runAsap (f) {
  var task = new Asap(f);
  defer(task);
  return task
}

/*       */
function ScheduledTask (delay, period, task, scheduler) {
  var this$1 = this;

  this.time = delay;
  this.period = period;
  this.task = task;
  this.scheduler = scheduler;
  this.active = true;

  this.run = function () { return task.run(this$1.time); };
  this.dispose = function () {
    scheduler.cancel(this$1);
    task.dispose();
  };
}

/*       */
function runTask$1 (task) {
  try {
    return task.run()
  } catch (e) {
    console.error(e);
  }
}

var Scheduler = function Scheduler (timer, timeline) {
  var this$1 = this;

  this.timer = timer;
  this.timeline = timeline;

  this._timer = null;
  this._nextArrival = Infinity;

  this._runReadyTasksBound = function () { return this$1._runReadyTasks(this$1.now()); };
};

Scheduler.prototype.now = function now () {
  return this.timer.now()
};

Scheduler.prototype.asap = function asap (task) {
  return this.schedule(0, -1, task)
};

Scheduler.prototype.delay = function delay (delay$1, task) {
  return this.schedule(delay$1, -1, task)
};

Scheduler.prototype.periodic = function periodic (period, task) {
  return this.schedule(0, period, task)
};

Scheduler.prototype.schedule = function schedule (delay, period, task) {
  var now = this.now();
  var st = new ScheduledTask(now + Math.max(0, delay), period, task, this);

  this.timeline.add(st);
  this._scheduleNextRun(now);
  return st
};

Scheduler.prototype.cancel = function cancel (task) {
  task.active = false;
  if (this.timeline.remove(task)) {
    this._reschedule();
  }
};

Scheduler.prototype.cancelAll = function cancelAll (f) {
  this.timeline.removeAll(f);
  this._reschedule();
};

Scheduler.prototype._reschedule = function _reschedule () {
  if (this.timeline.isEmpty()) {
    this._unschedule();
  } else {
    this._scheduleNextRun(this.now());
  }
};

Scheduler.prototype._unschedule = function _unschedule () {
  this.timer.clearTimer(this._timer);
  this._timer = null;
};

Scheduler.prototype._scheduleNextRun = function _scheduleNextRun (now) { // eslint-disable-line complexity
  if (this.timeline.isEmpty()) {
    return
  }

  var nextArrival = this.timeline.nextArrival();

  if (this._timer === null) {
    this._scheduleNextArrival(nextArrival, now);
  } else if (nextArrival < this._nextArrival) {
    this._unschedule();
    this._scheduleNextArrival(nextArrival, now);
  }
};

Scheduler.prototype._scheduleNextArrival = function _scheduleNextArrival (nextArrival, now) {
  this._nextArrival = nextArrival;
  var delay = Math.max(0, nextArrival - now);
  this._timer = this.timer.setTimer(this._runReadyTasksBound, delay);
};

Scheduler.prototype._runReadyTasks = function _runReadyTasks (now) {
  this._timer = null;
  this.timeline.runTasks(now, runTask$1);
  this._scheduleNextRun(this.now());
};

/** @license MIT License (c) copyright 2010-2016 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

var Timeline = function Timeline () {
  this.tasks = [];
};

Timeline.prototype.nextArrival = function nextArrival () {
  return this.isEmpty() ? Infinity : this.tasks[0].time
};

Timeline.prototype.isEmpty = function isEmpty () {
  return this.tasks.length === 0
};

Timeline.prototype.add = function add (st) {
  insertByTime(st, this.tasks);
};

Timeline.prototype.remove = function remove$$1 (st) {
  var i = binarySearch(st.time, this.tasks);

  if (i >= 0 && i < this.tasks.length) {
    var at = findIndex(st, this.tasks[i].events);
    if (at >= 0) {
      this.tasks[i].events.splice(at, 1);
      return true
    }
  }

  return false
};

Timeline.prototype.removeAll = function removeAll$$1 (f) {
    var this$1 = this;

  for (var i = 0; i < this.tasks.length; ++i) {
    removeAllFrom(f, this$1.tasks[i]);
  }
};

Timeline.prototype.runTasks = function runTasks (t, runTask) {
    var this$1 = this;

  var tasks = this.tasks;
  var l = tasks.length;
  var i = 0;

  while (i < l && tasks[i].time <= t) {
    ++i;
  }

  this.tasks = tasks.slice(i);

  // Run all ready tasks
  for (var j = 0; j < i; ++j) {
    this$1.tasks = runReadyTasks(runTask, tasks[j].events, this$1.tasks);
  }
};

function runReadyTasks (runTask, events, tasks) { // eslint-disable-line complexity
  for (var i = 0; i < events.length; ++i) {
    var task = events[i];

    if (task.active) {
      runTask(task);

      // Reschedule periodic repeating tasks
      // Check active again, since a task may have canceled itself
      if (task.period >= 0 && task.active) {
        task.time = task.time + task.period;
        insertByTime(task, tasks);
      }
    }
  }

  return tasks
}

function insertByTime (task, timeslots) { // eslint-disable-line complexity
  var l = timeslots.length;

  if (l === 0) {
    timeslots.push(newTimeslot(task.time, [task]));
    return
  }

  var i = binarySearch(task.time, timeslots);

  if (i >= l) {
    timeslots.push(newTimeslot(task.time, [task]));
  } else if (task.time === timeslots[i].time) {
    timeslots[i].events.push(task);
  } else {
    timeslots.splice(i, 0, newTimeslot(task.time, [task]));
  }
}

function removeAllFrom (f, timeslot) {
  timeslot.events = removeAll(f, timeslot.events);
}

function binarySearch (t, sortedArray) { // eslint-disable-line complexity
  var lo = 0;
  var hi = sortedArray.length;
  var mid, y;

  while (lo < hi) {
    mid = Math.floor((lo + hi) / 2);
    y = sortedArray[mid];

    if (t === y.time) {
      return mid
    } else if (t < y.time) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return hi
}

var newTimeslot = function (t, events) { return ({ time: t, events: events }); };

var propagateTask =
  curry3(function (run, value, sink) { return new PropagateTask(run, value, sink); });

var eventTask =
  curry2(function (value, sink) { return propagateTask(runEvent, value, sink); });

var endTask = function (sink) { return propagateTask(runEnd, void 0, sink); };

var PropagateTask = function PropagateTask (run, value, sink) {
  var active = true;

  this.dispose = function () { active = false; };
  this.run = function (t) {
    if (!active) { return }

    run(t, value, sink);
  };
};

function runEvent (time, value, sink) {
  sink.event(time)(value);
}

function runEnd (time, value, sink) {
  sink.end(time, value);
}

var defaultScheduler = new Scheduler(new ClockTimer(), new Timeline());

var scheduleTasks = curry2(function (tasks, scheduler) {
  var scheduledTasks = tasks.map(function (task) { return scheduler.asap(task); });

  return {
    dispose: function () { return scheduledTasks.forEach(function (task) { return task.dispose(); }); }
  }
});

var Stream = function Stream (source) {
  this.source = source;
};

var tapEnd = curry2(function (f, stream) { return new Stream(new TapEnd(f, stream.source)); });

var tapEvent = curry2(function (f, stream) { return new Stream(new TapEvent(f, stream.source)); });

var TapEvent = function TapEvent (f, source) {
  this.source = source;
  this.f = f;

  this.run = function (sink) { return function (scheduler) { return source.run(new TapSink(f, sink))(scheduler); }; };
};

var TapSink = function TapSink (f, sink) {
  this.event = function (t) { return function (x) {
    f(x)();
    sink.event(t)(x);
  }; };

  this.end = function (t) {
    sink.end(t);
  };
};

var TapEnd = function TapEnd (f, source) {
  this.source = source;
  this.f = f;

  this.run = function (sink) { return function (scheduler) { return source.run(new TapEndSink(f, sink))(scheduler); }; };
};

var TapEndSink = function TapEndSink (f, sink) {
  this.event = function (t) { return function (x) { return sink.event(t)(x); }; };

  this.end = function (t) {
    f();
    sink.end(t);
  };
};

var SettableDisposable = function SettableDisposable () {
  this.disposable = void 0;
  this.disposed = false;
  this.result = void 0;
};

SettableDisposable.prototype.setDisposable = function setDisposable (disposable) {
  this.disposable = disposable;

  if (this.disposed) {
    this.result = disposable.dispose();
  }
};

SettableDisposable.prototype.dispose = function dispose () {
  if (this.disposed) {
    return this.result
  }

  this.disposed = true;

  if (this.disposable !== void 0) {
    this.result = this.disposable.dispose();
  }

  return this.result
};

function runEffects (stream, scheduler) {
  return runSourceEffects(stream.source, scheduler)
}

var runSourceEffects = function (source, scheduler) { return runSource(source, scheduler); };

function runSource (source, scheduler) {
  var disposable = new SettableDisposable();
  var observer = new RunEffectsSink(disposable);

  disposable.setDisposable(source.run(observer)(scheduler));
}

var RunEffectsSink = function RunEffectsSink (disposable) {
  this._disposable = disposable;
  this.active = true;
};

RunEffectsSink.prototype.event = function event (t) {
  return function (x) {}
};

RunEffectsSink.prototype.end = function end (t) {
  this.active = false;
  Promise.resolve(this._disposable).then(function (d) { return d.dispose(); });
};

var drain = function (stream) { return function () { return runEffects(stream, defaultScheduler); }; };

var combine =
  curry3(function (f, stream1, stream2) { return new Stream(new Combine(f, stream1.source, stream2.source)); });

var Combine = function Combine (f, source1, source2) {
  this.f = f;
  this.source1 = source1;
  this.source2 = source2;
};

Combine.prototype.run = function run (sink) {
    var this$1 = this;

  return function (scheduler) {
    var disposables = Array(2);
    var sinks = Array(2);

    var mergeSink = new CombineSink(disposables, sinks, sink, this$1.f);

    sinks[0] = new IndexSink(0, mergeSink);
    sinks[1] = new IndexSink(1, mergeSink);
    disposables[0] = this$1.source1.run(sinks[0])(scheduler);
    disposables[1] = this$1.source2.run(sinks[1])(scheduler);

    return disposeAll(disposables)
  }
};

var IndexSink = function IndexSink () {};

IndexSink.prototype.cosntructor = function cosntructor (i, sink) {
  this.i = i;
  this.sink = sink;
};

IndexSink.prototype.event = function event (t) {
    var this$1 = this;

  return function (x) {
    this$1.sink.event(t)({ index: this$1.i, value: x });
  }
};

IndexSink.prototype.end = function end (t) {
  this.sink.end(t, this.i);
};

var CombineSink = function CombineSink (disposables, sinks, sink, f) {
  this.disposables = disposables;
  this.sinks = sinks;
  this.sink = sink;
  this.f = f;

  this.awaiting = 2;
  this.values = Array(2);
  this.hasValue = [false, false];
  this.activeCount = 2;
};

CombineSink.prototype.event = function event (t) {
    var this$1 = this;

  return function (ref) {
      var index = ref.index;
      var value = ref.value;

    var f = this$1.f;
    var awaiting = this$1._updateReady(index);
    this$1.values[index] = value;

    if (awaiting === 0) {
      var result = f(this$1.values[0])(this$1.values[1]);
      this$1.sink.event(t)(result);
    }
  }
};

CombineSink.prototype._updateReady = function _updateReady (index) {
  if (this.awaiting > 0) {
    if (!this.hasValue[index]) {
      this.hasValue[index] = true;
      this.awaiting -= 1;
    }
  }

  return this.awaiting
};

CombineSink.prototype.end = function end (t, ref) {
    var index = ref.index;
    var value = ref.value;

  this.disposables[index].dispose();

  if (--this.activeCount === 0) { this.sink.end(t); }
};

/*       */

exports.createDisposable = createDisposable;
exports.emptyDisposable = emptyDisposable;
exports.disposeAll = disposeAll;
exports.defaultScheduler = defaultScheduler;
exports.scheduleTasks = scheduleTasks;
exports.endTask = endTask;
exports.eventTask = eventTask;
exports.tapEnd = tapEnd;
exports.tapEvent = tapEvent;
exports.drain = drain;
exports.combine = combine;
