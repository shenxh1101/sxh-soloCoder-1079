const KeyGenerator = {
  ITERATIONS: 100000,
  KEY_LENGTH: 256,

  async generateKeyFromTimestamps(createTimestamp, unlockTimestamp, capsuleId) {
    const seed = createTimestamp ^ unlockTimestamp;
    const seedString = seed.toString() + capsuleId;
    
    const salt = await HashUtils.sha256(capsuleId);
    const saltBuffer = FileUtils.stringToArrayBuffer(salt);
    
    const passwordBuffer = FileUtils.stringToArrayBuffer(seedString);
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      this.KEY_LENGTH
    );
    
    const aesKey = await crypto.subtle.importKey(
      'raw',
      derivedBits,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    
    return aesKey;
  },

  async generateKeyFromString(password, salt) {
    const passwordBuffer = FileUtils.stringToArrayBuffer(password);
    const saltBuffer = typeof salt === 'string' 
      ? FileUtils.stringToArrayBuffer(salt) 
      : salt;
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      this.KEY_LENGTH
    );
    
    const aesKey = await crypto.subtle.importKey(
      'raw',
      derivedBits,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    
    return aesKey;
  },

  generateIV() {
    return crypto.getRandomValues(new Uint8Array(12));
  },

  async generateCapsuleKey(capsule) {
    return await this.generateKeyFromTimestamps(
      capsule.meta.createdAt,
      capsule.meta.unlockAt,
      capsule.id
    );
  },

  canDecrypt(capsule) {
    return TimeUtils.isDateUnlocked(capsule.meta.unlockAt);
  },

  async verifyKey(capsule, key) {
    try {
      const testData = new TextEncoder().encode('test');
      const iv = this.generateIV();
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        testData
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
      return new TextDecoder().decode(decrypted) === 'test';
    } catch (e) {
      return false;
    }
  }
};

window.KeyGenerator = KeyGenerator;
