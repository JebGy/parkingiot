import test from "node:test"
import assert from "node:assert/strict"
import { decideServoAction } from "../lib/servo.js"

const mk = (amount_final: number) => ({ amount_final } as any)
const code = {} as any

test("servo 1 cuando amount_final >= min", () => {
  process.env.SERVO_MIN_AMOUNT = "0.01"
  const r = decideServoAction(mk(10), code)
  assert.equal(r, 1)
})

test("servo 0 cuando amount_final < min", () => {
  process.env.SERVO_MIN_AMOUNT = "100"
  const r = decideServoAction(mk(10), code)
  assert.equal(r, 0)
})