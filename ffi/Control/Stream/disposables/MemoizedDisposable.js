export class MemoizedDisposable {
  constructor (disposable) {
    this.disposed = false
    this.value = undefined
    this.disposable = disposable
  }

  dispose () {
    if (!this.disposed) {
      this.disposed = true
      this.value = disposeSafely(this.disposable)
      this.disposable = undefined
    }

    return this.value
  }
}
