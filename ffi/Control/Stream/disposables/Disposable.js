export class Disposable {
  /**
   * Create a new Disposable which will dispose its underlying resource.
   * @param {function} dispose function
   * @param {*?} data any data to be passed to disposer function
   */
  constructor (dispose, data) {
    this._dispose = dispose
    this._data = data
  }

  dispose () {
    return this._dispose(this._data)
  }
}
