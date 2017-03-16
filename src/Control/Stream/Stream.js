var ControlStreamScheduler = require('../Control.Stream.Scheduler')
var ControlStreamStream = require('../Control.Stream.Stream')

exports.drain = function (stream) { return function () { return runSource(stream, ControlStreamScheduler.scheduler) } }

exports.subscribe = function (event) {
  return function (end) {
    return function (stream) {
      return function () {
        var disposable = new SettableDisposable()

        var observer = { event: event, end: end }

        var d = stream.run(observer)(ControlStreamScheduler.scheduler)

        disposable.setDisposable(d)

        return {}
      }
    }
  }
}

function runSource (source, scheduler) {
  var disposable = new SettableDisposable()

  function event (t) {
    return function (x) {
      return {}
    }
  }

  function end (t) {
    disposable.dispose()
    return {}
  }

  var observer = { event: event, end: end }

  var d = source.run(observer)(scheduler)

  disposable.setDisposable(d)

  return {}
}

var SettableDisposable = function SettableDisposable () {
  this.disposable = void 0
  this.disposed = false
  this.result = void 0
}

SettableDisposable.prototype.setDisposable = function setDisposable (disposable) {
  this.disposable = disposable

  if (this.disposed) {
    this.result = disposable.dispose()
  }
}

SettableDisposable.prototype.dispose = function dispose () {
  if (this.disposed) {
    return this.result
  }

  this.disposed = true

  if (this.disposable !== void 0) {
    this.result = this.disposable.dispose()
  }

  return this.result
}

exports.fromArray = function (array) {
  return function (stream) {
    return new FromArray(array, stream)
  }
}

function FromArray (array, stream) {
  this.array = array
  this.stream = stream
}

FromArray.prototype.run = function (sink) {
  var that = this

  return function (scheduler) {
    return that.stream.run(new FromArraySink(sink, that.array))(scheduler)
  }
}

function FromArraySink (sink, array) {
  this.sink = sink
  this.array = array
}

FromArraySink.prototype.event = function (time) {
  var array = this.array
  var sink = this.sink
  return function (x) {
    var value = array.shift()

    if (value) {
      sink.event(time)(value)
    } else {
      sink.end(time)
    }
  }
}

FromArraySink.prototype.end = function (time) {
  this.sink.end(time)
}

var LinkedList = function LinkedList () {
  this.head = null
  this.length = 0
}

LinkedList.prototype.add = function add (x) {
  if (this.head !== null) {
    this.head.prev = x
    x.next = this.head
  }
  this.head = x
  ++this.length
}

LinkedList.prototype.remove = function remove (x) { // eslint-disable-line complexity
  --this.length
  if (x === this.head) {
    this.head = this.head.next
  }
  if (x.next !== null) {
    x.next.prev = x.prev
    x.next = null
  }
  if (x.prev !== null) {
    x.prev.next = x.next
    x.prev = null
  }
}

LinkedList.prototype.isEmpty = function isEmpty () {
  return this.length === 0
}

LinkedList.prototype.dispose = function dispose () {
  if (this.isEmpty()) { return }

  var x = this.head
  this.head = null
  this.length = 0

  while (x !== null) {
    x.dispose()
    x = x.next
  }
}

exports.chain = function (f) {
  return function (stream) {
    return mergeMapConcurrently(f)(Infinity)(stream)
  }
}

exports.mergeConcurrently = mergeConcurrently

function mergeConcurrently (concurrency) {
  return function (stream) {
    return mergeMapConcurrently(function (x) { return x })(concurrency)(stream)
  }
}

exports.join = mergeConcurrently(Infinity)

exports.mergeMapConcurrently = mergeMapConcurrently

function mergeMapConcurrently (f) {
  return function (concurrency) {
    return function (stream) {
      var mstream = new MergeConcurrently(f, concurrency, stream)

      mstream.run.bind(mstream)

      return mstream
    }
  }
}

