# 财务App - 环境配置说明

## Firebase配置

### 1. 创建Firebase项目步骤

```
1. 访问 https://console.firebase.google.com
2. 点击"创建项目"
3. 输入项目名称（如：finance-app）
4. 选择地区和配置
5. 点击"创建项目"
```

### 2. 获取配置信息

在Firebase Console中：
1. 项目设置 → 常规
2. 向下滚动找到"你的应用"
3. 选择"Web"(</>) 图标
4. 复制配置对象

### 3. 配置文件位置

编辑 `js/firebase-config.js`：

```javascript
const firebaseConfig = {
    apiKey: "你的 API Key",
    authDomain: "你的项目.firebaseapp.com",
    projectId: "你的项目ID",
    storageBucket: "你的项目.appspot.com",
    messagingSenderId: "你的发送者ID",
    appId: "1:你的数字:web:你的应用ID"
};
```

## 支付集成配置

### 支付宝配置

1. **申请开放平台账户**
   - 访问 https://open.alipay.com
   - 申请支付宝开放平台账户
   - 申请App Pay或Web Pay

2. **获取密钥**
   - 应用ID（App ID）
   - 应用私钥（Private Key）
   - 支付宝公钥（Alipay Public Key）

3. **配置后端**
   ```python
   # 示例：Flask后端
   ALIPAY_APPID = "你的App ID"
   ALIPAY_PRIVATE_KEY = "你的应用私钥"
   ALIPAY_PUBLIC_KEY = "支付宝公钥"
   ```

### 微信支付配置

1. **申请商户号**
   - 访问 https://pay.weixin.qq.com
   - 申请微信支付商户
   - 提交相关资料审核

2. **获取密钥**
   - 商户ID（Merchant ID）
   - API密钥（API Key）
   - API证书

3. **配置后端**
   ```python
   # 示例：Flask后端
   WECHAT_MERCHANT_ID = "你的商户ID"
   WECHAT_API_KEY = "你的API密钥"
   WECHAT_CERT_PATH = "证书路径"
   ```

## 邮件配置（可选）

用于发送订阅确认、收据等邮件：

```javascript
// 在后端配置
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = "你的邮箱@gmail.com"
SMTP_PASSWORD = "你的应用密码"
SENDER_EMAIL = "support@yourapp.com"
```

## 数据库初始化

### Firestore集合结构

```
firestore/
├── users/
│   ├── {userId}/
│   │   ├── displayName: string
│   │   ├── email: string
│   │   ├── phone: string
│   │   ├── plan: string (free/pro_month/pro_year/...)
│   │   ├── subscriptionStatus: string (trial/active/expired/...)
│   │   ├── trialStartDate: timestamp
│   │   ├── subscriptionEndDate: timestamp
│   │   ├── preferences: object
│   │   └── createdAt: timestamp
│
├── transactions/
│   ├── {transactionId}/
│   │   ├── userId: string
│   │   ├── type: string (income/expense)
│   │   ├── amount: number
│   │   ├── category: string
│   │   ├── date: string (YYYY-MM-DD)
│   │   ├── remark: string
│   │   └── timestamp: timestamp
│
├── investments/
│   ├── {investmentId}/
│   │   ├── userId: string
│   │   ├── type: string (stock/fund/...)
│   │   ├── name: string
│   │   ├── buyPrice: number
│   │   ├── quantity: number
│   │   ├── currentPrice: number
│   │   ├── remark: string
│   │   └── timestamp: timestamp
│
├── billing/
│   ├── {billId}/
│   │   ├── userId: string
│   │   ├── orderId: string
│   │   ├── planId: string
│   │   ├── amount: number
│   │   ├── status: string (pending/paid/failed)
│   │   ├── paymentDate: timestamp
│   │   └── description: string
│
└── subscriptions/
    ├── {subId}/
    │   ├── userId: string
    │   ├── planId: string
    │   ├── startDate: timestamp
    │   ├── endDate: timestamp
    │   ├── autoRenew: boolean
    │   └── status: string
```

## 环境变量示例 (.env)

```bash
# Firebase
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id

# 支付宝
ALIPAY_APPID=your_app_id
ALIPAY_PRIVATE_KEY=your_private_key
ALIPAY_PUBLIC_KEY=alipay_public_key

# 微信支付
WECHAT_MERCHANT_ID=merchant_id
WECHAT_API_KEY=api_key

# 邮件
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# 应用配置
NODE_ENV=production
APP_URL=https://your-domain.com
API_URL=https://api.your-domain.com
```

## 部署清单

部署前确保完成以下所有项目：

- [ ] Firebase项目已创建并配置
- [ ] firebase-config.js已更新正确配置
- [ ] Firestore安全规则已设置
- [ ] 支付宝API已集成（如需要）
- [ ] 微信支付API已集成（如需要）
- [ ] 邮件服务已配置
- [ ] 环境变量已设置
- [ ] HTTPS已启用
- [ ] 备份策略已制定
- [ ] 日志系统已配置
- [ ] 性能监控已设置
- [ ] 错误追踪已配置

## 常见问题

**Q: Firebase免费配额够用吗？**
A: Firebase免费配额足以支持小型应用。超出配额后自动付费。

**Q: 需要自建后端吗？**
A: 不一定。小规模应用可以使用Firebase Cloud Functions。大规模应用建议自建后端。

**Q: 如何处理支付退款？**
A: 在Firebase中记录退款记录，在支付宝/微信后台发起退款。

**Q: 用户数据怎么备份？**
A: 启用Firebase自动备份，定期导出Firestore数据。

## 获取帮助

- Firebase文档：https://firebase.google.com/docs
- 支付宝接口文档：https://open.alipay.com/api
- 微信支付文档：https://pay.weixin.qq.com/wiki

---

最后更新：2024年6月
