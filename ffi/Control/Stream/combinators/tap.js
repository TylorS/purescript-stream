import { Stream } from '../Stream'
import { curry2 } from '@most/prelude'

export const tapEnd = curry2((f, stream) => new Stream(new TapEnd(f, stream.source)))

export const tapEvent = curry2((f, stream) => new Stream(new TapEvent(f, stream.source)))

class TapEvent {
  constructor (f, source) {
    this.source = source
    this.f = f

    this.run = sink => scheduler =>
      source.run(new TapSink(f, sink))(scheduler)
  }
}

class TapSink {
  constructor (f, sink) {
    this.event = t => x => {
      f(x)()
      sink.event(t)(x)
    }

    this.end = t => {
      sink.end(t)
    }
  }
}

class TapEnd {
  constructor (f, source) {
    this.source = source
    this.f = f

    this.run = sink => scheduler =>
      source.run(new TapEndSink(f, sink))(scheduler)
  }
}

class TapEndSink {
  constructor (f, sink) {
    this.event = t => x => sink.event(t)(x)

    this.end = t => {
      f()
      sink.end(t)
    }
  }
}
