// ============================================
// 财务管理应用 - 主程序 (Firebase多用户版)
// ============================================

// Firebase配置 - 真实多用户云端沙盒架构
const firebaseConfig = {
  apiKey: "AIzaSyCbthAUQebVR4YyFFLC4eeorFg2uc3qw5c",
  authDomain: "test-b96f4.firebaseapp.com",
  projectId: "test-b96f4",
  storageBucket: "test-b96f4.firebasestorage.app",
  messagingSenderId: "453498752569",
  appId: "1:453498752569:web:d4ab213b85d880b03747e8",
  measurementId: "G-BR98Q414HH"
};

// Firebase相关变量
let auth = null;
let db = null;
let currentUser = null;

// 初始化Firebase
function initFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();

        // 监听认证状态变化
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                // 从Firestore获取用户完整数据
                await loadUserData(user.uid);
                // 隐藏登录遮罩
                document.getElementById('loginOverlay').style.display = 'none';
                console.log('✅ 用户已登录:', user.email);

                // 初始化应用UI
                if (window.appInstance) {
                    window.appInstance.checkAuth();
                }
            } else {
                currentUser = null;
                // 显示登录遮罩
                document.getElementById('loginOverlay').style.display = 'flex';
                console.log('⚠️ 用户未登录');
            }
        });

        console.log('✅ Firebase初始化成功');
    } catch (error) {
        console.error('❌ Firebase初始化失败:', error);
        alert('Firebase初始化失败，请检查配置');
    }
}

// 从Firestore加载用户数据
async function loadUserData(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            // 扩展currentUser对象
            Object.assign(currentUser, userData);
            console.log('✅ 用户数据已加载:', userData);
        } else {
            console.log('⚠️ 用户数据不存在，将创建新用户数据');
            await createUserData(uid, currentUser.email);
        }
    } catch (error) {
        console.error('❌ 加载用户数据失败:', error);
    }
}

