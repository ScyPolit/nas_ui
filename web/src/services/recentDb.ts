import type { RecentViewedFile } from '@/types'

const DATABASE_NAME = 'dufs-modern'
const STORE_NAME = 'recent-viewed'
const MAX_RECORDS = 100

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof globalThis.indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持本地浏览历史'))
      return
    }
    const request = globalThis.indexedDB.open(DATABASE_NAME, 1)
    request.addEventListener('upgradeneeded', () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'path' }).createIndex('viewedAt', 'viewedAt')
      }
    })
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error ?? new Error('无法打开浏览历史数据库')))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () => reject(request.error ?? new Error('浏览历史数据库操作失败')))
  })
}

export async function addRecentViewed(record: RecentViewedFile): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).put(record)
  await transactionDone(transaction)
  database.close()

  const records = await getRecentViewed(MAX_RECORDS + 20)
  if (records.length > MAX_RECORDS) {
    const cleanupDatabase = await openDatabase()
    const cleanup = cleanupDatabase.transaction(STORE_NAME, 'readwrite')
    for (const stale of records.slice(MAX_RECORDS)) cleanup.objectStore(STORE_NAME).delete(stale.path)
    await transactionDone(cleanup)
    cleanupDatabase.close()
  }
}

export async function getRecentViewed(limit = 12): Promise<RecentViewedFile[]> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readonly')
  const values = await requestResult(transaction.objectStore(STORE_NAME).getAll())
  database.close()
  return (values as RecentViewedFile[])
    .sort((left, right) => right.viewedAt - left.viewedAt)
    .slice(0, limit)
}

export async function removeRecentViewed(path: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).delete(path)
  await transactionDone(transaction)
  database.close()
}

export async function clearRecentViewed(): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).clear()
  await transactionDone(transaction)
  database.close()
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve())
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('数据库事务已取消')))
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('数据库事务失败')))
  })
}
