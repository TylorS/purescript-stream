'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/** @license MIT License (c) copyright 2010-2016 original author or authors */

// Non-mutating array operations

// cons :: a -> [a] -> [a]
// a with x prepended


// append :: a -> [a] -> [a]
// a with x appended
function append (x, a) {
  var l = a.length;
  var b = new Array(l + 1);
  for (var i = 0; i < l; ++i) {
    b[i] = a[i];
  }

  b[l] = x;
  return b
}

// drop :: Int -> [a] -> [a]
// drop first n elements
function drop (n, a) { // eslint-disable-line complexity
  if (n < 0) {
    throw new TypeError('n must be >= 0')
  }

  var l = a.length;
  if (n === 0 || l === 0) {
    return a
  }

  if (n >= l) {
    return []
  }

  return unsafeDrop(n, a, l - n)
}

// unsafeDrop :: Int -> [a] -> Int -> [a]
// Internal helper for drop
function unsafeDrop (n, a, l) {
  var b = new Array(l);
  for (var i = 0; i < l; ++i) {
    b[i] = a[n + i];
  }
  return b
}

// tail :: [a] -> [a]
// drop head element
function tail (a) {
  return drop(1, a)
}

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
function reduce (f, z, a) {
  var r = z;
  for (var i = 0, l = a.length; i < l; ++i) {
    r = f(r, a[i], i);
  }
  return r
}

// replace :: a -> Int -> [a]
// replace element at index


// remove :: Int -> [a] -> [a]
// remove element at index
function remove (i, a) {  // eslint-disable-line complexity
  if (i < 0) {
    throw new TypeError('i must be >= 0')
  }

  var l = a.length;
  if (l === 0 || i >= l) { // exit early if index beyond end of array
    return a
  }

  if (l === 1) { // exit early if index in bounds and length === 1
    return []
  }

  return unsafeRemove(i, a, l - 1)
}

// unsafeRemove :: Int -> [a] -> Int -> [a]
// Internal helper to remove element at index
function unsafeRemove (i, a, l) {
  var b = new Array(l);
  var j;
  for (j = 0; j < i; ++j) {
    b[j] = a[j];
  }
  for (j = i; j < l; ++j) {
    b[j] = a[j + 1];
  }

  return b
}

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

  this.dispose = function () { return dispose(data); };
};

var MemoizedDisposable = function MemoizedDisposable (disposable) {
  this.disposed = false;
  this.value = undefined;
  this.disposable = disposable;
};

MemoizedDisposable.prototype.dispose = function dispose () {
  if (!this.disposed) {
    this.disposed = true;
    this.value = this.disposable.dispose();
    this.disposable = undefined;
  }

  return this.value
};

function disposeSafely (disposable) {
  disposable.dispose();
}

var createDisposable = curry2(function (dispose, data) { return new MemoizedDisposable(new Disposable(dispose, data)); });

var emptyDisposable = new Disposable(id, undefined);

var disposeAll = function (disposables) { return createDisposable(curry2(map)(disposeSafely), disposables); };

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
var ScheduledTask = function ScheduledTask (delay, period, task, scheduler) {
  this.time = delay;
  this.period = period;
  this.task = task;
  this.scheduler = scheduler;
  this.active = true;
};

ScheduledTask.prototype.run = function run () {
  this.task.run(this.time);
};

ScheduledTask.prototype.dispose = function dispose () {
  this.scheduler.cancel(this);
  this.task.dispose();
};

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
  return this.schedule(0)(-1)(task)
};

Scheduler.prototype.delay = function delay (delay$1) {
    var this$1 = this;

  return function (task) { return this$1.schedule(delay$1)(-1)(task); }
};

Scheduler.prototype.periodic = function periodic (period) {
    var this$1 = this;

  return function (task) { return this$1.schedule(0)(period)(task); }
};

