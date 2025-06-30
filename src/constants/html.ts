/**
 * HTML dashboard template for the worker web interface
 */

export const HTML_DASHBOARD = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>SWAB Worker Dashboard</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			max-width: 800px;
			margin: 0 auto;
			padding: 20px;
			background-color: #f5f5f5;
		}
		.container {
			background: white;
			padding: 30px;
			border-radius: 8px;
			box-shadow: 0 2px 10px rgba(0,0,0,0.1);
		}
		h1 {
			color: #333;
			text-align: center;
			margin-bottom: 30px;
		}
		.endpoint {
			background: #f8f9fa;
			border: 1px solid #e9ecef;
			border-radius: 6px;
			padding: 15px;
			margin-bottom: 15px;
		}
		.endpoint h3 {
			margin: 0 0 10px 0;
			color: #495057;
		}
		.endpoint p {
			margin: 5px 0;
			color: #6c757d;
		}
		.button {
			display: inline-block;
			background: #007bff;
			color: white;
			padding: 8px 16px;
			text-decoration: none;
			border-radius: 4px;
			font-size: 14px;
			margin-top: 10px;
		}
		.button:hover {
			background: #0056b3;
		}
		.status {
			text-align: center;
			margin: 20px 0;
			padding: 15px;
			background: #d4edda;
			border: 1px solid #c3e6cb;
			border-radius: 6px;
			color: #155724;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>🔔 SWAB Worker Dashboard</h1>
		
		<div class="status">
			Worker is running and monitoring notifications
		</div>

		<div class="endpoint">
			<h3>📊 /status</h3>
			<p>Check worker health and database connection</p>
			<a href="/status" class="button">Check Status</a>
		</div>

		<div class="endpoint">
			<h3>🧪 /test</h3>
			<p>Manually trigger notification check</p>
			<a href="/test" class="button">Run Test</a>
		</div>

		<div class="endpoint">
			<h3>⚡ /force-test</h3>
			<p>Force send first notification (ignores time matching)</p>
			<a href="/force-test" class="button">Force Send</a>
		</div>

		<div class="endpoint">
			<h3>💓 /heartbeat</h3>
			<p>Heartbeat check with current time info</p>
			<a href="/heartbeat" class="button">Heartbeat</a>
		</div>

		<div class="endpoint">
			<h3>🕐 /time-debug</h3>
			<p>Debug time matching logic</p>
			<a href="/time-debug" class="button">Time Debug</a>
		</div>

		<div class="endpoint">
			<h3>🔍 /debug</h3>
			<p>Comprehensive debug information</p>
			<a href="/debug" class="button">Full Debug</a>
		</div>

		<div class="endpoint">
			<h3>📝 /logs</h3>
			<p>View execution logs</p>
			<a href="/logs" class="button">View Logs</a>
		</div>

		<div class="endpoint">
			<h3>🧹 /clear-logs</h3>
			<p>Clear execution logs</p>
			<a href="/clear-logs" class="button">Clear Logs</a>
		</div>

		<div class="endpoint">
			<h3>🎯 /create-test-now</h3>
			<p>Create test notifications for current time</p>
			<a href="/create-test-now" class="button">Create Test</a>
		</div>

		<div class="endpoint">
			<h3>🗑️ /cleanup-test</h3>
			<p>Remove test notifications</p>
			<a href="/cleanup-test" class="button">Cleanup</a>
		</div>

		<div class="endpoint">
			<h3>🔥 /add-three-debug</h3>
			<p>Add three simple debug notifications</p>
			<a href="/add-three-debug" class="button">Add 3 Debug</a>
		</div>

		<div class="endpoint">
			<h3>🧹 /cleanup-debug</h3>
			<p>Remove debug notifications specifically</p>
			<a href="/cleanup-debug" class="button">Cleanup Debug</a>
		</div>
	</div>
</body>
</html>`;
