import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

test('SDK checkout and signed webhooks credit an order only once', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'waffo-test-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  const keyPath = path.join(dir, 'private.pem')
  const publicPath = path.join(dir, 'public.pem')
  await fs.writeFile(keyPath, privateKey)
  await fs.writeFile(publicPath, publicKey)

  const requests = []
  const gateway = http.createServer(async (req, res) => {
    let payload = ''
    for await (const chunk of req) payload += chunk
    const bodyHash = crypto.createHash('sha256').update(payload).digest('base64')
    const signed = `POST\n${req.url}\n${req.headers['x-timestamp']}\n${bodyHash}`
    assert.equal(crypto.verify('sha256', Buffer.from(signed), publicKey, Buffer.from(req.headers['x-signature'], 'base64')), true)
    requests.push({ path: req.url, body: JSON.parse(payload) })
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ data: req.url.includes('issue-session-token')
      ? { token: 'test-token', expiresAt: '2030-01-01T00:00:00Z' }
      : { checkoutUrl: 'https://pancake.waffo.ai/checkout/test', sessionId: 'cs_test', expiresAt: '2030-01-01T00:00:00Z' } }))
  })
  await new Promise((resolve) => gateway.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => gateway.close(resolve)))

  const storeId = 'STO_1234567890123456789012'
  const productId = 'PROD_1234567890123456789012'
  Object.assign(process.env, {
    DATA_DIR: dir,
    UPLOAD_DIR: path.join(dir, 'uploads'),
    SIGNUP_BONUS_CREDITS: '0',
    WAFFO_API_BASE: `http://127.0.0.1:${gateway.address().port}`,
    WAFFO_ENVIRONMENT: 'test',
    WAFFO_MERCHANT_ID: 'MER_1234567890123456789012',
    WAFFO_STORE_ID: storeId,
    WAFFO_PRIVATE_KEY_FILE: keyPath,
    WAFFO_WEBHOOK_PUBLIC_KEY_FILE: publicPath,
    WAFFO_PLAN_STARTER_PRODUCT_ID: productId,
  })
  delete process.env.WAFFO_PRIVATE_KEY

  const { createClipApi } = await import('../scripts/clip-api.mjs')
  const api = http.createServer(createClipApi())
  await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => api.close(resolve)))
  const base = `http://127.0.0.1:${api.address().port}`
  await fs.writeFile(keyPath, 'invalid key')
  const invalidPlans = await (await fetch(`${base}/api/billing/plans`)).json()
  assert.equal(invalidPlans.configured, false)
  assert.equal(invalidPlans.plans[0].available, false)
  await fs.writeFile(keyPath, privateKey)
  const register = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', password: 'test-password', name: 'Buyer' }),
  })
  assert.equal(register.status, 201)
  const user = (await register.json()).user
  const cookie = register.headers.get('set-cookie').split(';')[0]
  const checkout = await fetch(`${base}/api/billing/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ planId: 'starter' }),
  })
  assert.equal(checkout.status, 200)
  assert.match((await checkout.json()).checkoutUrl, /#token=test-token$/)
  const session = requests.find((request) => request.path.endsWith('create-session'))
  const token = requests.find((request) => request.path.endsWith('issue-session-token'))
  assert.equal(token.body.buyerIdentity, user.id)
  assert.equal(session.body.metadata.productId, productId)

  const event = {
    id: 'delivery-1',
    eventId: 'payment-1',
    eventType: 'order.completed',
    storeId,
    mode: 'test',
    data: {
      orderId: 'order-1',
      buyerEmail: user.email,
      merchantProvidedBuyerIdentity: user.id,
      currency: 'USD',
      amount: '7.99',
      orderMetadata: session.body.metadata,
    },
  }
  const webhook = async (body, key = privateKey) => {
    const raw = JSON.stringify(body)
    const timestamp = String(Date.now())
    const signature = crypto.sign('sha256', Buffer.from(`${timestamp}.${raw}`), key).toString('base64')
    return fetch(`${base}/api/webhooks/waffo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-waffo-signature': `t=${timestamp},v1=${signature}` },
      body: raw,
    })
  }
  assert.equal((await webhook({ ...event, storeId: 'STO_other' })).status, 400)
  assert.equal((await webhook({ ...event, mode: 'prod' })).status, 400)
  assert.equal((await webhook({ ...event, data: { ...event.data, merchantProvidedBuyerIdentity: 'other' } })).status, 422)
  assert.equal((await webhook({ ...event, data: { ...event.data, productId: 'other' } })).status, 422)
  const wrongKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
  assert.equal((await webhook(event, wrongKey)).status, 401)
  assert.equal((await (await webhook(event)).json()).credited, true)
  await fs.writeFile(path.join(dir, 'payment-events.jsonl'), '')
  assert.equal((await (await webhook(event)).json()).credited, false)
  const account = await fetch(`${base}/api/account`, { headers: { cookie } })
  assert.equal((await account.json()).balance, 100)
})
