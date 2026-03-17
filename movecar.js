/**
 * MoveCar 多用户智能挪车系统 - v3.0
 * 优化：30分钟断点续传 + 域名优先级二维码 + 多用户隔离 + 修复Webhook推送
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const CONFIG = {
  KV_TTL: 3600,         // 坐标等数据有效期：1 小时
  SESSION_TTL: 1800,    // 挪车会话有效期：30 分钟 (1800秒)
  RATE_LIMIT_TTL: 60    // 频率限制：60 秒
}

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname
  const userParam = url.searchParams.get('u') || 'default';
  const userKey = userParam.toLowerCase();

  // 1. 二维码生成工具
  if (path === '/qr') return renderQRPage(url.origin, userKey);
  
  // 2. 新增：个人挪车码生成引导页
  if (path === '/setup' || (path === '/' && userParam === 'default' && path !== '/setup')) {
    return renderSetupPage(url.origin);
  }

  // 3. 新增：调试信息页面
  if (path === '/debug') {
    return renderDebugPage(url.origin, userKey);
  }

  // 4. API 路由
  if (path === '/api/notify' && request.method === 'POST') return handleNotify(request, url, userKey);
  if (path === '/api/get-location') return handleGetLocation(userKey);
  if (path === '/api/owner-confirm' && request.method === 'POST') return handleOwnerConfirmAction(request, userKey);
  
  // 查询状态 API (带 Session 校验)
  if (path === '/api/check-status') {
    const s = url.searchParams.get('s');
    return handleCheckStatus(userKey, s);
  }

  // 5. 页面路由
  if (path === '/owner-confirm') return renderOwnerPage(userKey);

  // 默认进入挪车首页（只有指定了u参数时才显示）
  if (userParam !== 'default') {
    return renderMainPage(url.origin, userKey);
  } else {
    return renderSetupPage(url.origin);
  }
}

/** 新增：个人挪车码生成引导页 **/
function renderSetupPage(origin) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover">
  <title>制作个人挪车码</title>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .setup-container { 
      width: 100%; 
      max-width: 500px; 
      display: flex; 
      flex-direction: column; 
      gap: 20px; 
    }
    .setup-card { 
      background: white; 
      border-radius: 24px; 
      padding: 30px; 
      box-shadow: 0 20px 60px rgba(0,0,0,0.1);
      text-align: center;
    }
    .card-icon { 
      width: 80px; 
      height: 80px; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      border-radius: 20px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      margin: 0 auto 20px; 
      font-size: 40px; 
      color: white; 
    }
    .setup-title { 
      color: #1e293b; 
      font-size: 24px; 
      font-weight: 700; 
      margin-bottom: 8px; 
    }
    .setup-desc { 
      color: #64748b; 
      font-size: 16px; 
      line-height: 1.5; 
      margin-bottom: 25px; 
    }
    .input-group { 
      margin: 25px 0; 
    }
    .input-label { 
      display: block; 
      text-align: left; 
      color: #475569; 
      font-size: 14px; 
      font-weight: 600; 
      margin-bottom: 8px; 
    }
    .user-input { 
      width: 100%; 
      padding: 16px 20px; 
      border: 2px solid #e2e8f0; 
      border-radius: 16px; 
      font-size: 16px; 
      transition: all 0.3s ease;
      background: #f8fafc;
    }
    .user-input:focus { 
      outline: none; 
      border-color: #667eea; 
      background: white;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    .input-hint { 
      display: block; 
      text-align: left; 
      color: #94a3b8; 
      font-size: 13px; 
      margin-top: 8px; 
    }
    .primary-btn { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      border: none; 
      padding: 18px; 
      border-radius: 18px; 
      font-size: 18px; 
      font-weight: 600; 
      cursor: pointer; 
      width: 100%; 
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
    .primary-btn:hover { 
      transform: translateY(-2px); 
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    .primary-btn:active { 
      transform: translateY(0); 
    }
    .example-section { 
      background: #f8fafc; 
      border-radius: 16px; 
      padding: 20px; 
      margin-top: 20px; 
    }
    .example-title { 
      color: #475569; 
      font-size: 16px; 
      font-weight: 600; 
      margin-bottom: 12px; 
      text-align: left; 
    }
    .example-item { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      margin: 8px 0; 
      color: #64748b; 
      font-size: 14px; 
    }
    .example-badge { 
      background: #3b82f6; 
      color: white; 
      padding: 4px 10px; 
      border-radius: 20px; 
      font-size: 12px; 
      font-weight: 600; 
    }
    .qr-preview { 
      display: none; 
      margin-top: 25px; 
      animation: fadeIn 0.5s ease; 
    }
    .qr-preview.active { 
      display: block; 
    }
    .qr-img { 
      width: 200px; 
      height: 200px; 
      margin: 0 auto 20px; 
      border: 1px solid #e2e8f0; 
      border-radius: 12px; 
      padding: 10px; 
      background: white; 
    }
    .user-qr-url { 
      font-size: 12px; 
      color: #94a3b8; 
      word-break: break-all; 
      margin-top: 15px; 
      padding: 10px; 
      background: #f1f5f9; 
      border-radius: 8px; 
    }
    .action-buttons { 
      display: flex; 
      gap: 15px; 
      margin-top: 20px; 
    }
    .action-btn { 
      flex: 1; 
      padding: 15px; 
      border-radius: 16px; 
      font-size: 16px; 
      font-weight: 600; 
      text-decoration: none; 
      text-align: center; 
      cursor: pointer; 
      transition: all 0.3s ease; 
    }
    .print-btn { 
      background: #10b981; 
      color: white; 
    }
    .copy-btn { 
      background: #3b82f6; 
      color: white; 
    }
    .share-btn { 
      background: #8b5cf6; 
      color: white; 
    }
    .skip-link { 
      display: inline-block; 
      color: #64748b; 
      text-decoration: none; 
      font-size: 14px; 
      margin-top: 20px; 
    }
    .skip-link:hover { 
      color: #475569; 
      text-decoration: underline; 
    }
    @keyframes fadeIn { 
      from { opacity: 0; transform: translateY(20px); } 
      to { opacity: 1; transform: translateY(0); } 
    }
  </style>
</head>
<body>
  <div class="setup-container">
    <div class="setup-card">
      <div class="card-icon">🚗</div>
      <h1 class="setup-title">制作个人挪车码</h1>
      <p class="setup-desc">创建一个专属的挪车通知页面，其他人扫码后可以立即联系到您</p>
      
      <div class="input-group">
        <label class="input-label">设置您的唯一标识符</label>
        <input type="text" id="userIdentifier" class="user-input" placeholder="请输入您的专属ID，例如：xxxxxx">
        <span class="input-hint">建议使用英文、数字或下划线组合，区分大小写</span>
      </div>
      
      <button class="primary-btn" onclick="generateQR()">✨ 生成专属挪车码</button>
      
      <div class="qr-preview" id="qrPreview">
        <div class="qr-img" id="qrImageContainer"></div>
        
        <div class="action-buttons">
          <button class="action-btn print-btn" onclick="printQR()">🖨️ 打印二维码</button>
          <button class="action-btn copy-btn" onclick="copyLink()">📋 复制链接</button>
          <a class="action-btn share-btn" id="shareLink" href="#">🔗 访问页面</a>
        </div>
        
        <div class="user-qr-url" id="qrUrl">链接将在这里显示</div>
      </div>
      
      <div class="example-section">
        <div class="example-title">使用建议：</div>
        <div class="example-item">
          <div class="example-badge">推荐</div>
          <div>使用您的车牌号，如：<strong>豫A·12345</strong></div>
        </div>
        <div class="example-item">
          <div class="example-badge">推荐</div>
          <div>使用您的名字拼音，如：<strong>zhangsan</strong></div>
        </div>
      </div>
      
      <a href="/owner-confirm" class="skip-link">我是车主，直接进入处理页面 →</a>
    </div>
  </div>

  <script>
    const origin = "${origin}";
    
    function generateQR() {
      const userKey = document.getElementById('userIdentifier').value.trim();
      if (!userKey) {
        alert('请输入标识符');
        return;
      }
      
      // 清理用户输入，只允许字母、数字、下划线
      const cleanKey = userKey.replace(/[^a-zA-Z0-9_]/g, '');
      if (cleanKey !== userKey) {
        document.getElementById('userIdentifier').value = cleanKey;
      }
      
      const qrUrl = origin + '/?u=' + encodeURIComponent(cleanKey);
      const qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qrUrl);
      
      // 显示二维码预览
      document.getElementById('qrImageContainer').innerHTML = '<img src="' + qrImageUrl + '" alt="挪车二维码" style="width:100%; height:100%; object-fit:contain;">';
      document.getElementById('qrUrl').textContent = qrUrl;
      document.getElementById('shareLink').href = qrUrl;
      
      document.getElementById('qrPreview').classList.add('active');
    }
    
    function printQR() {
      const qrUrl = document.getElementById('qrUrl').textContent;
      if (!qrUrl || qrUrl === '链接将在这里显示') {
        alert('请先去生成二维码');
        return;
      }
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write('<!DOCTYPE html><html><head><title>打印挪车码</title><style>body { font-family: sans-serif; text-align: center; padding: 20px; }.print-card { max-width: 500px; margin: 0 auto; }.qr-img { width: 300px; height: 300px; margin: 20px auto; }.info { color: #666; font-size: 14px; margin-top: 20px; }</style></head><body><div class="print-card"><h2>您的个人挪车码</h2><div class="qr-img"><img src="https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=' + encodeURIComponent(qrUrl) + '" style="width:100%; height:100%;"></div><p>扫描此二维码可联系车主挪车</p><p class="info">' + qrUrl + '</p><p class="info">生成时间：' + new Date().toLocaleString() + '</p></div></body></html>');
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); }, 500);
    }
    
    function copyLink() {
      const qrUrl = document.getElementById('qrUrl').textContent;
      if (!qrUrl || qrUrl === '链接将在这里显示') {
        alert('请先去生成二维码');
        return;
      }
      
      navigator.clipboard.writeText(qrUrl).then(() => {
        const btn = document.querySelector('.copy-btn');
        const originalText = btn.textContent;
        btn.textContent = '✅ 已复制';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
      }).catch(() => {
        // 备用方法
        const textArea = document.createElement('textarea');
        textArea.value = qrUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('链接已复制到剪贴板');
      });
    }
    
    // 页面加载时，如果有默认示例值，自动生成预览
    document.addEventListener('DOMContentLoaded', function() {
      const defaultUserKey = document.getElementById('userIdentifier').value;
      if (defaultUserKey) {
        setTimeout(() => { generateQR(); }, 500);
      }
    });
    
    // 支持Enter键生成
    document.getElementById('userIdentifier').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        generateQR();
      }
    });
  </script>
