export class LinkedList {
  constructor () {
    this.head = null
    this.length = 0
  }

  add (x) {
    if (this.head !== null) {
      this.head.prev = x
      x.next = this.head
    }
    this.head = x
    ++this.length
  }

  remove (x) { // eslint-disable-line  complexity
    --this.length
    if (x === this.head) {
      this.head = this.head.next
    }
    if (x.next !== null) {
      x.next.prev = x.prev
      x.next = null
    }
    if (x.prev !== null) {
      x.prev.next = x.next
      x.prev = null
    }
  }

  isEmpty () {
    return this.length === 0
  }

  dispose () {
    if (this.isEmpty()) return

    var x = this.head
    this.head = null
    this.length = 0

    while (x !== null) {
      x.dispose()
      x = x.next
    }
  }
}
