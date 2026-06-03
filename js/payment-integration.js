// ============================================
// 支付集成模块 (支付宝 & 微信)
// ============================================

// 🎉 创始人/测试者绿色通道 - 绝对VIP权限
const FOUNDER_MODE = true; // 创始人模式开关
const VIP_MODE = true; // VIP权限开关
const BYPASS_PAYMENT = true; // 绕过支付检查

class PaymentManager {
    constructor() {
        this.plans = {
            free: { name: '免费版', price: 0, period: 'lifetime' },
            pro_month: { name: '专业版', price: 9.9, period: 'month' },
            pro_year: { name: '专业版年卡', price: 99, period: 'year' },
            enterprise_month: { name: '企业版', price: 29.9, period: 'month' },
            enterprise_year: { name: '企业版年卡', price: 299, period: 'year' }
        };

        // 🎉 创始人模式：自动激活VIP
        if (FOUNDER_MODE || VIP_MODE) {
            console.log('🎉 创始人模式：支付管理器已激活VIP权限');
        }
    }

    // ============ 支付宝支付 ============
    
    /**
     * 初始化支付宝支付
     * 实际项目中需要调用后端API获取订单信息
     */
    async initAlipayPayment(planId) {
        // 🎉 创始人模式：跳过支付，直接激活VIP
        if (FOUNDER_MODE || BYPASS_PAYMENT) {
            console.log('🎉 创始人模式：跳过支付宝支付，直接激活VIP');
            await this.updateUserPlan('premium');
            alert('🎉 创始人模式：VIP权限已激活！无需支付');
            return;
        }

        const plan = this.plans[planId];
        if (!plan) {
            alert('❌ 订阅计划不存在');
            return;
        }

        if (plan.price === 0) {
            await this.updateUserPlan('free');
            alert('✅ 已升级为免费版');
            return;
        }

        try {
            // 调用后端API创建订单
            const response = await this.createPaymentOrder(planId, 'alipay');

            if (response.success) {
                // 在新窗口打开支付宝支付页面
                window.open(response.paymentUrl, '_blank');

                // 轮询检查支付状态
                this.pollPaymentStatus(response.orderId, 'alipay');
            }
        } catch (error) {
            console.error('❌ 支付宝支付初始化失败:', error);
            alert('❌ 初始化支付失败：' + error.message);
        }
    }

    // ============ 微信支付 ============

    /**
     * 初始化微信支付
     */
    async initWechatPayment(planId) {
        // 🎉 创始人模式：跳过支付，直接激活VIP
        if (FOUNDER_MODE || BYPASS_PAYMENT) {
            console.log('🎉 创始人模式：跳过微信支付，直接激活VIP');
            await this.updateUserPlan('premium');
            alert('🎉 创始人模式：VIP权限已激活！无需支付');
            return;
        }

        const plan = this.plans[planId];
        if (!plan) {
            alert('❌ 订阅计划不存在');
            return;
        }

        if (plan.price === 0) {
            await this.updateUserPlan('free');
            alert('✅ 已升级为免费版');
            return;
        }

        try {
            // 调用后端API创建订单
            const response = await this.createPaymentOrder(planId, 'wechat');

            if (response.success) {
                // 显示微信支付二维码
                this.showWechatQRCode(response.qrCode, response.orderId);
            }
        } catch (error) {
            console.error('❌ 微信支付初始化失败:', error);
            alert('❌ 初始化支付失败：' + error.message);
        }
    }

    // ============ 订单创建 ============

    /**
     * 创建支付订单
     * 实际项目中需要调用你的后端API
     */
    async createPaymentOrder(planId, method) {
        // 这是一个示例实现
        // 实际项目中应该调用你的后端服务
        
        const userId = getCurrentUserId();
        const plan = this.plans[planId];

        try {
            // 示例：调用后端API
            // const response = await fetch('/api/create-order', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({
            //         userId,
            //         planId,
            //         amount: plan.price,
            //         method,
            //         currency: 'CNY'
            //     })
            // });
            // return await response.json();

            // 本地演示返回
            return {
                success: true,
                orderId: 'ORDER_' + Date.now(),
                planId: planId,
                amount: plan.price,
                method: method,
                paymentUrl: '#', // 实际应该是真实的支付URL
                qrCode: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCBmaWxsPSJ3aGl0ZSIgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiLz48L3N2Zz4='
            };
        } catch (error) {
            throw error;
        }
    }

    // ============ 支付状态检查 ============

    /**
     * 轮询检查支付状态
     */
    pollPaymentStatus(orderId, method, maxRetries = 60) {
        let retries = 0;
        const pollInterval = setInterval(async () => {
            try {
                const status = await this.checkPaymentStatus(orderId, method);
                
                if (status.paid) {
                    clearInterval(pollInterval);
                    alert('✅ 支付成功！');
                    await this.activateSubscription(orderId, status.planId);
                    window.location.href = 'account.html';
                } else if (status.failed) {
                    clearInterval(pollInterval);
                    alert('❌ 支付失败，请重试');
                }
                
                retries++;
                if (retries >= maxRetries) {
                    clearInterval(pollInterval);
                    alert('⏱️ 支付超时，请稍后在账户页面检查');
                }
            } catch (error) {
                console.error('检查支付状态失败:', error);
            }
        }, 2000); // 每2秒检查一次
    }

