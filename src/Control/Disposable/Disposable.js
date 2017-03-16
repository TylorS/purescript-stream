exports.emptyDisposable = { dispose: function () { return {} } }

exports.disposeAll = function (disposables) {
  var disposed = false

  function dispose () {
    if (disposed) return

    disposables.forEach(function (disposable) {
      disposable.dispose()
    })

    disposed = true
  }

  return { dispose: dispose }
}

exports.lazyDisposable = function (f) {
  var disposed = false

  function dispose () {
    if (disposed) return
    var disposable = f()

    disposable.dispose()

    disposed = true
  }

  return { dispose: dispose }
}