Scheduler.prototype.schedule = function schedule (delay) {
    var this$1 = this;

  return function (period) { return function (task) {
    var now = this$1.now();
    var st = new ScheduledTask(now + Math.max(0, delay), period, task, this$1);

    this$1.timeline.add(st);
    this$1._scheduleNextRun(now);
    return st
  }; }
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
  this.sink = sink;

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

  return {}
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

var LinkedList = function LinkedList () {
  this.head = null;
  this.length = 0;
};

LinkedList.prototype.add = function add (x) {
  if (this.head !== null) {
    this.head.prev = x;
    x.next = this.head;
  }
  this.head = x;
  ++this.length;
};

LinkedList.prototype.remove = function remove (x) { // eslint-disable-linecomplexity
  --this.length;
  if (x === this.head) {
    this.head = this.head.next;
  }
  if (x.next !== null) {
    x.next.prev = x.prev;
    x.next = null;
  }
  if (x.prev !== null) {
    x.prev.next = x.next;
    x.prev = null;
  }
};

LinkedList.prototype.isEmpty = function isEmpty () {
  return this.length === 0
};

LinkedList.prototype.dispose = function dispose () {
  if (this.isEmpty()) { return }

  var x = this.head;
  this.head = null;
  this.length = 0;

  while (x !== null) {
    x.dispose();
    x = x.next;
  }
};

var Stream = function Stream (source) {
  this.source = source;
};

/** @license MIT License (c) copyright 2010-2016 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

var flatMap =
  curry2(function (stream, f) { return mergeMapConcurrently(f, Infinity, stream); });

var mergeConcurrently = curry2(function (concurrency, stream) { return mergeMapConcurrently(id, concurrency, stream); });

var join =
  mergeConcurrently(Infinity);

var mergeMapConcurrently = curry3(function (f, concurrency, stream) { return new Stream(new MergeConcurrently(f, concurrency, stream.source)); });

var MergeConcurrently = function MergeConcurrently (f, concurrency, source) {
  this.f = f;
  this.concurrency = concurrency;
  this.source = source;
};

MergeConcurrently.prototype.run = function run (sink) {
    var this$1 = this;

  return function (scheduler) { return new Outer(this$1.f, this$1.concurrency, this$1.source, sink, scheduler); }
};

var Outer = function Outer (f, concurrency, source, sink, scheduler) {
  this.f = f;
  this.concurrency = concurrency;
  this.sink = sink;
  this.scheduler = scheduler;
  this.pending = [];
  this.current = new LinkedList();
  this.disposable = new MemoizedDisposable(source.run(this)(scheduler));
  this.active = true;
};

Outer.prototype.event = function event (t) {
    var this$1 = this;

  return function (x) { return this$1._addInner(t, x); }
};

Outer.prototype._addInner = function _addInner (t, x) {
  if (this.current.length < this.concurrency) {
    this._startInner(t, x);
  } else {
    this.pending.push(x);
  }
};

Outer.prototype._startInner = function _startInner (t, x) {
  try {
    this._initInner(t, x);
  } catch (e) {
    this.error(t, e);
  }
};

Outer.prototype._initInner = function _initInner (t, x) {
  var innerSink = new Inner(t, this, this.sink);
  innerSink.disposable = mapAndRun(this.f, x, innerSink, this.scheduler);
  this.current.add(innerSink);
};

Outer.prototype.end = function end (t) {
  this.active = false;
  this.disposable.dispose();
  this._checkEnd(t);
};

Outer.prototype.dispose = function dispose () {
  this.active = false;
  this.pending.length = 0;
  this.disposable.dispose();
  this.current.dispose();
};

Outer.prototype._endInner = function _endInner (t, inner) {
  this.current.remove(inner);
  inner.dispose();

  if (this.pending.length === 0) {
    this._checkEnd(t);
  } else {
    this._startInner(t, this.pending.shift());
  }
};

Outer.prototype._checkEnd = function _checkEnd (t) {
  if (!this.active && this.current.isEmpty()) {
    this.sink.end(t);
  }
};

var mapAndRun = function (f, x, sink, scheduler) { return f(x).source.run(sink)(scheduler); };

var Inner = function Inner (time, outer, sink) {
  this.prev = this.next = null;
  this.time = time;
  this.outer = outer;
  this.sink = sink;
  this.disposable = void 0;
};

Inner.prototype.event = function event (t) {
    var this$1 = this;

  return function (x) { return this$1.sink.event(Math.max(t, this$1.time))(x); }
};

Inner.prototype.end = function end (t) {
  this.outer._endInner(Math.max(t, this.time), this);
};

Inner.prototype.dispose = function dispose () {
  return this.disposable.dispose()
};

var IndexSink = function IndexSink (i, sink) {
  this.sink = sink;
  this.index = i;
  this.active = true;
  this.value = void 0;
};

IndexSink.prototype.event = function event (t) {
    var this$1 = this;

  return function (x) {
    if (!this$1.active) { return }

    this$1.value = x;
    this$1.sink.event(t)(this$1);
  }
};

IndexSink.prototype.end = function end (t) {
  if (!this.active) { return }

  this.active = false;
  this.sink.end(t, { index: this.index });
};

/** @license MIT License (c) copyright 2010-2016 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

var combine2 = function (f) { return function (s1) { return function (s2) { return combineArray(f, [s1, s2]); }; }; };
var combine3 = function (f) { return function (s1) { return function (s2) { return function (s3) { return combineArray(f, [s1, s2, s3]); }; }; }; };
var combine4 = function (f) { return function (s1) { return function (s2) { return function (s3) { return function (s4) { return combineArray(f, [s1, s2, s3, s4]); }; }; }; }; };
var combine5 = function (f) { return function (s1) { return function (s2) { return function (s3) { return function (s4) { return function (s5) { return combineArray(f, [s1, s2, s3, s4, s5]); }; }; }; }; }; };

function combineArray (f, streams) {
  return new Stream(combineSources(f, streams))
}

function combineSources (f, streams) {
  return new Combine(f, map(getSource, streams))
}

function getSource (stream) {
  return stream.source
}

function Combine (f, sources) {
  this.f = f;
  this.sources = sources;
}

Combine.prototype.run = function (sink) {
  var this$1 = this;

  return function (scheduler) {
    var l = this$1.sources.length;
    var disposables = new Array(l);
    var sinks = new Array(l);

    var mergeSink = new CombineSink(disposables, sinks, sink, this$1.f);

    for (var indexSink, i = 0; i < l; ++i) {
      indexSink = sinks[i] = new IndexSink(i, mergeSink);
      disposables[i] = this$1.sources[i].run(indexSink)(scheduler);
    }

    return disposeAll(disposables)
  }
};

function CombineSink (disposables, sinks, sink, f) {
  var this$1 = this;

  this.sink = sink;
  this.disposables = disposables;
  this.sinks = sinks;
  this.f = f;

  var l = sinks.length;
  this.awaiting = l;
  this.values = new Array(l);
  this.hasValue = new Array(l);

  for (var i = 0; i < l; ++i) {
    this$1.hasValue[i] = false;
  }

  this.activeCount = sinks.length;
}

CombineSink.prototype.event = function (t) {
  var this$1 = this;

  return function (indexedValue) {
    var i = indexedValue.index;
    var awaiting = this$1._updateReady(i);

    this$1.values[i] = indexedValue.value;
    if (awaiting === 0) {
      var value = tail(this$1.values).reduce(function (f, x) { return f(x); }, this$1.f(this$1.values[0]));
      this$1.sink.event(t)(value);
    }
  }
};

CombineSink.prototype._updateReady = function (index) {
  if (this.awaiting > 0) {
    if (!this.hasValue[index]) {
      this.hasValue[index] = true;
      this.awaiting -= 1;
    }
  }
  return this.awaiting
};

CombineSink.prototype.end = function (t, indexedValue) {
  this.disposables[indexedValue.index].dispose();

  if (--this.activeCount === 0) {
    this.sink.end(t);
  }
};

/** @license MIT License (c) copyright 2010-2016 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

/**
 * @param {Array} streams array of stream to merge
 * @returns {Stream} stream containing events from all input observables
 * in time order.  If two events are simultaneous they will be merged in
 * arbitrary order.
 */
function merge (streams) {
  return new Stream(mergeSources(streams))
}

/**
 * This implements fusion/flattening for merge.  It will
 * fuse adjacent merge operations.  For example:
 * - a.merge(b).merge(c) effectively becomes merge(a, b, c)
 * - merge(a, merge(b, c)) effectively becomes merge(a, b, c)
 * It does this by concatenating the sources arrays of
 * any nested Merge sources, in effect "flattening" nested
 * merge operations into a single merge.
 */
function mergeSources (streams) {
  return new Merge(reduce(appendSources, [], streams))
}

function appendSources (sources, stream) {
  var source = stream.source;
  return source instanceof Merge
    ? sources.concat(source.sources)
    : sources.concat(source)
}

function Merge (sources) {
  this.sources = sources;
}

Merge.prototype.run = function (sink, scheduler) {
  var this$1 = this;

  var l = this.sources.length;
  var disposables = new Array(l);
  var sinks = new Array(l);

  var mergeSink = new MergeSink(disposables, sinks, sink);

  for (var indexSink, i = 0; i < l; ++i) {
    indexSink = sinks[i] = new IndexSink(i, mergeSink);
    disposables[i] = this$1.sources[i].run(indexSink, scheduler);
  }

  return disposeAll(disposables)
};

function MergeSink (disposables, sinks, sink) {
  this.sink = sink;
  this.disposables = disposables;
  this.activeCount = sinks.length;
}

MergeSink.prototype.event = function (t, indexValue) {
  this.sink.event(t, indexValue.value);
};

MergeSink.prototype.end = function (t, indexedValue) {
  dispose.tryDispose(t, this.disposables[indexedValue.index], this.sink);
  if (--this.activeCount === 0) {
    this.sink.end(t, indexedValue.value);
  }
};

var concat = function (s1) { return function (s2) { return continueWith(function () { return s2; })(s1); }; };

var continueWith = function (f) { return function (stream) { return new Stream(new ContinueWith(f, stream.source)); }; };

function ContinueWith (f, source) {
  this.f = f;
  this.source = source;
}

ContinueWith.prototype.run = function (sink) {
  var this$1 = this;

  return function (scheduler) {
    return new ContinueWithSink(this$1.f, this$1.source, sink, scheduler)
  }
};

function ContinueWithSink (f, source, sink, scheduler) {
  this.f = f;
  this.sink = sink;
  this.scheduler = scheduler;
  this.active = true;
  this.disposable = new MemoizedDisposable(source.run(this)(scheduler));
}

ContinueWithSink.prototype.event = function (t) {
  var this$1 = this;

  return function (x) {
    if (!this$1.active) {
      return
    }
    this$1.sink.event(t)(x);
  }
};

ContinueWithSink.prototype.end = function (t, x) {
  if (!this.active) {
    return
  }

  this.disposable.dispose();
  this._startNext(t, x, this.sink);
};

ContinueWithSink.prototype._startNext = function (t, x, sink) {
  this._continue(this.f, x, sink);
};

ContinueWithSink.prototype._continue = function (f, x, sink) {
  return f(x).source.run(sink)(this.scheduler)
};

ContinueWithSink.prototype.dispose = function () {
  this.active = false;
  return this.disposable.dispose()
};

/**
 * Given a stream of streams, return a new stream that adopts the behavior
 * of the most recent inner stream.
 * @param {Stream} stream of streams on which to switch
 * @returns {Stream} switching stream
 */
function switchLatest (stream) {
  return new Stream(new Switch(stream.source))
}

function Switch (source) {
  this.source = source;
}

Switch.prototype.run = function (sink) {
  var this$1 = this;

  return function (scheduler) {
    var switchSink = new SwitchSink(sink, scheduler);
    return disposeAll([switchSink, this$1.source.run(switchSink)(scheduler)])
  }
};

function SwitchSink (sink, scheduler) {
  this.sink = sink;
  this.scheduler = scheduler;
  this.current = null;
  this.ended = false;
}

SwitchSink.prototype.event = function (t) {
  var this$1 = this;

  return function (stream) {
    this$1._disposeCurrent(t); // TODO: capture the result of this dispose
    this$1.current = new Segment(t, Infinity, this$1, this$1.sink);
    this$1.current.disposable = stream.source.run(this$1.current)(this$1.scheduler);
  }
};

SwitchSink.prototype.end = function (t, x) {
  this.ended = true;
  this._checkEnd(t, x);
};

SwitchSink.prototype.dispose = function () {
  return this._disposeCurrent(this.scheduler.now())
};

SwitchSink.prototype._disposeCurrent = function (t) {
  if (this.current !== null) {
    return this.current._dispose(t)
  }
};

SwitchSink.prototype._disposeInner = function (t, inner) {
  inner._dispose(t); // TODO: capture the result of this dispose
  if (inner === this.current) {
    this.current = null;
  }
};

SwitchSink.prototype._checkEnd = function (t, x) {
  if (this.ended && this.current === null) {
    this.sink.end(t, x);
  }
};

SwitchSink.prototype._endInner = function (t, x, inner) {
  this._disposeInner(t, inner);
  this._checkEnd(t, x);
};

function Segment (min, max, outer, sink) {
  this.min = min;
  this.max = max;
  this.outer = outer;
  this.sink = sink;
  this.disposable = emptyDisposable;
}

Segment.prototype.event = function (t) {
  var this$1 = this;

  return function (x) {
    if (t < this$1.max) {
      this$1.sink.event(Math.max(t, this$1.min))(x);
    }
  }
};

Segment.prototype.end = function (t, x) {
  this.outer._endInner(Math.max(t, this.min), x, this);
};

Segment.prototype._dispose = function (t) {
  this.max = t;
  this.disposable.dispose();
};

var skipRepeatsWith = function (equals) { return function (stream) { return new Stream(new SkipRepeats(equals, stream)); }; };

var SkipRepeats = function SkipRepeats (equals, source) {
  this.equals = equals;
  this.source = source;
};

SkipRepeats.prototype.run = function run (sink) {
    var this$1 = this;

  return function (scheduler) { return this$1.source.run(new SkipRepeatsSink(this$1.equals, sink), scheduler); }
};

var SkipRepeatsSink = function SkipRepeatsSink (equals, sink) {
  this.equals = equals;
  this.value = void 0;
  this.init = true;
};

SkipRepeatsSink.prototype.event = function event (t) {
    var this$1 = this;

  return function (x) {
    if (this$1.init) {
      this$1.init = false;
      this$1.value = x;
      this$1.sink.event(t, x);
    } else if (!this$1.equals(this$1.value)(x)) {
      this$1.value = x;
      this$1.sink.event(t)(x);
    }
  }
};

SkipRepeatsSink.prototype.end = function end (t) {
  this.sink.end(t);
};

var delay = function (delayTime) { return function (stream) { return delayTime <= 0 ? stream : new Stream(new Delay(delayTime, stream.source)); }; };

var Delay = function Delay (dt, source) {
  this.dt = dt;
  this.source = source;
};

Delay.prototype.run = function run (sink) {
    var this$1 = this;

  return function (scheduler) {
    var delaySink = new DelaySink(this$1.dt, sink, scheduler);
    return disposeAll([delaySink, this$1.source.run(delaySink)(scheduler)])
  }
};

var DelaySink = function DelaySink (dt, sink, scheduler) {
  this.dt = dt;
  this.sink = sink;
  this.scheduler = scheduler;
};

DelaySink.prototype.dispose = function dispose () {
    var this$1 = this;

  this.scheduler.cancelAll(function (task) { return task.sink === this$1.sink; });
};

DelaySink.prototype.event = function event (t) {
    var this$1 = this;

  return function (x) { return this$1.scheduler.delay(this$1.dt)(eventTask(x)(this$1.sink)); }
};

DelaySink.prototype.end = function end (t) {
  this.scheduler.delay(this.dt)(endTask(this.sink));
};

var dispose$1 = function (disposable) { return disposable.dispose(); };

var emptyDisposable$1 = {
  dispose: function dispose () {}
};

var MulticastDisposable = function MulticastDisposable (source, sink) {
  this.source = source;
  this.sink = sink;
  this.disposed = false;
};

MulticastDisposable.prototype.dispose = function dispose () {
  if (this.disposed) {
    return
  }
  this.disposed = true;
  var remaining = this.source.remove(this.sink);
  return remaining === 0 && this.source._dispose()
};

var MulticastSource = function MulticastSource (source) {
  this.source = source;
  this.sinks = [];
  this._disposable = emptyDisposable$1;
};

MulticastSource.prototype.run = function run (sink) {
    var this$1 = this;

  return function (scheduler) {
    var n = this$1.add(sink, scheduler);
    if (n === 1) {
      this$1._disposable = this$1.source.run(this$1)(scheduler);
    }
    return new MulticastDisposable(this$1, sink)
  }
};

MulticastSource.prototype._dispose = function _dispose () {
  var disposable = this._disposable;
  this._disposable = emptyDisposable$1;
  return Promise.resolve(disposable).then(dispose$1)
};

MulticastSource.prototype.add = function add (sink) {
  this.sinks = append(sink, this.sinks);
  return this.sinks.length
};

MulticastSource.prototype.remove = function remove$1 (sink) {
  var i = findIndex(sink, this.sinks);
  // istanbul ignore next
  if (i >= 0) {
    this.sinks = remove(i, this.sinks);
  }

  return this.sinks.length
};

MulticastSource.prototype.event = function event (time) {
    var this$1 = this;

  return function (value) {
    var s = this$1.sinks;
    if (s.length === 1) {
      return s[0].event(time)(value)
    }
    for (var i = 0; i < s.length; ++i) {
      s[i].event(time)(value);
    }
  }
};

MulticastSource.prototype.end = function end (time) {
  var s = this.sinks;
  for (var i = 0; i < s.length; ++i) {
    s[i].end(time);
  }
};

var HoldSource = (function (MulticastSource$$1) {
  function HoldSource (source, bufferSize) {
    MulticastSource$$1.call(this, source);
    this.bufferSize = bufferSize;
    this.has = false;
    this.buffer = [];
  }

  if ( MulticastSource$$1 ) HoldSource.__proto__ = MulticastSource$$1;
  HoldSource.prototype = Object.create( MulticastSource$$1 && MulticastSource$$1.prototype );
  HoldSource.prototype.constructor = HoldSource;

  HoldSource.prototype.add = function add (sink, scheduler) {
    if (this.has) {
      pushEvents(this.buffer, sink, scheduler);
    }

    return MulticastSource$$1.prototype.add.call(this, sink, scheduler)
  };

  HoldSource.prototype.event = function event (time) {
    var this$1 = this;

    return function (value) {
      this$1.has = true;
      this$1.buffer = dropAndAppend(value, this$1.buffer, this$1.bufferSize);

      return MulticastSource$$1.prototype.event.call(this$1, time)(value)
    }
  };

  return HoldSource;
}(MulticastSource));

function pushEvents (buffer, sink, scheduler) {
  var length = buffer.length;

  for (var i = 0; i < length; ++i) {
    sink.event(scheduler.now(), buffer[i]);
  }
}

function dropAndAppend (value, buffer, bufferSize) {
  if (buffer.length === bufferSize) {
    return append(value, drop(1, buffer))
  }

  return append(value, buffer)
}

function multicast (stream) {
  var source = stream.source;

  return source instanceof MulticastSource
    ? stream
    : new Stream(new MulticastSource(source))
}

var hold = function (bufferSize) { return function (stream) { return new Stream(new HoldSource(stream.source, bufferSize)); }; };

/*       */

exports.createDisposable = createDisposable;
exports.emptyDisposable = emptyDisposable;
exports.disposeAll = disposeAll;
exports.defaultScheduler = defaultScheduler;
exports.scheduleTasks = scheduleTasks;
exports.endTask = endTask;
exports.eventTask = eventTask;
exports.drain = drain;
exports.flatMap = flatMap;
exports.mergeConcurrently = mergeConcurrently;
exports.join = join;
exports.mergeMapConcurrently = mergeMapConcurrently;
exports.combine2 = combine2;
exports.combine3 = combine3;
exports.combine4 = combine4;
exports.combine5 = combine5;
exports.merge = merge;
exports.concat = concat;
exports.continueWith = continueWith;
exports.switch = switchLatest;
exports.skipRepeatsWith = skipRepeatsWith;
exports.delay = delay;
exports.multicast = multicast;
exports.hold = hold;
