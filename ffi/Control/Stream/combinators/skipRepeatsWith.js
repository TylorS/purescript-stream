import { Stream } from '../Stream'

export const skipRepeatsWith = equals => stream =>
  new Stream(new SkipRepeats(equals, stream))

class SkipRepeats {
  constructor (equals, source) {
    this.equals = equals
    this.source = source
  }

  run (sink) {
    return scheduler => this.source.run(new SkipRepeatsSink(this.equals, sink), scheduler)
  }
}

class SkipRepeatsSink {
  constructor (equals, sink) {
    this.equals = equals
    this.value = void 0
    this.init = true
  }

  event (t) {
    return x => {
      if (this.init) {
        this.init = false
        this.value = x
        this.sink.event(t, x)
      } else if (!this.equals(this.value)(x)) {
        this.value = x
        this.sink.event(t)(x)
      }
    }
  }

  end (t) {
    this.sink.end(t)
  }
}
