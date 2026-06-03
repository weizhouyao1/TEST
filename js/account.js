// ============================================
// 账户管理页面逻辑
// ============================================

class AccountPage {
    constructor() {
        this.setupEventListeners();
        this.loadUserData();
    }

    setupEventListeners() {
        // 菜单项点击
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => this.switchSection(e));
        });
    }

    // 切换部分
    switchSection(e) {
        const sectionName = e.currentTarget.getAttribute('data-section');
        
        // 移除所有active类
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // 添加active类
        e.currentTarget.classList.add('active');
        document.getElementById(sectionName).classList.add('active');
    }

    // 加载用户数据
    async loadUserData() {
        if (!isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const userId = getCurrentUserId();
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();

            if (!userData) return;

            // 更新个人信息
            this.updateProfileInfo(userData);

            // 更新订阅信息
            await this.updateSubscriptionInfo(userData);

            // 加载账单
            await this.loadBillingHistory(userId);

            // 加载偏好设置
            this.loadPreferences(userData);

        } catch (error) {
            console.error('加载用户数据失败:', error);
            this.showNotification('❌ 加载数据失败', 'error');
        }
    }

    // 更新个人信息显示
    updateProfileInfo(userData) {
        document.getElementById('userAvatar').textContent = (userData.displayName || '用户')[0];
        document.getElementById('userName').textContent = userData.displayName || '用户';
        document.getElementById('userEmail').textContent = userData.email || '';

        document.getElementById('profileName').value = userData.displayName || '';
        document.getElementById('profileEmail').value = userData.email || '';
        document.getElementById('profilePhone').value = userData.phone || '';
        document.getElementById('profileRealName').value = userData.realName || '';
    }

    // 更新订阅信息
    async updateSubscriptionInfo(userData) {
        const plan = userData.plan || 'free';
        const status = userData.subscriptionStatus || 'none';

        // 更新显示
        const planNames = {
            'free': '免费版',
            'pro_month': '专业版 (月付)',
            'pro_year': '专业版 (年付)',
            'enterprise_month': '企业版 (月付)',
            'enterprise_year': '企业版 (年付)'
        };

        document.getElementById('currentPlan').textContent = planNames[plan] || plan;

        if (status === 'trial') {
            // 显示试用信息
            const trialStart = userData.trialStartDate.toDate();
            const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            const today = new Date();
            const daysLeft = Math.max(0, Math.ceil((trialEnd - today) / (24 * 60 * 60 * 1000)));

            document.getElementById('trialInfo').style.display = 'block';
            document.getElementById('trialDays').textContent = daysLeft;
            document.getElementById('trialProgress').style.width = ((7 - daysLeft) / 7) * 100 + '%';
            document.getElementById('planStatus').textContent = `试用中 (剩余${daysLeft}天)`;
        } else if (status === 'active') {
            // 显示活跃订阅
            document.getElementById('trialInfo').style.display = 'none';
            document.getElementById('planStatus').textContent = '激活中';
            document.getElementById('subscriptionPeriod').textContent = 
                plan.includes('year') ? '年付' : '月付';
            
            if (userData.subscriptionEndDate) {
                const endDate = userData.subscriptionEndDate.toDate();
                document.getElementById('expiryDate').textContent = 
                    endDate.toLocaleDateString('zh-CN');
            }
            
            if (userData.nextBillingDate) {
                const nextDate = userData.nextBillingDate.toDate();
                document.getElementById('nextBillingDate').textContent = 
                    nextDate.toLocaleDateString('zh-CN');
            }

            document.getElementById('cancelBtn').style.display = 'block';
        } else {
            document.getElementById('trialInfo').style.display = 'none';
            document.getElementById('planStatus').textContent = '未激活';
            document.getElementById('cancelBtn').style.display = 'none';
        }
    }

    // 加载账单历史
    async loadBillingHistory(userId) {
        try {
            const snapshot = await db.collection('billing')
                .where('userId', '==', userId)
                .orderBy('paymentDate', 'desc')
                .limit(20)
                .get();

            const billingList = document.getElementById('billingList');
            
            if (snapshot.empty) {
                billingList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #999;">暂无账单</td></tr>';
                return;
            }

            billingList.innerHTML = snapshot.docs.map(doc => {
                const data = doc.data();
                const date = data.paymentDate.toDate().toLocaleDateString('zh-CN');
                const planNames = {
                    'pro_month': '专业版',
                    'pro_year': '专业版年卡',
                    'enterprise_month': '企业版',
                    'enterprise_year': '企业版年卡'
                };

                return `
                    <tr>
                        <td>${date}</td>
                        <td>${data.orderId}</td>
                        <td>${planNames[data.planId] || data.planId}</td>
                        <td>¥${data.amount.toFixed(2)}</td>
                        <td>
                            <span class="status-${data.status}">${
                                data.status === 'paid' ? '已支付' : '待支付'
                            }</span>
                        </td>
                        <td>
                            <a href="#" onclick="downloadInvoice('${doc.id}')">下载发票</a>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (error) {
            console.error('加载账单失败:', error);
        }
    }

    // 加载偏好设置
    loadPreferences(userData) {
        const prefs = userData.preferences || {};

        document.getElementById('emailNotification').checked = prefs.emailNotification !== false;
        document.getElementById('smsNotification').checked = prefs.smsNotification === true;
        document.getElementById('appNotification').checked = prefs.appNotification !== false;
        document.getElementById('autoSync').checked = prefs.autoSync !== false;
        document.getElementById('language').value = prefs.language || 'zh-CN';
    }
}

// ============ 功能函数 ============

// 更新个人信息
async function updateProfile() {
    if (!isAuthenticated()) return;

    const phone = document.getElementById('profilePhone').value;
    const realName = document.getElementById('profileRealName').value;

    try {
        const userId = getCurrentUserId();
        await db.collection('users').doc(userId).update({
            phone: phone,
            realName: realName,
            updatedAt: new Date()
        });

        showNotification('✅ 个人信息已更新', 'success');
    } catch (error) {
        console.error('更新失败:', error);
        showNotification('❌ 更新失败', 'error');
    }
}

// 修改密码
async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('请填写所有字段');
        return;
    }

    if (newPassword !== confirmPassword) {
        alert('两次输入的密码不一致');
        return;
    }

    if (newPassword.length < 8) {
        alert('新密码至少8个字符');
        return;
    }

    try {
        // 重新认证用户
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
        );
        await currentUser.reauthenticateWithCredential(credential);

        // 更新密码
        await currentUser.updatePassword(newPassword);

        // 清空表单
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

        showNotification('✅ 密码已更新', 'success');
    } catch (error) {
        console.error('密码修改失败:', error);
        if (error.code === 'auth/wrong-password') {
            alert('❌ 当前密码错误');
        } else {
            alert('❌ 密码修改失败：' + error.message);
        }
    }
}

// 取消订阅
async function cancelSubscription() {
    if (!confirm('确定要取消订阅吗？取消后你可以继续使用到期末日')) {
        return;
    }

    try {
        const userId = getCurrentUserId();
        await db.collection('users').doc(userId).update({
            subscriptionStatus: 'cancelled',
            autoRenew: false,
            cancellationDate: new Date(),
            updatedAt: new Date()
        });

        showNotification('✅ 订阅已取消', 'success');
        setTimeout(() => {
            location.reload();
        }, 1500);
    } catch (error) {
        console.error('取消订阅失败:', error);
        showNotification('❌ 取消失败', 'error');
    }
}

// 保存偏好设置
async function savePreferences() {
    if (!isAuthenticated()) return;

    try {
        const userId = getCurrentUserId();
        await db.collection('users').doc(userId).update({
            'preferences.emailNotification': document.getElementById('emailNotification').checked,
            'preferences.smsNotification': document.getElementById('smsNotification').checked,
            'preferences.appNotification': document.getElementById('appNotification').checked,
            'preferences.autoSync': document.getElementById('autoSync').checked,
            'preferences.language': document.getElementById('language').value,
            updatedAt: new Date()
        });

        showNotification('✅ 设置已保存', 'success');
    } catch (error) {
        console.error('保存失败:', error);
        showNotification('❌ 保存失败', 'error');
    }
}

// 导出数据
async function exportData() {
    if (!isAuthenticated()) return;

    try {
        const userId = getCurrentUserId();
        
        // 获取交易数据
        const transSnapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .get();
        
        // 获取投资数据
        const invSnapshot = await db.collection('investments')
            .where('userId', '==', userId)
            .get();

        const data = {
            exportDate: new Date().toISOString(),
            transactions: transSnapshot.docs.map(doc => doc.data()),
            investments: invSnapshot.docs.map(doc => doc.data())
        };

        // 转换为JSON字符串
        const jsonStr = JSON.stringify(data, null, 2);
        
        // 下载文件
        this.downloadFile(jsonStr, `财务数据_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        
        showNotification('✅ 数据已导出', 'success');
    } catch (error) {
        console.error('导出失败:', error);
        showNotification('❌ 导出失败', 'error');
    }
}

// 导出为CSV
async function exportCSV() {
    alert('CSV导出功能开发中...');
}

// 下载文件辅助函数
function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// 删除账户
async function deleteAccount() {
    if (!confirm('确定要永久删除账户吗？此操作无法撤销，所有数据将被删除')) {
        return;
    }

    if (!confirm('再次确认：删除账户是不可逆的')) {
        return;
    }

    try {
        const userId = getCurrentUserId();
        
        // 删除用户文档和相关数据
        await Promise.all([
            db.collection('users').doc(userId).delete(),
            deleteSubcollection(userId, 'transactions'),
            deleteSubcollection(userId, 'investments')
        ]);

        // 删除认证账户
        await currentUser.delete();

        showNotification('✅ 账户已删除', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    } catch (error) {
        console.error('删除账户失败:', error);
        showNotification('❌ 删除失败', 'error');
    }
}

// 删除子集合
async function deleteSubcollection(userId, collection) {
    const snapshot = await db.collection(collection)
        .where('userId', '==', userId)
        .get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.textContent = message;
    notification.className = `notification show ${type}`;

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// 请求发票
function requestInvoice() {
    alert('发票申请功能开发中...');
}

// 过滤账单
function filterBilling() {
    alert('账单筛选功能开发中...');
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        new AccountPage();
        console.log('✅ 账户管理页面已初始化');
    }, 1000);
});