</body>
</html>`;
  
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

/** 新增：调试信息页面 **/
function renderDebugPage(origin, userKey) {
  const webhookUrl = getUserConfig(userKey, 'WEBHOOK_URL');
  const webhookToken = getUserConfig(userKey, 'WEBHOOK_TOKEN') || '779486149';
  const ppToken = getUserConfig(userKey, 'PUSHPLUS_TOKEN');
  const barkUrl = getUserConfig(userKey, 'BARK_URL');
  const carTitle = getUserConfig(userKey, 'CAR_TITLE') || '车主';
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>系统调试信息</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
    .debug-container { max-width: 800px; margin: 0 auto; }
    .debug-card { background: white; padding: 30px; border-radius: 20px; margin: 20px 0; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    .config-item { margin: 15px 0; padding: 15px; background: #f8fafc; border-radius: 10px; border-left: 4px solid #3b82f6; }
    .status { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-left: 10px; }
    .success { background: #10b981; color: white; }
    .error { background: #ef4444; color: white; }
    .warning { background: #f59e0b; color: white; }
    .info { background: #3b82f6; color: white; }
    .btn { padding: 12px 24px; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; margin-right: 10px; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-warning { background: #f59e0b; color: white; }
    .btn-success { background: #10b981; color: white; }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .result-panel { margin-top: 20px; padding: 20px; border-radius: 10px; background: #f1f5f9; max-height: 400px; overflow-y: auto; }
    pre { background: #1e293b; color: #e2e8f0; padding: 15px; border-radius: 8px; font-size: 12px; white-space: pre-wrap; }
    h1, h2, h3 { color: #1e293b; }
    h1 { margin-bottom: 10px; }
    h2 { margin-bottom: 20px; color: #475569; }
    .test-log { font-family: monospace; font-size: 12px; margin: 5px 0; }
    .log-success { color: #10b981; }
    .log-error { color: #ef4444; }
    .log-info { color: #3b82f6; }
  </style>
</head>
<body>
  <div class="debug-container">
    <h1>🚗 挪车系统调试信息</h1>
    <p style="color: #fff; margin-bottom: 30px;">版本 v3.0 | 用户: ${userKey}</p>
    
    <div class="debug-card">
      <h2>📊 当前用户配置</h2>
      <div class="config-item">
        <strong>用户标识:</strong> ${userKey} 
        <span class="status info">${userKey === 'default' ? '默认用户' : '自定义用户'}</span>
      </div>
      <div class="config-item">
        <strong>Webhook URL:</strong> 
        ${webhookUrl ? webhookUrl : '<span class="status error">未配置</span>'}
        ${webhookUrl ? '<span class="status success">已配置</span>' : ''}
      </div>
      <div class="config-item">
        <strong>Webhook Token:</strong> 
        ${webhookToken ? '***' + webhookToken.slice(-4) : '<span class="status error">未配置</span>'}
        ${webhookToken ? '<span class="status success">已配置</span>' : ''}
      </div>
      <div class="config-item">
        <strong>PushPlus Token:</strong> 
        ${ppToken ? '***' + ppToken.slice(-4) : '<span class="status warning">未配置</span>'}
        ${ppToken ? '<span class="status success">已配置</span>' : ''}
      </div>
      <div class="config-item">
        <strong>Bark URL:</strong> 
        ${barkUrl ? barkUrl.substring(0, 30) + '...' : '<span class="status warning">未配置</span>'}
        ${barkUrl ? '<span class="status success">已配置</span>' : ''}
      </div>
      <div class="config-item">
        <strong>车主标题:</strong> ${carTitle}
      </div>
      <div class="config-item">
        <strong>基础域名:</strong> ${origin}
      </div>
    </div>
    
    <div class="debug-card">
      <h2>🔧 调试功能</h2>
      <p style="color: #64748b; margin-bottom: 20px;">点击下方按钮测试各种推送通道</p>
      
      <div>
        <button onclick="testWebhook()" class="btn btn-primary">🔌 测试Webhook推送</button>
        <button onclick="testPushPlus()" class="btn btn-success" ${!ppToken ? 'disabled style="opacity:0.5"' : ''}>📱 测试PushPlus推送</button>
        <button onclick="testBark()" class="btn btn-warning" ${!barkUrl ? 'disabled style="opacity:0.5"' : ''}>🔔 测试Bark推送</button>
        <button onclick="testAll()" class="btn btn-success">🚀 测试全部推送通道</button>
        <button onclick="showLogs()" class="btn btn-info">📋 查看推送日志</button>
      </div>
      
      <div id="testResult" class="result-panel" style="display: none;">
        <h3 style="margin-top: 0;">📄 测试结果</h3>
        <div id="resultContent"></div>
      </div>
      
      <div id="logResult" class="result-panel" style="display: none;">
        <h3 style="margin-top: 0;">📊 推送日志</h3>
        <div id="logContent"></div>
      </div>
    </div>
    
    <div class="debug-card">
      <h2>📋 使用说明</h2>
      <ol style="line-height: 1.8;">
        <li><strong>Webhook配置检查</strong>：确保在Cloudflare Workers中设置了正确的环境变量</li>
        <li><strong>调试方法</strong>：点击测试按钮，在浏览器控制台(F12)查看详细的网络请求和响应</li>
        <li><strong>常见问题</strong>：
          <ul>
            <li>Webhook未配置：检查<code>WEBHOOK_URL</code>环境变量</li>
            <li>网络问题：确认目标服务器可访问</li>
            <li>权限问题：检查Authorization头部值是否正确</li>
            <li>请求格式：确保服务器支持application/json</li>
          </ul>
        </li>
        <li><strong>环境变量格式</strong>：
          <pre style="font-size: 12px;"># Webhook推送配置 (适配WXPush)
WEBHOOK_URL = https://<您的Worker地址>/你的token
WEBHOOK_TOKEN = 你的token
# 或者使用 /wxsend 端点
# WEBHOOK_URL = https://<您的Worker地址>/wxsend
# WEBHOOK_TOKEN = 你的token

# 其他推送通道
PUSHPLUS_TOKEN = 您的PushPlus Token
BARK_URL = https://api.day.app/您的Bark密钥
CAR_TITLE = 车主姓名（全平台显示）
PHONE_NUMBER = 联系电话</pre>
        </li>
      </ol>
    </div>
  </div>

  <script>
    async function testWebhook() {
      showResultPanel('🔌 正在测试Webhook推送...', 'log-info');
      
      try {
        // 先测试手动配置
        addLog('🔧 检查Webhook配置...', 'log-info');
        const webhookUrl = "${webhookUrl}";
        const webhookToken = "${webhookToken}";
        
        if (!webhookUrl) {
          addLog('❌ 未检测到WEBHOOK_URL环境变量配置', 'log-error');
          addLog('请在Cloudflare Workers中设置WEBHOOK_URL环境变量', 'log-info');
          addLog('推荐配置: WEBHOOK_URL = https://<您的Worker地址>/你的token', 'log-info');
          return;
        }
        
        if (!webhookToken) {
          addLog('⚠️ 未检测到WEBHOOK_TOKEN环境变量，使用默认值779486149', 'log-warning');
        }
        
        addLog(\`🔧 Webhook URL: \${webhookUrl}\`, 'log-info');
        addLog(\`🔧 Webhook Token: \${webhookToken ? '***' + webhookToken.slice(-4) : '未配置'}\`, 'log-info');
        
        // 测试直接访问WXPush页面
        addLog('🔧 测试WXPush服务可访问性...', 'log-info');
        
        const testWXPush = async (testUrl, description) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(testUrl, { 
              method: 'GET',
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const contentType = response.headers.get('content-type') || '';
              if (contentType.includes('text/html')) {
                addLog(\`✅ \${description}: 可访问 (返回HTML页面)\`, 'log-success');
                return true;
              } else if (contentType.includes('application/json')) {
                addLog(\`✅ \${description}: 可访问 (返回JSON)\`, 'log-success');
                return true;
              } else {
                addLog(\`✅ \${description}: 可访问 (状态: \${response.status})\`, 'log-success');
                return true;
              }
            } else {
              addLog(\`⚠️ \${description}: 返回状态 \${response.status}\`, 'log-warning');
              return false;
            }
          } catch (error) {
            addLog(\`❌ \${description}: \${error.message}\`, 'log-error');
            return false;
          }
        };
        
        // 测试推荐的URL格式
        const recommendedUrl = 'https://<您的Worker地址>/你的token';
        const wxsendUrl = 'https://<您的Worker地址>/wxsend';
        const rootUrl = 'https://<您的Worker地址>/';
        
        addLog('🔧 测试WXPush服务状态...', 'log-info');
        await testWXPush(recommendedUrl, '推荐格式 (Token路径)');
        await testWXPush(wxsendUrl, '/wxsend端点');
        await testWXPush(rootUrl, '根路径');
        
        // 执行实际的挪车系统测试
        addLog('🚀 开始执行挪车系统Webhook测试...', 'log-info');
        
        const response = await fetch('/api/notify?u=' + "${userKey}", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: '调试测试消息 - Webhook测试',
            location: { lat: 39.9042, lng: 116.4074 },
            sessionId: 'debug_webhook_' + Date.now()
          })
        });
        
        const data = await response.json();
        if (data.success) {
          addLog('✅ Webhook推送测试成功！', 'log-success');
          addLog('响应结果: ' + JSON.stringify(data, null, 2), 'log-info');
          
          if (data.pushResults && data.pushResults.webhook) {
            addLog('✅ Webhook通道: 推送成功', 'log-success');
          } else {
            addLog('⚠️ Webhook通道: 推送失败或未启用', 'log-warning');
            addLog('可能原因:', 'log-info');
            addLog('1. Webhook URL配置错误', 'log-info');
            addLog('2. Token验证失败', 'log-info');
            addLog('3. WXPush服务内部错误', 'log-info');
            addLog('4. 请求格式不符合WXPush要求', 'log-info');
          }
        } else {
          addLog('❌ Webhook推送测试失败: ' + (data.error || '未知错误'), 'log-error');
        }
      } catch(error) {
        addLog('❌ 网络请求失败: ' + error.message, 'log-error');
        addLog('请检查:', 'log-info');
        addLog('1. 浏览器控制台是否有CORS错误', 'log-info');
        addLog('2. 网络连接是否正常', 'log-info');
        addLog('3. Cloudflare Workers是否正常运行', 'log-info');
      }
    }
    
    async function testPushPlus() {
      showResultPanel('📱 正在测试PushPlus推送...', 'log-info');
      
      try {
        const response = await fetch('/api/notify?u=' + "${userKey}", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: '调试测试消息 - PushPlus测试',
            location: { lat: 39.9042, lng: 116.4074 },
            sessionId: 'debug_pp_' + Date.now()
          })
        });
        
        const data = await response.json();
        if (data.success) {
          addLog('✅ PushPlus推送测试完成', 'log-success');
          if (data.pushResults && data.pushResults.pushplus) {
            addLog('✅ PushPlus通道: 推送成功', 'log-success');
          } else {
            addLog('⚠️ PushPlus通道: 推送失败或未启用', 'log-warning');
          }
        } else {
          addLog('❌ PushPlus推送测试失败: ' + (data.error || '未知错误'), 'log-error');
        }
      } catch(error) {
        addLog('❌ 网络请求失败: ' + error.message, 'log-error');
      }
    }
    
    async function testBark() {
      showResultPanel('🔔 正在测试Bark推送...', 'log-info');
      
      try {
        const response = await fetch('/api/notify?u=' + "${userKey}", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: '调试测试消息 - Bark测试',
            location: { lat: 39.9042, lng: 116.4074 },
            sessionId: 'debug_bark_' + Date.now()
          })
        });
        
        const data = await response.json();
        if (data.success) {
          addLog('✅ Bark推送测试完成', 'log-success');
          if (data.pushResults && data.pushResults.bark) {
            addLog('✅ Bark通道: 推送成功', 'log-success');
          } else {
            addLog('⚠️ Bark通道: 推送失败或未启用', 'log-warning');
          }
        } else {
          addLog('❌ Bark推送测试失败: ' + (data.error || '未知错误'), 'log-error');
        }
      } catch(error) {
        addLog('❌ 网络请求失败: ' + error.message, 'log-error');
      }
    }
    
    async function testAll() {
      showResultPanel('🚀 正在测试全部推送通道...', 'log-info');
      
      try {
        const response = await fetch('/api/notify?u=' + "${userKey}", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: '调试测试消息 - 全通道测试',
            location: { lat: 39.9042, lng: 116.4074 },
            sessionId: 'debug_all_' + Date.now()
          })
        });
        
        const data = await response.json();
        if (data.success) {
          addLog('✅ 全通道推送测试完成', 'log-success');
          addLog('详细结果: ' + JSON.stringify(data, null, 2), 'log-info');
          
          if (data.pushResults) {
            if (data.pushResults.webhook) {
              addLog('✅ Webhook通道: 推送成功', 'log-success');
            } else {
              addLog('⚠️ Webhook通道: 推送失败或未启用', 'log-warning');
            }
            if (data.pushResults.pushplus) {
              addLog('✅ PushPlus通道: 推送成功', 'log-success');
            } else {
              addLog('⚠️ PushPlus通道: 推送失败或未启用', 'log-warning');
            }
            if (data.pushResults.bark) {
              addLog('✅ Bark通道: 推送成功', 'log-success');
            } else {
              addLog('⚠️ Bark通道: 推送失败或未启用', 'log-warning');
            }
          }
        } else {
          addLog('❌ 全通道推送测试失败: ' + (data.error || '未知错误'), 'log-error');
        }
      } catch(error) {
        addLog('❌ 网络请求失败: ' + error.message, 'log-error');
      }
    }
    
    function showLogs() {
      const resultPanel = document.getElementById('testResult');
      const logPanel = document.getElementById('logResult');
      resultPanel.style.display = 'none';
      logPanel.style.display = 'block';
      document.getElementById('logContent').innerHTML = '<p>请在浏览器控制台(F12)查看详细的推送日志</p><p>控制台会显示每个推送通道的请求详情、响应状态和错误信息</p>';
    }
    
    function showResultPanel(message, className) {
      const resultPanel = document.getElementById('testResult');
      const logPanel = document.getElementById('logResult');
      resultPanel.style.display = 'block';
      logPanel.style.display = 'none';
      document.getElementById('resultContent').innerHTML = '';
      addLog(message, className);
    }
    
    function addLog(message, className) {
      const resultContent = document.getElementById('resultContent');
      const logElement = document.createElement('div');
      logElement.className = 'test-log ' + (className || '');
      logElement.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
      resultContent.appendChild(logElement);
      resultContent.scrollTop = resultContent.scrollHeight;
    }
    
    // 页面加载时，如果有Webhook URL，自动测试一次
    document.addEventListener('DOMContentLoaded', function() {
      const webhookUrl = "${webhookUrl}";
      if (webhookUrl && webhookUrl.trim()) {
        addLog('✅ 检测到Webhook URL配置: ' + webhookUrl.substring(0, 50) + '...', 'log-success');
      } else {
        addLog('⚠️ 未检测到Webhook URL配置，请检查环境变量', 'log-warning');
      }
    });
  </script>
</body>
</html>`;
  
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

