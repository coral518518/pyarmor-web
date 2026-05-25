// Cloudflare Worker Script serving a high-end web interface for PyArmor Obfuscation
// Entrypoint is at the top for clarity. Scroll down to see the HTML/CSS template.

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 1. Handle CORS Preflight requests
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Max-Age": "86400",
                },
            });
        }

        // 2. Serve the Obfuscation Proxy (POST /obfuscate)
        if (url.pathname === "/obfuscate" && request.method === "POST") {
            try {
                const bodyText = await request.text();
                let code = bodyText;
                let platform = "";
                let pythonVersion = "3.11";

                // Support JSON format from the Web UI
                const contentType = request.headers.get("content-type") || "";
                if (contentType.includes("application/json")) {
                    const data = JSON.parse(bodyText);
                    code = data.code || "";
                    platform = data.platform || "";
                    pythonVersion = data.python || data.python_version || "3.11";
                } else {
                    platform = url.searchParams.get("platform") || "";
                    pythonVersion = url.searchParams.get("python") || url.searchParams.get("python_version") || "3.11";
                }

                if (!code || code.trim() === "") {
                    return new Response("Error: Python code is empty.", {
                        status: 400,
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8",
                            "Access-Control-Allow-Origin": "*",
                        },
                    });
                }

                // Get Koyeb Backend URL from Cloudflare Worker Environment Variables
                const backendBase = env.KOYEB_BACKEND_URL;
                if (!backendBase) {
                    return new Response(
                        "Worker Configuration Error: The environment variable 'KOYEB_BACKEND_URL' is missing. Please add it to your Cloudflare Worker environment settings.",
                        {
                            status: 500,
                            headers: {
                                "Content-Type": "text/plain; charset=utf-8",
                                "Access-Control-Allow-Origin": "*",
                            },
                        }
                    );
                }

                const targetUrl = new URL("/obfuscate", backendBase);
                targetUrl.searchParams.set("format", "zip");
                if (platform) {
                    targetUrl.searchParams.set("platform", platform);
                }
                if (pythonVersion) {
                    targetUrl.searchParams.set("python_version", pythonVersion);
                }

                // Fetch from Koyeb backend
                const koyebResponse = await fetch(targetUrl.toString(), {
                    method: "POST",
                    headers: {
                        "Content-Type": "text/plain",
                    },
                    body: code,
                });

                if (!koyebResponse.ok) {
                    const errorMsg = await koyebResponse.text();
                    return new Response(errorMsg, {
                        status: koyebResponse.status,
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8",
                            "Access-Control-Allow-Origin": "*",
                        },
                    });
                }

                // Forward the generated zip stream back to the client
                const zipBlob = await koyebResponse.arrayBuffer();
                return new Response(zipBlob, {
                    status: 200,
                    headers: {
                        "Content-Type": "application/zip",
                        "Content-Disposition": 'attachment; filename="obfuscated.zip"',
                        "Access-Control-Allow-Origin": "*",
                    },
                });

            } catch (err) {
                return new Response(`Worker Internal Error: ${err.message}`, {
                    status: 502,
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8",
                        "Access-Control-Allow-Origin": "*",
                    },
                });
            }
        }

        // 3. Serve Frontend Webpage on GET requests
        if (request.method === "GET") {
            return new Response(HTML_CONTENT, {
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                },
            });
        }

        return new Response("Not Found", { status: 404 });
    },
};