function MergeConcurrently (f, concurrency, source) {
  this.f = f
  this.concurrency = concurrency
  this.source = source
}

MergeConcurrently.prototype.run = function run (sink) {
  var this$1 = this

  return function (scheduler) { return new Outer(this$1.f, this$1.concurrency, this$1.source, sink, scheduler) }
}

var Outer = function Outer (f, concurrency, source, sink, scheduler) {
  this.f = f
  this.concurrency = concurrency
  this.sink = sink
  this.scheduler = scheduler
  this.pending = []
  this.current = new LinkedList()

  var disposed = false
  var disposable = source.run(this)(scheduler)

  this.disposable = {
    dispose: function () {
      if (disposed) return

      disposed = true
      disposable.dispose()
    }
  }

  this.active = true
}

Outer.prototype.event = function event (t) {
  var this$1 = this

  return function (x) { return this$1._addInner(t, x) }
}

Outer.prototype._addInner = function _addInner (t, x) {
  if (this.current.length < this.concurrency) {
    this._startInner(t, x)
  } else {
    this.pending.push(x)
  }
}

Outer.prototype._startInner = function _startInner (t, x) {
  this._initInner(t, x)
}

Outer.prototype._initInner = function _initInner (t, x) {
  var innerSink = new Inner(t, this, this.sink)
  innerSink.disposable = mapAndRun(this.f, x, innerSink, this.scheduler)
  this.current.add(innerSink)
}

Outer.prototype.end = function end (t) {
  this.active = false
  this.disposable.dispose()
  this._checkEnd(t)
}

Outer.prototype.dispose = function dispose () {
  this.active = false
  this.pending.length = 0
  this.disposable.dispose()
  this.current.dispose()
}

Outer.prototype._endInner = function _endInner (t, inner) {
  this.current.remove(inner)
  inner.dispose()

  if (this.pending.length === 0) {
    this._checkEnd(t)
  } else {
    this._startInner(t, this.pending.shift())
  }
}

Outer.prototype._checkEnd = function _checkEnd (t) {
  if (!this.active && this.current.isEmpty()) {
    this.sink.end(t)
  }
}

var mapAndRun = function (f, x, sink, scheduler) { return f(x).run(sink)(scheduler) }

var Inner = function Inner (time, outer, sink) {
  this.prev = this.next = null
  this.time = time
  this.outer = outer
  this.sink = sink
  this.disposable = void 0
}

Inner.prototype.event = function event (t) {
  var this$1 = this

  return function (x) { return this$1.sink.event(Math.max(t, this$1.time))(x) }
}

Inner.prototype.end = function end (t) {
  this.outer._endInner(Math.max(t, this.time), this)
}

Inner.prototype.dispose = function dispose () {
  return this.disposable.dispose()
}

exports.switch = function switchLatest (stream) {
  return new Switch(stream)
}

function Switch (source) {
  this.source = source
}

Switch.prototype.run = function (sink) {
  var this$1 = this

  return function (scheduler) {
    var switchSink = new SwitchSink(sink, scheduler)
    var disposable = this$1.source.run(switchSink)(scheduler)

    return {
      dispose: function () {
        switchSink.dispose()
        disposable.dispose()
      }
    }
  }
}

function SwitchSink (sink, scheduler) {
  this.sink = sink
  this.scheduler = scheduler
  this.current = null
  this.ended = false
}

SwitchSink.prototype.event = function (t) {
  var this$1 = this

  return function (stream) {
    this$1._disposeCurrent(t) // TODO: capture the result of this dispose
    this$1.current = new Segment(t, Infinity, this$1, this$1.sink)
    this$1.current.disposable = stream.run(this$1.current)(this$1.scheduler)
  }
}

SwitchSink.prototype.end = function (t, x) {
  this.ended = true
  this._checkEnd(t, x)
}

SwitchSink.prototype.dispose = function () {
  return this._disposeCurrent(this.scheduler.now())
}