/** 配置读取 **/
function getUserConfig(userKey, envPrefix) {
  const specificKey = envPrefix + "_" + userKey.toUpperCase();
  if (typeof globalThis[specificKey] !== 'undefined') return globalThis[specificKey];
  if (typeof globalThis[envPrefix] !== 'undefined') return globalThis[envPrefix];
  return null;
}

// 坐标转换 (WGS-84 -> GCJ-02)
function wgs84ToGcj02(lat, lng) {
  const a = 6378245.0; const ee = 0.00669342162296594323;
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return { lat, lng };
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * Math.PI;
  let magic = Math.sin(radLat); magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}
function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
  return ret;
}
function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
  return ret;
}
function generateMapUrls(lat, lng) {
  const gcj = wgs84ToGcj02(lat, lng);
  return {
    amapUrl: "https://uri.amap.com/marker?position=" + gcj.lng + "," + gcj.lat + "&name=扫码者位置",
    appleUrl: "https://maps.apple.com/?ll=" + gcj.lat + "," + gcj.lng + "&q=扫码者位置"
  };
}

/** 新增：专门处理WXPush Webhook请求的函数 - 修复版本 **/
async function sendWXPushWebhook(webhookUrl, token, data) {
  try {
    console.log(`🔌 [sendWXPushWebhook] 开始发送Webhook请求`);
    console.log(`🔌 原始Webhook URL: ${webhookUrl}`);
    console.log(`🔌 使用Token: ${token}`);
    console.log(`🔌 请求数据: ${JSON.stringify(data)}`);
    
    // 验证输入参数
    if (!webhookUrl) {
      throw new Error('Webhook URL未配置');
    }
    if (!token) {
      throw new Error('Webhook Token未配置');
    }
    
    // 尝试不同的URL格式
    const testUrls = [];
    
    // 方法1: 直接使用token路径 (推荐格式)
    try {
      const urlObj1 = new URL(webhookUrl);
      if (urlObj1.pathname === '/' || urlObj1.pathname === '' || urlObj1.pathname === '/wxsend') {
        urlObj1.pathname = `/${token}`;
        testUrls.push({
          url: urlObj1.toString(),
          headers: { "Content-Type": "application/json" },
          method: 'POST',
          description: 'Token路径格式'
        });
      }
    } catch (e) {
      console.log(`⚠️ 无法解析URL: ${webhookUrl}`);
    }
    
    // 方法2: 使用/wxsend端点 + Authorization头部
    try {
      const urlObj2 = new URL(webhookUrl);
      if (!urlObj2.pathname.endsWith('/wxsend')) {
        // 如果原始URL不是/wxsend，添加/wxsend路径
        urlObj2.pathname = '/wxsend';
      }
      testUrls.push({
        url: urlObj2.toString(),
        headers: { 
          "Content-Type": "application/json",
          "Authorization": token
        },
        method: 'POST',
        description: '/wxsend端点 + Authorization头部'
      });
    } catch (e) {
      console.log(`⚠️ 无法构造/wxsend URL: ${webhookUrl}`);
    }
    
    // 方法3: 原始URL格式
    testUrls.push({
      url: webhookUrl,
      headers: { "Content-Type": "application/json" },
      method: 'POST',
      description: '原始URL格式'
    });
    
    console.log(`🔌 将尝试以下URL格式:`, testUrls.map(t => ({ url: t.url, description: t.description })));
    
    // 按顺序尝试不同的URL格式
    let lastError = null;
    for (let i = 0; i < testUrls.length; i++) {
      const testConfig = testUrls[i];
      console.log(`🔌 尝试第${i+1}种方法: ${testConfig.description}`);
      console.log(`🔌 请求URL: ${testConfig.url}`);
      console.log(`🔌 请求头: ${JSON.stringify(testConfig.headers)}`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
        
        const response = await fetch(testConfig.url, {
          method: testConfig.method,
          headers: testConfig.headers,
          body: JSON.stringify(data),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log(`🔌 响应状态: ${response.status} ${response.statusText}`);
        
        const responseText = await response.text();
        console.log(`🔌 响应内容: ${responseText.substring(0, 500)}`);
        
        if (response.ok) {
          console.log(`✅ 第${i+1}种方法成功: ${testConfig.description}`);
          return response;
        } else {
          console.log(`⚠️ 第${i+1}种方法失败: HTTP ${response.status}`);
          lastError = new Error(`HTTP ${response.status}: ${responseText.substring(0, 200)}`);
        }
      } catch (error) {
        console.error(`❌ 第${i+1}种方法异常:`, error.message);
        lastError = error;
      }
    }
    
    // 所有方法都失败
    throw lastError || new Error('所有Webhook请求方法都失败');
    
  } catch (error) {
    console.error('❌ 发送WXPush请求失败:', error.message);
    
    // 提供更详细的错误信息
    if (error.name === 'TypeError') {
      console.error('❌ 网络连接失败，可能原因:');
      console.error('   - Webhook URL不可访问');
      console.error('   - CORS策略限制');
      console.error('   - 目标服务器无响应');
      console.error('   - DNS解析失败');
    } else if (error.name === 'AbortError') {
      console.error('❌ 请求超时，可能原因:');
      console.error('   - 服务器响应太慢');
      console.error('   - 网络连接不稳定');
    }
    
    throw error;
  }
}

/** 发送通知逻辑 - 修复Webhook推送问题 **/
async function handleNotify(request, url, userKey) {
  try {
    if (typeof MOVE_CAR_STATUS === 'undefined') throw new Error('KV 未绑定');
    const lockKey = "lock_" + userKey;
    const isLocked = await MOVE_CAR_STATUS.get(lockKey);
    if (isLocked) throw new Error('发送频率过快，请一分钟后再试');

    const body = await request.json();
    const sessionId = body.sessionId; 

    const ppToken = getUserConfig(userKey, 'PUSHPLUS_TOKEN');
    const barkUrl = getUserConfig(userKey, 'BARK_URL');
    const webhookUrl = getUserConfig(userKey, 'WEBHOOK_URL');
    const webhookToken = getUserConfig(userKey, 'WEBHOOK_TOKEN') || '你的token';
    const carTitle = getUserConfig(userKey, 'CAR_TITLE') || '车主';
    const baseDomain = (typeof globalThis.EXTERNAL_URL !== 'undefined' && globalThis.EXTERNAL_URL) ? globalThis.EXTERNAL_URL.replace(/\/$/, "") : url.origin;
    const confirmUrl = baseDomain + "/owner-confirm?u=" + userKey;

    let notifyText = "🚗 挪车请求【" + carTitle + "】\\n💬 留言: " + (body.message || '车旁有人等待');
    
    // 存储当前会话信息，有效期设为 30 分钟
    const statusData = { status: 'waiting', sessionId: sessionId };
    
    if (body.location && body.location.lat) {
      const maps = generateMapUrls(body.location.lat, body.location.lng);
      await MOVE_CAR_STATUS.put("loc_" + userKey, JSON.stringify({ ...body.location, ...maps }), { expirationTtl: CONFIG.KV_TTL });
    }

    await MOVE_CAR_STATUS.put("status_" + userKey, JSON.stringify(statusData), { expirationTtl: CONFIG.SESSION_TTL });
    await MOVE_CAR_STATUS.put(lockKey, '1', { expirationTtl: CONFIG.RATE_LIMIT_TTL });

    const tasks = [];
    const pushResults = { pushplus: false, bark: false, webhook: false };
    
    // 1. 原有的 PushPlus 推送
    if (ppToken) {
      const pushplusTask = fetch('http://www.pushplus.plus/send', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          token: ppToken, 
          title: "🚗 挪车请求：" + carTitle, 
          content: notifyText.replace(/\\n/g, '<br>') + '<br><br><a href="' + confirmUrl + '" style="font-size:18px;color:#0093E9">【点击处理】</a>', 
          template: 'html' 
        }) 
      }).then(async response => {
        const data = await response.json();
        console.log(`PushPlus响应: ${JSON.stringify(data)}`);
        if (data.code === 200) {
          pushResults.pushplus = true;
          console.log(`✅ PushPlus推送成功: ${data.msg || 'OK'}`);
        } else {
          console.error(`❌ PushPlus推送失败: ${data.msg || '未知错误'}`);
        }
        return data;
      }).catch(error => {
        console.error('❌ PushPlus推送异常:', error.message);
        return { code: 500, msg: error.message };
      });
      tasks.push(pushplusTask);
    } else {
      console.log('ℹ️ 未配置PushPlus Token，跳过推送');
    }
    
    // 2. 原有的 Bark 推送
    if (barkUrl) {
      const barkTask = fetch(barkUrl + "/" + encodeURIComponent('挪车请求') + "/" + encodeURIComponent(notifyText) + "?url=" + encodeURIComponent(confirmUrl))
        .then(async response => {
          console.log(`Bark响应状态: ${response.status} ${response.statusText}`);
          if (response.ok) {
            pushResults.bark = true;
            console.log('✅ Bark推送成功');
          } else {
            console.error(`❌ Bark推送失败: ${response.status} ${response.statusText}`);
          }
          return response;
        }).catch(error => {
          console.error('❌ Bark推送异常:', error.message);
        });
      tasks.push(barkTask);
    } else {
      console.log('ℹ️ 未配置Bark URL，跳过推送');
    }
    
    // 3. 修复的 Webhook 推送通道 - 适配WXPush
    if (webhookUrl) {
      console.log(`🔌 尝试发送Webhook到: ${webhookUrl}`);
      
      // 根据WXPush文档修复请求格式
      const webhookData = {
        title: "🚗 挪车请求：" + carTitle,
        content: notifyText.replace(/\\\\n/g, '\\n') + "\\n\\n处理链接：" + confirmUrl
      };
      
      console.log(`🔌 Webhook请求体: ${JSON.stringify(webhookData)}`);
      
      // 修复Webhook发送逻辑
      const webhookTask = sendWXPushWebhook(webhookUrl, webhookToken, webhookData)
        .then(async (response) => {
          console.log(`🔌 Webhook响应状态: ${response.status} ${response.statusText}`);
          
          try {
            const responseText = await response.text();
            console.log(`🔌 Webhook响应内容: ${responseText.substring(0, 500)}`);
            
            if (response.ok) {
              pushResults.webhook = true;
              console.log('✅ Webhook推送成功');
              
              // 尝试解析JSON响应
              try {
                const jsonData = JSON.parse(responseText);
                console.log('🔌 Webhook返回的JSON:', JSON.stringify(jsonData).substring(0, 300));
                return jsonData;
              } catch(e) {
                console.log('🔌 Webhook返回非JSON格式');
                return { text: responseText };
              }
            } else {
              console.error(`❌ Webhook推送失败: ${response.status}`);
              console.error(`❌ 响应内容: ${responseText.substring(0, 300)}`);
              return { error: `HTTP ${response.status}`, text: responseText };
            }
          } catch(e) {
            console.error('❌ 读取Webhook响应失败:', e.message);
            return { error: e.message };
          }
        }).catch(error => {
          console.error('❌ Webhook推送异常:', error.message);
          console.error('❌ 错误详情:', error.stack);
          return { error: error.message };
        });
      
      tasks.push(webhookTask);
    } else {
      console.log('⚠️ 未配置Webhook URL，跳过推送');
      console.log(`ℹ️ 检查环境变量: WEBHOOK_URL = ${getUserConfig(userKey, 'WEBHOOK_URL')}`);
    }

    // 等待所有推送完成
    console.log(`📤 开始发送 ${tasks.length} 个推送任务`);
    const results = await Promise.allSettled(tasks);
    console.log(`📥 所有推送任务完成，结果:`, results);
    
    // 统计成功数量
    const successCount = [pushResults.pushplus, pushResults.bark, pushResults.webhook].filter(Boolean).length;
    console.log(`📊 推送结果统计: ${successCount}/${tasks.length} 个推送成功`);
    
    // 返回详细的推送结果
    return new Response(JSON.stringify({ 
      success: true, 
      pushResults: pushResults,
      successCount: successCount,
      totalTasks: tasks.length,
      webhookUrl: webhookUrl || '未配置',
      message: '通知发送完成，详细结果请在控制台查看'
    }));
  } catch (e) {
    console.error('❌ handleNotify函数异常:', e.message);
    console.error('❌ 异常堆栈:', e.stack);
    return new Response(JSON.stringify({ 
      success: false, 
      error: e.message,
      stack: e.stack
    }), { status: 500 });
  }
}

