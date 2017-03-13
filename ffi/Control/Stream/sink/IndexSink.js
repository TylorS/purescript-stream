export class IndexSink {
  constructor (i, sink) {
    this.sink = sink
    this.index = i
    this.active = true
    this.value = void 0
  }

  event (t) {
    return x => {
      if (!this.active) return

      this.value = x
      this.sink.event(t)(this)
    }
  }

  end (t) {
    if (!this.active) return

    this.active = false
    this.sink.end(t, { index: this.index })
  }
}