SwitchSink.prototype._disposeCurrent = function (t) {
  if (this.current !== null) {
    return this.current._dispose(t)
  }
}

SwitchSink.prototype._disposeInner = function (t, inner) {
  inner._dispose(t) // TODO: capture the result of this dispose
  if (inner === this.current) {
    this.current = null
  }
}

SwitchSink.prototype._checkEnd = function (t, x) {
  if (this.ended && this.current === null) {
    this.sink.end(t, x)
  }
}

SwitchSink.prototype._endInner = function (t, x, inner) {
  this._disposeInner(t, inner)
  this._checkEnd(t, x)
}

function Segment (min, max, outer, sink) {
  this.min = min
  this.max = max
  this.outer = outer
  this.sink = sink
  this.disposable = { dispose: Function.prototype }
}

Segment.prototype.event = function (t) {
  var this$1 = this

  return function (x) {
    if (t < this$1.max) {
      this$1.sink.event(Math.max(t, this$1.min))(x)
    }
  }
}

Segment.prototype.end = function (t, x) {
  this.outer._endInner(Math.max(t, this.min), x, this)
}

Segment.prototype._dispose = function (t) {
  this.max = t
  this.disposable.dispose()
}

exports.continueWith = function continueWith (f) {
  return function (stream) {
    return new ContinueWith(f, stream)
  }
}

function ContinueWith (f, source) {
  this.f = f
  this.source = source
}

ContinueWith.prototype.run = function (sink) {
  var that = this
  return function (scheduler) {
    return new ContinueWithSink(that.f, that.source, sink, scheduler)
  }
}

function ContinueWithSink (f, source, sink, scheduler) {
  this.f = f
  this.sink = sink
  this.scheduler = scheduler
  this.active = true
  this.disposable = source.run(this)(scheduler)
}

ContinueWithSink.prototype.event = function (t) {
  var that = this

  return function (x) {
    if (!that.active) {
      return
    }
    that.sink.event(t)(x)
  }
}

ContinueWithSink.prototype.end = function (t, x) {
  if (!this.active) {
    return
  }

  this.disposable.dispose()

  this._startNext(t, x, this.sink)
}

ContinueWithSink.prototype._startNext = function (t, x, sink) {
  try {
    this.disposable = this._continue(this.f, x, sink)
  } catch (e) {
    sink.error(t, e)
  }
}

ContinueWithSink.prototype._continue = function (f, x, sink) {
  return f(x).run(sink)(this.scheduler)
}

ContinueWithSink.prototype.dispose = function () {
  this.active = false
  return this.disposable.dispose()
}

exports.combine2 = function (f) { return function (s1) { return function (s2) { return combineArray(f, [s1, s2]) } } }
exports.combine3 = function (f) { return function (s1) { return function (s2) { return function (s3) { return combineArray(f, [s1, s2, s3]) } } } }
exports.combine4 = function (f) { return function (s1) { return function (s2) { return function (s3) { return function (s4) { return combineArray(f, [s1, s2, s3, s4]) } } } } }
exports.combine5 = function (f) { return function (s1) { return function (s2) { return function (s3) { return function (s4) { return function (s5) { return combineArray(f, [s1, s2, s3, s4, s5]) } } } } } }

exports.combineArray = function (streams) {
  return combineArray(Array, streams)
}

function combineArray (f, streams) {
  return new Combine(f, streams)
}

function Combine (f, sources) {
  this.f = f
  this.sources = sources
}

Combine.prototype.run = function (sink) {
  var this$1 = this

  return function (scheduler) {
    var l = this$1.sources.length
    var disposables = new Array(l)
    var sinks = new Array(l)

    var mergeSink = new CombineSink(disposables, sinks, sink, this$1.f)

    for (var indexSink, i = 0; i < l; ++i) {
      indexSink = sinks[i] = new IndexSink(i, mergeSink)
      disposables[i] = this$1.sources[i].run(indexSink)(scheduler)
    }

    return {
      dispose: function () {
        disposables.forEach(function (d) {
          d.dispose()
        })
      }
    }
  }
}

