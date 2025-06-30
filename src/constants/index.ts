/**
 * Consolidated constants for the Slack Weekly Notification Worker
 * All constants are exported from this single file for cleaner imports
 */

// Day mapping constants for weekly notifications
export const DAY_TO_NUMBER = {
	sunday: 0,
	monday: 1,
	tuesday: 2,
	wednesday: 3,
	thursday: 4,
	friday: 5,
	saturday: 6,
};

// Logging configuration
export const MAX_LOGS = 50;

// HTML Dashboard template
export const HTML_DASHBOARD = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Slack Weekly Notification Worker Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .header {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 2rem;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        
        .header h1 {
            color: #2c3e50;
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }
        
        .header p {
            color: #7f8c8d;
            font-size: 1.1rem;
        }
        
        .container {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 2rem;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }
        
        .card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 2rem;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        }
        
        .card h2 {
            color: #2c3e50;
            margin-bottom: 1rem;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .emoji {
            font-size: 1.8rem;
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }
        
        .status-item {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 1rem;
            border-radius: 12px;
            text-align: center;
            border: 1px solid #dee2e6;
        }
        
        .status-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #495057;
            margin-bottom: 0.25rem;
        }
        
        .status-label {
            font-size: 0.9rem;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .logs-container {
            max-height: 400px;
            overflow-y: auto;
            background: #f8f9fa;
            border-radius: 12px;
            padding: 1rem;
            border: 1px solid #dee2e6;
        }
        
        .log-entry {
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            background: white;
            border-radius: 8px;
            border-left: 4px solid #007bff;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
            line-height: 1.4;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        .log-entry:last-child {
            margin-bottom: 0;
        }
        
        .log-time {
            color: #6c757d;
            font-weight: bold;
            margin-right: 0.5rem;
        }
        
        .actions {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
            flex-wrap: wrap;
        }
        
        .btn {
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 25px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
        }
        
        .btn:hover {
            background: linear-gradient(135deg, #0056b3 0%, #004085 100%);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 123, 255, 0.4);
        }
        
        .btn-secondary {
            background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
            box-shadow: 0 4px 15px rgba(108, 117, 125, 0.3);
        }
        
        .btn-secondary:hover {
            background: linear-gradient(135deg, #495057 0%, #343a40 100%);
            box-shadow: 0 6px 20px rgba(108, 117, 125, 0.4);
        }
        
        .footer {
            text-align: center;
            padding: 2rem;
            color: rgba(255, 255, 255, 0.8);
            font-size: 0.9rem;
        }
        
        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            
            .container {
                grid-template-columns: 1fr;
                margin: 1rem auto;
                padding: 0 1rem;
            }
            
            .card {
                padding: 1.5rem;
            }
            
            .actions {
                flex-direction: column;
            }
            
            .btn {
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 Slack Weekly Notification Worker</h1>
        <p>Automated notification system dashboard</p>
    </div>
    
    <div class="container">
        <div class="card">
            <h2><span class="emoji">📊</span>System Status</h2>
            <div class="status-grid">
                <div class="status-item">
                    <div class="status-value">{{UPTIME}}</div>
                    <div class="status-label">Uptime</div>
                </div>
                <div class="status-item">
                    <div class="status-value">{{TOTAL_EXECUTIONS}}</div>
                    <div class="status-label">Total Runs</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2><span class="emoji">🔄</span>Quick Actions</h2>
            <div class="actions">
                <a href="/trigger" class="btn">
                    <span>⚡</span>
                    Trigger Check
                </a>
                <a href="/logs/clear" class="btn btn-secondary">
                    <span>🗑️</span>
                    Clear Logs
                </a>
            </div>
        </div>
    </div>
    
    <div class="container">
        <div class="card" style="grid-column: 1 / -1;">
            <h2><span class="emoji">📋</span>Execution Logs</h2>
            <div class="logs-container">
                {{LOGS}}
            </div>
        </div>
    </div>
    
    <div class="footer">
        <p>⚡ Powered by Cloudflare Workers • 🚀 Built with TypeScript</p>
    </div>
</body>
</html>`;
