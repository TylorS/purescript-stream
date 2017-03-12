module Control.Stream
  ( STREAM
  , EffStream
  , PureStream
  , Stream
  , Source
  , Sink
  , Scheduler
  , Task
  , ScheduledTask
  , Disposable
  , Time
  , createStream
  , getSource
  , runSource
  , defaultScheduler
  , eventTask
  , endTask
  , createDisposable
  , emptyDisposable
  , disposeAll
  , scheduleTasks
  , drain
  , tapEvent
  , tapEnd
  , just
  , fromArray
  )
  where

import Control.Monad.Eff (Eff, Pure)
import Data.Array (snoc)
import Data.Functor (class Functor, map)
import Data.Unit (Unit)
import Prelude (flip)

newtype Time = Time Int

foreign import data STREAM :: !

type EffStream e a = Eff (stream :: STREAM | e) a
type PureStream a = EffStream () a

newtype Stream a = Stream { source :: Source a }

type Source a = { run :: Sink a -> Scheduler -> Disposable }

type Sink a =
  { event :: Time -> a -> Unit
  , end :: Time -> Unit
  }

type Scheduler =
  { now :: Pure Time
  , asap :: Task -> ScheduledTask
  , delay :: Number -> Task -> ScheduledTask
  , period :: Number -> Task -> ScheduledTask
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

type Disposable = { dispose :: Pure Unit }

instance functorStream :: Functor Stream where
  map = _map

createStream :: forall a. (Sink a -> Scheduler -> Disposable) -> Stream a
createStream run = Stream { source: { run } }

getSource :: forall a. Stream a -> Source a
getSource stream = case stream of Stream a -> a.source

runSource :: forall a. Stream a -> Sink a -> Scheduler -> Disposable
runSource stream sink scheduler = (getSource stream).run sink scheduler

just :: forall a. a -> Stream a
just a = createStream (runJust a)

runJust :: forall a. a ->  Sink a -> Scheduler -> Disposable
runJust a sink scheduler =
  scheduleTasks [ eventTask a sink, endTask sink ] scheduler

-- TODO: remove fromArray because it's not a real event stream
-- replace with a fromArray combinator
fromArray :: forall a. Array a -> Stream a
fromArray arr = createStream (runFromArray arr)

runFromArray :: forall a. Array a -> Sink a -> Scheduler -> Disposable
runFromArray arr sink scheduler = scheduleTasks tasks scheduler
  where
    tasks :: Array Task
    tasks = snoc eventTasks (endTask sink)

    eventTasks :: Array Task
    eventTasks = map (flip eventTask sink) arr

_map :: forall a b. (a -> b) -> Stream a -> Stream b
_map f stream = createStream runMap
  where
    runMap :: Sink b -> Scheduler -> Disposable
    runMap sink scheduler =
      runSource stream (mapSink f sink) scheduler

mapSink :: forall a b. (a -> b) -> Sink b -> Sink a
mapSink f sink = { event: mapEvent, end: sink.end }
  where
    mapEvent :: Time -> a -> Unit
    mapEvent time value = sink.event time (f value)

foreign import defaultScheduler :: Scheduler
foreign import eventTask :: forall a. a -> Sink a -> Task
foreign import endTask :: forall a. Sink a -> Task
foreign import createDisposable :: forall a. (a -> Unit) -> a -> Disposable
foreign import emptyDisposable :: Disposable
foreign import disposeAll :: Array Disposable -> Disposable
foreign import scheduleTasks :: Array Task -> Scheduler -> Disposable
foreign import drain :: forall e a. Stream a -> EffStream e Unit
foreign import tapEvent :: forall e a. (a -> EffStream e Unit) -> Stream a -> Stream a
foreign import tapEnd :: forall e a. EffStream e Unit -> Stream a -> Stream a