async function handleCheckStatus(userKey, clientSessionId) {
  const data = await MOVE_CAR_STATUS.get("status_" + userKey);
  if (!data) return new Response(JSON.stringify({ status: 'none' }));

  const statusObj = JSON.parse(data);
  if (statusObj.sessionId !== clientSessionId) {
    return new Response(JSON.stringify({ status: 'none' }));
  }

  const ownerLoc = await MOVE_CAR_STATUS.get("owner_loc_" + userKey);
  return new Response(JSON.stringify({ 
    status: statusObj.status, 
    ownerLocation: ownerLoc ? JSON.parse(ownerLoc) : null 
  }));
}

async function handleGetLocation(userKey) {
  const data = await MOVE_CAR_STATUS.get("loc_" + userKey);
  return new Response(data || '{}');
}

async function handleOwnerConfirmAction(request, userKey) {
  const body = await request.json();
  const data = await MOVE_CAR_STATUS.get("status_" + userKey);
  if (data) {
    const statusObj = JSON.parse(data);
    statusObj.status = 'confirmed';
    if (body.location) {
      const urls = generateMapUrls(body.location.lat, body.location.lng);
      await MOVE_CAR_STATUS.put("owner_loc_" + userKey, JSON.stringify({ ...body.location, ...urls }), { expirationTtl: 600 });
    }
    // 确认后状态继续保持，直到 SESSION_TTL 到期
    await MOVE_CAR_STATUS.put("status_" + userKey, JSON.stringify(statusObj), { expirationTtl: 600 });
  }
  return new Response(JSON.stringify({ success: true }));
}

