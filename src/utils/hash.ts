declare module 'crypto-hash' {
  export function sha256(data: string | ArrayBuffer): Promise<string>;
}

import { sha256 } from 'crypto-hash';

export class HashUtil {
  /**
   * 计算文件的SHA-256哈希值
   * @param file 文件对象
   * @returns Promise<string> 哈希值
   */
  static async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    return this.calculateBufferHash(buffer);
  }

  /**
   * 计算数组缓冲区的SHA-256哈希值
   * @param buffer 数组缓冲区
   * @returns Promise<string> 哈希值
   */
  static async calculateBufferHash(buffer: ArrayBuffer): Promise<string> {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('浏览器不支持加密API');
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return this.bufferToHex(hashBuffer);
  }

  /**
   * 将ArrayBuffer转换为十六进制字符串
   * @param buffer ArrayBuffer对象
   * @returns string 十六进制字符串
   */
  static bufferToHex(buffer: ArrayBuffer): string {
    const hexArr = Array.from(new Uint8Array(buffer)).map(
      (b) => b.toString(16).padStart(2, '0')
    );
    return hexArr.join('');
  }

  /**
   * 计算分片的哈希值
   * @param chunk 分片数据
   * @returns Promise<string> 哈希值
   */
  static async calculateChunkHash(chunk: ArrayBuffer): Promise<string> {
    return this.calculateBufferHash(chunk);
  }
}