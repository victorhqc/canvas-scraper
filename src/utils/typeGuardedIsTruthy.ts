export default function isTruthy<Type>(x: Type | '' | null | false | undefined): x is Type {
  return Boolean(x);
}