function CombineSink (disposables, sinks, sink, f) {
  var this$1 = this

  this.sink = sink
  this.disposables = disposables
  this.sinks = sinks
  this.f = f

  var l = sinks.length
  this.awaiting = l
  this.values = new Array(l)
  this.hasValue = new Array(l)

  for (var i = 0; i < l; ++i) {
    this$1.hasValue[i] = false
  }

  this.activeCount = sinks.length
}

CombineSink.prototype.event = function (t) {
  var this$1 = this

  return function (indexedValue) {
    var i = indexedValue.index
    var awaiting = this$1._updateReady(i)

    this$1.values[i] = indexedValue.value
    if (awaiting === 0) {
      var value = tail(this$1.values).reduce(function (f, x) { return f(x) }, this$1.f(this$1.values[0]))
      this$1.sink.event(t)(value)
    }
  }
}

CombineSink.prototype._updateReady = function (index) {
  if (this.awaiting > 0) {
    if (!this.hasValue[index]) {
      this.hasValue[index] = true
      this.awaiting -= 1
    }
  }
  return this.awaiting
}

CombineSink.prototype.end = function (t, indexedValue) {
  this.disposables[indexedValue.index].dispose()

  if (--this.activeCount === 0) {
    this.sink.end(t)
  }
}

var IndexSink = function IndexSink (i, sink) {
  this.sink = sink
  this.index = i
  this.active = true
  this.value = void 0
}

IndexSink.prototype.event = function event (t) {
  var this$1 = this

  return function (x) {
    if (!this$1.active) { return }

    this$1.value = x
    this$1.sink.event(t)(this$1)
  }
}

IndexSink.prototype.end = function end (t) {
  if (!this.active) { return }

  this.active = false
  this.sink.end(t, { index: this.index })
}

function drop (n, a) { // eslint-disable-line complexity
  if (n < 0) {
    throw new TypeError('n must be >= 0')
  }

  var l = a.length
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
  var b = new Array(l)
  for (var i = 0; i < l; ++i) {
    b[i] = a[n + i]
  }
  return b
}

// tail :: [a] -> [a]
// drop head element
function tail (a) {
  return drop(1, a)
}

exports.merge = function merge (streams) {
  return mergeSources(streams)
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
  return stream instanceof Merge
    ? sources.concat(stream.sources)
    : sources.concat(stream)
}

function Merge (sources) {
  this.sources = sources
}

Merge.prototype.run = function (sink) {
  var this$1 = this

  return function (scheduler) {
    var l = this.sources.length
    var disposables = new Array(l)
    var sinks = new Array(l)

    var mergeSink = new MergeSink(disposables, sinks, sink)

    for (var indexSink, i = 0; i < l; ++i) {
      indexSink = sinks[i] = new IndexSink(i, mergeSink)
      disposables[i] = this$1.sources[i].run(indexSink, scheduler)
    }

    return all(disposables)
  }
}

function all (disposables) {
  return {
    dispose: function () {
      disposables.forEach(function (d) {
        d.dispose()
      })
    }
  }
}

function MergeSink (disposables, sinks, sink) {
  this.sink = sink
  this.disposables = disposables
  this.activeCount = sinks.length
}

MergeSink.prototype.event = function (t) {
  var that = this
  return function (indexValue) {
    that.sink.event(t)(indexValue.value)
  }
}

MergeSink.prototype.end = function (t, indexedValue) {
  this.disposables[indexedValue.index].dispose()
  if (--this.activeCount === 0) {
    this.sink.end(t, indexedValue.value)
  }
}

function reduce (f, z, a) {
  var r = z
  for (var i = 0, l = a.length; i < l; ++i) {
    r = f(r, a[i], i)
  }
  return r
}

exports.until = function takeUntil (signal) {
  return function (stream) {
    return new Until(signal, stream)
  }
}

