module Control.Stream
  ( STREAM
  , EffStream
  , Stream
  , Source
  , Sink
  , Scheduler
  , Task
  , ScheduledTask
  , Disposable
  , Time
  , EventFn
  , EndFn
  -- Scheduler-related functions and values
  , defaultScheduler
  , eventTask
  , endTask
  , createDisposable
  , emptyDisposable
  , disposeAll
  , scheduleTasks
  -- Stream-related helpers
  , createStream
  , createSink
  , createCombinator
  , createEventCombinator
  , createEndCombinator
  , getSource
  , runSource
  -- Combinators
  , drain
  , tapEvent
  , tapEnd
  , filter
  , mergeConcurrently
  , mergeMapConcurrently
  , join
  , combine2
  , combine3
  , combine4
  , combine5
  , continueWith
  , concat
  , merge
  , switch
  , constant
  , scan
  , startWith
  -- Stream factories
  , just
  , fromArray
  , empty
  , periodic
  )
  where

import Control.Applicative (class Applicative)
import Control.Apply (class Apply)
import Control.Bind (class Bind)
import Control.Category (id)
import Control.Monad (class Monad)
import Control.Monad.Eff (Eff, Pure)
import Control.Monad.Eff.Ref (Ref, modifyRef', newRef, readRef)
import Control.Monad.Eff.Unsafe (unsafeCoerceEff, unsafePerformEff)
import Control.MonadPlus (class Alt, class Plus)
import Data.Array (snoc)
import Data.Function (flip, ($))
import Data.Functor (class Functor, map)
import Data.Monoid (class Monoid)
import Data.Semigroup (class Semigroup)
import Data.Unit (Unit, unit)

newtype Time = Time Int

foreign import data STREAM :: !

type EffStream e a = Eff (stream :: STREAM | e) a

newtype Stream a = Stream { source :: Source a }

type Source a = { run :: Sink a -> Scheduler -> Disposable }

type Sink a =
  { event :: Time -> a -> Unit
  , end :: Time -> Unit
  }

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

type Disposable = { dispose :: Pure Unit }

type EventFn a b = (Sink b -> Scheduler -> Time -> a -> Unit)
type EndFn a = (Sink a -> Scheduler -> Time -> Unit)

instance functorStream :: Functor Stream where
  map = _map

instance applyStream :: Apply Stream where
  apply = combine2 id

instance applicativeStream :: Applicative Stream where
  pure = just

instance bindStream :: Bind Stream where
  bind = flatMap

instance monadStream :: Monad Stream

instance semigroupStream :: Semigroup (Stream a) where
  append = concat

instance altStream :: Alt Stream where
  alt = \s1 s2 -> merge [s1, s2]

instance monoidStream :: Monoid (Stream a) where
  mempty = empty

instance plusStream :: Plus Stream where
  empty = empty

-- Stream-related helpers
createStream :: forall a. (Sink a -> Scheduler -> Disposable) -> Stream a
createStream run = Stream { source: { run } }

getSource :: forall a. Stream a -> Source a
getSource stream = case stream of Stream a -> a.source

runSource :: forall a. Stream a -> Sink a -> Scheduler -> Disposable
runSource stream sink scheduler = (getSource stream).run sink scheduler

createSink :: forall a. (Time -> a -> Unit) -> (Time -> Unit) -> Sink a
createSink event end = { event, end }

createCombinator :: forall a b. EventFn a b -> EndFn b -> Stream a -> Stream b
createCombinator event end stream = createStream runCombinator
  where
    runCombinator :: Sink b -> Scheduler -> Disposable
    runCombinator sink scheduler =
      runSource stream (createSink (event sink scheduler) (end sink scheduler)) scheduler

createEventCombinator :: forall a b. EventFn a b -> Stream a -> Stream b
createEventCombinator event stream = createCombinator event end stream
  where
    end :: EndFn b
    end sink scheduler time =
      sink.end time

createEndCombinator :: forall a. EndFn a -> Stream a -> Stream a
createEndCombinator end stream = createCombinator event end stream
  where
    event :: EventFn a a
    event sink scheduler time value = sink.event time value

-- Stream factories
just :: forall a. a -> Stream a
just a = createStream (runJust a)

runJust :: forall a. a ->  Sink a -> Scheduler -> Disposable
runJust a sink scheduler =
  scheduleTasks [ eventTask a sink, endTask sink ] scheduler

empty :: forall a. Stream a
empty = createStream \sink scheduler -> scheduleTasks [endTask sink] scheduler

never :: forall a. Stream a
never = createStream \sink scheduler -> emptyDisposable

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

periodic :: Number -> Stream Unit
periodic period = createStream (runPeriodic period)

runPeriodic :: Number -> Sink Unit -> Scheduler -> Disposable
runPeriodic period sink scheduler = { dispose: scheduledTask.dispose }
  where
    p = case scheduler of Scheduler a -> a.periodic
    scheduledTask = p period (eventTask unit sink)

-- combinators
_map :: forall a b. (a -> b) -> Stream a -> Stream b
_map f stream = createEventCombinator mapEvent stream
  where
    mapEvent :: EventFn a b
    mapEvent sink scheduler time value = sink.event time (f value)

filter :: forall a. (a -> Boolean) -> Stream a -> Stream a
filter predicate stream = createEventCombinator event stream
  where
    event :: EventFn a a
    event sink scheduler time value = if predicate value
      then sink.event time value
      else unit

tapEvent :: forall e a. (a -> EffStream e Unit) -> Stream a -> Stream a
tapEvent f stream = createEventCombinator event stream
  where
    event :: EventFn a a
    event sink scheduler time value = sink.event time value
      where -- find a better way to perform these side effects
        x = unsafePerformEff (f value)

tapEnd :: forall e a. EffStream e Unit -> Stream a -> Stream a
tapEnd f stream = createEndCombinator end stream
  where
    end :: EndFn a
    end sink scheduler time = sink.end time
      where -- find a better way to perform these side effects
        x = unsafePerformEff f

startWith :: forall a. a -> Stream a -> Stream a
startWith value stream = concat (just value) stream

constant :: forall a b. b -> Stream a -> Stream b
constant value stream = createEventCombinator constantEvent stream
  where
    constantEvent sink scheduler time x = sink.event time value

scan :: forall a b. (b -> a -> b) -> b -> Stream a -> Stream b
scan f seed stream = startWith seed $ createEventCombinator scanEvent stream
  where
    state = createState seed

    scanEvent :: Sink b -> Scheduler -> Time -> a -> Unit
    scanEvent sink scheduler time value = sink.event time (state.set \acc -> f acc value)

-- find a better way to perform these side effects
createState :: forall a. a -> { get :: Pure a,  set :: (a -> a) -> a }
createState seed = { set, get }
  where
    ref :: Ref a
    ref = unsafePerformEff $ unsafeCoerceEff $ newRef seed

    set :: (a -> a) -> a
    set f = unsafePerformEff $ unsafeCoerceEff $
            modifyRef' ref \x -> { state: (f x), value: (f x) }

    get :: Pure a
    get = unsafeCoerceEff $ readRef ref

-- Foreign imports
-- Scheduler-related
foreign import defaultScheduler :: Scheduler
foreign import eventTask :: forall a. a -> Sink a -> Task
foreign import endTask :: forall a. Sink a -> Task
foreign import createDisposable :: forall a. (a -> Unit) -> a -> Disposable
foreign import emptyDisposable :: Disposable
foreign import disposeAll :: Array Disposable -> Disposable
foreign import scheduleTasks :: Array Task -> Scheduler -> Disposable
-- combinators
foreign import drain :: forall e a. Stream a -> EffStream e Unit
foreign import mergeConcurrently :: forall a. Int -> Stream (Stream a) -> Stream a
foreign import mergeMapConcurrently :: forall a b. (a -> Stream b) -> Stream a -> Stream b
foreign import combine2 :: forall a b c. (a -> b -> c) -> Stream a -> Stream b -> Stream c
foreign import combine3 :: forall a b c d. (a -> b -> c -> d) -> Stream a -> Stream b -> Stream c -> Stream d
foreign import combine4 :: forall a b c d e. (a -> b -> c -> d -> e) -> Stream a -> Stream b -> Stream c -> Stream d -> Stream e
foreign import combine5 :: forall a b c d e f. (a -> b -> c -> d -> e -> f) -> Stream a -> Stream b -> Stream c -> Stream d -> Stream e -> Stream f
foreign import join :: forall a. Stream (Stream a) -> Stream a
foreign import flatMap :: forall a b. Stream a -> (a -> Stream b) -> Stream b
foreign import continueWith :: forall a. (Unit -> Stream a) -> Stream a -> Stream a
foreign import concat :: forall a. Stream a -> Stream a -> Stream a
foreign import merge :: forall a. Array (Stream a) -> Stream a
foreign import switch :: forall a. Stream (Stream a) -> Stream a
