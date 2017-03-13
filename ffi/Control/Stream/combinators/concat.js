import { MemoizedDisposable } from '../disposables/MemoizedDisposable'
import { Stream } from '../Stream'

export const concat = s1 => s2 => continueWith(() => s2)(s1)

export const continueWith = f => stream => new Stream(new ContinueWith(f, stream.source))

function ContinueWith (f, source) {
  this.f = f
  this.source = source
}

ContinueWith.prototype.run = function (sink) {
  return scheduler => {
    return new ContinueWithSink(this.f, this.source, sink, scheduler)
  }
}

function ContinueWithSink (f, source, sink, scheduler) {
  this.f = f
  this.sink = sink
  this.scheduler = scheduler
  this.active = true
  this.disposable = new MemoizedDisposable(source.run(this)(scheduler))
}

ContinueWithSink.prototype.event = function (t) {
  return x => {
    if (!this.active) {
      return
    }
    this.sink.event(t)(x)
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
  this._continue(this.f, x, sink)
}

ContinueWithSink.prototype._continue = function (f, x, sink) {
  return f(x).source.run(sink)(this.scheduler)
}

ContinueWithSink.prototype.dispose = function () {
  this.active = false
  return this.disposable.dispose()
}