exports.since = function skipUntil (signal) {
  return function (stream) {
    return new Since(signal, stream)
  }
}

function Until (maxSignal, source) {
  this.maxSignal = maxSignal
  this.source = source
}

Until.prototype.run = function (sink) {
  var that = this
  return function (scheduler) {
    var min = new Bound(-Infinity, sink)
    var max = new UpperBound(that.maxSignal, sink, scheduler)
    var disposable = that.source.run(new TimeWindowSink(min, max, sink), scheduler)

    return all([min, max, disposable])
  }
}

function Since (minSignal, source) {
  this.minSignal = minSignal
  this.source = source
}

Since.prototype.run = function (sink) {
  var that = this
  return function (scheduler) {
    var min = new LowerBound(that.minSignal, sink, scheduler)
    var max = new Bound(Infinity, sink)
    var disposable = that.source.run(new TimeWindowSink(min, max, sink))(scheduler)

    return all([min, max, disposable])
  }
}

function Bound (value, sink) {
  this.value = value
  this.sink = sink
}

Bound.prototype.event = noop
Bound.prototype.end = noop
Bound.prototype.dispose = noop

function TimeWindowSink (min, max, sink) {
  this.min = min
  this.max = max
  this.sink = sink
}

TimeWindowSink.prototype.event = function (t, x) {
  var that = this
  return function (x) {
    if (t >= that.min.value && t < that.max.value) {
      that.sink.event(t)(x)
    }
  }
}

TimeWindowSink.prototype.end = function (time) {
  this.sink.end(time)
}

function LowerBound (signal, sink, scheduler) {
  this.value = Infinity
  this.sink = sink
  this.disposable = signal.run(this)(scheduler)
}

LowerBound.prototype.event = function (t /*, x */) {
  return function () {
    if (t < this.value) {
      this.value = t
    }
  }
}

LowerBound.prototype.end = noop

LowerBound.prototype.dispose = function () {
  return this.disposable.dispose()
}

function UpperBound (signal, sink, scheduler) {
  this.value = Infinity
  this.sink = sink
  this.disposable = signal.run(this)(scheduler)
}

UpperBound.prototype.event = function (t) {
  var that = this

  return function (x) {
    if (t < this.value) {
      that.value = t
      that.sink.end(t)
    }
  }
}

UpperBound.prototype.end = noop

UpperBound.prototype.dispose = function () {
  return this.disposable.dispose()
}

function noop () { }

exports.throttle = function throttle (period) {
  return function (stream) {
    return throttleSource(period, stream)
  }
}

function throttleSource (period, source) {
  return source instanceof Throttle
    ? fuseThrottle(period, source)
    : new Throttle(period, source)
}

function fuseThrottle (period, source) {
  return new Throttle(Math.max(period, source.period), source.source)
}

function Throttle (period, source) {
  this.period = period
  this.source = source
}

Throttle.prototype.run = function (sink) {
  var that = this
  return function (scheduler) {
    return that.source.run(new ThrottleSink(that.period, sink), scheduler)
  }
}

function ThrottleSink (period, sink) {
  this.time = 0
  this.period = period
  this.sink = sink
}

ThrottleSink.prototype.event = function (t) {
  var that = this
  return function (x) {
    if (t >= this.time) {
      that.time = t + this.period
      that.sink.event(t)(x)
    }
  }
}

ThrottleSink.prototype.end = function (t) { this.sink.end(t) }

exports.debounce = function debounce (period) {
  return function (stream) {
    return new Debounce(period, stream)
  }
}

function Debounce (dt, source) {
  this.dt = dt
  this.source = source
}

Debounce.prototype.run = function (sink) {
  var that = this
  return function (scheduler) {
    return new DebounceSink(that.dt, that.source, sink, scheduler)
  }
}

function DebounceSink (dt, source, sink, scheduler) {
  this.dt = dt
  this.sink = sink
  this.scheduler = scheduler
  this.value = void 0
  this.timer = null

  var sourceDisposable = source.run(this)(scheduler)
  this.disposable = all([this, sourceDisposable])
}

