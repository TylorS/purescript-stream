module Control.Stream
  ( STREAM
  , EffStream
  , Stream
  , Source
  , EventFn
  , EndFn
  , RunFn
  , Sink
  , Scheduler
  , Task
  , ScheduledTask
  , Disposable
  , Time
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
  , multicast
  , hold
  , skipRepeats
  , skipRepeatsWith
  , delay
  , sample
  -- Stream factories
  , just
  , fromArray
  , empty
  , never
  , periodic
  )
  where

import Control.Alt ((<|>))
import Control.Applicative (class Applicative)
import Control.Apply (class Apply)
import Control.Bind (class Bind)
import Control.Category (id)
import Control.Monad (class Monad)
import Control.Monad.Eff (Eff, Pure, runPure)
import Control.Monad.Eff.Ref (Ref, modifyRef', newRef, readRef)
import Control.Monad.Eff.Unsafe (unsafeCoerceEff, unsafePerformEff)
import Control.MonadPlus (class Alt, class Plus)
import Data.Eq (class Eq, eq)
import Data.Function (flip, ($))
import Data.Functor (class Functor, map)
import Data.Maybe (Maybe(Just, Nothing), fromJust, isJust)
import Data.Monoid (class Monoid)
import Data.Semigroup (class Semigroup)
import Data.Unit (Unit, unit)
import Partial.Unsafe (unsafePartial)

newtype Time = Time Int

foreign import data STREAM :: !

type EffStream e a = Eff (stream :: STREAM | e) a

newtype Stream a = Stream { source :: Source a }

newtype Source a = Source { run :: RunFn a }

type RunFn a = Sink a -> Scheduler -> Disposable
type EventFn a = Time -> a -> Unit
type EndFn = Time -> Unit

newtype Sink a = Sink
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
createStream run = Stream { source: Source { run } }

getSource :: forall a. Stream a -> Source a
getSource (Stream stream) = stream.source

runSource :: forall a. Source a -> Sink a -> Scheduler -> Disposable
runSource (Source source) sink scheduler = source.run sink scheduler

runStream :: forall a. Stream a -> Sink a -> Scheduler -> Disposable
runStream stream sink scheduler = runSource (getSource stream) sink scheduler

createSink :: forall a. (Time -> a -> Unit) -> (Time -> Unit) -> Sink a
createSink event end = Sink { event, end }

createCombinator :: forall a b. (Sink b -> Scheduler -> EventFn a) -> (Sink b -> Scheduler -> EndFn) -> Stream a -> Stream b
createCombinator event end stream = createStream runCombinator
  where
    runCombinator :: Sink b -> Scheduler -> Disposable
    runCombinator sink scheduler =
      runStream stream (createSink (event sink scheduler) (end sink scheduler)) scheduler

createEventCombinator :: forall a b. (Sink b -> Scheduler -> EventFn a) -> Stream a -> Stream b
createEventCombinator event stream = createCombinator event end stream
  where
    end (Sink sink) (Scheduler scheduler) time = sink.end time

createEndCombinator :: forall a. (Sink a -> Scheduler -> EndFn) -> Stream a -> Stream a
createEndCombinator end stream = createCombinator event end stream
  where
    event :: Sink a -> Scheduler -> EventFn a
    event (Sink sink) scheduler time value = sink.event time value

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
    tasks = eventTasks <|> [ (endTask sink) ]

    eventTasks :: Array Task
    eventTasks = map (flip eventTask sink) arr

periodic :: Number -> Stream Unit
periodic period = createStream (runPeriodic period)

runPeriodic :: Number -> Sink Unit -> Scheduler -> Disposable
runPeriodic period sink (Scheduler scheduler) = { dispose: scheduledTask.dispose }
  where
    scheduledTask = scheduler.periodic period (eventTask unit sink)

-- combinators
_map :: forall a b. (a -> b) -> Stream a -> Stream b
_map f stream = createEventCombinator mapEvent stream
  where
    mapEvent (Sink sink) (Scheduler scheduler) time value = sink.event time (f value)

filter :: forall a. (a -> Boolean) -> Stream a -> Stream a
filter predicate stream = createEventCombinator event stream
  where
    event (Sink sink) (Scheduler scheduler) time value = if predicate value
      then sink.event time value
      else unit

tapEvent :: forall e a. (a -> EffStream e Unit) -> Stream a -> Stream a
tapEvent f stream = createEventCombinator event stream
  where
    event (Sink sink) (Scheduler scheduler) time value = sink.event time value
      where -- find a better way to perform these side effects
        x = unsafePerformEff (f value)

tapEnd :: forall e a. EffStream e Unit -> Stream a -> Stream a
tapEnd f stream = createEndCombinator end stream
  where
    end (Sink sink) (Scheduler scheduler) time = sink.end time
      where -- find a better way to perform these side effects
        x = unsafePerformEff f

startWith :: forall a. a -> Stream a -> Stream a
startWith value stream = concat (just value) stream

constant :: forall a b. b -> Stream a -> Stream b
constant value stream = createEventCombinator constantEvent stream
  where
    constantEvent (Sink sink) (Scheduler scheduler) time x = sink.event time value

scan :: forall a b. (b -> a -> b) -> b -> Stream a -> Stream b
scan f seed stream = startWith seed $ createEventCombinator scanEvent stream
  where
    state :: State b
    state = createState seed

    scanEvent :: Sink b -> Scheduler -> Time -> a -> Unit
    scanEvent (Sink sink) (Scheduler scheduler) time value = sink.event time (state.set \acc -> f acc value)

skipRepeats :: forall a. (Eq a) => Stream a -> Stream a
skipRepeats = skipRepeatsWith eq

sample :: forall a b c. (a -> b -> c) -> Stream a -> Stream b -> Stream c
sample f sampler stream = createStream $ runSample (createState Nothing)
  where
    runSample :: State (Maybe b) -> Sink c -> Scheduler -> Disposable
    runSample state sink scheduler = disposeAll
      [ runStream stream (createHoldSink state) scheduler
      , runStream sampler (createSampleSink state sink f) scheduler
      ]

createHoldSink :: forall a. State (Maybe a) -> Sink a
createHoldSink state = createSink event end
  where
    event time value = always unit (state.set \_ -> Just value)
    end time = unit

createSampleSink :: forall a b c. State (Maybe b) -> Sink c -> (a -> b -> c) -> Sink a
createSampleSink state (Sink sink) f = createSink event end
  where
    end time = sink.end time
    event time value =
      if isJust (runPure state.get)
      then sink.event time $ f value (unsafePartial $ fromJust (runPure state.get))
      else unit

always :: forall a b. a -> b -> a
always a b = a

-- find a better way to perform these side effects
type State a = { get:: Pure a, set :: (a -> a) -> a }

createState :: forall a. a -> State a
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
foreign import multicast :: forall a. Stream a -> Stream a
foreign import hold :: forall a. Int -> Stream a -> Stream a
foreign import skipRepeatsWith :: forall a. (a -> a -> Boolean) -> Stream a -> Stream a
foreign import delay :: forall a. Number -> Stream a -> Stream a