    /**
     * 检查支付状态
     */
    async checkPaymentStatus(orderId, method) {
        // 这是一个示例实现
        // 实际项目中应该调用你的后端API
        
        try {
            // 示例：调用后端API
            // const response = await fetch(`/api/check-payment/${orderId}`, {
            //     method: 'GET',
            //     headers: { 'Content-Type': 'application/json' }
            // });
            // return await response.json();

            // 本地演示返回
            return {
                paid: false,
                failed: false,
                status: 'pending'
            };
        } catch (error) {
            throw error;
        }
    }

    // ============ 激活订阅 ============

    /**
     * 激活订阅
     */
    async activateSubscription(orderId, planId) {
        const userId = getCurrentUserId();
        const plan = this.plans[planId];

        try {
            // 更新用户订阅信息
            await db.collection('users').doc(userId).update({
                plan: planId,
                subscriptionStatus: 'active',
                subscriptionStartDate: new Date(),
                subscriptionEndDate: this.calculateEndDate(plan.period),
                lastPaymentDate: new Date(),
                lastPaymentId: orderId,
                autoRenew: true,
                updatedAt: new Date()
            });

            // 创建账单记录
            await db.collection('billing').add({
                userId: userId,
                orderId: orderId,
                planId: planId,
                amount: plan.price,
                currency: 'CNY',
                status: 'paid',
                paymentDate: new Date(),
                period: plan.period,
                description: `购买${plan.name}`
            });

            console.log('✅ 订阅已激活:', planId);
        } catch (error) {
            console.error('❌ 激活订阅失败:', error);
            throw error;
        }
    }

    /**
     * 计算订阅结束日期
     */
    calculateEndDate(period) {
        const now = new Date();
        const endDate = new Date(now);

        switch (period) {
            case 'month':
                endDate.setMonth(endDate.getMonth() + 1);
                break;
            case 'year':
                endDate.setFullYear(endDate.getFullYear() + 1);
                break;
            case 'lifetime':
                endDate.setFullYear(endDate.getFullYear() + 100);
                break;
        }

        return endDate;
    }

    // ============ 显示微信二维码 ============

    /**
     * 显示微信支付二维码
     */
    showWechatQRCode(qrCodeUrl, orderId) {
        const modal = document.createElement('div');
        modal.className = 'wechat-modal';
        modal.innerHTML = `
            <div class="wechat-modal-content">
                <div class="wechat-modal-header">
                    <h3>微信支付</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="wechat-modal-body">
                    <p>请使用微信扫描二维码支付</p>
                    <img src="${qrCodeUrl}" alt="微信支付二维码" class="qr-code">
                    <p class="hint">扫码后请在微信中完成支付</p>
                </div>
                <div class="wechat-modal-footer">
                    <p>订单号: ${orderId}</p>
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.remove()">返回</button>
                </div>
            </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .wechat-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }
            .wechat-modal-content {
                background: white;
                border-radius: 12px;
                padding: 30px;
                text-align: center;
                max-width: 400px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            }
            .wechat-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            .close-btn {
                background: none;
                border: none;
                font-size: 1.5em;
                cursor: pointer;
                color: #999;
            }
            .qr-code {
                max-width: 250px;
                margin: 20px 0;
            }
            .hint {
                color: #999;
                font-size: 0.9em;
            }
            .wechat-modal-footer {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(modal);
    }

    // ============ 订阅管理 ============

    /**
     * 更新用户套餐
     */
    async updateUserPlan(planId) {
        const userId = getCurrentUserId();
        
        try {
            await db.collection('users').doc(userId).update({
                plan: planId,
                updatedAt: new Date()
            });
            console.log('✅ 套餐已更新:', planId);
        } catch (error) {
            console.error('❌ 更新套餐失败:', error);
            throw error;
        }
    }

    /**
     * 取消订阅
     */
    async cancelSubscription() {
        const userId = getCurrentUserId();
        
        if (!confirm('确定要取消订阅吗？取消后你可以继续使用到期末日')) {
            return;
        }

        try {
            await db.collection('users').doc(userId).update({
                subscriptionStatus: 'cancelled',
                autoRenew: false,
                cancellationDate: new Date(),
                updatedAt: new Date()
            });

            alert('✅ 订阅已取消，你可以继续使用到期末日');
            window.location.reload();
        } catch (error) {
            console.error('❌ 取消订阅失败:', error);
            alert('❌ 取消失败，请重试');
        }
    }

    /**
     * 检查订阅状态
     */
    async checkSubscriptionStatus(userId) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();

            if (!userData) return null;

            // 检查试用期
            if (userData.subscriptionStatus === 'trial') {
                const trialStart = userData.trialStartDate.toDate();
                const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
                const today = new Date();

                if (today > trialEnd) {
                    // 试用期已结束
                    await db.collection('users').doc(userId).update({
                        subscriptionStatus: 'expired'
                    });
                    return { status: 'expired', message: '试用期已结束' };
                } else {
                    const daysLeft = Math.ceil((trialEnd - today) / (24 * 60 * 60 * 1000));
                    return { status: 'trial', daysLeft };
                }
            }

            // 检查付费订阅
            if (userData.subscriptionStatus === 'active') {
                const endDate = userData.subscriptionEndDate.toDate();
                const today = new Date();

                if (today > endDate) {
                    await db.collection('users').doc(userId).update({
                        subscriptionStatus: 'expired'
                    });
                    return { status: 'expired', message: '订阅已过期' };
                } else {
                    return { status: 'active', endDate };
                }
            }

            return { status: userData.subscriptionStatus };
        } catch (error) {
            console.error('检查订阅状态失败:', error);
            return null;
        }
    }
}

// 创建全局支付管理器实例
const paymentManager = new PaymentManager();

console.log('✅ 支付管理器已初始化');