DebounceSink.prototype.event = function (t) {
  var that = this
  return function (x) {
    that._clearTimer()
    that.value = x
    var task = ControlStreamScheduler.eventTask(that.sink)(x)
    that.timer = this.scheduler.delay(this.dt, task)
  }
}

DebounceSink.prototype.end = function (t, x) {
  if (this._clearTimer()) {
    this.sink.event(t, this.value)
    this.value = void 0
  }
  this.sink.end(t, x)
}

DebounceSink.prototype.dispose = function () {
  this._clearTimer()
}

DebounceSink.prototype._clearTimer = function () {
  if (this.timer === null) {
    return false
  }
  this.timer.dispose()
  this.timer = null
  return true
}

exports.delay = function delay (delayTime) {
  return function (stream) {
    return delayTime <= 0 ? stream : new Delay(delayTime, stream)
  }
}

function Delay (dt, source) {
  this.dt = dt
  this.source = source
}

Delay.prototype.run = function (sink) {
  var that = this

  return function (scheduler) {
    var delaySink = new DelaySink(that.dt, sink, scheduler)
    return all([delaySink, that.source.run(delaySink)(scheduler)])
  }
}

function DelaySink (dt, sink, scheduler) {
  this.dt = dt
  this.sink = sink
  this.scheduler = scheduler
}

DelaySink.prototype.dispose = function () {
  var self = this
  this.scheduler.cancelAll(function (task) {
    return task.sink === self.sink
  })
}

DelaySink.prototype.event = function (t) {
  var that = this
  return function (x) {
    that.scheduler.delay(that.dt)(ControlStreamScheduler.eventTask(that.sink)(x))
  }
}

DelaySink.prototype.end = function (t, x) {
  this.scheduler.delay(this.dt)(ControlStreamScheduler.endTask(this.sink))
}

var MulticastDisposable = function MulticastDisposable (source, sink) {
  this.source = source
  this.sink = sink
  this.disposed = false
}

MulticastDisposable.prototype.dispose = function dispose () {
  if (this.disposed) {
    return
  }
  this.disposed = true
  var remaining = this.source.remove(this.sink)
  return remaining === 0 && this.source._dispose()
}

var dispose = function (disposable) { return disposable.dispose() }

var emptyDisposable = {
  dispose: function dispose$1 () { }
}

function MulticastSource (source) {
  this.source = source
  this.sinks = []
  this._disposable = emptyDisposable
}

MulticastSource.prototype.run = function run (sink) {
  var that = this
  return function (scheduler) {
    var n = that.add(sink)
    if (n === 1) {
      that._disposable = that.source.run(that)(scheduler)
    }
    return new MulticastDisposable(that, sink)
  }
}

MulticastSource.prototype._dispose = function _dispose () {
  var disposable = this._disposable
  this._disposable = emptyDisposable
  return Promise.resolve(disposable).then(dispose)
}

MulticastSource.prototype.add = function add (sink) {
  this.sinks = append(sink, this.sinks)
  return this.sinks.length
}

function append (x, a) {
  var l = a.length
  var b = new Array(l + 1)
  for (var i = 0; i < l; ++i) {
    b[i] = a[i]
  }

  b[l] = x
  return b
}

MulticastSource.prototype.remove = function remove$1 (sink) {
  var i = findIndex(sink, this.sinks)
  // istanbul ignore next
  if (i >= 0) {
    this.sinks = remove(i, this.sinks)
  }

  return this.sinks.length
}

function findIndex (x, a) {
  for (var i = 0, l = a.length; i < l; ++i) {
    if (x === a[i]) {
      return i
    }
  }
  return -1
}

function remove (i, a) {  // eslint-disable-line complexity
  if (i < 0) {
    throw new TypeError('i must be >= 0')
  }

  var l = a.length
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
  var b = new Array(l)
  var j
  for (j = 0; j < i; ++j) {
    b[j] = a[j]
  }
  for (j = i; j < l; ++j) {
    b[j] = a[j + 1]
  }

  return b
}

