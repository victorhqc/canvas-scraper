// Code from
// https://dev.to/ascorbic/creating-a-typed-compose-function-in-typescript-3-351i

/* eslint @typescript-eslint/explicit-function-return-type: 0 */
/* eslint @typescript-eslint/no-explicit-any: 0 */

export const pipe = <T extends any[], R>(fn1: (...args: T) => R, ...fns: Array<(a: R) => R>) => {
  const piped = fns.reduce(
    (prevFn, nextFn) => (value: R) => nextFn(prevFn(value)),
    value => value
  );
  return (...args: T) => piped(fn1(...args));
};

export const compose = <R>(fn1: (a: R) => R, ...fns: Array<(a: R) => R>) =>
  fns.reduce((prevFn, nextFn) => value => prevFn(nextFn(value)), fn1);