// 创建新用户数据（默认VIP）
async function createUserData(uid, email) {
    try {
        const userData = {
            uid: uid,
            email: email,
            displayName: email.split('@')[0],
            isVIP: true, // 新注册用户默认VIP
            vipLevel: 'Premium',
            permissions: {
                'investment': true,
                'reports': true,
                'realtime_stock': true,
                'portfolio_analysis': true,
                'advanced_charts': true
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(uid).set(userData);
        Object.assign(currentUser, userData);
        console.log('✅ 用户数据已创建:', userData);
    } catch (error) {
        console.error('❌ 创建用户数据失败:', error);
    }
}

// 认证相关函数
function isAuthenticated() {
    return currentUser !== null;
}

function getCurrentUserId() {
    return currentUser ? currentUser.uid : null;
}

// VIP权限检查 - 从Firestore用户数据读取
function isVIP() {
    if (!currentUser) return false;
    // 从Firebase用户数据中读取VIP状态
    return currentUser.isVIP === true;
}

// 权限检查 - 从Firestore用户数据读取
function hasPermission(feature) {
    if (!currentUser) return false;
    // VIP用户拥有所有权限
    if (currentUser.isVIP === true) return true;
    // 检查特定功能权限
    const permissions = currentUser.permissions || {};
    return permissions[feature] === true;
}

// 数据存储管理
class FinanceApp {
    constructor() {
        this.transactions = [];
        this.investments = [];
        this.currentFilter = 'all';
        this.userPlan = 'free';

        // 初始化Firebase
        initFirebase();
    }

    // 检查认证状态
    checkAuth() {
        if (!isAuthenticated()) {
            console.log('⚠️ 用户未登录，等待登录...');
            return;
        }

        // 继续初始化
        this.loadUserPlan();
        this.init();
    }

    // 加载用户套餐信息
    async loadUserPlan() {
        try {
            if (!isAuthenticated()) {
                this.userPlan = 'free';
                return;
            }

            // 从Firestore读取用户套餐
            const uid = getCurrentUserId();
            const userDoc = await db.collection('users').doc(uid).get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                this.userPlan = userData.isVIP ? 'premium' : 'free';
            } else {
                this.userPlan = 'free';
            }
        } catch (error) {
            console.error('加载用户套餐失败:', error);
            this.userPlan = 'free';
        }
    }

    // 检查试用期状态（Firebase模式）
    async checkTrialStatus(userData) {
        if (userData.subscriptionStatus !== 'trial') return;

        const trialStart = new Date(userData.trialStartDate);
        const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const today = new Date();

        if (today > trialEnd) {
            // 试用期已结束，降级为免费版
            userData.subscriptionStatus = 'expired';
            userData.plan = 'free';
            // 更新Firestore中的用户数据
            if (isAuthenticated()) {
                const uid = getCurrentUserId();
                await db.collection('users').doc(uid).update(userData);
            }
            this.userPlan = 'free';
        }
    }

    // 初始化应用
    async init() {
        // 从Firestore加载数据
        if (isAuthenticated()) {
            this.transactions = await this.loadDataFromFirestore('transactions');
            this.investments = await this.loadDataFromFirestore('investments');
        }

        // 无条件执行UI初始化
        this.setCurrentDate();
        this.setupEventListeners();
        this.updateDashboard();
        this.renderTransactions();
        this.renderInvestments();
        this.updateVIPStatus();

        console.log('✅ 应用UI初始化完成');
    }

    // 从Firestore加载数据
    async loadDataFromFirestore(collectionName) {
        if (!isAuthenticated()) return [];

        try {
            const uid = getCurrentUserId();
            const snapshot = await db.collection('users').doc(uid).collection(collectionName).get();

            const data = [];
            snapshot.forEach(doc => {
                data.push(doc.data());
            });

            if (data.length === 0) {
                console.log(`📝 新用户，云端暂无${collectionName}数据`);
            } else {
                console.log(`✅ 从Firestore加载${collectionName}:`, data.length, '条记录');
            }

            return data;
        } catch (error) {
            console.error(`❌ 加载${collectionName}失败:`, error);
            return [];
        }
    }

    // 保存数据到Firestore
    async saveDataToFirestore(collectionName, data) {
        if (!isAuthenticated()) return;

        try {
            const uid = getCurrentUserId();
            const batch = db.batch();

            // 删除旧数据
            const oldSnapshot = await db.collection('users').doc(uid).collection(collectionName).get();
            oldSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            // 添加新数据
            data.forEach(item => {
                const docRef = db.collection('users').doc(uid).collection(collectionName).doc(item.id.toString());
                batch.set(docRef, item);
            });

            await batch.commit();
            console.log(`✅ 保存${collectionName}到Firestore:`, data.length, '条记录');
        } catch (error) {
            console.error(`❌ 保存${collectionName}失败:`, error);
        }
    }

    // 更新VIP状态显示
    updateVIPStatus() {
        const vipStatusElement = document.getElementById('vipStatus');
        if (vipStatusElement) {
            if (isAuthenticated() && isVIP()) {
                vipStatusElement.style.display = 'inline';
                vipStatusElement.textContent = `🌟 尊贵会员 (${currentUser.displayName || currentUser.email})`;
                console.log('🌟 VIP状态已显示:', currentUser.email);
            } else {
                vipStatusElement.style.display = 'none';
            }
        }
    }

    // 检查功能限制
    checkFeatureLimits() {
        // VIP用户跳过所有限制
        if (isVIP()) {
            console.log('🎉 VIP用户：跳过功能限制检查');
            return;
        }

        if (this.userPlan === 'free') {
            // 免费版限制提示
            this.showUpgradePrompt();
        }
    }

    // 显示升级提示
    showUpgradePrompt() {
        const banner = document.createElement('div');
        banner.className = 'upgrade-banner';
        banner.innerHTML = `
            <div class="upgrade-content">
                <span>✨ 升级到专业版解锁更多功能</span>
                <button class="btn btn-upgrade" onclick="window.location.href='pricing.html'">
                    立即升级
                </button>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .upgrade-banner {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: sticky;
                top: 0;
                z-index: 100;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .upgrade-content {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .btn-upgrade {
                background: white;
                color: #667eea;
                padding: 8px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.3s ease;
            }
            .btn-upgrade:hover {
                transform: scale(1.05);
            }
        `;
        document.head.appendChild(style);
        document.querySelector('.main-content').insertBefore(banner, document.querySelector('.main-content').firstChild);
    }

    // ============ 数据管理 ============

    // 保存数据到Firestore
    async saveData(key, data) {
        if (!isAuthenticated()) return;
        await this.saveDataToFirestore(key, data);
    }

    // 从Firestore读取数据
    async loadData(key) {
        if (!isAuthenticated()) return null;
        return await this.loadDataFromFirestore(key);
    }

    // 同步数据到Firestore
    async syncToFirebase(dataType) {
        if (!isAuthenticated()) return;

        try {
            const data = dataType === 'transactions' ? this.transactions : this.investments;
            await this.saveDataToFirestore(dataType, data);
            console.log(`✅ 数据已同步到Firestore (${dataType})`);
        } catch (error) {
            console.error('同步失败:', error);
        }
    }

    // ============ 事件监听 ============

    setupEventListeners() {
        // 标签页切换 - 修复所有导航按钮
        document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn);
            });
        });

        // 交易表单
        const transForm = document.getElementById('transactionForm');
        if (transForm) {
            transForm.addEventListener('submit', (e) => this.handleAddTransaction(e));
        }

        // 交易过滤
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilterChange(e));
        });

        // 投资表单
        const investForm = document.getElementById('investmentForm');
        if (investForm) {
            investForm.addEventListener('submit', (e) => this.handleAddInvestment(e));
        }

        // 报表时间选择
        const reportMonth = document.getElementById('reportMonth');
        if (reportMonth) {
            reportMonth.addEventListener('change', () => this.updateReports());
        }
    }

    // ============ 标签页管理 ============

    switchTab(btn) {
        // 移除所有active类
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

        // 添加active类
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        const tabElement = document.getElementById(tabId);
        
        if (tabElement) {
            tabElement.classList.add('active');
        }

        // 更新报表
        if (tabId === 'report') {
            setTimeout(() => this.updateReports(), 100);
        }
    }

    // ============ 日期管理 ============

    setCurrentDate() {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        const dateStr = today.toLocaleDateString('zh-CN', options);
        document.getElementById('currentDate').textContent = dateStr;

        // 设置交易日期默认值为今天
        const dateInput = document.getElementById('transDate');
        if (dateInput) {
            dateInput.valueAsDate = today;
        }
    }

    // ============ 交易管理 ============

    // 添加交易
    handleAddTransaction(e) {
        e.preventDefault();

        // 检查免费版限制
        if (this.userPlan === 'free' && this.transactions.length >= 100) {
            alert('❌ 免费版每月限制100条交易\n\n升级到专业版解锁无限制记录');
            window.location.href = 'pricing.html';
            return;
        }

        const transaction = {
            id: Date.now(),
            type: document.getElementById('transType').value,
            amount: parseFloat(document.getElementById('amount').value),
            category: document.getElementById('category').value,
            date: document.getElementById('transDate').value,
            remark: document.getElementById('remark').value,
            timestamp: new Date().getTime()
        };

        this.transactions.unshift(transaction);
        this.saveData('transactions', this.transactions);
        this.syncToFirebase('transactions');
        
        // 重置表单
        e.target.reset();
        this.setCurrentDate();

        // 更新显示
        this.updateDashboard();
        this.renderTransactions();
        alert('✅ 交易记录添加成功！');
    }

    // 处理过滤变化
    handleFilterChange(e) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.getAttribute('data-filter');
        this.renderTransactions();
    }

    // 渲染交易列表
    renderTransactions() {
        const container = document.getElementById('transactionsList');
        if (!container) return;

        let filtered = this.transactions;
        if (this.currentFilter !== 'all') {
            filtered = this.transactions.filter(t => t.type === this.currentFilter);
        }

        if (filtered.length === 0) {
            container.innerHTML = '<p class="empty-message">暂无交易记录</p>';
            return;
        }

        container.innerHTML = filtered.map(trans => `
            <div class="transaction-item ${trans.type}">
                <div class="transaction-info">
                    <div class="transaction-category">
                        ${this.getCategoryEmoji(trans.category)} ${this.getCategoryName(trans.category)}
                    </div>
                    <div class="transaction-meta">
                        ${trans.date} ${trans.remark ? '- ' + trans.remark : ''}
                    </div>
                </div>
                <div class="transaction-amount ${trans.type}">
                    ${trans.type === 'income' ? '+' : '-'} ¥${trans.amount.toFixed(2)}
                </div>
                <button class="btn btn-danger" onclick="app.deleteTransaction(${trans.id})" title="删除">×</button>
            </div>
        `).join('');
    }

    // 删除交易
    deleteTransaction(id) {
        if (confirm('确定要删除这条交易记录吗？')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this.saveData('transactions', this.transactions);
            this.updateDashboard();
            this.renderTransactions();
            alert('✅ 交易记录已删除');
        }
    }

    // ============ 投资管理 ============

    // 添加投资
    handleAddInvestment(e) {
        e.preventDefault();

        // 🎉 VIP模式：跳过所有权限检查
        if (window.currentUser && window.currentUser.isVIP) {
            console.log('🎉 VIP模式：跳过投资组合权限检查');
        } else {
            // 检查专业版限制
            if (this.userPlan === 'free') {
                alert('❌ 免费版不支持投资组合功能\n\n升级到专业版立即使用');
                window.location.href = 'pricing.html';
                return;
            }

            if (this.userPlan === 'pro_month' || this.userPlan === 'pro_year') {
                if (this.investments.length >= 50) {
                    alert('❌ 专业版最多可管理50个投资\n\n升级到企业版获得无限投资');
                    return;
                }
            }
        }

        const investment = {
            id: Date.now(),
            type: document.getElementById('assetType').value,
            name: document.getElementById('assetName').value,
            buyPrice: parseFloat(document.getElementById('buyPrice').value),
            quantity: parseFloat(document.getElementById('quantity').value),
            currentPrice: parseFloat(document.getElementById('currentPrice').value),
            remark: document.getElementById('investRemark').value,
            // 新增市场信息
            market: document.getElementById('stockMarket')?.value || '',
            stockCode: document.getElementById('stockCode')?.value || '',
            // 新增货币和购买时间
            currency: document.getElementById('currency')?.value || 'CNY',
            purchaseDate: document.getElementById('purchaseDate')?.value || new Date().toISOString().split('T')[0],
            timestamp: new Date().getTime()
        };

        this.investments.unshift(investment);
        this.saveData('investments', this.investments);
        this.syncToFirebase('investments');

        // 重置表单
        e.target.reset();

        // 重新设置默认购买时间
        document.getElementById('purchaseDate').valueAsDate = new Date();

        // 更新显示
        this.updateDashboard();
        this.renderInvestments();
        alert('✅ 投资记录添加成功！');
    }

    // 渲染投资列表
    renderInvestments() {
        const container = document.getElementById('investmentListContainer');
        if (!container) return;

        if (this.investments.length === 0) {
            container.innerHTML = '<p class="empty-message">暂无投资记录</p>';
            return;
        }

        // 货币符号映射
        const currencySymbols = {
            'CNY': '¥',
            'USD': '$',
            'HKD': 'HK$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'CAD': 'C$',
            'AUD': 'A$'
        };

        container.innerHTML = this.investments.map(inv => {
            const costValue = inv.buyPrice * inv.quantity;
            const currentValue = inv.currentPrice * inv.quantity;
            const profit = currentValue - costValue;
            const profitRate = ((profit / costValue) * 100).toFixed(2);

            const currency = inv.currency || 'CNY';
            const symbol = currencySymbols[currency] || '¥';

            return `
                <div class="investment-item">
                    <div class="investment-info">
                        <div class="investment-type">${this.getAssetTypeEmoji(inv.type)} ${this.getAssetTypeName(inv.type)}</div>
                        <div class="investment-name">${inv.name}</div>
                        ${inv.market ? `<div class="investment-market" style="font-size: 0.85em; color: var(--text-tertiary); margin-bottom: 8px;">${inv.market} ${inv.stockCode ? '(' + inv.stockCode + ')' : ''} · ${currency}</div>` : ''}
                        ${inv.purchaseDate ? `<div class="investment-date" style="font-size: 0.8em; color: var(--text-tertiary); margin-bottom: 8px;">购买时间: ${inv.purchaseDate}</div>` : ''}
                        <div class="investment-details">
                            <div>买入: ${symbol}${inv.buyPrice.toFixed(2)} × ${inv.quantity}</div>
                            <div>现价: ${symbol}${inv.currentPrice.toFixed(2)}</div>
                            <div>成本: ${symbol}${costValue.toFixed(2)}</div>
                            <div>市值: ${symbol}${currentValue.toFixed(2)}</div>
                        </div>
                        ${inv.remark ? `<div style="margin-top: 8px; color: var(--text-tertiary); font-size: 0.9em;">备注: ${inv.remark}</div>` : ''}
                    </div>
                    <div class="investment-value">
                        <div class="investment-return ${profit >= 0 ? 'positive' : 'negative'}">
                            ${profit >= 0 ? '+' : ''} ${symbol}${profit.toFixed(2)}
                        </div>
                        <div class="investment-return ${profit >= 0 ? 'positive' : 'negative'}" style="font-size: 0.9em;">
                            (${profit >= 0 ? '+' : ''}${profitRate}%)
                        </div>
                    </div>
                    <button class="btn btn-danger" onclick="app.deleteInvestment(${inv.id})" title="删除">×</button>
                </div>
            `;
        }).join('');
    }

    // 删除投资
    deleteInvestment(id) {
        if (confirm('确定要删除这条投资记录吗？')) {
            this.investments = this.investments.filter(i => i.id !== id);
            this.saveData('investments', this.investments);
            this.updateDashboard();
            this.renderInvestments();
            alert('✅ 投资记录已删除');
        }
    }

    // ============ 仪表盘更新 ============

    updateDashboard() {
        this.updateMonthlyStats();
        this.updateInvestmentValue();
        this.updateRecentInvestments();
    }

    // 更新月度统计（简化版，去掉收支统计）
    updateMonthlyStats() {
        // 计算投资统计
        let totalCost = 0;
        let investmentCount = this.investments.length;

        this.investments.forEach(inv => {
            totalCost += inv.buyPrice * inv.quantity;
        });

        // 更新显示
        document.getElementById('investmentCount').textContent = investmentCount;
        document.getElementById('investmentCost').textContent = `¥${totalCost.toFixed(2)}`;
    }

    // 更新投资总值
    updateInvestmentValue() {
        let totalValue = 0;
        let totalCost = 0;
        let totalProfit = 0;

        this.investments.forEach(inv => {
            const costValue = inv.buyPrice * inv.quantity;
            const currentValue = inv.currentPrice * inv.quantity;
            totalCost += costValue;
            totalValue += currentValue;
            totalProfit += (currentValue - costValue);
        });

        document.getElementById('investmentValue').textContent = `¥${totalValue.toFixed(2)}`;
        
        // 显示成本和收益
        const profitRate = totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(2) : 0;
        const profitElement = document.querySelector('#investmentProfit') || this.createProfitDisplay();
        
        if (profitElement) {
            profitElement.textContent = `${totalProfit >= 0 ? '+' : ''}¥${totalProfit.toFixed(2)} (${profitRate}%)`;
            profitElement.style.color = totalProfit >= 0 ? '#4CAF50' : '#f44336';
        }
    }

    createProfitDisplay() {
        const card = document.querySelector('.card-investment');
        if (card) {
            let profitDiv = document.querySelector('#investmentProfit');
            if (!profitDiv) {
                profitDiv = document.createElement('div');
                profitDiv.id = 'investmentProfit';
                profitDiv.style.fontSize = '0.9em';
                profitDiv.style.marginTop = '10px';
                profitDiv.style.opacity = '0.9';
                card.appendChild(profitDiv);
            }
            return profitDiv;
        }
        return null;
    }

    // 更新最近的投资
    updateRecentInvestments() {
        const container = document.getElementById('recentList');
        if (!container) return;

        const recent = this.investments.slice(0, 5);

        if (recent.length === 0) {
            container.innerHTML = '<p class="empty-message">暂无投资记录</p>';
            return;
        }

        container.innerHTML = recent.map(inv => {
            const costValue = inv.buyPrice * inv.quantity;
            const currentValue = inv.currentPrice * inv.quantity;
            const profit = currentValue - costValue;
            const profitRate = ((profit / costValue) * 100).toFixed(2);

            return `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-category">
                            ${this.getAssetTypeEmoji(inv.type)} ${inv.name}
                        </div>
                        <div class="transaction-meta">
                            买入价: ¥${inv.buyPrice.toFixed(2)} × ${inv.quantity}
                        </div>
                    </div>
                    <div class="transaction-amount ${profit >= 0 ? 'income' : 'expense'}">
                        ${profit >= 0 ? '+' : ''}¥${profit.toFixed(2)}<br>
                        <small>(${profitRate}%)</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ============ 报表生成 ============

    updateReports() {
        this.updateMonthlySummary();
        this.generateCategoryChart();
        this.generateTrendChart();
    }

    // 月度汇总
    updateMonthlySummary() {
        const reportMode = document.getElementById('reportMonth')?.value || 'current';
        let months = this.getMonthsData(reportMode);

        let html = '';
        months.forEach(month => {
            const monthStr = month.label;
            const income = month.income;
            const expense = month.expense;
            const balance = income - expense;

            html += `
                <div class="summary-row">
                    <span class="summary-label">${monthStr}</span>
                    <span>收入: ¥${income.toFixed(2)} | 支出: ¥${expense.toFixed(2)} | 结余: <span style="color: ${balance >= 0 ? '#4CAF50' : '#f44336'}; font-weight: bold;">¥${balance.toFixed(2)}</span></span>
                </div>
            `;
        });

        document.getElementById('monthSummary').innerHTML = html || '<p>暂无数据</p>';
    }

    // 生成分类占比图表（简单HTML版本）
    generateCategoryChart() {
        const categories = {};
        this.transactions.forEach(trans => {
            if (trans.type === 'expense') {
                const cat = trans.category;
                categories[cat] = (categories[cat] || 0) + trans.amount;
            }
        });

        let total = Object.values(categories).reduce((a, b) => a + b, 0);
        if (total === 0) {
            document.getElementById('categoryChart').innerHTML = '<p style="text-align: center; padding: 50px;">暂无支出数据</p>';
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
        Object.entries(categories).forEach(([cat, amount]) => {
            const percent = ((amount / total) * 100).toFixed(1);
            html += `
                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>${this.getCategoryName(cat)}</span>
                        <span><strong>¥${amount.toFixed(2)}</strong> (${percent}%)</span>
                    </div>
                    <div style="background-color: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden;">
                        <div style="background-color: #4CAF50; height: 100%; width: ${percent}%;"></div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        document.getElementById('categoryChart').innerHTML = html;
    }

    // 生成收支走势图
    generateTrendChart() {
        const reportMode = document.getElementById('reportMonth')?.value || 'current';
        let months = this.getMonthsData(reportMode);

        let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
        months.forEach(month => {
            const maxValue = Math.max(...months.map(m => Math.max(m.income, m.expense))) || 100;
            const incomePercent = (month.income / maxValue) * 100 || 0;
            const expensePercent = (month.expense / maxValue) * 100 || 0;

            html += `
                <div>
                    <div style="margin-bottom: 8px; font-weight: bold;">${month.label}</div>
                    <div style="display: flex; gap: 10px; margin-bottom: 5px;">
                        <div style="flex: 1;">
                            <div style="background-color: #e0e0e0; height: 25px; border-radius: 5px; overflow: hidden;">
                                <div style="background-color: #4CAF50; height: 100%; width: ${incomePercent}%;"></div>
                            </div>
                            <div style="font-size: 0.85em; color: #666; margin-top: 3px;">收入: ¥${month.income.toFixed(2)}</div>
                        </div>
                        <div style="flex: 1;">
                            <div style="background-color: #e0e0e0; height: 25px; border-radius: 5px; overflow: hidden;">
                                <div style="background-color: #f44336; height: 100%; width: ${expensePercent}%;"></div>
                            </div>
                            <div style="font-size: 0.85em; color: #666; margin-top: 3px;">支出: ¥${month.expense.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        document.getElementById('trendChart').innerHTML = html;
    }

    // 获取月份数据
    getMonthsData(mode) {
        const months = [];
        let count = mode === 'current' ? 1 : mode === 'last3' ? 3 : 12;

        for (let i = count - 1; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const year = date.getFullYear();
            const month = date.getMonth();

            let income = 0, expense = 0;
            this.transactions.forEach(trans => {
                const transDate = new Date(trans.date);
                if (transDate.getFullYear() === year && transDate.getMonth() === month) {
                    if (trans.type === 'income') {
                        income += trans.amount;
                    } else {
                        expense += trans.amount;
                    }
                }
            });

            const monthName = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
            months.push({ label: monthName, income, expense });
        }

        return months;
    }

    // ============ 辅助函数 ============

    // 获取分类名称
    getCategoryName(category) {
        const names = {
            'salary': '工资',
            'food': '餐饮',
            'transport': '交通',
            'shopping': '购物',
            'utilities': '水电煤',
            'other': '其他'
        };
        return names[category] || category;
    }

    // 获取分类emoji
    getCategoryEmoji(category) {
        const emojis = {
            'salary': '💰',
            'food': '🍔',
            'transport': '🚗',
            'shopping': '🛍️',
            'utilities': '💡',
            'other': '📌'
        };
        return emojis[category] || '📌';
    }

    // 获取资产类型名称
    getAssetTypeName(type) {
        const names = {
            'stock': '股票',
            'fund': '基金',
            'bond': '债券',
            'crypto': '加密货币',
            'real-estate': '房产'
        };
        return names[type] || type;
    }

    // 获取资产类型emoji
    getAssetTypeEmoji(type) {
        const emojis = {
            'stock': '📊',
            'fund': '📈',
            'bond': '📋',
            'crypto': '₿',
            'real-estate': '🏠'
        };
        return emojis[type] || '📌';
    }
}

// ============================================
// 初始化应用
// ============================================

let app;
document.addEventListener('DOMContentLoaded', () => {
    // 修复导航图标
    fixNavIcons();

    // 添加股票市场功能
    addStockMarketFeatures();

    try {
        app = new FinanceApp();
        window.appInstance = app; // 存储到全局变量
        console.log('✅ 财务管理应用已初始化');
    } catch (error) {
        console.error('❌ 应用初始化失败:', error);
        // 即使初始化失败，也尝试创建基本功能
        app = new FinanceApp();
        window.appInstance = app;
    }
});

// 修复导航图标 - 将emoji替换为SVG
function fixNavIcons() {
    const icons = {
        'dashboard': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
        'investment': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>',
        'report': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>',
        'upgrade': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
        'account': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        'logout': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>'
    };

    document.querySelectorAll('.nav-btn').forEach(btn => {
        const tab = btn.getAttribute('data-tab');
        const text = btn.textContent.trim();

        // 根据文本内容匹配图标
        let iconKey = null;
        if (text.includes('仪表盘')) iconKey = 'dashboard';
        else if (text.includes('投资组合')) iconKey = 'investment';
        else if (text.includes('报表分析')) iconKey = 'report';
        else if (text.includes('升级')) iconKey = 'upgrade';
        else if (text.includes('我的账户')) iconKey = 'account';
        else if (text.includes('退出')) iconKey = 'logout';

        if (iconKey && icons[iconKey]) {
            // 清空按钮内容并重新添加
            const span = btn.querySelector('span');
            if (span) {
                span.className = 'nav-icon';
                span.innerHTML = icons[iconKey];
            }
        }
    });
}

// 添加股票市场选择和自动获取价格功能
function addStockMarketFeatures() {
    const investmentForm = document.getElementById('investmentForm');
    if (!investmentForm) return;

    // 检查是否已经添加过
    if (document.getElementById('stockMarket')) return;

    // 市场与货币的映射
    const marketCurrencyMap = {
        'A股': 'CNY',
        '港股': 'HKD',
        '美股': 'USD',
        '英股': 'GBP',
        '日股': 'JPY',
        '德股': 'EUR',
        '法股': 'EUR',
        '加股': 'CAD',
        '澳股': 'AUD',
        '其他': 'USD'
    };

    // 在资产类型后添加股票市场选择
    const assetTypeGroup = document.getElementById('assetType').closest('.form-group');
    const marketSelectHTML = `
        <div class="form-group">
            <label>股票市场</label>
            <select id="stockMarket" required onchange="updateCurrencyByMarket()">
                <option value="">选择市场</option>
                <option value="A股">A股 (中国大陆)</option>
                <option value="港股">港股 (香港)</option>
                <option value="美股">美股 (美国)</option>
                <option value="英股">英股 (英国)</option>
                <option value="日股">日股 (日本)</option>
                <option value="德股">德股 (德国)</option>
                <option value="法股">法股 (法国)</option>
                <option value="加股">加股 (加拿大)</option>
                <option value="澳股">澳股 (澳大利亚)</option>
                <option value="其他">其他市场</option>
            </select>
        </div>
    `;

    const marketDiv = document.createElement('div');
    marketDiv.innerHTML = marketSelectHTML;
    assetTypeGroup.parentNode.insertBefore(marketDiv.firstElementChild, assetTypeGroup.nextSibling);

    // 在股票市场后添加货币选择
    const marketGroup = document.getElementById('stockMarket').closest('.form-group');
    const currencySelectHTML = `
        <div class="form-group">
            <label>货币</label>
            <select id="currency" required>
                <option value="">选择货币</option>
                <option value="CNY">人民币 (CNY)</option>
                <option value="USD">美元 (USD)</option>
                <option value="HKD">港币 (HKD)</option>
                <option value="EUR">欧元 (EUR)</option>
                <option value="GBP">英镑 (GBP)</option>
                <option value="JPY">日元 (JPY)</option>
                <option value="CAD">加元 (CAD)</option>
                <option value="AUD">澳元 (AUD)</option>
            </select>
        </div>
    `;

    const currencyDiv = document.createElement('div');
    currencyDiv.innerHTML = currencySelectHTML;
    marketGroup.parentNode.insertBefore(currencyDiv.firstElementChild, marketGroup.nextSibling);

    // 在资产名称后添加股票代码输入框
    const assetNameGroup = document.getElementById('assetName').closest('.form-group');
    const stockCodeHTML = `
        <div class="form-group">
            <label>股票代码</label>
            <input type="text" id="stockCode" placeholder="如：000001、AAPL、0700" required onblur="autoFillStockName()">
        </div>
    `;

    const codeDiv = document.createElement('div');
    codeDiv.innerHTML = stockCodeHTML;
    assetNameGroup.parentNode.insertBefore(codeDiv.firstElementChild, assetNameGroup.nextSibling);

    // 在购入价格前添加购买时间
    const buyPriceGroup = document.getElementById('buyPrice').closest('.form-group');
    const purchaseDateHTML = `
        <div class="form-group">
            <label>购买时间</label>
            <input type="date" id="purchaseDate" required>
        </div>
    `;

    const dateDiv = document.createElement('div');
    dateDiv.innerHTML = purchaseDateHTML;
    buyPriceGroup.parentNode.insertBefore(dateDiv.firstElementChild, buyPriceGroup);

    // 在当前价格后添加自动获取价格按钮
    const currentPriceGroup = document.getElementById('currentPrice').closest('.form-group');
    const autoPriceHTML = `
        <div class="form-group">
            <label>&nbsp;</label>
            <button type="button" class="btn btn-secondary" onclick="fetchStockPrice()" style="background: var(--gradient-secondary); color: white;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;">
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    <polyline points="9 11 12 14 22 4"></polyline>
                </svg>
                自动获取最新价格
            </button>
        </div>
        <div class="form-group">
            <label>&nbsp;</label>
            <button type="button" class="btn btn-secondary" onclick="testAPIHealth()" style="background: var(--gradient-accent); color: white; font-size: 0.9em;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
                测试API连接
            </button>
        </div>
    `;

    const autoDiv = document.createElement('div');
    autoDiv.innerHTML = autoPriceHTML;
    currentPriceGroup.parentNode.insertBefore(autoDiv.firstElementChild, currentPriceGroup.nextSibling);

    // 设置默认购买时间为今天
    document.getElementById('purchaseDate').valueAsDate = new Date();

    console.log('✅ 股票市场功能已添加');
}

// 根据市场自动选择货币
function updateCurrencyByMarket() {
    const market = document.getElementById('stockMarket').value;
    const currencySelect = document.getElementById('currency');

    const marketCurrencyMap = {
        'A股': 'CNY',
        '港股': 'HKD',
        '美股': 'USD',
        '英股': 'GBP',
        '日股': 'JPY',
        '德股': 'EUR',
        '法股': 'EUR',
        '加股': 'CAD',
        '澳股': 'AUD',
        '其他': 'USD'
    };

    if (market && marketCurrencyMap[market]) {
        currencySelect.value = marketCurrencyMap[market];
    }
}

// 根据股票代码自动填充资产名称
function autoFillStockName() {
    const stockCode = document.getElementById('stockCode').value.trim();
    const assetNameInput = document.getElementById('assetName');

    if (!stockCode || assetNameInput.value) return;

    // 常见股票代码与名称的映射
    const stockNames = {
        // 美股
        'AAPL': '苹果公司 (Apple)',
        'GOOGL': '谷歌 (Alphabet)',
        'MSFT': '微软 (Microsoft)',
        'AMZN': '亚马逊 (Amazon)',
        'TSLA': '特斯拉 (Tesla)',
        'META': 'Meta (Facebook)',
        'NVDA': '英伟达 (NVIDIA)',
        'QQQ': '纳斯达克100 ETF',
        'SPY': '标普500 ETF',
        'IWM': '罗素2000 ETF',
        'DIA': '道琼斯ETF',
        // 港股
        '0700': '腾讯控股',
        '9988': '阿里巴巴',
        '0941': '中国移动',
        '1299': '友邦保险',
        '2318': '中国平安',
        // A股
        '000001': '平安银行',
        '000002': '万科A',
        '600519': '贵州茅台',
        '600036': '招商银行',
    };

    const upperCode = stockCode.toUpperCase();
    if (stockNames[upperCode]) {
        assetNameInput.value = stockNames[upperCode];
    }
}

// 获取股票价格
async function fetchStockPrice() {
    const market = document.getElementById('stockMarket').value;
    const stockCode = document.getElementById('stockCode').value;
    const currency = document.getElementById('currency')?.value || 'CNY';

    if (!market || !stockCode) {
        alert('请先选择股票市场和输入股票代码');
        return;
    }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '获取中...';
    btn.disabled = true;

    // 创建调试信息显示
    let debugInfo = `📡 开始获取 ${market} ${stockCode} 的价格...\n`;
    debugInfo += `💰 目标货币: ${currency}\n\n`;

    try {
        // 尝试使用真实API获取价格
        debugInfo += `🌐 尝试连接真实API...\n`;
        const result = await getRealStockPrice(market, stockCode, currency);
        const price = result.price;
        const stockName = result.stockName;

        document.getElementById('currentPrice').value = price.toFixed(2);

        // 如果获取到股票名称，自动填充到资产名称输入框
        if (stockName) {
            const assetNameInput = document.getElementById('assetName');
            if (assetNameInput) {
                // 每次查询都覆盖之前的股票名称
                assetNameInput.value = stockName;
                debugInfo += `📝 已自动填充股票名称: ${stockName}\n`;
            }
        }

        // 获取货币符号
        const currencySymbols = {
            'CNY': '¥',
            'USD': '$',
            'HKD': 'HK$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'CAD': 'C$',
            'AUD': 'A$'
        };
        const symbol = currencySymbols[currency] || '¥';

        debugInfo += `✅ 成功获取价格: ${symbol}${price.toFixed(2)}\n`;
        if (stockName) {
            debugInfo += `📝 股票名称: ${stockName}\n`;
        }
        alert(`✅ 已获取 ${market} ${stockCode} 的最新价格: ${symbol}${price.toFixed(2)}\n\n${debugInfo}`);
    } catch (error) {
        console.error('获取股票价格失败:', error);
        debugInfo += `❌ 真实API失败: ${error.message}\n`;
        debugInfo += `🔄 尝试使用模拟数据...\n`;
        console.log('🔄 准备调用模拟数据函数...');

        // 如果真实API失败，使用模拟数据
        try {
            console.log('🔄 调用 simulateStockPrice...');
            const price = await simulateStockPrice(market, stockCode, currency);
            console.log('✅ 模拟数据返回价格:', price);
            document.getElementById('currentPrice').value = price.toFixed(2);

            const currencySymbols = {
                'CNY': '¥',
                'USD': '$',
                'HKD': 'HK$',
                'EUR': '€',
                'GBP': '£',
                'JPY': '¥',
                'CAD': 'C$',
                'AUD': 'A$'
            };
            const symbol = currencySymbols[currency] || '¥';

            debugInfo += `✅ 模拟数据成功: ${symbol}${price.toFixed(2)}\n`;
            alert(`⚠️ 实时数据获取失败，使用模拟数据\n${market} ${stockCode} 的价格: ${symbol}${price.toFixed(2)}\n\n调试信息:\n${debugInfo}`);
        } catch (simError) {
            console.error('模拟价格获取失败:', simError);
            debugInfo += `❌ 模拟数据也失败: ${simError.message}\n`;

            // 兜底机制：提示用户手动输入
            const currencySymbols = {
                'CNY': '¥',
                'USD': '$',
                'HKD': 'HK$',
                'EUR': '€',
                'GBP': '£',
                'JPY': '¥',
                'CAD': 'C$',
                'AUD': 'A$'
            };
            const symbol = currencySymbols[currency] || '¥';

            alert(`❌ 无法获取实时行情\n\n请手动输入${market} ${stockCode}的当前价格\n\n调试信息:\n${debugInfo}`);

            // 保持输入框可用，清空价格让用户手动输入
            document.getElementById('currentPrice').value = '';
            document.getElementById('currentPrice').focus();
        }
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// API健康检查
async function checkAPIHealth() {
    const proxies = [
        { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' },
        { name: 'corsproxy.io', url: 'https://corsproxy.io/?' },
        { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy?quest=' }
    ];

    const testUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL';
    const results = [];

    for (const proxy of proxies) {
        try {
            const startTime = Date.now();
            const response = await fetch(proxy.url + encodeURIComponent(testUrl));
            const endTime = Date.now();
            const latency = endTime - startTime;

            if (response.ok) {
                const data = await response.json();
                if (data.chart && data.chart.result) {
                    results.push({
                        proxy: proxy.name,
                        status: '✅ 可用',
                        latency: `${latency}ms`,
                        data: '正常'
                    });
                } else {
                    results.push({
                        proxy: proxy.name,
                        status: '⚠️ 响应异常',
                        latency: `${latency}ms`,
                        data: '格式错误'
                    });
                }
            } else {
                results.push({
                    proxy: proxy.name,
                    status: '❌ HTTP错误',
                    latency: `${latency}ms`,
                    data: response.status
                });
            }
        } catch (error) {
            results.push({
                proxy: proxy.name,
                status: '❌ 连接失败',
                latency: 'N/A',
                data: error.message
            });
        }
    }

    return results;
}

// 测试API健康状态
async function testAPIHealth() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '测试中...';
    btn.disabled = true;

    try {
        const results = await checkAPIHealth();

        let report = '🔍 API健康检查结果:\n\n';
        results.forEach(result => {
            report += `${result.proxy}: ${result.status}\n`;
            report += `  延迟: ${result.latency}\n`;
            report += `  详情: ${result.data}\n\n`;
        });

        const availableCount = results.filter(r => r.status.includes('可用')).length;
        report += `📊 总结: ${availableCount}/${results.length} 个代理可用`;

        alert(report);
    } catch (error) {
        alert(`❌ API健康检查失败: ${error.message}`);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// JSONP请求函数
function jsonpRequest(url, callbackName) {
    return new Promise((resolve, reject) => {
        // 创建全局回调函数
        window[callbackName] = function(data) {
            resolve(data);
            // 清理
            delete window[callbackName];
            document.head.removeChild(script);
        };

        // 创建script标签
        const script = document.createElement('script');
        script.src = url;
        script.onerror = function() {
            reject(new Error('JSONP请求失败'));
            delete window[callbackName];
            document.head.removeChild(script);
        };

        document.head.appendChild(script);

        // 设置超时
        setTimeout(() => {
            if (window[callbackName]) {
                reject(new Error('JSONP请求超时'));
                delete window[callbackName];
                document.head.removeChild(script);
            }
        }, 10000);
    });
}

// 获取真实股票价格（使用腾讯/新浪JSONP接口）
async function getRealStockPrice(market, code, currency) {
    try {
        console.log(`📡 尝试获取 ${market} ${code} 的价格`);

        let price = null;
        let stockName = null; // 股票名称
        let originalCurrency = 'CNY'; // 原始货币

        // 根据市场选择不同的数据源
        if (market === '港股') {
            // 港股使用腾讯财经
            // 港股代码格式：03988 -> hk03988
            const hkCode = code.padStart(5, '0'); // 确保是5位数字
            const tencentUrl = `https://qt.gtimg.cn/q=hk${hkCode}`;

            try {
                console.log(`🔗 尝试腾讯财经接口: ${tencentUrl}`);
                const response = await fetch(tencentUrl);
                const arrayBuffer = await response.arrayBuffer();
                const decoder = new TextDecoder('gbk');
                const text = decoder.decode(arrayBuffer);

                console.log(`📊 腾讯响应:`, text);

                // 腾讯返回格式: v_hk03988="3.85~中国银行~..."
                if (text && text.includes('~')) {
                    const parts = text.split('~');
                    if (parts.length > 3) {
                        price = parseFloat(parts[3]); // 当前价格在第4个位置
                        stockName = parts[1]; // 股票名称在第2个位置（GBK已正确解码）
                        originalCurrency = 'HKD';
                        console.log(`✅ 获取到港股价格: ${price} HKD, 名称: ${stockName}`);
                    }
                }
            } catch (tencentError) {
                console.warn('⚠️ 腾讯财经失败:', tencentError.message);
            }

            // 如果腾讯失败，尝试新浪财经
            if (price === null) {
                try {
                    const sinaUrl = `https://hq.sinajs.cn/list=hk${hkCode}`;
                    console.log(`🔗 尝试新浪财经接口: ${sinaUrl}`);
                    const response = await fetch(sinaUrl);
                    const arrayBuffer = await response.arrayBuffer();
                    const decoder = new TextDecoder('gbk');
                    const text = decoder.decode(arrayBuffer);

                    console.log(`📊 新浪响应:`, text);

                    // 新浪返回格式: var hq_str_hk03988="中国银行,3.85,..."
                    if (text && text.includes(',')) {
                        const match = text.match(/"([^"]+)"/);
                        if (match) {
                            const parts = match[1].split(',');
                            if (parts.length > 5) {
                                price = parseFloat(parts[6]); // 当前价格
                                stockName = parts[0]; // 股票名称在第1个位置（GBK已正确解码）
                                originalCurrency = 'HKD';
                                console.log(`✅ 获取到港股价格: ${price} HKD, 名称: ${stockName}`);
                            }
                        }
                    }
                } catch (sinaError) {
                    console.warn('⚠️ 新浪财经失败:', sinaError.message);
                }
            }
        } else if (market === 'A股') {
            // A股使用新浪财经
            // A股代码格式：000001 -> sh000001 或 sz000001
            let marketPrefix = code.startsWith('6') ? 'sh' : 'sz';
            const sinaUrl = `https://hq.sinajs.cn/list=${marketPrefix}${code}`;

            try {
                console.log(`🔗 尝试新浪财经接口: ${sinaUrl}`);
                const response = await fetch(sinaUrl);
                const arrayBuffer = await response.arrayBuffer();
                const decoder = new TextDecoder('gbk');
                const text = decoder.decode(arrayBuffer);

                console.log(`📊 新浪响应:`, text);

                // 新浪返回格式: var hq_str_sh000001="上证指数,3285.67,..."
                if (text && text.includes(',')) {
                    const match = text.match(/"([^"]+)"/);
                    if (match) {
                        const parts = match[1].split(',');
                        if (parts.length > 2) {
                            price = parseFloat(parts[3]); // 当前价格
                            stockName = parts[0]; // 股票名称在第1个位置（GBK已正确解码）
                            originalCurrency = 'CNY';
                            console.log(`✅ 获取到A股价格: ${price} CNY, 名称: ${stockName}`);
                        }
                    }
                }
            } catch (sinaError) {
                console.warn('⚠️ 新浪财经失败:', sinaError.message);
            }

            // 如果新浪失败，尝试腾讯财经
            if (price === null) {
                try {
                    let tencentCode = code;
                    if (code.startsWith('6')) {
                        tencentCode = 'sh' + code;
                    } else {
                        tencentCode = 'sz' + code;
                    }
                    const tencentUrl = `https://qt.gtimg.cn/q=${tencentCode}`;
                    console.log(`🔗 尝试腾讯财经接口: ${tencentUrl}`);
                    const response = await fetch(tencentUrl);
                    const arrayBuffer = await response.arrayBuffer();
                    const decoder = new TextDecoder('gbk');
                    const text = decoder.decode(arrayBuffer);

                    console.log(`📊 腾讯响应:`, text);

                    // 腾讯返回格式: v_sh000001="3285.67~..."
                    if (text && text.includes('~')) {
                        const parts = text.split('~');
                        if (parts.length > 3) {
                            price = parseFloat(parts[3]); // 当前价格
                            stockName = parts[1]; // 股票名称在第2个位置（GBK已正确解码）
                            originalCurrency = 'CNY';
                            console.log(`✅ 获取到A股价格: ${price} CNY, 名称: ${stockName}`);
                        }
                    }
                } catch (tencentError) {
                    console.warn('⚠️ 腾讯财经失败:', tencentError.message);
                }
            }
        } else if (market === '美股' || market === '其他') {
            // 美股使用多个API尝试获取实时数据
            // 优先级1: Yahoo Finance代理接口（最快最稳定）
            try {
                // 使用corsproxy作为Yahoo Finance的代理
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${code}`)}`;
                console.log(`🔗 尝试Yahoo Finance代理接口: ${proxyUrl}`);
                const response = await fetch(proxyUrl);
                const data = await response.json();

                if (data && data.chart && data.chart.result && data.chart.result[0]) {
                    const meta = data.chart.result[0].meta;
                    if (meta && meta.regularMarketPrice) {
                        price = meta.regularMarketPrice;
                        stockName = meta.symbol || code; // 股票名称
                        originalCurrency = meta.currency || 'USD';
                        console.log(`✅ 获取到美股价格: ${price} ${originalCurrency}, 名称: ${stockName}`);
                    }
                }
            } catch (yahooError) {
                console.warn('⚠️ Yahoo Finance代理接口失败:', yahooError.message);
            }

            // 如果Yahoo失败，尝试2: Financial Modeling Prep (免费版)
            if (price === null) {
                try {
                    const fmpUrl = `https://financialmodelingprep.com/api/v3/quote/${code}?apikey=demo`;
                    console.log(`🔗 尝试FMP接口: ${fmpUrl}`);
                    const response = await fetch(fmpUrl);
                    const data = await response.json();

                    if (data && data.length > 0 && data[0].price) {
                        price = data[0].price;
                        stockName = data[0].name || data[0].symbol; // 股票名称
                        originalCurrency = 'USD';
                        console.log(`✅ 获取到美股价格: ${price} USD, 名称: ${stockName}`);
                    }
                } catch (fmpError) {
                    console.warn('⚠️ FMP接口失败:', fmpError.message);
                }
            }

            // 如果都失败，尝试3: Alpha Vantage (免费版)
            if (price === null) {
                try {
                    const avUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${code}&apikey=demo`;
                    console.log(`🔗 尝试Alpha Vantage接口: ${avUrl}`);
                    const response = await fetch(avUrl);
                    const data = await response.json();

                    if (data && data['Global Quote'] && data['Global Quote']['05. price']) {
                        price = parseFloat(data['Global Quote']['05. price']);
                        stockName = data['Global Quote']['01. symbol'] || code; // 股票名称
                        originalCurrency = 'USD';
                        console.log(`✅ 获取到美股价格: ${price} USD, 名称: ${stockName}`);
                    }
                } catch (avError) {
                    console.warn('⚠️ Alpha Vantage接口失败:', avError.message);
                }
            }

            if (price === null) {
                throw new Error('无法获取美股实时数据');
            }
        } else {
            // 其他市场使用模拟数据
            throw new Error('暂不支持该市场的实时数据，请使用模拟数据');
        }

        if (price === null || isNaN(price)) {
            throw new Error('无法解析价格数据');
        }

        // 根据目标货币决定是否需要汇率转换
        let convertedPrice = price;

        // 汇率转换
        const exchangeRates = {
            'CNY': { 'HKD': 0.92, 'USD': 0.139, 'EUR': 0.128, 'GBP': 0.109, 'JPY': 20.76, 'CAD': 0.189, 'AUD': 0.208 },
            'HKD': { 'CNY': 1.087, 'USD': 0.151, 'EUR': 0.139, 'GBP': 0.118, 'JPY': 22.56, 'CAD': 0.205, 'AUD': 0.226 },
            'USD': { 'CNY': 7.2, 'HKD': 6.62, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 149.5, 'CAD': 1.36, 'AUD': 1.53 }
        };

        if (originalCurrency !== currency) {
            if (exchangeRates[originalCurrency] && exchangeRates[originalCurrency][currency]) {
                convertedPrice = price * exchangeRates[originalCurrency][currency];
            } else if (exchangeRates['USD'] && exchangeRates['USD'][currency]) {
                // 先转换为美元，再转换为目标货币
                const usdPrice = originalCurrency === 'CNY' ? price / 7.2 :
                               originalCurrency === 'HKD' ? price / 7.8 : price;
                convertedPrice = usdPrice * exchangeRates['USD'][currency];
            }
        }

        console.log(`💱 转换后价格 (${currency}): ${convertedPrice}`);
        return { price: convertedPrice, stockName: stockName };
    } catch (error) {
        console.warn('❌ 真实API获取失败，将使用模拟数据:', error.message);
        throw error;
    }
}

// 改进的模拟股票价格获取（基于真实股票代码）
async function simulateStockPrice(market, code, currency) {
    try {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 500));

        // 港股代码映射（处理不同格式）
        const hkCodeMapping = {
            '03988': '9988',  // 阿里巴巴
            '09988': '9988',
            '00941': '0941',  // 中国移动
            '01299': '1299',  // 友邦保险
            '02318': '2318',  // 中国平安
            '00960': '0960',  // 龙湖集团
            '01024': '1024',  // 快手
            '01810': '1810',  // 小米
            '09618': '9618',  // 京东
        };

        // 标准化港股代码
        let normalizedCode = code.toUpperCase();
        if (market === '港股' && hkCodeMapping[normalizedCode]) {
            normalizedCode = hkCodeMapping[normalizedCode];
        }

        // 常见股票的真实价格参考（原币种，2024年数据）
        const knownStocks = {
            // 美股（美元）
            'AAPL': 178.72,
            'GOOGL': 141.80,
            'GOOG': 141.80,
            'MSFT': 378.91,
            'AMZN': 178.25,
            'TSLA': 248.50,
            'META': 505.95,
            'NVDA': 875.28,
            'QQQ': 478.92,
            'SPY': 511.50,
            'IWM': 201.35,
            'DIA': 398.50,
            'GLD': 215.50,
            'SLV': 28.35,
            'TLT': 92.45,
            'V': 275.80,
            'JPM': 195.35,
            'BAC': 38.45,
            'WMT': 165.20,
            'DIS': 112.50,
            'NFLX': 628.90,
            'AMD': 175.65,
            'INTC': 31.25,
            'CRM': 272.45,
            'ORCL': 125.80,
            'ADBE': 568.35,
            'PYPL': 62.45,
            'SHOP': 68.90,
            'SQ': 85.35,
            'COIN': 258.45,
            'UBER': 72.35,
            'LYFT': 14.25,
            'HOOD': 17.85,
            'PLTR': 25.45,
            'SNAP': 12.35,
            'ROKU': 62.85,
            'ZM': 68.45,
            'DOCU': 52.35,
            'SNOW': 145.85,
            'CLOUD': 58.45,
            'NET': 72.35,
            'DDOG': 108.45,
            'MDB': 385.65,
            'TEAM': 268.45,
            'OKTA': 92.35,
            'ZS': 68.45,
            'FSLY': 12.35,
            'FAST': 58.45,
            'ETSY': 72.35,
            'ABNB': 168.45,
            'RBLX': 42.35,
            'DOCU': 52.35,
            'UPST': 28.45,
            'PATH': 18.35,
            'SOFI': 7.85,
            'LCID': 2.85,
            'RIVN': 12.45,
            'NIO': 5.85,
            'XPEV': 9.35,
            'LI': 18.45,
            'XPENG': 9.35,
            // 港股（港币）
            '0700': 315.20,  // 腾讯
            '9988': 73.15,   // 阿里巴巴
            '0941': 168.50,  // 中国移动
            '1299': 285.80,  // 友邦保险
            '2318': 12.45,   // 中国平安
            '0960': 18.50,   // 龙湖集团
            '1024': 28.50,   // 快手
            '1810': 18.50,   // 小米
            '9618': 18.50,   // 京东
            'BABA': 73.15,   // 阿里巴巴（美股）
            'JD': 28.50,     // 京东（美股）
            'PDD': 158.50,   // 拼多多（美股）
            'BIDU': 115.50,  // 百度（美股）
            'NTES': 98.50,   // 网易（美股）
            // A股（人民币）
            '000001': 11.25,  // 平安银行
            '000002': 8.45,   // 万科A
            '600519': 1750.50, // 贵州茅台
            '600036': 32.80,  // 招商银行
            '000858': 28.50,  // 五粮液
            '600276': 45.80,  // 恒瑞医药
            '000725': 12.50,  // 京东方A
            '002415': 38.50,  // 海康威视
            '600887': 42.50,  // 伊利股份
            '000333': 85.50,  // 美的集团
            '002594': 245.50, // 比亚迪
            '300750': 185.50, // 宁德时代
            '688981': 45.50,  // 中芯国际
            '601318': 42.50,  // 中国平安
            '601888': 28.50,  // 中国中免
            '600900': 5.50,   // 长江电力
            '601939': 6.50,   // 建设银行
            '601288': 4.50,   // 农业银行
            '601398': 4.50,   // 工商银行
            '601988': 3.50,   // 中国银行
            '600030': 15.50,  // 中信证券
            '000063': 8.50,   // 中兴通讯
            '002475': 18.50,  // 立讯精密
            '300059': 28.50,  // 东方财富
        };

        // 检查是否是已知股票
        if (knownStocks[normalizedCode]) {
            const basePrice = knownStocks[normalizedCode];
            // 更小的波动范围，模拟实时价格
            const randomFactor = 0.995 + Math.random() * 0.01; // 0.995-1.005之间的随机因子，模拟小幅波动
            const price = basePrice * randomFactor;

            // 根据选择的货币返回价格
            if (currency === 'CNY') {
                // 如果目标货币是人民币，需要转换
                if (market === 'A股') {
                    return price; // A股已经是人民币
                } else if (market === '港股') {
                    return price * 0.92; // 港币转人民币
                } else {
                    return price * 7.2; // 美元转人民币
                }
            } else if (currency === 'USD') {
                // 如果目标货币是美元
                if (market === 'A股') {
                    return price / 7.2; // 人民币转美元
                } else if (market === '港股') {
                    return price / 7.8; // 港币转美元
                } else {
                    return price; // 美股已经是美元
                }
            } else if (currency === 'HKD') {
                // 如果目标货币是港币
                if (market === '港股') {
                    return price; // 港股已经是港币
                } else if (market === 'A股') {
                    return price / 0.92; // 人民币转港币
                } else {
                    return price * 7.8; // 美元转港币
                }
            } else {
                // 其他货币
                if (currency === 'EUR') {
                    return price * 0.92; // 转换为欧元
                } else if (currency === 'GBP') {
                    return price * 0.79; // 转换为英镑
                } else if (currency === 'JPY') {
                    return price * 149.5; // 转换为日元
                } else if (currency === 'CAD') {
                    return price * 1.36; // 转换为加元
                } else if (currency === 'AUD') {
                    return price * 1.53; // 转换为澳元
                } else {
                    return price * 7.2; // 默认转换为人民币
                }
            }
        }

        // 未知股票使用市场基准价格（原币种）
        const basePrices = {
            'A股': 15,      // 人民币
            '港股': 120,    // 港币
            '美股': 180,    // 美元
            '英股': 900,    // 英镑
            '日股': 1800,   // 日元
            '德股': 120,    // 欧元
            '法股': 95,     // 欧元
            '加股': 65,     // 加元
            '澳股': 28,     // 澳元
            '其他': 60      // 美元
        };

        const basePrice = basePrices[market] || 60;
        const randomFactor = 0.9 + Math.random() * 0.2; // 0.9-1.1之间的随机因子
        let price = basePrice * randomFactor;

        // 根据选择的货币返回价格
        if (currency === 'CNY') {
            // 转换为人民币
            if (market === '港股') {
                price = price * 0.92;
            } else if (market === '美股' || market === '其他') {
                price = price * 7.2;
            } else if (market === '英股') {
                price = price * 9.1;
            } else if (market === '日股') {
                price = price * 0.048;
            } else if (market === '德股' || market === '法股') {
                price = price * 7.8;
            } else if (market === '加股') {
                price = price * 5.3;
            } else if (market === '澳股') {
                price = price * 4.7;
            }
        } else if (currency === 'USD' && market !== '美股' && market !== '其他') {
            // 转换为美元
            if (market === 'A股') {
                price = price / 7.2;
            } else if (market === '港股') {
                price = price / 7.8;
            } else if (market === '英股') {
                price = price / 1.27;
            } else if (market === '日股') {
                price = price / 149.5;
            } else if (market === '德股' || market === '法股') {
                price = price / 1.09;
            } else if (market === '加股') {
                price = price / 1.36;
            } else if (market === '澳股') {
                price = price / 1.53;
            }
        } else if (currency === 'HKD' && market !== '港股') {
            // 转换为港币
            if (market === 'A股') {
                price = price / 0.92;
            } else if (market === '美股' || market === '其他') {
                price = price * 7.8;
            }
        }

        return price;
    } catch (error) {
        console.error('模拟价格计算出错:', error);
        // 返回一个安全的默认值
        return 100.0;
    }
}

// 登出函数
async function logout() {
    try {
        console.log('🔄 开始登出...');
        console.log('auth对象状态:', auth);

        if (!auth) {
            console.error('❌ auth对象为null，Firebase可能未初始化');
            alert('Firebase未初始化，请刷新页面重试');
            return;
        }

        await auth.signOut();
        console.log('✅ 已登出');
        window.location.reload();
    } catch (error) {
        console.error('❌ 登出失败:', error);
        alert('登出失败: ' + error.message);
    }
}

// 登录/注册弹窗控制
let authMode = 'login'; // 'login' 或 'register'

function openAuthModal(mode) {
    authMode = mode;
    const modal = document.getElementById('authModal');
    const title = document.getElementById('authTitle');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (mode === 'login') {
        title.textContent = '登录';
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        title.textContent = '注册';
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    }

    modal.style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

// 切换到注册表单
document.getElementById('show-register-btn').addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal('register');
});

// 切换到登录表单
document.getElementById('show-login-btn').addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal('login');
});

// 处理登录表单提交
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('✅ 登录成功:', userCredential.user.email);
        closeAuthModal();
    } catch (error) {
        console.error('❌ 登录失败:', error);
        alert(error.message);
    }
});

// 处理注册表单提交
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (password !== confirmPassword) {
        alert('两次输入的密码不一致');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        console.log('✅ 注册成功:', userCredential.user.email);
        alert('注册成功！已自动登录并开通VIP权限');
        closeAuthModal();
    } catch (error) {
        console.error('❌ 注册失败:', error);
        alert(error.message);
    }
});
