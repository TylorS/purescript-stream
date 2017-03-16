import { curry2, curry3 } from '@most/prelude'

const propagateTask =
  curry3((run, value, sink) => new PropagateTask(run, value, sink))

export const eventTask =
  curry2((value, sink) => propagateTask(runEvent, value, sink))

export const endTask = sink => propagateTask(runEnd, void 0, sink)

class PropagateTask {
  constructor (run, value, sink) {
    let active = true
    this.sink = sink

    this.dispose = () => { active = false }
    this.run = t => {
      if (!active) return

      run(t, value, sink)
    }
  }
}

function runEvent (time, value, sink) {
  sink.event(time)(value)
}

function runEnd (time, value, sink) {
  sink.end(time, value)
}
