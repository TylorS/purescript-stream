import { append, drop } from '@most/prelude'

import { MulticastSource } from './MulticastSource'

export class HoldSource extends MulticastSource {
  constructor (source, bufferSize) {
    super(source)
    this.bufferSize = bufferSize
    this.has = false
    this.buffer = []
  }

  add (sink, scheduler) {
    if (this.has) {
      pushEvents(this.buffer, sink, scheduler)
    }

    return super.add(sink, scheduler)
  }

  event (time) {
    return value => {
      this.has = true
      this.buffer = dropAndAppend(value, this.buffer, this.bufferSize)

      return super.event(time)(value)
    }
  }
}

function pushEvents (buffer, sink, scheduler) {
  const length = buffer.length

  for (let i = 0; i < length; ++i) {
    sink.event(scheduler.now(), buffer[i])
  }
}

export function dropAndAppend (value, buffer, bufferSize) {
  if (buffer.length === bufferSize) {
    return append(value, drop(1, buffer))
  }

  return append(value, buffer)
}
