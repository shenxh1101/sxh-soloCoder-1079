const CapsuleModel = {
  VERSION: '1.0',

  create({
    title,
    message,
    creator,
    unlockAt,
    recipients = [],
    isPublic = false,
    encryption = 'AES-GCM'
  }) {
    const now = TimeUtils.getCurrentTimestamp();
    const id = TimeUtils.generateUUID();

    const capsule = {
      id,
      version: this.VERSION,
      meta: {
        title: title || '时间胶囊',
        creator: creator || '匿名用户',
        createdAt: now,
        unlockAt,
        isPublic,
        encryption: {
          algorithm: encryption,
          keySeed: now ^ unlockAt,
          iterations: KeyGenerator.ITERATIONS
        }
      },
      recipients: [],
      data: null,
      integrity: null
    };

    return capsule;
  },

  async finalize(capsule, message, recipients) {
    const processedRecipients = [];
    const recipientCodes = [];

    for (const recipient of recipients) {
      const code = TimeUtils.generateRandomCode(8);
      const codeHash = await HashUtils.hashExtractCode(code);
      
      processedRecipients.push({
        email: recipient,
        codeHash
      });
      
      recipientCodes.push({
        email: recipient,
        code
      });
    }

    capsule.recipients = processedRecipients;

    const encryptedData = await AESUtils.encryptCapsuleMessage(capsule, message);
    capsule.data = encryptedData;

    const integrityHash = await HashUtils.generateIntegrityHash(capsule);
    capsule.integrity = {
      hash: integrityHash,
      algorithm: 'SHA-256'
    };

    return { capsule, recipientCodes };
  },

  validate(capsule) {
    const errors = [];

    if (!capsule.id) errors.push('缺少胶囊ID');
    if (!capsule.version) errors.push('缺少版本信息');
    if (!capsule.meta) {
      errors.push('缺少元数据');
    } else {
      if (!capsule.meta.title) errors.push('缺少标题');
      if (!capsule.meta.creator) errors.push('缺少创建者');
      if (!capsule.meta.createdAt) errors.push('缺少创建时间');
      if (!capsule.meta.unlockAt) errors.push('缺少解锁时间');
      if (!capsule.meta.encryption) errors.push('缺少加密信息');
    }
    if (!capsule.recipients || capsule.recipients.length === 0) {
      errors.push('缺少接收者');
    }
    if (!capsule.data) {
      errors.push('缺少加密数据');
    } else {
      if (!capsule.data.ciphertext) errors.push('缺少密文');
      if (!capsule.data.iv) errors.push('缺少初始向量');
      if (!capsule.data.tag) errors.push('缺少认证标签');
    }
    if (!capsule.integrity || !capsule.integrity.hash) {
      errors.push('缺少完整性校验');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  getRecipientByCodeHash(capsule, codeHash) {
    return capsule.recipients.find(r => r.codeHash === codeHash);
  },

  getRecipientByEmail(capsule, email) {
    return capsule.recipients.find(r => r.email === email);
  },

  getStatus(capsule) {
    const now = TimeUtils.getCurrentTimestamp();
    const unlockAt = capsule.meta.unlockAt;
    
    if (now >= unlockAt) {
      return 'unlocked';
    }
    
    const diff = unlockAt - now;
    if (diff < 3600) {
      return 'soon';
    }
    if (diff < 86400) {
      return 'today';
    }
    return 'locked';
  },

  getStatusText(status) {
    const statusMap = {
      'unlocked': '已解锁',
      'soon': '即将解锁',
      'today': '今日解锁',
      'locked': '已封印'
    };
    return statusMap[status] || '未知';
  },

  toJSON(capsule) {
    return JSON.stringify(capsule, null, 2);
  },

  fromJSON(jsonString) {
    try {
      const capsule = JSON.parse(jsonString);
      const validation = this.validate(capsule);
      if (!validation.valid) {
        throw new Error('胶囊数据无效: ' + validation.errors.join(', '));
      }
      return capsule;
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error('JSON格式错误');
      }
      throw e;
    }
  },

  getPreview(capsule) {
    return {
      id: capsule.id,
      title: capsule.meta.title,
      creator: capsule.meta.creator,
      createdAt: capsule.meta.createdAt,
      unlockAt: capsule.meta.unlockAt,
      isPublic: capsule.meta.isPublic,
      recipientCount: capsule.recipients.length,
      status: this.getStatus(capsule),
      statusText: this.getStatusText(this.getStatus(capsule))
    };
  }
};

window.CapsuleModel = CapsuleModel;
