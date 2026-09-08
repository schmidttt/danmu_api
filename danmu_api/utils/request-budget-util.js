import { AsyncLocalStorage } from 'node:async_hooks';

// Forward 的同步 AsyncLocalStorage shim 无法隔离异步任务，不能在那里提前
// 返回仍在运行的源。保留其原调度；HTTP 单请求的完整读取超时仍然生效。
export const supportsRequestBudgets = globalThis.__FORWARD_WIDGET__ !== true;
export const requestBudgetContext = new AsyncLocalStorage();

function abortError(message = 'Request deadline exceeded') {
  return new DOMException(message, 'AbortError');
}

export function throwIfRequestCancelled(signal) {
  const scopedSignal = requestBudgetContext.getStore()?.signal;
  if (signal?.aborted || scopedSignal?.aborted) throw abortError();
}

// 同时取消网络请求和等待它的调度任务。race 负责收敛不遵守 AbortSignal 的源，
// 上下文负责阻止迟到任务继续发请求或写入共享缓存。
export async function runWithRequestBudget(timeoutMs, task) {
  if (!supportsRequestBudgets) return task();
  throwIfRequestCancelled();
  const parent = requestBudgetContext.getStore();
  const deadline = Math.min(Date.now() + Math.max(0, timeoutMs), parent?.deadline ?? Infinity);
  if (deadline <= Date.now()) throw abortError();
  const controller = new AbortController();
  const abort = () => controller.abort(abortError());
  parent?.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, Math.max(0, deadline - Date.now()));
  let onAbort;
  const cancelled = new Promise((_, reject) => {
    onAbort = () => reject(abortError());
    controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([
      requestBudgetContext.run({ signal: controller.signal, deadline }, () => Promise.resolve().then(task)),
      cancelled,
    ]);
  } finally {
    clearTimeout(timer);
    parent?.signal.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', onAbort);
    controller.abort(abortError('Request scope closed'));
  }
}

export function waitForRequestDelay(ms, signal) {
  throwIfRequestCancelled(signal);
  const signals = [...new Set([signal, requestBudgetContext.getStore()?.signal].filter(Boolean))];
  return new Promise((resolve, reject) => {
    const cleanup = () => signals.forEach(item => item.removeEventListener('abort', onAbort));
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(abortError());
    };
    const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
    signals.forEach(item => item.addEventListener('abort', onAbort, { once: true }));
  });
}