// ==========================================
// FRONTEND HTML, CSS & JS WEB PAGE TEMPLATE
// ==========================================
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PyArmor Online Obfuscator - 在线混淆 Python 代码</title>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #030014;
            --card-bg: rgba(15, 15, 25, 0.7);
            --border-color: rgba(255, 255, 255, 0.08);
            --text-main: #f4f4f5;
            --text-muted: #a1a1aa;
            --accent-purple: #7c3aed;
            --accent-blue: #3b82f6;
            --btn-obfuscate-grad: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
            --btn-obfuscate-hover: linear-gradient(135deg, #8b5cf6 0%, #60a5fa 100%);
            --editor-bg: rgba(20, 20, 25, 0.5);
            --danger-bg: rgba(239, 68, 68, 0.08);
            --danger-border: rgba(239, 68, 68, 0.2);
            --danger-text: #ef4444;
            --success-bg: rgba(16, 185, 129, 0.08);
            --success-border: rgba(16, 185, 129, 0.2);
            --success-text: #10b981;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', 'Inter', -apple-system, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            overflow-x: hidden;
            padding: 1rem 1.5rem;
        }

        /* Ambient floating light effects */
        .bg-glow-1 {
            position: absolute;
            top: -10%;
            left: 15%;
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, rgba(124, 58, 237, 0.18) 0%, rgba(0,0,0,0) 70%);
            filter: blur(50px);
            pointer-events: none;
            z-index: 0;
            animation: float 25s ease-in-out infinite alternate;
        }

        .bg-glow-2 {
            position: absolute;
            bottom: 5%;
            right: 10%;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(0,0,0,0) 70%);
            filter: blur(50px);
            pointer-events: none;
            z-index: 0;
            animation: float-reverse 30s ease-in-out infinite alternate;
        }

        @keyframes float {
            0% { transform: translate(0, 0) scale(1); }
            100% { transform: translate(120px, 60px) scale(1.15); }
        }

        @keyframes float-reverse {
            0% { transform: translate(0, 0) scale(1.1); }
            100% { transform: translate(-100px, -70px) scale(0.9); }
        }

        .container {
            width: 100%;
            max-width: 1000px;
            z-index: 10;
            position: relative;
        }

        /* Header Styling */
        .app-header {
            text-align: center;
            margin-bottom: 1.5rem;
        }

        .app-header .logo-container {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 70px;
            height: 70px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border-color);
            border-radius: 20px;
            margin-bottom: 1rem;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(8px);
        }

        .app-header .logo-icon {
            font-size: 2rem;
            filter: drop-shadow(0 0 10px rgba(124, 58, 237, 0.5));
        }

        .app-header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #f4f4f5 30%, #a1a1aa 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }

        .app-header p {
            font-size: 1.1rem;
            color: var(--text-muted);
            font-weight: 300;
            margin: 0 auto;
        }

        /* Main Obfuscator Layout Card */
        .main-card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 2rem;
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            margin-bottom: 2rem;
            transition: border-color 0.3s ease;
        }

        .main-card:focus-within {
            border-color: rgba(124, 58, 237, 0.3);
        }

        /* Editor Section */
        .code-section {
            width: 100%;
            margin-bottom: 2rem;
        }

        .editor-container {
            border: 1px solid var(--border-color);
            border-radius: 16px;
            overflow: hidden;
            background: rgba(10, 10, 15, 0.3);
        }

        .editor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255, 255, 255, 0.02);
            padding: 0.875rem 1.25rem;
            border-bottom: 1px solid var(--border-color);
            flex-wrap: wrap;
            gap: 0.75rem;
        }

        .editor-header h3 {
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-main);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .btn-group {
            display: flex;
            gap: 0.5rem;
        }

        /* Buttons Styling */
        button {
            font-family: 'Outfit', 'Inter', -apple-system, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
            font-size: 0.875rem;
            font-weight: 500;
            padding: 0.5rem 1rem;
            border-radius: 10px;
            border: 1px solid transparent;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.05);
            border-color: var(--border-color);
            color: var(--text-main);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }

        .btn-danger {
            background: rgba(239, 68, 68, 0.05);
            border-color: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
        }

        .btn-danger:hover {
            background: rgba(239, 68, 68, 0.2);
            border-color: rgba(239, 68, 68, 0.4);
            color: #fee2e2;
            transform: translateY(-1px);
        }

        .btn-obfuscate {
            background: var(--btn-obfuscate-grad);
            color: #ffffff;
            box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
            font-weight: 600;
        }

        .btn-obfuscate:hover {
            background: var(--btn-obfuscate-hover);
            box-shadow: 0 6px 20px rgba(124, 58, 237, 0.45);
            transform: translateY(-1.5px);
        }

        .btn-obfuscate:active {
            transform: translateY(0);
        }

        button:disabled {
            background: rgba(255, 255, 255, 0.08) !important;
            background-image: none !important;
            border-color: rgba(255, 255, 255, 0.05) !important;
            color: var(--text-muted) !important;
            cursor: not-allowed !important;
            box-shadow: none !important;
            transform: none !important;
            pointer-events: none;
        }

        /* Editor Area with Synchronized Line Numbers */
        .editor-body {
            display: flex;
            position: relative;
            height: 380px;
        }

        .line-numbers {
            width: 50px;
            background: rgba(5, 5, 10, 0.5);
            border-right: 1px solid var(--border-color);
            padding: 1.25rem 0.5rem;
            text-align: right;
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 0.85rem;
            color: #4b5563;
            user-select: none;
            overflow: hidden;
        }

        .line-numbers div {
            line-height: 22px;
            height: 22px;
        }

        textarea#inputCode {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: #f4f4f5;
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 0.85rem;
            line-height: 22px;
            padding: 1.25rem 1rem;
            resize: none;
            overflow-y: auto;
            white-space: pre;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
        }

        textarea#inputCode::-webkit-scrollbar {
            width: 8px;
        }

        textarea#inputCode::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
        }

        textarea#inputCode::-webkit-scrollbar-track {
            background: transparent;
        }

        textarea#inputCode::placeholder {
            color: #4b5563;
        }

        /* Options Panel */
        .options-section {
            margin-bottom: 2rem;
            border-top: 1px solid var(--border-color);
            padding-top: 1.5rem;
        }

        .options-section h3 {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: var(--text-main);
        }

        .options-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 1.5rem;
        }

        .option-card {
            background: rgba(255, 255, 255, 0.01);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 1.25rem;
        }

        .option-label {
            display: block;
            font-size: 0.95rem;
            font-weight: 500;
            color: var(--text-muted);
            margin-bottom: 1rem;
        }

        .platform-checkboxes {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 0.75rem;
        }

        /* Custom Checkbox Styling */
        .checkbox-container {
            display: flex;
            align-items: center;
            position: relative;
            padding-left: 1.75rem;
            cursor: pointer;
            font-size: 0.9rem;
            user-select: none;
            color: var(--text-main);
        }

        .checkbox-container input {
            position: absolute;
            opacity: 0;
            cursor: pointer;
            height: 0;
            width: 0;
        }

        .checkmark {
            position: absolute;
            top: 50%;
            left: 0;
            transform: translateY(-50%);
            height: 16px;
            width: 16px;
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            transition: all 0.2s ease;
        }

        .checkbox-container:hover input ~ .checkmark {
            border-color: rgba(124, 58, 237, 0.4);
            background-color: rgba(124, 58, 237, 0.05);
        }

        .checkbox-container input:checked ~ .checkmark {
            background-color: var(--accent-purple);
            border-color: var(--accent-purple);
        }

        .checkmark:after {
            content: "";
            position: absolute;
            display: none;
        }

        .checkbox-container input:checked ~ .checkmark:after {
            display: block;
        }

        .checkbox-container .checkmark:after {
            left: 5px;
            top: 2px;
            width: 4px;
            height: 8px;
            border: solid white;
            border-width: 0 2px 2px 0;
            transform: rotate(45deg);
        }

        .option-help {
            display: block;
            margin-top: 1rem;
            font-size: 0.8rem;
            color: #71717a;
            line-height: 1.4;
        }

        /* Radio button checkmark override */
        .radio-container {
            display: flex;
            align-items: center;
            position: relative;
            padding-left: 1.75rem;
            cursor: pointer;
            font-size: 0.9rem;
            user-select: none;
            color: var(--text-main);
        }

        .radio-container input {
            position: absolute;
            opacity: 0;
            cursor: pointer;
            height: 0;
            width: 0;
        }

        .radiomark {
            position: absolute;
            top: 50%;
            left: 0;
            transform: translateY(-50%);
            height: 16px;
            width: 16px;
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-color);
            border-radius: 50%;
            transition: all 0.2s ease;
        }

        .radio-container:hover input ~ .radiomark {
            border-color: rgba(124, 58, 237, 0.4);
            background-color: rgba(124, 58, 237, 0.05);
        }

        .radio-container input:checked ~ .radiomark {
            background-color: var(--accent-purple);
            border-color: var(--accent-purple);
        }

        .radiomark:after {
            content: "";
            position: absolute;
            display: none;
            left: 5px;
            top: 5px;
            width: 6px;
            height: 6px;
            background-color: white;
            border-radius: 50%;
        }

        .radio-container input:checked ~ .radiomark:after {
            display: block;
        }

        /* Status Panels */
        .status-panel {
            display: none;
            border-radius: 16px;
            padding: 1.5rem;
            margin-top: 1.5rem;
            border: 1px solid transparent;
            animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .status-loading {
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
            color: var(--text-muted);
            text-align: center;
            padding: 1rem 0;
        }

        .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid rgba(124, 58, 237, 0.2);
            border-top: 3px solid var(--accent-purple);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .status-success {
            display: none;
            background: var(--success-bg);
            border-color: var(--success-border);
            text-align: center;
        }

        .success-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            background: rgba(16, 185, 129, 0.1);
            color: var(--success-text);
            border-radius: 50%;
            font-size: 1.25rem;
            font-weight: bold;
            margin-bottom: 0.75rem;
            border: 1px solid var(--success-border);
        }

        .status-success h4 {
            color: var(--success-text);
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 0.25rem;
        }

        .status-success p {
            font-size: 0.9rem;
            color: var(--text-muted);
            margin-bottom: 1.25rem;
        }

        .btn-download {
            background: var(--success-text);
            color: white;
            font-weight: 600;
            padding: 0.625rem 1.5rem;
            font-size: 0.95rem;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }

        .btn-download:hover {
            background: #059669;
            transform: translateY(-1.5px);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
        }

        .status-error {
            display: none;
            background: var(--danger-bg);
            border-color: var(--danger-border);
        }

        .error-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--danger-text);
            margin-bottom: 0.75rem;
        }

        .error-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            background: rgba(239, 68, 68, 0.1);
            border-radius: 50%;
            font-size: 0.9rem;
            font-weight: bold;
            border: 1px solid var(--danger-border);
        }

        .status-error h4 {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--danger-text);
        }

        .error-log {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(239, 68, 68, 0.15);
            border-radius: 8px;
            padding: 1rem;
            color: #fca5a5;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            overflow-x: auto;
            white-space: pre-wrap;
            max-height: 250px;
        }

        /* Footer */
        footer {
            text-align: center;
            font-size: 0.85rem;
            color: #52525b;
            margin-top: 1.5rem;
        }

        footer a {
            color: #71717a;
            text-decoration: none;
            transition: color 0.2s ease;
        }

        footer a:hover {
            color: var(--text-muted);
        }

        @media (max-width: 640px) {
            body {
                padding: 1rem 0.75rem;
            }
            .app-header h1 {
                font-size: 1.8rem;
            }
            .app-header p {
                font-size: 0.95rem;
            }
            .main-card {
                padding: 1rem;
                border-radius: 16px;
            }
            .editor-header {
                flex-direction: column;
                align-items: stretch;
                gap: 0.75rem;
            }
            .btn-group {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0.5rem;
                width: 100%;
            }
            .btn-group button {
                justify-content: center;
                padding: 0.6rem 0.875rem;
            }
            #obfuscateBtn {
                grid-column: span 2;
                width: 100%;
            }
            .editor-body {
                height: 300px;
            }
            .platform-checkboxes {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="bg-glow-1"></div>
    <div class="bg-glow-2"></div>

    <div class="container">
        <!-- Header -->
        <header class="app-header">
            <div class="logo-container">
                <span class="logo-icon">&#x1F512;</span>
            </div>
            <h1>PyArmor Online Obfuscator</h1>
            <p>在线混淆您的 Python 代码并打包为 ZIP 压缩包下载，支持跨平台运行时配置</p>
        </header>

        <!-- Main Card -->
        <div class="main-card">
            <!-- Code Section -->
            <div class="code-section">
                <div class="editor-container">
                    <div class="editor-header">
                        <h3>&#x1F4DD; 原始 Python 代码</h3>
                        <div class="btn-group">
                            <button class="btn-secondary" id="loadExample">&#x1F4CB; 加载示例</button>
                            <button class="btn-danger" id="clearInput">&#x1F5D1; 清空</button>
                            <button class="btn-obfuscate" id="obfuscateBtn">&#x2728; 开始混淆</button>
                        </div>
                    </div>
                    <div class="editor-body">
                        <div class="line-numbers" id="lineNumbers"><div>1</div></div>
                        <textarea id="inputCode" placeholder="在此输入您的 Python 代码...

例如:
print(&quot;Hello, World!&quot;)

def add(a, b):
    return a + b"></textarea>
                    </div>
                </div>
            </div>
            
                        <!-- Status Panel -->
            <div class="status-panel" id="statusPanel">
                <!-- Loading State -->
                <div class="status-loading" id="statusLoading">
                    <div class="spinner"></div>
                    <p id="loadingText">正在提交到服务器，正在使用 PyArmor 混淆代码中...</p>
                </div>

                <!-- Success State -->
                <div class="status-success" id="statusSuccess">
                    <div class="success-icon">✓</div>
                    <h4>混淆打包成功!</h4>
                    <p>已成功打包混淆脚本与运行时包，解压后可直接运行。</p>
                    <button class="btn-download" id="downloadBtn">&#x1F4E5; 下载 obfuscated.zip</button>
                </div>

                <!-- Error State -->
                <div class="status-error" id="statusError">
                    <div class="error-header">
                        <div class="error-icon">✗</div>
                        <h4>混淆处理失败</h4>
                    </div>
                    <pre class="error-log" id="errorLog"></pre>
                </div>
            </div>
            
            <!-- Options Section -->
            <div class="options-section">
                <h3>&#x2699;&#xFE0F; 编译参数</h3>
                <div class="options-grid">
                    <div class="option-card">
                        <label class="option-label">目标 Python 版本 (Target Python Version)</label>
                        <div class="platform-checkboxes" style="display: flex; gap: 1rem; flex-wrap: wrap;">
                            <label class="radio-container">
                                <input type="radio" name="pythonVersion" value="3.8">
                                <span class="radiomark"></span>
                                Python 3.8
                            </label>
                            <label class="radio-container">
                                <input type="radio" name="pythonVersion" value="3.9">
                                <span class="radiomark"></span>
                                Python 3.9
                            </label>
                            <label class="radio-container">
                                <input type="radio" name="pythonVersion" value="3.10">
                                <span class="radiomark"></span>
                                Python 3.10
                            </label>
                            <label class="radio-container">
                                <input type="radio" name="pythonVersion" value="3.11" checked>
                                <span class="radiomark"></span>
                                Python 3.11
                            </label>
                            <label class="radio-container">
                                <input type="radio" name="pythonVersion" value="3.12">
                                <span class="radiomark"></span>
                                Python 3.12
                            </label>
                            <label class="radio-container">
                                <input type="radio" name="pythonVersion" value="3.13">
                                <span class="radiomark"></span>
                                Python 3.13
                            </label>
                        </div>
                        <small class="option-help">注意：混淆后的代码通常绑定到用于加密的 Python 次要版本 (Minor Version)。例如，用 Python 3.11 混淆的代码无法在 Python 3.10 或 3.13 等不同次要版本环境下直接运行。请选择目标运行环境对应的 Python 版本。</small>
                    </div>
                    <div class="option-card">
                        <label class="option-label">目标运行平台 (Target Platforms)</label>
                        <div class="platform-checkboxes">
                            <label class="checkbox-container">
                                <input type="checkbox" name="platform" value="linux.x86_64" checked>
                                <span class="checkmark"></span>
                                Linux (x86_64)
                            </label>
                            <label class="checkbox-container">
                                <input type="checkbox" name="platform" value="windows.x86_64">
                                <span class="checkmark"></span>
                                Windows (x86_64)
                            </label>
                            <label class="checkbox-container">
                                <input type="checkbox" name="platform" value="darwin.x86_64">
                                <span class="checkmark"></span>
                                macOS Intel (x86_64)
                            </label>
                            <label class="checkbox-container">
                                <input type="checkbox" name="platform" value="darwin.arm64">
                                <span class="checkmark"></span>
                                macOS Apple (arm64)
                            </label>
                        </div>
                        <small class="option-help">注意：PyArmor 8+ 生成的混淆代码执行需要依赖包含平台二进制文件的 <code>pyarmor_runtime_000000</code> 模块。如果您需要在多个操作系统运行此脚本，请勾选对应平台。</small>
                    </div>
                </div>
            </div>

        </div>

        <!-- Footer -->
        <footer>
            <p>基于 PyArmor 构建 | Powered by Cloudflare Workers</p>
        </footer>
    </div>

    <!-- Frontend logic -->
    <script>
        const textarea = document.getElementById('inputCode');
        const lineNumbers = document.getElementById('lineNumbers');
        const loadExampleBtn = document.getElementById('loadExample');
        const clearInputBtn = document.getElementById('clearInput');
        const obfuscateBtn = document.getElementById('obfuscateBtn');
        
        const statusPanel = document.getElementById('statusPanel');
        const statusLoading = document.getElementById('statusLoading');
        const statusSuccess = document.getElementById('statusSuccess');
        const statusError = document.getElementById('statusError');
        const errorLog = document.getElementById('errorLog');
        const downloadBtn = document.getElementById('downloadBtn');

        let currentZipBlob = null;

        // Synchronize line numbers
        function updateLineNumbers() {
            const lines = textarea.value.split('\\n');
            const count = lines.length;
            let html = '';
            for (let i = 1; i <= count; i++) {
                html += \`<div>\${i}</div>\`;
            }
            lineNumbers.innerHTML = html;
        }

        textarea.addEventListener('input', updateLineNumbers);
        textarea.addEventListener('scroll', () => {
            lineNumbers.scrollTop = textarea.scrollTop;
        });

        // Initialize line numbers
        updateLineNumbers();

        // Load Example Code
        loadExampleBtn.addEventListener('click', () => {
            textarea.value = \`# 示例 Python 脚本
print("hello")
\`;
            updateLineNumbers();
            hideStatusPanel();
        });

        // Clear input
        clearInputBtn.addEventListener('click', () => {
            textarea.value = '';
            updateLineNumbers();
            hideStatusPanel();
        });

        function hideStatusPanel() {
            statusPanel.style.display = 'none';
            statusLoading.style.display = 'none';
            statusSuccess.style.display = 'none';
            statusError.style.display = 'none';
            currentZipBlob = null;
        }

        // Trigger Obfuscate
        obfuscateBtn.addEventListener('click', async () => {
            const code = textarea.value.trim();
            if (!code) {
                alert('请先输入一些 Python 代码！');
                return;
            }

            // Get selected platforms
            const selectedCheckboxes = document.querySelectorAll('input[name="platform"]:checked');
            const platforms = Array.from(selectedCheckboxes).map(cb => cb.value).join(',');

            // Get selected Python version
            const selectedPythonRadio = document.querySelector('input[name="pythonVersion"]:checked');
            const pythonVersion = selectedPythonRadio ? selectedPythonRadio.value : '3.11';

            // Disable button
            obfuscateBtn.disabled = true;
            const originalBtnText = obfuscateBtn.innerHTML;
            obfuscateBtn.innerHTML = '⚡ 正在处理...';

            // Reset UI states
            statusPanel.style.display = 'block';
            statusLoading.style.display = 'flex';
            statusSuccess.style.display = 'none';
            statusError.style.display = 'none';
            currentZipBlob = null;

            try {
                // Post to CF Worker Proxy
                const response = await fetch('/obfuscate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: code,
                        platform: platforms,
                        python: pythonVersion
                    })
                });

                if (!response.ok) {
                    const errorMsg = await response.text();
                    throw new Error(errorMsg || '服务器响应异常');
                }

                // Retrieve array buffer and convert to blob
                const data = await response.arrayBuffer();
                currentZipBlob = new Blob([data], { type: 'application/zip' });

                // Update UI to success
                statusLoading.style.display = 'none';
                statusSuccess.style.display = 'block';

            } catch (err) {
                statusLoading.style.display = 'none';
                statusError.style.display = 'block';
                errorLog.textContent = err.message || '未知错误，请检查后台连接';
            } finally {
                // Start a 3-second countdown before re-enabling the button
                let countdown = 3;
                obfuscateBtn.innerHTML = '⏳ ' + countdown + ' 秒后恢复';
                
                const intervalId = setInterval(() => {
                    countdown--;
                    if (countdown > 0) {
                        obfuscateBtn.innerHTML = '⏳ ' + countdown + ' 秒后恢复';
                    } else {
                        clearInterval(intervalId);
                        obfuscateBtn.disabled = false;
                        obfuscateBtn.innerHTML = originalBtnText;
                    }
                }, 1000);
            }
        });

        // Download ZIP
        downloadBtn.addEventListener('click', () => {
            if (!currentZipBlob) return;
            const url = window.URL.createObjectURL(currentZipBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'obfuscated.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        });
    </script>
</body>
</html>`;
