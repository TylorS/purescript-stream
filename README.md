# Purescript Stream

> An ultra-fast reactive stream library for purescript

## Let me have it
```sh
bower install --save purescript-stream
```

## Basic usage
```purescript
module Main where

import Prelude
import Control.Monad.Eff (Eff)
import Control.Monad.Eff.Console (CONSOLE, logShow, log)
import Control.Stream (STREAM, periodic, constant, scan, tapEvent, tapEnd, drain)
import Data.Unit (Unit)

main :: Eff (stream :: STREAM, console :: CONSOLE) Unit
main = do
  periodic 1000.0 -- Stream Unit
    # constant 1 -- Stream Int
    # scan (+) 0 -- Stream Int
    # tapEvent logShow -- Perform side-effects on events
    # tapEnd (log "done") -- Perform a side-effect on stream completion
    # drain -- activate your stream
```