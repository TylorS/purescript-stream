module Control.Stream.Sink (Sink(..)) where

import Control.Stream.Time (Time)
import Data.Unit (Unit)

newtype Sink a = Sink
  { event :: Time -> a -> Unit
  , end :: Time -> Unit
  }
