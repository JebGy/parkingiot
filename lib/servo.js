export function decideServoAction(payment, _code) {
  const min = parseFloat(process.env.SERVO_MIN_AMOUNT || "0")
  const amt = Number(payment.amount_final)
  if (isNaN(amt)) return 0
  return amt >= min ? 1 : 0
}