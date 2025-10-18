// 全局变量：存储所有用户数据
let allUsers = [];

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 1. 权限校验（非管理员跳转首页）
  const role = getCookie('role');
  const username = getCookie('username');
  if (role !== 'admin' || !username) {
    alert('无管理员权限！');
    window.location.href = '/';
    return;
  }

  // 2. 加载系统概览和用户列表
  loadDashboardData();
  loadAllUsers();

  // 3. 绑定事件监听
  bindEvents();
});

// 绑定所有事件（移除按钮依赖，改为即时搜索）
function bindEvents() {
  // 核心修改：监听搜索框输入变化，实时触发搜索（替代按钮和回车）
  document.getElementById('userSearch').addEventListener('input', handleSearch);

  // 新增用户按钮
  document.getElementById('addUserBtn').addEventListener('click', () => {
    openUserModal('add');
  });

  // 关闭用户模态框
  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('userModal').style.display = 'none';
  });

  // 关闭密码模态框
  document.getElementById('pwdModalClose').addEventListener('click', () => {
    document.getElementById('pwdModal').style.display = 'none';
  });

  // 用户表单提交（新增/编辑角色）
  document.getElementById('userForm').addEventListener('submit', handleUserFormSubmit);

  // 密码表单提交
  document.getElementById('pwdForm').addEventListener('submit', handlePwdFormSubmit);
}

// 加载系统概览数据
async function loadDashboardData() {
  try {
    const response = await fetch('/admin/dashboard');
    const data = await response.json();
    if (data.success) {
      document.getElementById('userCount').textContent = data.data.userCount;
      document.getElementById('fileCount').textContent = data.data.fileCount;
      
      // 转换文件大小单位
      const totalSize = data.data.totalSize;
      let sizeText;
      if (totalSize > 1024 * 1024 * 1024) {
        sizeText = (totalSize / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
      } else {
        sizeText = (totalSize / (1024 * 1024)).toFixed(2) + ' MB';
      }
      document.getElementById('totalSize').textContent = sizeText;
    }
  } catch (err) {
    console.error('加载概览数据失败:', err);
  }
}

// 加载所有用户
async function loadAllUsers() {
  const tableBody = document.getElementById('userTableBody');
  tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">加载中...</td></tr>';

  try {
    const response = await fetch('/admin/users');
    const data = await response.json();
    if (data.success && data.users.length > 0) {
      allUsers = data.users;
      renderUserList(allUsers);
    } else {
      tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">暂无用户数据</td></tr>';
    }
  } catch (err) {
    tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #f56c6c;">加载失败，请刷新重试</td></tr>';
    console.error('加载用户列表失败:', err);
  }
}

// 渲染用户列表（修复用户名特殊字符问题）
function renderUserList(users) {
  const tableBody = document.getElementById('userTableBody');
  if (users.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">未找到匹配用户</td></tr>';
    return;
  }

  let html = '';
  users.forEach(user => {
    // 转义用户名中的单引号，避免破坏onclick语法
    const escapedUsername = user.username.replace(/'/g, '&#39;');
    html += `
      <tr>
        <td>${user.username}</td>
        <td><span class="role-tag role-${user.role}">${user.role === 'admin' ? '管理员' : '普通用户'}</span></td>
        <td>
          <button class="btn btn-outline action-btn" onclick="editUser('${escapedUsername}', '${user.role}')">编辑角色</button>
          <button class="btn btn-outline action-btn" onclick="changeUserPwd('${escapedUsername}')">修改密码</button>
          <button class="btn btn-danger action-btn" onclick="deleteUser('${escapedUsername}')">删除</button>
        </td>
      </tr>
    `;
  });
  tableBody.innerHTML = html;
}

// 搜索用户（输入变化时自动触发，空值时显示所有用户）
function handleSearch() {
  const searchVal = document.getElementById('userSearch').value.trim().toLowerCase();
  
  // 输入为空时显示所有用户（替代原"重置"功能）
  const filteredUsers = searchVal 
    ? allUsers.filter(user => {
        const usernameMatch = user.username.toLowerCase().includes(searchVal);
        const roleMatch = (user.role === 'admin' ? '管理员' : '普通用户').toLowerCase().includes(searchVal);
        return usernameMatch || roleMatch;
      })
    : allUsers;

  renderUserList(filteredUsers);
}

// 打开用户模态框（新增/编辑）
function openUserModal(type, username = '', role = 'user') {
  const modal = document.getElementById('userModal');
  const modalTitle = document.getElementById('modalTitle');
  const formType = document.getElementById('formType');
  const passwordGroup = document.getElementById('passwordGroup');
  const currentUsername = document.getElementById('currentUsername');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password'); // 获取密码输入框

  // 重置表单
  document.getElementById('userForm').reset();
  document.getElementById('formMessage').style.display = 'none';

  // 设置表单类型
  formType.value = type;
  if (type === 'add') {
    modalTitle.textContent = '新增用户';
    passwordGroup.style.display = 'block';
    usernameInput.disabled = false;
    usernameInput.required = true;
    // 新增用户时，密码框必填
    passwordInput.required = true;
  } else {
    modalTitle.textContent = `编辑用户【${username}】`;
    passwordGroup.style.display = 'none'; // 隐藏密码框
    currentUsername.value = username;
    usernameInput.value = username;
    usernameInput.disabled = true;
    usernameInput.required = false;
    document.getElementById('role').value = role;
    // 编辑角色时，移除密码框的必填属性
    passwordInput.required = false;
  }

  // 显示模态框
  modal.style.display = 'flex';
}

// 处理用户表单提交（新增/编辑角色）
async function handleUserFormSubmit(e) {
  e.preventDefault();
  const formType = document.getElementById('formType').value;
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;
  const messageEl = document.getElementById('formMessage');
  const modal = document.getElementById('userModal');

  try {
    let response;
    if (formType === 'add') {
      // 新增用户
      response = await fetch('/admin/user/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
      });
    } else {
      // 编辑角色
      const currentUsername = document.getElementById('currentUsername').value;
      response = await fetch('/admin/user/change-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername, newRole: role })
      });
    }

    const data = await response.json();
    if (data.success) {
      messageEl.className = 'message success';
      messageEl.textContent = data.message;
      // 关闭模态框并刷新列表
      setTimeout(() => {
        modal.style.display = 'none';
        loadAllUsers();
      }, 1500);
    } else {
      messageEl.className = 'message error';
      messageEl.textContent = data.message;
    }
  } catch (err) {
    messageEl.className = 'message error';
    messageEl.textContent = '操作失败：网络错误';
  }
}

