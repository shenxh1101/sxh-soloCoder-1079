const AESUtils = {
  async encrypt(plaintext, key) {
    const iv = KeyGenerator.generateIV();
    const encoded = FileUtils.stringToArrayBuffer(plaintext);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoded
    );
    
    const ciphertext = encrypted.slice(0, -16);
    const tag = encrypted.slice(-16);
    
    return {
      ciphertext: FileUtils.arrayBufferToBase64(ciphertext),
      iv: FileUtils.arrayBufferToBase64(iv.buffer),
      tag: FileUtils.arrayBufferToBase64(tag)
    };
  },

  async decrypt(encryptedData, key) {
    try {
      const iv = new Uint8Array(FileUtils.base64ToArrayBuffer(encryptedData.iv));
      const ciphertext = FileUtils.base64ToArrayBuffer(encryptedData.ciphertext);
      const tag = FileUtils.base64ToArrayBuffer(encryptedData.tag);
      
      const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
      combined.set(new Uint8Array(ciphertext), 0);
      combined.set(new Uint8Array(tag), ciphertext.byteLength);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        combined.buffer
      );
      
      return FileUtils.arrayBufferToString(decrypted);
    } catch (e) {
      throw new Error('解密失败，请检查提取码是否正确或时间是否已到');
    }
  },

  async encryptCapsuleMessage(capsule, message) {
    const key = await KeyGenerator.generateCapsuleKey(capsule);
    return await this.encrypt(message, key);
  },

  async decryptCapsuleMessage(capsule, extractCode) {
    if (!KeyGenerator.canDecrypt(capsule)) {
      throw new Error('尚未到达解锁时间，无法解密');
    }
    
    const codeHash = await HashUtils.hashExtractCode(extractCode);
    const matchedRecipient = capsule.recipients.find(r => r.codeHash === codeHash);
    
    if (!matchedRecipient) {
      throw new Error('提取码错误');
    }
    
    const key = await KeyGenerator.generateCapsuleKey(capsule);
    return await this.decrypt(capsule.data, key);
  },

  async decryptCapsuleWithKey(capsule, key) {
    if (!KeyGenerator.canDecrypt(capsule)) {
      throw new Error('尚未到达解锁时间，无法解密');
    }
    
    return await this.decrypt(capsule.data, key);
  },

  async testEncryption() {
    try {
      const testKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      const plaintext = '这是一条测试消息';
      const encrypted = await this.encrypt(plaintext, testKey);
      const decrypted = await this.decrypt(encrypted, testKey);
      
      return decrypted === plaintext;
    } catch (e) {
      console.error('加密测试失败:', e);
      return false;
    }
  }
};

window.AESUtils = AESUtils;
