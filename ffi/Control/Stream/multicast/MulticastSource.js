import { append, findIndex, remove } from '@most/prelude'
import { dispose, emptyDisposable } from './dispose'

import { MulticastDisposable } from './MulticastDisposable'

export class MulticastSource {
  constructor (source) {
    this.source = source
    this.sinks = []
    this._disposable = emptyDisposable
  }

  run (sink) {
    return scheduler => {
      const n = this.add(sink, scheduler)
      if (n === 1) {
        this._disposable = this.source.run(this)(scheduler)
      }
      return new MulticastDisposable(this, sink)
    }
  }

  _dispose () {
    const disposable = this._disposable
    this._disposable = emptyDisposable
    return Promise.resolve(disposable).then(dispose)
  }

  add (sink) {
    this.sinks = append(sink, this.sinks)
    return this.sinks.length
  }

  remove (sink) {
    const i = findIndex(sink, this.sinks)
    // istanbul ignore next
    if (i >= 0) {
      this.sinks = remove(i, this.sinks)
    }

    return this.sinks.length
  }

  event (time) {
    return value => {
      const s = this.sinks
      if (s.length === 1) {
        return s[0].event(time)(value)
      }
      for (let i = 0; i < s.length; ++i) {
        s[i].event(time)(value)
      }
    }
  }

  end (time) {
    const s = this.sinks
    for (let i = 0; i < s.length; ++i) {
      s[i].end(time)
    }
  }
}
