export class SettableDisposable {
  constructor () {
    this.disposable = void 0
    this.disposed = false
    this.result = void 0
  }

  setDisposable (disposable) {
    this.disposable = disposable

    if (this.disposed) {
      this.result = disposable.dispose()
    }
  }

  dispose () {
    if (this.disposed) {
      return this.result
    }

    this.disposed = true

    if (this.disposable !== void 0) {
      this.result = this.disposable.dispose()
    }

    return this.result
  }
}
