const HashUtils = {
  async sha256(data) {
    let buffer;
    if (typeof data === 'string') {
      buffer = FileUtils.stringToArrayBuffer(data);
    } else if (data instanceof ArrayBuffer) {
      buffer = data;
    } else {
      buffer = FileUtils.stringToArrayBuffer(JSON.stringify(data));
    }
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return this.bufferToHex(hashBuffer);
  },

  bufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    const hexArray = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
    return hexArray.join('');
  },

  async generateIntegrityHash(capsule) {
    const dataToHash = {
      meta: capsule.meta,
      recipients: capsule.recipients.map(r => ({ email: r.email, codeHash: r.codeHash })),
      data: capsule.data
    };
    return await this.sha256(dataToHash);
  },

  async verifyIntegrity(capsule) {
    if (!capsule.integrity || !capsule.integrity.hash) {
      return { valid: false, error: '缺少完整性校验数据' };
    }
    
    try {
      const calculatedHash = await this.generateIntegrityHash(capsule);
      const valid = calculatedHash === capsule.integrity.hash;
      return {
        valid,
        error: valid ? null : '数据完整性校验失败，文件可能已被篡改'
      };
    } catch (e) {
      return { valid: false, error: '完整性校验过程出错: ' + e.message };
    }
  },

  async hashExtractCode(code) {
    return await this.sha256(code.toUpperCase());
  },

  async verifyExtractCode(code, expectedHash) {
    const actualHash = await this.hashExtractCode(code);
    return actualHash === expectedHash;
  },

  async hmac(key, data) {
    let keyBuffer;
    if (typeof key === 'string') {
      keyBuffer = FileUtils.stringToArrayBuffer(key);
    } else if (key instanceof ArrayBuffer) {
      keyBuffer = key;
    } else {
      keyBuffer = FileUtils.stringToArrayBuffer(JSON.stringify(key));
    }

    let dataBuffer;
    if (typeof data === 'string') {
      dataBuffer = FileUtils.stringToArrayBuffer(data);
    } else if (data instanceof ArrayBuffer) {
      dataBuffer = data;
    } else {
      dataBuffer = FileUtils.stringToArrayBuffer(JSON.stringify(data));
    }

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    return this.bufferToHex(signature);
  }
};

window.HashUtils = HashUtils;
