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
	<title>SWAB Worker Dashboard</title>
	<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;padding:16px 0 32px 0;background:#fff;color:#111;}
.container{padding:0 0 24px 0;}
h1{font-size:2.2em;font-weight:700;text-align:center;margin:0 0 28px 0;letter-spacing:-1px;}
.status{text-align:center;margin:18px 0 28px 0;padding:0;font-size:1.1em;font-weight:500;}
.endpoint{margin-bottom:22px;padding:0;}
.endpoint h3{margin:0 0 4px 0;font-size:1.13em;font-weight:600;letter-spacing:-0.5px;}
.endpoint p{margin:0 0 2px 0;font-size:1em;font-weight:400;letter-spacing:-0.2px;}
.button{display:inline-block;background:none;color:#111;padding:0;text-decoration:underline;font-size:1em;font-weight:500;margin-top:4px;border:none;cursor:pointer;}
.button:active{color:#444;}
</style>
</head>
<body>
	<div class="container">
		<h1>SWAB Worker Dashboard</h1>
		<div class="status">Worker is running and monitoring notifications</div>
		<div class="endpoint"><h3>/status</h3><p>Check worker health and database connection</p><a href="/status" class="button">Check Status</a></div>
		<div class="endpoint"><h3>/test</h3><p>Manually trigger notification check</p><a href="/test" class="button">Run Test</a></div>
		<div class="endpoint"><h3>/force-test</h3><p>Force send first notification (ignores time matching)</p><a href="/force-test" class="button">Force Send</a></div>
		<div class="endpoint"><h3>/heartbeat</h3><p>Heartbeat check with current time info</p><a href="/heartbeat" class="button">Heartbeat</a></div>
		<div class="endpoint"><h3>/time-debug</h3><p>Debug time matching logic</p><a href="/time-debug" class="button">Time Debug</a></div>
		<div class="endpoint"><h3>/debug</h3><p>Comprehensive debug information</p><a href="/debug" class="button">Full Debug</a></div>
		<div class="endpoint"><h3>/logs</h3><p>View execution logs</p><a href="/logs" class="button">View Logs</a></div>
		<div class="endpoint"><h3>/clear-logs</h3><p>Clear execution logs</p><a href="/clear-logs" class="button">Clear Logs</a></div>
		<div class="endpoint"><h3>/create-test-now</h3><p>Create test notifications for current time</p><a href="/create-test-now" class="button">Create Test</a></div>
		<div class="endpoint"><h3>/cleanup-test</h3><p>Remove test notifications</p><a href="/cleanup-test" class="button">Cleanup</a></div>
		<div class="endpoint"><h3>/add-three-debug</h3><p>Add three simple debug notifications</p><a href="/add-three-debug" class="button">Add 3 Debug</a></div>
		<div class="endpoint"><h3>/cleanup-debug</h3><p>Remove debug notifications specifically</p><a href="/cleanup-debug" class="button">Cleanup Debug</a></div>
	</div>
</body>
</html>`;
