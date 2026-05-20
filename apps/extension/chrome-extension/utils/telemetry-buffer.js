// utils/telemetry-buffer.js
// Batching telemetry and error logs for Backend Scaling

window.HireMaxTelemetry = {
    buffer: [],
    maxSize: 100,
    flushTimeout: null,
    flushIntervalMs: 5000, // Flush every 5 seconds if not full

    log: function (event, level, details = {}) {
        const payload = {
            timestamp: new Date().toISOString(),
            event,
            level, // 'INFO', 'WARN', 'ERROR'
            url: window.location.href,
            details
        };

        this.buffer.push(payload);
        console.log(`[HireMax Telemetry] Cached: ${level} - ${event}`);

        if (this.buffer.length >= this.maxSize) {
            this.flush();
        } else {
            this.scheduleFlush();
        }
    },

    scheduleFlush: function () {
        if (this.flushTimeout) clearTimeout(this.flushTimeout);
        this.flushTimeout = setTimeout(() => this.flush(), this.flushIntervalMs);
    },

    flush: function () {
        if (this.buffer.length === 0) return;

        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }

        const payloadToSent = [...this.buffer];
        this.buffer = []; // Reset fast

        chrome.runtime.sendMessage({
            type: "FLUSH_TELEMETRY",
            payload: {
                events: payloadToSent
            }
        });
    }
};
