/** @license MIT License (c) copyright 2010-2016 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

import { curry2, curry3, id as identity } from '@most/prelude'

import { LinkedList } from '../LinkedList'
import { MemoizedDisposable } from '../disposables/MemoizedDisposable'
import { Stream } from '../Stream'

export const flatMap =
  curry2((stream, f) => mergeMapConcurrently(f, Infinity, stream))

export const mergeConcurrently = curry2((concurrency, stream) =>
  mergeMapConcurrently(identity, concurrency, stream))

export const join =
  mergeConcurrently(Infinity)

export const mergeMapConcurrently = curry3((f, concurrency, stream) =>
  new Stream(new MergeConcurrently(f, concurrency, stream.source)))

class MergeConcurrently {
  constructor (f, concurrency, source) {
    this.f = f
    this.concurrency = concurrency
    this.source = source
  }

  run (sink) {
    return scheduler => new Outer(this.f, this.concurrency, this.source, sink, scheduler)
  }
}

class Outer {
  constructor (f, concurrency, source, sink, scheduler) {
    this.f = f
    this.concurrency = concurrency
    this.sink = sink
    this.scheduler = scheduler
    this.pending = []
    this.current = new LinkedList()
    this.disposable = new MemoizedDisposable(source.run(this)(scheduler))
    this.active = true
  }

  event (t) {
    return x => this._addInner(t, x)
  }

  _addInner (t, x) {
    if (this.current.length < this.concurrency) {
      this._startInner(t, x)
    } else {
      this.pending.push(x)
    }
  }

  _startInner (t, x) {
    try {
      this._initInner(t, x)
    } catch (e) {
      this.error(t, e)
    }
  }

  _initInner (t, x) {
    const innerSink = new Inner(t, this, this.sink)
    innerSink.disposable = mapAndRun(this.f, x, innerSink, this.scheduler)
    this.current.add(innerSink)
  }

  end (t) {
    this.active = false
    this.disposable.dispose()
    this._checkEnd(t)
  }

  dispose () {
    this.active = false
    this.pending.length = 0
    this.disposable.dispose()
    this.current.dispose()
  }

  _endInner (t, inner) {
    this.current.remove(inner)
    inner.dispose()

    if (this.pending.length === 0) {
      this._checkEnd(t)
    } else {
      this._startInner(t, this.pending.shift())
    }
  }

  _checkEnd (t) {
    if (!this.active && this.current.isEmpty()) {
      this.sink.end(t)
    }
  }
}

const mapAndRun = (f, x, sink, scheduler) => f(x).source.run(sink)(scheduler)

class Inner {
  constructor (time, outer, sink) {
    this.prev = this.next = null
    this.time = time
    this.outer = outer
    this.sink = sink
    this.disposable = void 0
  }

  event (t) {
    return x => this.sink.event(Math.max(t, this.time))(x)
  }

  end (t) {
    this.outer._endInner(Math.max(t, this.time), this)
  }

  dispose () {
    return this.disposable.dispose()
  }
}
