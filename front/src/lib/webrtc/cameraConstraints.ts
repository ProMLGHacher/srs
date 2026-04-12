/**
 * Для первого захвата и prejoin: меньше ideal → быстрее открытие камеры и согласование,
 * чем 1280×720 по умолчанию. max оставляет запас качества, если устройство даёт выше.
 */
export const fastStartVideoConstraints: MediaTrackConstraints = {
  facingMode: "user",
  width: { ideal: 640, max: 1280 },
  height: { ideal: 480, max: 720 },
}
