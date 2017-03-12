import { curry2, id, map } from '@most/prelude'

import { Disposable } from './Disposable'
import { MemoizedDisposable } from './MemoizedDisposable'
import { disposeSafely } from './disposeSafely'

export const createDisposable = curry2((dispose, data) => new MemoizedDisposable(new Disposable(dispose, data)))

export const emptyDisposable = new Disposable(id, undefined)

export const disposeAll = disposables =>
  createDisposable(map(disposeSafely, disposables), disposables)
