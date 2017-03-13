/** @license MIT License (c) copyright 2010-2016 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

import { map, tail } from '@most/prelude'

import { IndexSink } from '../sink/IndexSink'
import { Stream } from '../Stream'
import { disposeAll } from '../disposables'

export const combine2 = f => s1 => s2 => combineArray(f, [s1, s2])
export const combine3 = f => s1 => s2 => s3 => combineArray(f, [s1, s2, s3])
export const combine4 = f => s1 => s2 => s3 => s4 => combineArray(f, [s1, s2, s3, s4])
export const combine5 = f => s1 => s2 => s3 => s4 => s5 => combineArray(f, [s1, s2, s3, s4, s5])

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
  this.f = f
  this.sources = sources
}

Combine.prototype.run = function (sink) {
  return scheduler => {
    var l = this.sources.length
    var disposables = new Array(l)
    var sinks = new Array(l)

    var mergeSink = new CombineSink(disposables, sinks, sink, this.f)

    for (var indexSink, i = 0; i < l; ++i) {
      indexSink = sinks[i] = new IndexSink(i, mergeSink)
      disposables[i] = this.sources[i].run(indexSink)(scheduler)
    }

    return disposeAll(disposables)
  }
}

function CombineSink (disposables, sinks, sink, f) {
  this.sink = sink
  this.disposables = disposables
  this.sinks = sinks
  this.f = f

  var l = sinks.length
  this.awaiting = l
  this.values = new Array(l)
  this.hasValue = new Array(l)

  for (var i = 0; i < l; ++i) {
    this.hasValue[i] = false
  }

  this.activeCount = sinks.length
}

CombineSink.prototype.event = function (t) {
  return indexedValue => {
    var i = indexedValue.index
    var awaiting = this._updateReady(i)

    this.values[i] = indexedValue.value
    if (awaiting === 0) {
      const value = tail(this.values).reduce((f, x) => f(x), this.f(this.values[0]))
      this.sink.event(t)(value)
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
