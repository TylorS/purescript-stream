module Control.Stream.Disposable where

import Control.Monad.Eff (Pure)
import Data.Unit (Unit)

type Disposable = { dispose :: Pure Unit }

foreign import emptyDisposable :: Disposable
foreign import disposeAll :: Array Disposable -> Disposable
foreign import lazyDisposable :: (Unit -> Disposable) -> Disposable
