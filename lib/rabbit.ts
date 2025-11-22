let ready = false
let connecting = false
let amqplib: any
let conn: any
let channel: any

async function ensure() {
  if (ready) return true
  if (connecting) return false
  connecting = true
  try {
    const url = process.env.RABBITMQ_URL || ""
    if (!url) {
      connecting = false
      return false
    }
    amqplib = await import("amqplib")
    conn = await amqplib.connect(url)
    channel = await conn.createConfirmChannel()
    await channel.assertQueue("esp32_servo", { durable: true })
    ready = true
    connecting = false
    return true
  } catch {
    connecting = false
    ready = false
    return false
  }
}

export async function publishServoAction(codigo: string, value: number) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ok = await ensure()
    if (!ok) {
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
      continue
    }
    try {
      const payload = JSON.stringify({ action: "servo", value, codigo_id: codigo })
      await new Promise<void>((resolve, reject) => {
        channel.sendToQueue("esp32_servo", Buffer.from(payload), { persistent: true }, (err: any) => {
          if (err) reject(err)
          else resolve()
        })
      })
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
    }
  }
  return false
}