const fileList = document.getElementById("fileList");
const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("arquivo");
const progressBar = document.getElementById("progressBar");
const status = document.getElementById("status");
const searchInput = document.getElementById("searchInput");

// ---------- 上传文件类型校验 ----------
const allowedExtensions = [".torrent"];
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authModal = document.getElementById("authModal");
const closeModal = document.querySelector(".close");
const authForm = document.getElementById("authForm");
const modalTitle = document.getElementById("modalTitle");
const authMsg = document.getElementById("authMsg");

let authMode = "login"; // login / register

let currentUser = null;
let currentRole = null;

// ---------- cookie 操作 ----------
function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

// ---------- 初始登录状态检查 ----------
function checkLoginStatus() {
    const username = getCookie("username");
    const role = getCookie("role");
    const progressContainer = document.getElementById("progressContainer");
    const usernameDisplay = document.getElementById("usernameDisplay");

    if (username) {
        currentUser = username;
        currentRole = role || "user";
        loginBtn.style.display = "none";
        registerBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        uploadForm.style.display = "block";
        progressContainer.style.display = "block"; // 显示上传进度条
        // 显示用户名
        usernameDisplay.textContent = `欢迎, ${username}`;
        usernameDisplay.style.display = "inline";

    } else {
        currentUser = null;
        currentRole = null;
        loginBtn.style.display = "inline-block";
        registerBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        uploadForm.style.display = "none";
        progressContainer.style.display = "none"; // 隐藏上传进度条
        // 隐藏用户名
        usernameDisplay.style.display = "none";
    }
    loadFiles(); // 确保每次状态变化都刷新文件列表
}

// ---------- 弹窗操作 ----------
loginBtn.onclick = () => { authMode="login"; modalTitle.textContent="登录"; authMsg.textContent=""; authModal.style.display="block";}
registerBtn.onclick = () => { authMode="register"; modalTitle.textContent="注册"; authMsg.textContent=""; authModal.style.display="block";}
closeModal.onclick = () => authModal.style.display="none";
window.onclick = e => { if(e.target==authModal) authModal.style.display="none";}

// ---------- 登录/注册表单提交 ----------
authForm.onsubmit = e => {
    e.preventDefault();
    const formData = new FormData(authForm);
    fetch(`/${authMode}`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ username: formData.get("username"), password: formData.get("password") })
    })
    .then(res=>res.json())
    .then(data => {
        if (data.success) {
            authModal.style.display = "none";
            checkLoginStatus(); // 刷新所有状态
        } else authMsg.textContent = data.message;
    });
};

// ---------- 登出 ----------
logoutBtn.onclick = () => {
    fetch("/logout",{method:"POST"}).then(()=>{
        checkLoginStatus(); // 刷新登录状态和上传表单
    });
};

// ---------- 文件选择校验 ----------
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
        alert(`不允许的文件类型: ${ext}`);
        fileInput.value = "";
    }
});

// ---------- 上传 ----------
uploadForm.onsubmit = e => {
    e.preventDefault();
    if(!currentUser) { alert("请先登录"); return; }
    const file = fileInput.files[0];
    if(!file) return;

    // 新建临时按钮禁用状态
    const submitBtn = uploadForm.querySelector('input[type="submit"]');
    submitBtn.disabled = true;

    const formData = new FormData();
    formData.append("arquivo", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST","/upload",true);
    xhr.upload.onprogress = evt => { 
        if(evt.lengthComputable){ 
            const pct=Math.round((evt.loaded/evt.total)*100); 
            progressBar.style.width=pct+"%"; 
            status.textContent=`上传中: ${pct}%`; 
        }
    };
    xhr.onload = () => { 
        submitBtn.disabled = false;
        if(xhr.status===200){ 
            status.textContent="上传成功!";
            progressBar.style.width="100%"; 
            loadFiles(); // 上传成功后立即刷新文件列表
            setTimeout(()=>{
                progressBar.style.width = "0%";
                status.textContent = "";
                fileInput.value = "";
            },1000);
        } else {
            status.textContent="上传失败"; 
            setTimeout(()=>{ progressBar.style.width = "0%"; },1000);
        }
    };

    xhr.onerror = () => {
        status.textContent="上传失败";
        submitBtn.disabled = false;
        setTimeout(()=>{ progressBar.style.width = "0%"; },1000);
    };
    xhr.send(formData);
};

// ---------- 获取文件列表 ----------
function loadFiles() {
    fetch("/files").then(res => res.json()).then(files => {
        const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";
        fileList.innerHTML = "";

        files
        .filter(f => {
            const nameMatch = f.originalName.toLowerCase().includes(searchValue);
            const uploaderMatch = f.uploader.toLowerCase().includes(searchValue);
            return nameMatch || uploaderMatch; // 文件名或上传者匹配
        })
        .forEach(f => {
            const li = document.createElement("li");

            // 文件名（点击跳转 detail.html）
            const span = document.createElement("span");
            span.textContent = `${f.originalName} (${f.uploader} / ${new Date(f.uploadTime).toLocaleString()})`;
            span.style.cursor = "pointer";
            span.style.textDecoration = "underline";
            span.onclick = () => {
                window.location.href = `detail.html?file=${encodeURIComponent(f.savedName)}`;
            };
            li.appendChild(span);

            // 下载按钮
            const downloadBtn = document.createElement("button");
            downloadBtn.className = "Btn";
            downloadBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" class="svgIcon">
                <path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8 224 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 306.7L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"></path>
            </svg>
            <span class="icon2"></span>
            `;
            downloadBtn.onclick = () => {
                window.open(`/uploads/${encodeURIComponent(f.savedName)}`, "_blank");
            };
            li.appendChild(downloadBtn);

            // 删除按钮（仅上传者或管理员可见）
            if(currentUser && (currentUser===f.uploader || currentRole==="admin")){
                const delBtn = document.createElement("button");
                delBtn.className = "button";
                delBtn.innerHTML = `
                <svg viewBox="0 0 448 512" class="svgIcon">
                    <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                </svg>
                `;
                delBtn.onclick = () => {
                    fetch("/delete", {
                        method:"POST",
                        headers:{"Content-Type":"application/json"},
                        body: JSON.stringify({savedName:f.savedName})
                    }).then(res=>res.json()).then(d=>{
                        if(d.success) loadFiles(); else alert(d.message);
                    });
                };
                li.appendChild(delBtn);
            }

            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.gap = "10px"; // 两个按钮之间的间距

            fileList.appendChild(li);
        });
    });
}

// ---------- 搜索框输入监听 ----------
if (searchInput) {
    searchInput.addEventListener("input", loadFiles);
}

// ---------- 页面初始状态 ----------
document.addEventListener("DOMContentLoaded", () => {
    checkLoginStatus();
    
    // 确保搜索框事件监听
    if (searchInput) {
        searchInput.addEventListener("input", loadFiles);
    }
});
