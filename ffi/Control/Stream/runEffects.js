import { SettableDisposable } from './disposables/SettableDisposable'

export function runEffects (stream, scheduler) {
  return runSourceEffects(stream.source, scheduler)
}

const runSourceEffects = (source, scheduler) => runSource(source, scheduler)

function runSource (source, scheduler) {
  const disposable = new SettableDisposable()
  const observer = new RunEffectsSink(disposable)

  disposable.setDisposable(source.run(observer)(scheduler))

  return {}
}

var RunEffectsSink = function RunEffectsSink (disposable) {
  this._disposable = disposable
  this.active = true
}

RunEffectsSink.prototype.event = function event (t) {
  return function (x) {}
}

RunEffectsSink.prototype.end = function end (t) {
  this.active = false
  Promise.resolve(this._disposable).then(d => d.dispose())
}