MulticastSource.prototype.event = function event (time) {
  var that = this
  return function (value) {
    var s = that.sinks
    if (s.length === 1) {
      return s[0].event(time)(value)
    }
    for (var i = 0; i < s.length; ++i) {
      s[i].event(time)(value)
    }
  }
}

MulticastSource.prototype.end = function end (time) {
  var s = this.sinks
  for (var i = 0; i < s.length; ++i) {
    s[i].end(time)
  }
}

MulticastSource.prototype.until = function (signal) {
  return exports.until(signal)(this)
}

exports.multicast = function multicast (stream) {
  return new MulticastSource(stream)
}

function __extends (d, b) { // eslint-disable-line complexity
  for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]
  function __ () { this.constructor = d }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __())
}

var HoldSubjectSource = (function (_super) {
  __extends(HoldSubjectSource, _super)
  function HoldSubjectSource (source, bufferSize) {
    var _this = _super.call(this, source) || this
    _this.has = false
    _this.buffer = []
    _this.bufferSize = bufferSize
    return _this
  }
  HoldSubjectSource.prototype.add = function (sink) {
    if (this.has) {
      pushEvents(this.buffer, sink)
    }
    return _super.prototype.add.call(this, sink)
  }
  HoldSubjectSource.prototype.event = function (time) {
    var that = this
    return function (value) {
      that.has = true
      that.buffer = dropAndAppend(value, that.buffer, that.bufferSize)
      return _super.prototype.event.call(that, time)(value)
    }
  }
  return HoldSubjectSource
}(MulticastSource))

function pushEvents (buffer, sink) {
  var length = buffer.length
  for (var i = 0; i < length; ++i) {
    sink.event(ControlStreamScheduler.scheduler.now(), buffer[i])
  }
}

function dropAndAppend (value, buffer, bufferSize) {
  if (buffer.length === bufferSize) {
    return append(value, drop(1, buffer))
  }
  return append(value, buffer)
}

exports.hold = function hold (bufferSize) {
  return function (stream) {
    return new HoldSubjectSource(stream, bufferSize)
  }
}

exports.toSubject = function (stream) {
  return exports.multicast(stream)
}

exports.toHoldSubject = exports.hold

exports.fromSubject = function (subject) {
  return subject
}

exports.subjectEvent = function (value) {
  return function (subject) {
    ControlStreamScheduler.eventTask(subject)(value)
    return subject
  }
}

exports.subjectEnd = function (value) {
  return function (subject) {
    subject.end(Date.now())
    return subject
  }
}

exports.proxy = function (value) {
  var stream = new ProxyStream(value)

  function attach (original) {
    stream.attach(original)
    return original
  }

  return { attach: attach, stream: stream }
}

var ProxyStream = (function (_super) {
  __extends(ProxyStream, _super)
  function ProxyStream (value) {
    var _this = _super.call(this, ControlStreamStream.never, 1) || this
    _this.attached = false
    _this.running = false
    _this.buffer.push(value)
    return _this
  }
  ProxyStream.prototype.run = function (sink) {
    var that = this

    that.add(sink)

    return function (scheduler) {
      if (that.attached && !that.running) {
        that.running = true
        that._disposable = that.source.run(that)(scheduler)
        return that._disposable
      }

      return new MulticastDisposable(that, sink)
    }
  }

  ProxyStream.prototype.attach = function (source) {
    if (this.attached) throw new Error('Can only proxy 1 stream')
    this.attached = true

    this.source = source

    if (this.sinks.length) { this._disposable = source.run(this)(ControlStreamScheduler.scheduler) }
  }

  ProxyStream.prototype.end = function end (time) {
    this.attached = false
    this.running = false

    return _super.prototype.end.call(this, time)
  }

  return ProxyStream
}(HoldSubjectSource))
