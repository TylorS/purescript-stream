module Control.Stream.Stream
  ( STREAM
  , EffStream
  , Stream(..)
  , just
  , empty
  , never
  , periodic
  , createCombinator
  , createEventCombinator
  , createEndCombinator
  , drain
  , tapEvent
  , tapEnd
  , fromArray
  , filter
  , take
  , skip
  , constant
  , continueWith
  , concat
  , startWith
  , scan
  , loop
  , chain
  , mergeConcurrently
  , join
  , mergeMapConcurrently
  , concatMap
  , switch
  , combine2
  , combine3
  , combine4
  , combine5
  , combineArray
  , merge
  , skipRepeatsWith
  , skipRepeats
  , until
  , since
  , during
  , sample
  , debounce
  , throttle
  , delay
  , multicast
  , hold
  , Subject
  , toSubject
  , toHoldSubject
  , fromSubject
  , subjectEvent
  , subjectEnd
  , subscribe
  ) where

import Control.Alternative (class Apply)
import Control.Bind (class Bind)
import Control.Category (id)
import Control.Monad.Eff (Eff, Pure, runPure)
import Control.Monad.Eff.Ref (Ref, modifyRef', newRef, readRef)
import Control.Monad.Eff.Unsafe (unsafeCoerceEff, unsafePerformEff)
import Control.MonadPlus (class Alt, class Alternative, class MonadPlus, class Plus)
import Control.MonadZero (class Applicative, class MonadZero)
import Control.Stream.Disposable (Disposable, emptyDisposable, disposeAll)
import Control.Stream.Scheduler (Scheduler(..), endTask, eventTask, scheduleTasks)
import Control.Stream.Sink (Sink(..))
import Control.Stream.Stream (Stream(..), EffStream, empty, just)
import Control.Stream.Time (Time)
import Data.Eq ((==))
import Data.EuclideanRing ((-))
import Data.Functor (class Functor)
import Data.Maybe (Maybe(..), fromJust, isNothing)
import Data.Monoid (class Monoid)
import Data.Unit (Unit, unit)
import Partial.Unsafe (unsafePartial)
import Prelude (class Eq, class Monad, class Semigroup, eq)

foreign import data STREAM :: !

type EffStream e a = Eff (stream :: STREAM | e) a

foreign import data Subject :: * -> *

newtype Stream a = Stream { run :: Sink a -> Scheduler -> Disposable }

instance functorStream :: Functor Stream where
  map = mapStream

instance applyStream :: Apply Stream where
  apply = combine2 id

instance applicativeStream :: Applicative Stream where
  pure = just

instance bindStream :: Bind Stream where
  bind = chain

instance monadStream :: Monad Stream

instance semigroupStream :: Semigroup (Stream a) where
  append = concat

instance altStream :: Alt Stream where
  alt = \s1 s2 -> merge [s1, s2]

instance monoidStream :: Monoid (Stream a) where
  mempty = empty

instance plusStream :: Plus Stream where
  empty = empty

instance alternativeStream :: Alternative Stream

instance monadZeroStream :: MonadZero Stream

instance monadPlusStream :: MonadPlus Stream

just :: forall a. a -> Stream a
just a = Stream { run } where
  run :: Sink a -> Scheduler -> Disposable
  run sink (Scheduler scheduler) =
    scheduleTasks scheduler.asap [ (eventTask sink a), (endTask sink) ]

empty :: forall a. Stream a
empty = Stream { run } where
  run :: Sink a -> Scheduler -> Disposable
  run sink (Scheduler scheduler) = scheduleTasks scheduler.asap [ endTask sink ]

never :: forall a. Stream a
never = Stream { run: \sink scheduler -> emptyDisposable }

periodic :: Number -> Stream Unit
periodic period = Stream { run } where
  run :: Sink Unit -> Scheduler -> Disposable
  run sink (Scheduler scheduler) = do
    let task = eventTask sink unit
    let scheduledTask = scheduler.periodic period task
    { dispose : scheduledTask.dispose }

createCombinator :: forall a b. (Sink b -> Time -> a -> Unit) -> (Sink b -> Time -> Unit) -> Stream a -> Stream b
createCombinator event end (Stream stream) = Stream { run } where
  run :: Sink b -> Scheduler -> Disposable
  run sink scheduler = stream.run (Sink { event: (event sink), end: (end sink) }) scheduler

createEventCombinator :: forall a b. (Sink b -> Time -> a -> Unit) -> Stream a -> Stream b
createEventCombinator event stream = createCombinator event end stream where
  end (Sink sink) time = sink.end time

createEndCombinator :: forall a. (Sink a -> Time -> Unit) -> Stream a -> Stream a
createEndCombinator end stream = createCombinator event end stream where
  event (Sink sink) time value = sink.event time value

tapEvent :: forall e a. (a -> Eff e Unit) -> Stream a -> Stream a
tapEvent f stream = createEventCombinator event stream where
  event :: Sink a -> Time -> a -> Unit
  event (Sink sink) time value = sink.event time (always value (unsafePerformEff (f value)))

tapEnd :: forall e a. Eff e Unit -> Stream a -> Stream a
tapEnd f stream = createEndCombinator end stream where
  end :: Sink a -> Time -> Unit
  end (Sink sink) time = sink.end (always time (unsafePerformEff f))

take :: forall a. Int -> Stream a -> Stream a
take 0 stream = empty
take amount (Stream stream) = Stream { run } where
  run (Sink sink) scheduler = disposable where
    disposable = stream.run (Sink { event, end }) scheduler where
      state :: State Int
      state = createState amount

      event ::Time -> a -> Unit
      event time value = do
        let amountLeft = (getState state)
        if amountLeft == 0
          then unit
          else do
            let newAmountLeft = state.set \x -> x - 1
            let x = sink.event time value
            if newAmountLeft == 0
              then sink.end (always time (runPure disposable.dispose))
              else unit

      end time = sink.end time

skip :: forall a. Int -> Stream a -> Stream a
skip 0 stream = stream
skip amount stream = createEventCombinator event stream where
  state :: State Int
  state = createState amount

  event :: Sink a -> Time -> a -> Unit
  event (Sink sink) time value = do
    let amountLeft = runPure state.get
    if (amountLeft == 0)
      then sink.event time value
      else always unit (state.set \x -> x - 1)

mapStream :: forall a b. (a -> b) -> Stream a -> Stream b
mapStream f stream = createEventCombinator event stream where
  event :: Sink b -> Time -> a -> Unit
  event (Sink sink) time value = sink.event time (f value)

filter :: forall a. (a -> Boolean) -> Stream a -> Stream a
filter predicate stream = createEventCombinator event stream where
  event (Sink sink) time value = if predicate value
    then sink.event time value
    else unit

skipRepeatsWith :: forall a. (a -> a -> Boolean) -> Stream a -> Stream a
skipRepeatsWith compare stream = createEventCombinator event stream where
  state :: State (Maybe a)
  state = createState Nothing

  event (Sink sink) time value = do
    let currentState = (getState state)
    if (isNothing currentState)
      then sink.event time value
      else do
        let currentValue = unsafePartial (fromJust currentState)
        if (compare currentValue value)
          then unit
          else sink.event time value

skipRepeats :: forall a. (Eq a) => Stream a -> Stream a
skipRepeats = skipRepeatsWith (eq)

constant :: forall a b. b -> Stream a -> Stream b
constant b stream = createEventCombinator event stream where
  event :: Sink b -> Time -> a -> Unit
  event (Sink sink) time value = sink.event time b

concat :: forall a. Stream a -> Stream a -> Stream a
concat s1 s2 = continueWith(\_ -> s2) s1

startWith :: forall a. a -> Stream a -> Stream a
startWith seed stream = concat (just seed) stream

scan :: forall a b. (b -> a -> b) -> b -> Stream a -> Stream b
scan f initial stream = startWith initial (createEventCombinator event stream) where
  seed :: State b
  seed = createState initial

  event :: Sink b -> Time -> a -> Unit
  event (Sink sink) time value = sink.event time (seed.set \x -> f x value)

loop :: forall a b c. (b -> a -> { seed :: b, value :: c }) -> b -> Stream a -> Stream c
loop f initial stream = createEventCombinator event stream where
  seed :: State b
  seed = createState initial

  event :: Sink c -> Time -> a -> Unit
  event (Sink sink) time x = do
    let seedValue = f (getState seed) x
    sink.event time (always seedValue.value (seed.set \_ -> seedValue.seed))

concatMap :: forall a b. (a -> Stream b) -> Stream a -> Stream b
concatMap f stream = mergeMapConcurrently f 1 stream

ap :: forall a b. (Stream (a -> b)) -> Stream a -> Stream b
ap fs xs = combine2 (\f x -> f x) fs xs

during :: forall a b. Stream (Stream b) -> Stream a -> Stream a
during timeWindow stream = until (join timeWindow) (since timeWindow stream)

sample :: forall a b c. (a -> b -> c) -> Stream a -> Stream b -> Stream c
sample f (Stream sampler) (Stream stream) = Stream { run: runSample (createState Nothing) } where
  runSample :: State (Maybe b) -> Sink c -> Scheduler -> Disposable
  runSample state sink scheduler = disposeAll
    [ stream.run (createHoldSink state) scheduler
    , sampler.run (createSampleSink state sink f) scheduler
    ]

createHoldSink :: forall a. State (Maybe a) -> Sink a
createHoldSink state = Sink { event, end } where
  event time value = always unit (state.set \_ -> Just value)
  end time = unit

createSampleSink :: forall a b c. State (Maybe b) -> Sink c -> (a -> b -> c) -> Sink a
createSampleSink state (Sink sink) f = Sink { event, end } where
  end time = sink.end time
  event time value =
    if isNothing (runPure state.get)
    then unit
    else sink.event time (f value (unsafePartial (fromJust (runPure state.get))))

sampleWith :: forall a b. Stream b -> Stream a -> Stream a
sampleWith signal stream = sample (\_ y -> y) signal stream

-- find a better way to perform these side effects
always :: forall a b. a -> b -> a
always a b = a

type State a = { get:: Pure a, set :: (a -> a) -> a }

getState :: forall a. State a -> a
getState state = runPure state.get

createState :: forall a. a -> State a
createState seed = { set, get }
  where
    ref :: Ref a
    ref = unsafePerformEff (unsafeCoerceEff (newRef seed))

    set :: (a -> a) -> a
    set f = unsafePerformEff (unsafeCoerceEff (modifyRef' ref \x -> { state: (f x), value: (f x) }))

    get :: Pure a
    get = unsafeCoerceEff (readRef ref)

foreign import drain :: forall e a. Stream a -> EffStream e Unit
foreign import subscribe :: forall e a. (a -> Eff e Unit) -> (Unit -> Eff e Unit) -> Stream a -> EffStream e Unit
foreign import fromArray :: forall a b. Array a -> Stream b -> Stream a
foreign import chain :: forall a b. Stream a -> (a -> Stream b) -> Stream b
foreign import mergeConcurrently :: forall a. Int -> Stream (Stream a) -> Stream a
foreign import join :: forall a. Stream (Stream a) -> Stream a
foreign import mergeMapConcurrently :: forall a b. (a -> Stream b) -> Int -> Stream a -> Stream b
foreign import switch :: forall a. Stream (Stream a) -> Stream a
foreign import continueWith :: forall a. (Unit -> Stream a) -> Stream a -> Stream a
foreign import combine2 :: forall a b c. (a -> b -> c) -> Stream a -> Stream b -> Stream c
foreign import combine3 :: forall a b c d. (a -> b -> c -> d) -> Stream a -> Stream b -> Stream c -> Stream d
foreign import combine4 :: forall a b c d e. (a -> b -> c -> d -> e) -> Stream a -> Stream b -> Stream c -> Stream d -> Stream e
foreign import combine5 :: forall a b c d e f. (a -> b -> c -> d -> e -> f) -> Stream a -> Stream b -> Stream c -> Stream d -> Stream e -> Stream f
foreign import combineArray :: forall a. Array (Stream a) -> Stream (Array a)
foreign import merge :: forall a. Array (Stream a) -> Stream a
foreign import until :: forall a b. Stream b -> Stream a -> Stream a
foreign import since :: forall a b. Stream b -> Stream a -> Stream a
foreign import debounce :: forall a. Number -> Stream a -> Stream a
foreign import throttle :: forall a. Number -> Stream a -> Stream a
foreign import delay :: forall a. Number -> Stream a -> Stream a
foreign import multicast :: forall a. Stream a -> Stream a
foreign import hold :: forall a. Stream a -> Stream a
foreign import proxy :: forall a. a -> { attach :: (Stream a -> Stream a), stream :: Stream a }

-- Sad subject types :/
foreign import toSubject :: forall a. Stream a -> Subject a
foreign import toHoldSubject :: forall a. Int -> Stream a -> Subject a
foreign import fromSubject :: forall a. Subject a -> Stream a
foreign import subjectEvent :: forall a. a -> Subject a -> Subject a
foreign import subjectEnd :: forall a. a -> Subject a -> Subject a
