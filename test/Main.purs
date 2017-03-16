module Test.Main where

import Control.Monad.Eff (Eff)
import Control.Monad.Eff.Console (CONSOLE, logShow)
import Data.Unit (Unit)

main :: Eff (console :: CONSOLE) Unit
main = do
  logShow "Write tests. You're a bad developer!"
