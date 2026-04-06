/** Простая очередь async-операций с медиа (публикация / смена камеры). */
export function createMediaMutex(): {
  run<T>(fn: () => Promise<T>): Promise<T>
} {
  let chain: Promise<void> = Promise.resolve()
  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      const p = chain.then(() => fn())
      chain = p.then(
        () => {},
        () => {},
      )
      return p
    },
  }
}
