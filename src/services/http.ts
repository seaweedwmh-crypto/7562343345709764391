// 错误类型枚举
export enum ErrorType {
  TIMEOUT = 'timeout',
  NETWORK = 'network',
  SERVICE = 'service',
  FUSE = 'fuse'
}

// 请求选项接口
export interface RequestOptions extends RequestInit {
  timeout?: number; // 超时时间（毫秒），默认5000
  retryCount?: number; // 最大重试次数，默认3
  retryDelay?: number; // 初始重试延迟（毫秒），默认500
}

// 熔断器状态
type FuseState = 'closed' | 'open' | 'half-open';

// 熔断器配置
interface FuseConfig {
  failureThreshold: number; // 连续失败阈值，默认5
  coolDownPeriod: number; // 冷却时间（毫秒），默认30000
  testRequestInterval: number; // 半开状态测试请求间隔（毫秒），默认5000
}

// 熔断器状态
interface FuseStatus {
  state: FuseState;
  failureCount: number;
  lastFailureTime: number;
  coolDownEndTime: number;
  remainingCoolDownTime: number;
}

// 全局熔断器状态
const fuseStatus: FuseStatus = {
  state: 'closed',
  failureCount: 0,
  lastFailureTime: 0,
  coolDownEndTime: 0,
  remainingCoolDownTime: 0
};

// 熔断器默认配置
const defaultFuseConfig: FuseConfig = {
  failureThreshold: 5,
  coolDownPeriod: 30000,
  testRequestInterval: 5000
};

// 超时请求函数
const timeoutRequest = (url: string, options: RequestOptions): Promise<Response> => {
  const { timeout = 5000 } = options;
  const controller = new AbortController();
  const signal = controller.signal;

  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return fetch(url, { ...options, signal })
    .finally(() => clearTimeout(timeoutId));
};

// 指数退避延迟
const exponentialBackoff = (attempt: number, baseDelay: number = 500): number => {
  return baseDelay * Math.pow(2, attempt - 1);
};

// 更新熔断器状态
const updateFuseStatus = (success: boolean) => {
  const now = Date.now();

  if (success) {
    // 请求成功，重置失败计数
    fuseStatus.failureCount = 0;
    if (fuseStatus.state === 'half-open') {
      fuseStatus.state = 'closed';
    }
  } else {
    // 请求失败，增加失败计数
    fuseStatus.failureCount++;
    fuseStatus.lastFailureTime = now;

    // 检查是否需要打开熔断器
    if (fuseStatus.failureCount >= defaultFuseConfig.failureThreshold) {
      fuseStatus.state = 'open';
      fuseStatus.coolDownEndTime = now + defaultFuseConfig.coolDownPeriod;
    }
  }
};

// 检查熔断器状态
const checkFuseStatus = (): boolean => {
  const now = Date.now();

  if (fuseStatus.state === 'open') {
    // 检查冷却时间是否结束
    if (now >= fuseStatus.coolDownEndTime) {
      fuseStatus.state = 'half-open';
      return true; // 允许测试请求
    }
    return false; // 快速失败
  }

  if (fuseStatus.state === 'half-open') {
    // 检查是否可以发送测试请求
    if (now >= fuseStatus.lastFailureTime + defaultFuseConfig.testRequestInterval) {
      return true;
    }
    return false;
  }

  return true; // 关闭状态，允许请求
};

// 核心请求函数
export const request = async (url: string, options: RequestOptions = {}): Promise<Response> => {
  const { retryCount = 3, retryDelay = 500 } = options;
  const startTime = Date.now();

  // 检查熔断器状态（非绕过模式）
  const headers = new Headers(options.headers || {});
  const isBypassFuse = headers.get('X-Bypass-Fuse') === 'true';
  if (!isBypassFuse && !checkFuseStatus()) {
    const error = new Error(`请求被熔断器拒绝，冷却剩余时间：${Math.ceil((fuseStatus.coolDownEndTime - Date.now()) / 1000)}秒`);
    (error as any).type = ErrorType.FUSE;
    throw error;
  }

  let attempt = 0;
  while (attempt < retryCount) {
    attempt++;
    try {
      const response = await timeoutRequest(url, options);
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (response.ok) {
        // 请求成功，更新熔断器状态
        updateFuseStatus(true);
        console.log(`请求成功：${url}，状态码：${response.status}，耗时：${duration}ms，尝试次数：${attempt}`);
        return response;
      }

      // 请求失败（非2xx状态码）
      console.warn(`请求失败：${url}，状态码：${response.status}，耗时：${duration}ms，尝试次数：${attempt}`);
    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 超时错误
      if (error.name === 'AbortError') {
        console.warn(`请求超时：${url}，耗时：${duration}ms，尝试次数：${attempt}`);
        error.type = ErrorType.TIMEOUT;
      } 
      // 网络错误
      else if (!navigator.onLine) {
        console.warn(`网络错误：${url}，耗时：${duration}ms，尝试次数：${attempt}`);
        error.type = ErrorType.NETWORK;
      } 
      // 服务错误
      else {
        console.warn(`服务错误：${url}，错误：${error.message}，耗时：${duration}ms，尝试次数：${attempt}`);
        error.type = ErrorType.SERVICE;
      }

      // 最后一次尝试失败，抛出错误
      if (attempt === retryCount) {
        updateFuseStatus(false);
        throw error;
      }
    }

    // 指数退避延迟
    const delay = exponentialBackoff(attempt, retryDelay);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // 理论上不会到达这里，但为了TypeScript类型安全
  throw new Error('请求失败');
};

// 获取熔断器状态
export const getFuseStatus = (): FuseStatus => ({
  ...fuseStatus,
  remainingCoolDownTime: Math.max(0, fuseStatus.coolDownEndTime - Date.now())
});

// 重置熔断器
export const resetFuse = () => {
  fuseStatus.state = 'closed';
  fuseStatus.failureCount = 0;
  fuseStatus.lastFailureTime = 0;
  fuseStatus.coolDownEndTime = 0;
};