# Changelog

# 4.0.0

## Breaking

-   The `async` option has been renamed to `asyncMode` and can no longer be a
    function

## Added

-   The `options` object can now contain a `hooks` property

## Changed

-   Providing a function to the `async` option has been moved to the
    `onAsyncTransition` hook

# 3.0.0

## Breaking

-   `stateMachine()` now returns an object containing the `state` store instead
    of the store itself
-   The `dispatch()` function is no longer a method on the `state` store, it is
    now a property on the object returned by `stateMachine()`

## Added

-   The object returned by `stateMachine()` now contains a `transitioning` store
    that contains `true` while an async transition is going on
-   The object returned by `stateMachine()` now contains a `is` object that maps
    every state to a boolean store that contains `true` when the machine is in
    that state

## Changed

-   The state machine now ignores any call to `dispatch()` while an async
    transition is going on

# 2.0.2

-   Fixed `exports` field in `package.json`

## 2.0.1

-   Added file LICENSE
-   Added file README.md
-   Added file CHANGELOG.md

## 2.0.0

-   Added the possibility to return promises from transition functions

## 1.0.0

-   Initial release
