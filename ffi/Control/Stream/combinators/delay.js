import { endTask, eventTask } from '../scheduler'

import { Stream } from '../Stream'
import { disposeAll } from '../disposables'

export const delay = delayTime => stream =>
  delayTime <= 0 ? stream : new Stream(new Delay(delayTime, stream.source))

class Delay {
  constructor (dt, source) {
    this.dt = dt
    this.source = source
  }

  run (sink) {
    return scheduler => {
      const delaySink = new DelaySink(this.dt, sink, scheduler)
      return disposeAll([delaySink, this.source.run(delaySink)(scheduler)])
    }
  }
}

class DelaySink {
  constructor (dt, sink, scheduler) {
    this.dt = dt
    this.sink = sink
    this.scheduler = scheduler
  }

  dispose () {
    this.scheduler.cancelAll(task => task.sink === this.sink)
  }

  event (t) {
    return x => this.scheduler.delay(this.dt)(eventTask(x)(this.sink))
  }

  end (t) {
    this.scheduler.delay(this.dt)(endTask(this.sink))
  }
}