// 打开密码修改模态框
function changeUserPwd(username) {
  const modal = document.getElementById('pwdModal');
  document.getElementById('pwdUsername').value = username;
  document.getElementById('pwdForm').reset();
  document.getElementById('pwdMessage').style.display = 'none';
  modal.style.display = 'flex';
}

// 处理密码表单提交
async function handlePwdFormSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('pwdUsername').value;
  const newPwd = document.getElementById('newPwd').value;
  const newPwdConfirm = document.getElementById('newPwdConfirm').value;
  const messageEl = document.getElementById('pwdMessage');
  const modal = document.getElementById('pwdModal');

  // 前端校验
  if (newPwd !== newPwdConfirm) {
    messageEl.className = 'message error';
    messageEl.textContent = '两次输入的密码不一致！';
    return;
  }

  try {
    const response = await fetch('/admin/change-user-pwd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, newPwd })
    });
    const data = await response.json();

    if (data.success) {
      messageEl.className = 'message success';
      messageEl.textContent = data.message;
      setTimeout(() => {
        modal.style.display = 'none';
        loadAllUsers();
      }, 1500);
    } else {
      messageEl.className = 'message error';
      messageEl.textContent = data.message;
    }
  } catch (err) {
    messageEl.className = 'message error';
    messageEl.textContent = '修改失败：网络错误';
  }
}

// 删除用户
async function deleteUser(username) {
  if (!confirm(`确定要删除用户【${username}】吗？\n删除后将同时删除该用户上传的所有文件！`)) {
    return;
  }

  try {
    const response = await fetch('/admin/user/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await response.json();

    if (data.success) {
      alert(data.message);
      loadAllUsers();
    } else {
      alert('删除失败：' + data.message);
    }
  } catch (err) {
    alert('删除失败：网络错误');
    console.error('删除用户失败:', err);
  }
}

// 全局函数（供HTML中onclick调用）
window.editUser = (username, role) => openUserModal('edit', username, role);
window.changeUserPwd = changeUserPwd;
window.deleteUser = deleteUser;