/** 功能：二维码生成工具页 **/
function renderQRPage(origin, userKey) {
  const carTitle = getUserConfig(userKey, 'CAR_TITLE') || '车主';
  let baseDomain = (typeof globalThis.EXTERNAL_URL !== 'undefined' && globalThis.EXTERNAL_URL) ? globalThis.EXTERNAL_URL.replace(/\/$/, "") : origin;
  const targetUrl = baseDomain + "/?u=" + userKey;
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>制作挪车码</title>
  <style>
    body { font-family: sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .qr-card { background: white; padding: 40px 20px; border-radius: 30px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); text-align: center; width: 90%; max-width: 380px; }
    .qr-img { width: 250px; height: 250px; margin: 25px auto; border: 1px solid #f1f5f9; padding: 8px; border-radius: 12px; }
    .btn { display: block; background: #0093E9; color: white; text-decoration: none; padding: 16px; border-radius: 16px; font-weight: bold; margin-top: 20px; }
    .url-info { font-size: 11px; color: #cbd5e1; margin-top: 15px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="qr-card">
    <h2 style="color:#1e293b">${carTitle} 的专属挪车码</h2>
    <p style="color:#64748b; font-size:14px; margin-top:8px">扫码通知，保护隐私</p>
    <img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${encodeURIComponent(targetUrl)}">
    <a href="javascript:window.print()" class="btn">🖨️ 立即打印挪车牌</a>
    <div class="url-info">${targetUrl}</div>
  </div>
</body>
</html>`;
  
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

/** 界面渲染：扫码者页 **/
function renderMainPage(origin, userKey) {
  const phone = getUserConfig(userKey, 'PHONE_NUMBER') || '';
  const carTitle = getUserConfig(userKey, 'CAR_TITLE') || '车主';
  const phoneHtml = phone ? '<a href="tel:' + phone + '" class="btn-phone">📞 拨打车主电话</a>' : '';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover">
  <title>挪车通知</title>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: linear-gradient(160deg, #0093E9 0%, #80D0C7 100%); min-height: 100vh; padding: 20px; display: flex; justify-content: center; }
    .container { width: 100%; max-width: 500px; display: flex; flex-direction: column; gap: 15px; }
    .card { background: white; border-radius: 24px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    .header { text-align: center; }
    .icon-wrap { width: 64px; height: 64px; background: #0093E9; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; font-size: 32px; color: white; }
    textarea { width: 100%; min-height: 90px; border: 1px solid #eee; border-radius: 14px; padding: 15px; font-size: 16px; outline: none; margin-top: 10px; background:#fcfcfc; resize:none; }
    .tag { display: inline-block; background: #f1f5f9; padding: 10px 16px; border-radius: 20px; font-size: 14px; margin: 5px 3px; cursor: pointer; color:#475569; }
    .btn-main { background: #0093E9; color: white; border: none; padding: 18px; border-radius: 18px; font-size: 18px; font-weight: bold; cursor: pointer; width: 100%; }
    .btn-phone { background: #ef4444; color: white; border: none; padding: 15px; border-radius: 15px; text-decoration: none; text-align: center; font-weight: bold; display: block; margin-top: 10px; }
    .hidden { display: none !important; }
    .map-links { display: flex; gap: 10px; margin-top: 15px; }
    .map-btn { flex: 1; padding: 14px; border-radius: 14px; text-align: center; text-decoration: none; color: white; font-weight: bold; }
    .amap { background: #1890ff; } .apple { background: #000; }
  </style>
</head>
<body>
  <div class="container" id="mainView">
    <div class="card header">
      <div class="icon-wrap">🚗</div>
      <h2 style="color:#1e293b">呼叫 ${carTitle}</h2>
      <p style="color:#64748b; font-size:14px; margin-top:5px">提示：车主将收到即时提醒</p>
    </div>
    <div class="card">
      <textarea id="msgInput" placeholder="请输入留言..."></textarea>
      <div style="margin-top:5px">
        <div class="tag" onclick="setTag('麻烦挪下车，谢谢')">🚧 挡路了</div>
        <div class="tag" onclick="setTag('临时停靠，请包涵')">⏱️ 临停</div>
        <div class="tag" onclick="setTag('有急事外出，速来')">🏃 急事</div>
      </div>
    </div>
    <div class="card" id="locStatus" style="font-size:13px; color:#94a3b8; text-align:center;">定位请求中...</div>
    <button id="notifyBtn" class="btn-main" onclick="sendNotify()">🔔 发送通知</button>
  </div>

  <div class="container hidden" id="successView">
    <div class="card" style="text-align:center">
      <div style="font-size:64px; margin-bottom:15px">📧</div>
      <h2 style="color:#1e293b">通知已送达</h2>
      <p style="color:#64748b">车主已收到挪车请求，请在车旁稍候</p>
    </div>
    <div id="ownerFeedback" class="card hidden" style="text-align:center; border: 2.5px solid #10b981;">
      <div style="font-size:40px">👨‍✈️</div>
      <h3 style="color:#059669">车主回复：马上到</h3>
      <div class="map-links">
        <a id="ownerAmap" href="#" class="map-btn amap">高德地图</a>
        <a id="ownerApple" href="#" class="map-btn apple">苹果地图</a>
      </div>
    </div>
    <div>
      <button class="btn-main" style="background:#f59e0b; margin-top:10px;" onclick="location.reload()">🔄 刷新状态</button>
      ${phoneHtml}
    </div>
  </div>

  <script>
    let userLoc = null;
    const userKey = "${userKey}";
    
    // 会话持久化
    let sessionId = localStorage.getItem('movecar_session_' + userKey);
    if (!sessionId) {
      sessionId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('movecar_session_' + userKey, sessionId);
    }

    window.onload = async () => {
      checkActiveSession();
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(p => {
          userLoc = { lat: p.coords.latitude, lng: p.coords.longitude };
          document.getElementById('locStatus').innerText = '📍 位置已锁定';
          document.getElementById('locStatus').style.color = '#10b981';
        }, () => {
          document.getElementById('locStatus').innerText = '📍 无法获取精确位置';
        });
      }
    };

    async function checkActiveSession() {
      try {
        const res = await fetch('/api/check-status?u=' + userKey + '&s=' + sessionId);
        const data = await res.json();
        if (data.status && data.status !== 'none') {
          showSuccess(data);
          pollStatus();
        }
      } catch(e){}
    }

    function setTag(t) { document.getElementById('msgInput').value = t; }

    async function sendNotify() {
      const btn = document.getElementById('notifyBtn');
      btn.disabled = true; btn.innerText = '正在联络车主...';
      try {
        const res = await fetch('/api/notify?u=' + userKey, {
          method: 'POST',
          body: JSON.stringify({ 
            message: document.getElementById('msgInput').value, 
            location: userLoc,
            sessionId: sessionId 
          })
        });
        const data = await res.json();
        if (data.success) {
          showSuccess(data.status === 'waiting' ? {status: 'waiting'} : data);
          pollStatus();
        } else { alert(data.error); btn.disabled = false; btn.innerText = '🔔 发送通知'; }
      } catch(e) { alert('服务暂时不可用'); btn.disabled = false; }
    }

    function showSuccess(data) {
      document.getElementById('mainView').classList.add('hidden');
      document.getElementById('successView').classList.remove('hidden');
      updateUI(data);
    }

    function updateUI(data) {
      if (data.status === 'confirmed') {
        document.getElementById('ownerFeedback').classList.remove('hidden');
        if (data.ownerLocation) {
          document.getElementById('ownerAmap').href = data.ownerLocation.amapUrl;
          document.getElementById('ownerApple').href = data.ownerLocation.appleUrl;
        }
      }
    }

    function pollStatus() {
      setInterval(async () => {
        try {
          const res = await fetch('/api/check-status?u=' + userKey + '&s=' + sessionId);
          const data = await res.json();
          updateUI(data);
        } catch(e){}
      }, 5000);
    }
  </script>
</body>
</html>`;
  
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

/** 界面渲染：车主页 **/
function renderOwnerPage(userKey) {
  const carTitle = getUserConfig(userKey, 'CAR_TITLE') || '车主';
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>挪车处理</title>
  <style>
    body { font-family: sans-serif; background: #4f46e5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin:0; padding:20px; }
    .card { background: white; padding: 35px 25px; border-radius: 30px; text-align: center; width: 100%; max-width: 400px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
    .btn { background: #10b981; color: white; border: none; width: 100%; padding: 20px; border-radius: 18px; font-size: 18px; font-weight: bold; cursor: pointer; margin-top: 20px; box-shadow: 0 5px 15px rgba(16,185,129,0.3); }
    .map-box { display: none; background: #f8fafc; padding: 20px; border-radius: 20px; margin-top: 15px; border: 1px solid #e2e8f0; }
    .map-btn { display: inline-block; padding: 12px 18px; background: #2563eb; color: white; text-decoration: none; border-radius: 12px; margin: 5px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:50px">📣</div>
    <h2 style="margin:15px 0; color:#1e293b">${carTitle}</h2>
    <p style="color:#64748b">有人正在车旁等您，请确认：</p>
    <div id="mapArea" class="map-box">
      <p style="font-size:14px; color:#2563eb; margin-bottom:12px; font-weight:bold">对方实时位置 📍</p>
      <a id="amapLink" href="#" class="map-btn">高德地图</a>
      <a id="appleLink" href="#" class="map-btn" style="background:#000">苹果地图</a>
    </div>
    <button id="confirmBtn" class="btn" onclick="confirmMove()">🚀 我已知晓，马上过去</button>
  </div>
  <script>
    const userKey = "${userKey}";
    window.onload = async () => {
      const res = await fetch('/api/get-location?u=' + userKey);
      const data = await res.json();
      if(data.amapUrl) {
        document.getElementById('mapArea').style.display = 'block';
        document.getElementById('amapLink').href = data.amapUrl;
        document.getElementById('appleLink').href = data.appleUrl;
      }
    };
    async function confirmMove() {
      const btn = document.getElementById('confirmBtn');
      btn.innerText = '已告知对方 ✓'; btn.disabled = true; btn.style.background = '#94a3b8';
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async p => {
          await fetch('/api/owner-confirm?u=' + userKey, { method: 'POST', body: JSON.stringify({ location: {lat: p.coords.latitude, lng: p.coords.longitude} }) });
        }, async () => {
          await fetch('/api/owner-confirm?u=' + userKey, { method: 'POST', body: JSON.stringify({ location: null }) });
        });
      }
    }
  </script>
</body>
</html>`;
  
  return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}
