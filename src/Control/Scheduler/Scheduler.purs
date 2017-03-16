module Control.Stream.Scheduler where

import Control.Monad.Eff (Pure)
import Control.Stream.Disposable (Disposable)
import Control.Stream.Sink (Sink)
import Control.Stream.Time (Time)
import Data.Unit (Unit)

newtype Scheduler = Scheduler
  { now :: Pure Time
  , asap :: Task -> ScheduledTask
  , delay :: Number -> Task -> ScheduledTask
  , periodic :: Number -> Task -> ScheduledTask
  , schedule :: Number -> Number -> Task -> ScheduledTask
  , cancel :: ScheduledTask -> Unit
  , cancelAll :: (ScheduledTask -> Boolean) -> Unit
  }

type Task =
  { run :: Time -> Unit
  , dispose :: Pure Unit
  }

type ScheduledTask =
  { run :: Pure Unit
  , dispose :: Pure Unit
  }

foreign import scheduler :: Scheduler
foreign import scheduleTasks :: (Task -> ScheduledTask) -> Array Task -> Disposable
foreign import eventTask :: forall a. Sink a -> a -> Task
foreign import endTask :: forall a. Sink a -> Task
