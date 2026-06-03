// ============================================
// 定价页面逻辑
// ============================================

class PricingPage {
    constructor() {
        this.billingMode = 'month'; // 'month' 或 'year'
        this.setupEventListeners();
        this.loadUserSubscription();
    }

    setupEventListeners() {
        // 计费周期切换
        const billingToggle = document.getElementById('billingToggle');
        if (billingToggle) {
            billingToggle.addEventListener('click', () => this.toggleBillingMode());
        }

        // 订阅按钮
        const proButton = document.getElementById('proButton');
        const entButton = document.getElementById('entButton');
        
        if (proButton) {
            proButton.addEventListener('click', () => this.handleSubscribe('pro'));
        }
        if (entButton) {
            entButton.addEventListener('click', () => this.handleSubscribe('enterprise'));
        }
    }

    // 切换计费模式
    toggleBillingMode() {
        const toggle = document.getElementById('billingToggle');
        
        if (this.billingMode === 'month') {
            this.billingMode = 'year';
            toggle.classList.add('active');
            this.updatePrices('year');
        } else {
            this.billingMode = 'month';
            toggle.classList.remove('active');
            this.updatePrices('month');
        }
    }

    // 更新价格显示
    updatePrices(mode) {
        if (mode === 'month') {
            // 月付模式
            document.getElementById('proMonthPrice').textContent = '¥9.9';
            document.getElementById('proMonthPrice').querySelector('span').textContent = '/月';
            document.getElementById('proYearlyInfo').style.display = 'none';

            document.getElementById('entMonthPrice').textContent = '¥29.9';
            document.getElementById('entMonthPrice').querySelector('span').textContent = '/月';
            document.getElementById('entYearlyInfo').style.display = 'none';
        } else {
            // 年付模式
            document.getElementById('proMonthPrice').textContent = '¥99';
            document.getElementById('proMonthPrice').querySelector('span').textContent = '/年';
            document.getElementById('proYearlyInfo').style.display = 'block';

            document.getElementById('entMonthPrice').textContent = '¥299';
            document.getElementById('entMonthPrice').querySelector('span').textContent = '/年';
            document.getElementById('entYearlyInfo').style.display = 'block';
        }
    }

    // 处理订阅
    async handleSubscribe(planType) {
        if (!isAuthenticated()) {
            alert('请先登录');
            window.location.href = 'login.html';
            return;
        }

        const planId = this.billingMode === 'month' 
            ? `${planType}_month` 
            : `${planType}_year`;

        try {
            // 显示支付方式选择
            this.showPaymentMethodModal(planId);
        } catch (error) {
            console.error('订阅失败:', error);
            alert('❌ 订阅失败：' + error.message);
        }
    }

    // 显示支付方式选择模态框
    showPaymentMethodModal(planId) {
        const modal = document.createElement('div');
        modal.className = 'payment-modal';
        modal.innerHTML = `
            <div class="payment-modal-content">
                <div class="modal-header">
                    <h3>选择支付方式</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="modal-body">
                    <button class="payment-option" onclick="paymentManager.initAlipayPayment('${planId}')">
                        <div class="payment-icon">💳</div>
                        <div class="payment-name">支付宝支付</div>
                        <p>快速安全的在线支付</p>
                    </button>
                    <button class="payment-option" onclick="paymentManager.initWechatPayment('${planId}')">
                        <div class="payment-icon">📱</div>
                        <div class="payment-name">微信支付</div>
                        <p>扫码快速完成支付</p>
                    </button>
                </div>
                <div class="modal-footer">
                    <p class="security-note">🔒 所有交易安全加密，支持退款承诺</p>
                </div>
            </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .payment-modal {
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
            .payment-modal-content {
                background: white;
                border-radius: 12px;
                padding: 0;
                min-width: 400px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                overflow: hidden;
            }
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #ddd;
            }
            .close-btn {
                background: none;
                border: none;
                font-size: 1.5em;
                cursor: pointer;
                color: #999;
            }
            .modal-body {
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            .payment-option {
                border: 2px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                background: white;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 15px;
                text-align: left;
            }
            .payment-option:hover {
                border-color: #667eea;
                background: #f5f5ff;
                transform: translateY(-2px);
            }
            .payment-icon {
                font-size: 2em;
                flex-shrink: 0;
            }
            .payment-name {
                font-weight: bold;
                color: #333;
                margin-bottom: 5px;
            }
            .payment-option p {
                font-size: 0.85em;
                color: #999;
                margin: 0;
            }
            .modal-footer {
                padding: 20px;
                border-top: 1px solid #ddd;
                background: #f9f9f9;
            }
            .security-note {
                text-align: center;
                font-size: 0.9em;
                color: #666;
                margin: 0;
            }
            @media (max-width: 480px) {
                .payment-modal-content {
                    min-width: auto;
                    width: 90%;
                }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(modal);
    }

    // 加载用户订阅信息
    async loadUserSubscription() {
        if (!isAuthenticated()) return;

        try {
            const userId = getCurrentUserId();
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();

            if (!userData) return;

            // 更新按钮状态
            this.updateButtonStates(userData.plan);

            // 显示试用信息
            if (userData.subscriptionStatus === 'trial') {
                this.showTrialInfo(userData.trialStartDate);
            }
        } catch (error) {
            console.error('加载订阅信息失败:', error);
        }
    }

    // 更新按钮状态
    updateButtonStates(currentPlan) {
        const proButton = document.getElementById('proButton');
        const entButton = document.getElementById('entButton');

        if (proButton) {
            if (currentPlan.includes('pro')) {
                proButton.textContent = '当前套餐';
                proButton.disabled = true;
                proButton.classList.add('btn-disabled');
            }
        }

        if (entButton) {
            if (currentPlan.includes('enterprise')) {
                entButton.textContent = '当前套餐';
                entButton.disabled = true;
                entButton.classList.add('btn-disabled');
            }
        }
    }

    // 显示试用信息
    showTrialInfo(trialStartDate) {
        const trialEnd = new Date(trialStartDate.toDate().getTime() + 7 * 24 * 60 * 60 * 1000);
        const today = new Date();
        const daysLeft = Math.max(0, Math.ceil((trialEnd - today) / (24 * 60 * 60 * 1000)));

        // 计算进度
        const totalDays = 7;
        const usedDays = totalDays - daysLeft;
        const progress = (usedDays / totalDays) * 100;

        // 更新HTML
        document.getElementById('trialDays').textContent = daysLeft;
        document.getElementById('trialProgress').style.width = progress + '%';

        // 如果试用期快要结束，显示提示
        if (daysLeft <= 2) {
            const trialInfo = document.getElementById('trialInfo');
            if (trialInfo) {
                trialInfo.style.backgroundColor = '#ffebee';
                trialInfo.style.borderLeftColor = '#f44336';
            }
        }
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 等待Firebase初始化
    setTimeout(() => {
        new PricingPage();
        console.log('✅ 定价页面已初始化');
    }, 1000);
});
