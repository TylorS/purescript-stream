import { HoldSource } from './HoldSource'
import { MulticastSource } from './MulticastSource'
import { Stream } from '../Stream'

export function multicast (stream) {
  const source = stream.source

  return source instanceof MulticastSource
    ? stream
    : new Stream(new MulticastSource(source))
}

export const hold = bufferSize => stream =>
  new Stream(new HoldSource(stream.source, bufferSize))
